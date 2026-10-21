import { z } from 'zod'
import { db, SCHEMA_VERSION, TABLE_NAMES, type TableName } from '@/db/db'
import {
  CalculationSchema,
  ConceptSchema,
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

export function downloadJson(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
