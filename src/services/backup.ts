import { z } from 'zod'
import { db, SCHEMA_VERSION, TABLE_NAMES, type TableName } from '@/db/db'
import {
  CalculationSchema,
  CalendarEventSchema,
  CardReviewSchema,
  CardSchema,
  ConceptSchema,
  DatasetSchema,
  ReportSchema,
  ExamPlanSchema,
  MistakeSchema,
  ExamRunSchema,
  ExerciseSchema,
  DevProblemSchema,
  FormulaSchema,
  KvSchema,
  NoteSchema,
  QuestionSchema,
  SessionSchema,
  SketchSchema,
  SubjectSchema,
  TaskSchema,
  ToolLinkSchema,
} from '@/db/models'
import { migrateConceptV2, migrateFormulaV2 } from '@/db/migrations'
import { guard } from './errors'

export const BACKUP_APP_ID = 'exodia'

const DataSchema = z.object({
  notes: z.array(NoteSchema),
  concepts: z.array(ConceptSchema),
  formulas: z.array(FormulaSchema),
  questions: z.array(QuestionSchema),
  calculations: z.array(CalculationSchema),
  tasks: z.array(TaskSchema),
  subjects: z.array(SubjectSchema),
  sessions: z.array(SessionSchema),
  sketches: z.array(SketchSchema),
  tools: z.array(ToolLinkSchema),
  kv: z.array(KvSchema),
  devProblems: z.array(DevProblemSchema).default([]),
  events: z.array(CalendarEventSchema).default([]),
  cards: z.array(CardSchema).default([]),
  reviews: z.array(CardReviewSchema).default([]),
  exercises: z.array(ExerciseSchema).default([]),
  examRuns: z.array(ExamRunSchema).default([]),
  datasets: z.array(DatasetSchema).default([]),
  reports: z.array(ReportSchema).default([]),
  examPlans: z.array(ExamPlanSchema).default([]),
  mistakes: z.array(MistakeSchema).default([]),
})

export const BackupSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  data: DataSchema,
})
export type Backup = z.infer<typeof BackupSchema>

export async function exportData(): Promise<Backup> {
  return guard('No se pudieron exportar los datos', async () => {
    const entries = await Promise.all(TABLE_NAMES.map(async (t) => [t, await db.table(t).toArray()] as const))
    return {
      app: BACKUP_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: Object.fromEntries(entries) as Backup['data'],
    }
  })
}

export type ParseResult = { ok: true; backup: Backup; counts: Record<TableName, number> } | { ok: false; error: string }

/** Migra exportaciones de versiones anteriores del esquema al formato actual. */
function migrateBackup(raw: unknown): unknown {
  const b = raw as { schemaVersion: number; data?: { formulas?: unknown; concepts?: unknown } }
  if (b.schemaVersion < 2 && b.data) {
    type Rec = { id: string }
    const map = (xs: unknown, fn: (x: Rec) => Rec) => (Array.isArray(xs) ? xs.map((x) => (x && typeof x === 'object' ? fn(x as Rec) : x)) : xs)
    b.data = {
      ...b.data,
      formulas: map(b.data.formulas, (f) => migrateFormulaV2(f)),
      concepts: map(b.data.concepts, (c) => migrateConceptV2(c)),
    }
    b.schemaVersion = 2
  }
  // v3 solo agrega la tabla devProblems, que el esquema completa con [] si falta.
  if (b.schemaVersion < 3) b.schemaVersion = 3
  // v4 agrega events; el esquema completa con [] si falta.
  if (b.schemaVersion < 4) b.schemaVersion = 4
  // v5 agrega cards; el esquema completa con [] si falta.
  if (b.schemaVersion < 5) b.schemaVersion = 5
  // v6 agrega reviews; el esquema completa con [] si falta.
  if (b.schemaVersion < 6) b.schemaVersion = 6
  if (b.schemaVersion < 7) b.schemaVersion = 7
  // v8 agrega datasets; el esquema completa con [] si falta.
  if (b.schemaVersion < 8) b.schemaVersion = 8
  // v9 agrega reports; el esquema completa con [] si falta.
  if (b.schemaVersion < 9) b.schemaVersion = 9
  if (b.schemaVersion < 10) b.schemaVersion = 10
  if (b.schemaVersion < 11) b.schemaVersion = 11
  return b
}

export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'El archivo no es JSON válido.' }
  }
  const header = z.object({ app: z.string(), schemaVersion: z.number() }).safeParse(raw)
  if (!header.success || header.data.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'El archivo no es una exportación de EXODIA.' }
  }
  if (header.data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `La exportación usa el esquema v${header.data.schemaVersion}, más nuevo que el de esta versión (v${SCHEMA_VERSION}).` }
  }
  const parsed = BackupSchema.safeParse(migrateBackup(raw))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: `Datos inválidos en ${issue?.path.join('.') || 'raíz'}: ${issue?.message ?? ''}` }
  }
  const counts = Object.fromEntries(TABLE_NAMES.map((t) => [t, parsed.data.data[t].length])) as Record<TableName, number>
  return { ok: true, backup: parsed.data, counts }
}

export type ImportMode = 'replace' | 'merge'

/**
 * replace: borra todo y carga la exportación.
 * merge: agrega registros nuevos y sobrescribe los que tienen el mismo id.
 * Se ejecuta en una única transacción: si algo falla, no se modifica nada.
 */
export function importData(backup: Backup, mode: ImportMode): Promise<void> {
  return guard('No se pudieron importar los datos', () =>
    db.transaction('rw', TABLE_NAMES.map((t) => db.table(t)), async () => {
      for (const t of TABLE_NAMES) {
        const table = db.table(t)
        if (mode === 'replace') await table.clear()
        const rows = backup.data[t] as unknown[]
        if (rows.length) await table.bulkPut(rows)
      }
    }),
  )
}

export function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadJson(obj: unknown, filename: string): void {
  downloadFile(JSON.stringify(obj, null, 2), filename, 'application/json')
}
