import { db, SCHEMA_VERSION, TABLE_NAMES } from '@/db/db'
import type { Database, Json } from '@/lib/database.types'
import type {
  Calculation,
  Concept,
  DevProblem,
  FocusSession,
  Formula,
  FormulaVariable,
  KvEntry,
  Note,
  Priority,
  Question,
  Sketch,
  Stroke,
  Subject,
  Task,
  ToolLink,
} from '@/db/models'
import { supabase } from '@/lib/supabase'
import type { Backup } from './backup'
import { exportData, importData } from './backup'
import { guard, StorageError } from './errors'

export const SYNC_USER_KEY = 'sync.lastUserId'
type Tables = Database['public']['Tables']
type Row<T extends keyof Tables> = Tables[T]['Row']

const CHUNK = 200
const iso = (ms: number) => new Date(ms).toISOString()
const isoOpt = (ms?: number | null) => (ms == null ? null : iso(ms))

export function mapLocalToRemote(data: Backup['data'], userId: string) {
  const subjects = new Set(data.subjects.map((s) => s.id))
  const concepts = new Set(data.concepts.map((c) => c.id))
  const notes = new Set(data.notes.map((n) => n.id))
  const tasks = new Set(data.tasks.map((t) => t.id))
  const fk = (id: string | null | undefined, known: Set<string>) => (id && known.has(id) ? id : null)

  return {
    subjects: data.subjects.map((s) => ({
      id: s.id,
      user_id: userId,
      name: s.name,
      period: s.period,
      objectives: s.objectives,
      notes: s.notes,
      archived: s.archived,
      seed: !!s.seed,
      created_at: iso(s.createdAt),
      updated_at: iso(s.updatedAt),
    })),
    concepts: data.concepts.map((c) => ({
      id: c.id,
      user_id: userId,
      title: c.title,
      discipline: c.discipline,
      tags: c.tags,
      summary: c.summary,
      explanation: c.explanation,
      formalism: c.formalism,
      examples: c.examples,
      observations: c.observations,
      related_ids: c.relatedIds,
      favorite: c.favorite,
      seed: !!c.seed,
      created_at: iso(c.createdAt),
      updated_at: iso(c.updatedAt),
      last_viewed_at: isoOpt(c.lastViewedAt),
    })),
    formulas: data.formulas.map((f) => ({
      id: f.id,
      user_id: userId,
      name: f.name,
      latex: f.latex,
      description: f.description,
      variables: f.variables as Json,
      result_unit: f.resultUnit,
      example: f.example,
      discipline: f.discipline,
      tags: f.tags,
      concept_ids: f.conceptIds,
      eval_expression: f.evalExpression,
      eval_target: f.evalTarget,
      tool_path: f.toolPath || null,
      seed: !!f.seed,
      created_at: iso(f.createdAt),
      updated_at: iso(f.updatedAt),
    })),
    notes: data.notes.map((n) => ({
      id: n.id,
      user_id: userId,
      title: n.title,
      content: n.content,
      tags: n.tags,
      favorite: n.favorite,
      concept_ids: n.conceptIds,
      formula_ids: n.formulaIds,
      calculation_ids: n.calculationIds,
      subject_id: fk(n.subjectId, subjects),
      created_at: iso(n.createdAt),
      updated_at: iso(n.updatedAt),
    })),
    questions: data.questions.map((q) => ({
      id: q.id,
      user_id: userId,
      text: q.text,
      resolved: q.resolved,
      answer: q.answer,
      concept_id: fk(q.conceptId, concepts),
      note_id: fk(q.noteId, notes),
      created_at: iso(q.createdAt),
      resolved_at: isoOpt(q.resolvedAt),
    })),
    calculations: data.calculations.map((c) => ({
      id: c.id,
      user_id: userId,
      kind: c.kind,
      input: c.input,
      result: c.result,
      created_at: iso(c.createdAt),
    })),
    tasks: data.tasks.map((t) => ({
      id: t.id,
      user_id: userId,
      title: t.title,
      details: t.details,
      priority: t.priority,
      subject_id: fk(t.subjectId, subjects),
      project: t.project,
      done: t.done,
      due_date: t.dueDate ?? null,
      created_at: iso(t.createdAt),
      completed_at: isoOpt(t.completedAt),
    })),
    sessions: data.sessions.map((s) => ({
      id: s.id,
      user_id: userId,
      phase: s.phase,
      started_at: iso(s.startedAt),
      ended_at: iso(s.endedAt),
      duration_ms: s.durationMs,
      task_id: fk(s.taskId, tasks),
      subject_id: fk(s.subjectId, subjects),
    })),
    sketches: data.sketches.map((s) => ({
      id: s.id,
      user_id: userId,
      title: s.title,
      strokes: s.strokes as Json,
      background: s.background,
      created_at: iso(s.createdAt),
      updated_at: iso(s.updatedAt),
    })),
    tools: data.tools.map((t) => ({
      id: t.id,
      user_id: userId,
      name: t.name,
      url: t.url,
      description: t.description,
      sort_order: t.order,
      seed: !!t.seed,
    })),
    kv: data.kv.map((k) => ({ key: k.key, user_id: userId, value: k.value as Json })),
    dev_problems: data.devProblems.map((p) => ({
      id: p.id,
      user_id: userId,
      title: p.title,
      text: p.text,
      kind: p.kind,
      strategy: p.strategy,
      lang: p.lang,
      mode: p.mode,
      stage: p.stage,
      revealed: p.revealed,
      created_at: iso(p.createdAt),
      updated_at: iso(p.updatedAt),
    })),
  }
}

const ORDER = [
  'subjects',
  'concepts',
  'formulas',
  'notes',
  'questions',
  'calculations',
  'tasks',
  'sessions',
  'sketches',
  'tools',
  'kv',
  'dev_problems',
] as const

async function upsert<T extends (typeof ORDER)[number]>(
  table: T,
  rows: ReturnType<typeof mapLocalToRemote>[T],
) {
  if (!supabase) throw new StorageError('Supabase no está configurado. Reiniciá el servidor de desarrollo.')
  const conflict = table === 'kv' ? 'user_id,key' : 'id'
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await supabase.from(table).upsert(chunk as never, { onConflict: conflict })
    if (error) throw new StorageError(`No se pudo subir ${table}: ${error.message}`, error)
  }
}

export async function pushLocalToSupabase(): Promise<Record<(typeof ORDER)[number], number>> {
  return guard('No se pudo subir a Supabase', async () => {
    const uid = await currentUserId()
    const data = (await exportData()).data
    data.kv = data.kv.filter((k) => k.key !== SYNC_USER_KEY)
    const remote = mapLocalToRemote(data, uid)
    for (const table of ORDER) await upsert(table, remote[table])
    await db.kv.put({ key: SYNC_USER_KEY, value: uid })
    setConflict(false)
    return Object.fromEntries(ORDER.map((t) => [t, remote[t].length])) as Record<(typeof ORDER)[number], number>
  })
}

const ms = (v: string | null | undefined) => (v ? Date.parse(v) : 0)
const strs = (v: string[]) => v ?? []

function variables(v: Json): FormulaVariable[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const o = item as Record<string, Json | undefined>
    const symbol = typeof o.symbol === 'string' ? o.symbol : ''
    if (!symbol) return []
    return [{ symbol, meaning: typeof o.meaning === 'string' ? o.meaning : '', unit: typeof o.unit === 'string' ? o.unit : '' }]
  })
}

function strokes(v: Json): Stroke[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const o = item as Record<string, Json | undefined>
    if (o.tool !== 'pen' && o.tool !== 'eraser') return []
    const points = Array.isArray(o.points) ? o.points.filter((n): n is number => typeof n === 'number') : []
    return [{ tool: o.tool, color: typeof o.color === 'string' ? o.color : '#fff', size: typeof o.size === 'number' ? o.size : 2, points }]
  })
}

const priority = (v: string): Priority => (v === 'low' || v === 'high' || v === 'medium' ? v : 'medium')

/** true si la fila remota es estrictamente más nueva. Empate o sin marca: se queda la local. */
export function takeRemote(localStamp: number | null, remoteStamp: number | null): boolean {
  if (localStamp == null) return true
  if (remoteStamp == null) return false
  return remoteStamp > localStamp
}

export function mapRemoteToLocal(rows: {
  subjects: Row<'subjects'>[]
  concepts: Row<'concepts'>[]
  formulas: Row<'formulas'>[]
  notes: Row<'notes'>[]
  questions: Row<'questions'>[]
  calculations: Row<'calculations'>[]
  tasks: Row<'tasks'>[]
  sessions: Row<'sessions'>[]
  sketches: Row<'sketches'>[]
  tools: Row<'tools'>[]
  kv: Row<'kv'>[]
  dev_problems: Row<'dev_problems'>[]
}): Backup['data'] {
  return {
    subjects: rows.subjects.map((s) => ({
      id: s.id, name: s.name, period: s.period, objectives: s.objectives, notes: s.notes, archived: s.archived, seed: s.seed, createdAt: ms(s.created_at), updatedAt: ms(s.updated_at),
    })),
    concepts: rows.concepts.map((c) => ({
      id: c.id, title: c.title, discipline: c.discipline, tags: strs(c.tags), summary: c.summary, explanation: c.explanation, formalism: c.formalism, examples: c.examples, observations: c.observations, relatedIds: strs(c.related_ids), favorite: c.favorite, seed: c.seed, createdAt: ms(c.created_at), updatedAt: ms(c.updated_at), lastViewedAt: c.last_viewed_at ? ms(c.last_viewed_at) : null,
    })),
    formulas: rows.formulas.map((f) => ({
      id: f.id, name: f.name, latex: f.latex, description: f.description, variables: variables(f.variables), resultUnit: f.result_unit, example: f.example, discipline: f.discipline, tags: strs(f.tags), conceptIds: strs(f.concept_ids), evalExpression: f.eval_expression, evalTarget: f.eval_target, ...(f.tool_path ? { toolPath: f.tool_path } : {}), seed: f.seed, createdAt: ms(f.created_at), updatedAt: ms(f.updated_at),
    })),
    notes: rows.notes.map((n) => ({
      id: n.id, title: n.title, content: n.content, tags: strs(n.tags), favorite: n.favorite, conceptIds: strs(n.concept_ids), formulaIds: strs(n.formula_ids), calculationIds: strs(n.calculation_ids), subjectId: n.subject_id, createdAt: ms(n.created_at), updatedAt: ms(n.updated_at),
    })),
    questions: rows.questions.map((q) => ({
      id: q.id, text: q.text, resolved: q.resolved, answer: q.answer, conceptId: q.concept_id, noteId: q.note_id, createdAt: ms(q.created_at), resolvedAt: q.resolved_at ? ms(q.resolved_at) : null,
    })),
    calculations: rows.calculations.map((c) => ({ id: c.id, kind: c.kind, input: c.input, result: c.result, createdAt: ms(c.created_at) })),
    tasks: rows.tasks.map((t) => ({
      id: t.id, title: t.title, details: t.details, priority: priority(t.priority), subjectId: t.subject_id, project: t.project, done: t.done, dueDate: t.due_date, createdAt: ms(t.created_at), completedAt: t.completed_at ? ms(t.completed_at) : null,
    })),
    sessions: rows.sessions.flatMap((s) => (s.phase === 'work' || s.phase === 'short' || s.phase === 'long' ? [{
      id: s.id, phase: s.phase, startedAt: ms(s.started_at), endedAt: ms(s.ended_at), durationMs: s.duration_ms, taskId: s.task_id, subjectId: s.subject_id,
    }] : [])),
    sketches: rows.sketches.map((s) => ({ id: s.id, title: s.title, strokes: strokes(s.strokes), background: s.background, createdAt: ms(s.created_at), updatedAt: ms(s.updated_at) })),
    tools: rows.tools.map((t) => ({ id: t.id, name: t.name, url: t.url, description: t.description, order: t.sort_order, seed: t.seed })),
    kv: rows.kv.filter((k) => k.key !== SYNC_USER_KEY).map((k) => ({ key: k.key, value: k.value })),
    devProblems: rows.dev_problems.map((p) => ({
      id: p.id, title: p.title, text: p.text, kind: p.kind, strategy: p.strategy, lang: p.lang, mode: p.mode === 'consult' ? 'consult' as const : 'guided' as const, stage: p.stage, revealed: p.revealed, createdAt: ms(p.created_at), updatedAt: ms(p.updated_at),
    })),
  }
}

const stampOf = {
  subjects: (r: Subject) => r.updatedAt,
  concepts: (r: Concept) => r.updatedAt,
  formulas: (r: Formula) => r.updatedAt,
  notes: (r: Note) => r.updatedAt,
  questions: (r: Question) => r.createdAt,
  calculations: (r: Calculation) => r.createdAt,
  tasks: (r: Task) => r.createdAt,
  sessions: (r: FocusSession) => r.endedAt,
  sketches: (r: Sketch) => r.updatedAt,
  tools: (_r: ToolLink) => 0,
  kv: (_r: KvEntry) => 0,
  devProblems: (r: DevProblem) => r.updatedAt,
} as const

async function currentUserId(): Promise<string> {
  if (!supabase) throw new StorageError('Supabase no está configurado. Reiniciá el servidor de desarrollo.')
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new StorageError('Tenés que entrar con tu cuenta antes de sincronizar.')
  return data.user.id
}

async function fetchRemote(): Promise<Backup['data']> {
  if (!supabase) throw new StorageError('Supabase no está configurado. Reiniciá el servidor de desarrollo.')
  const load = async <T extends (typeof ORDER)[number]>(table: T) => {
    const { data, error } = await supabase!.from(table).select('*')
    if (error) throw new StorageError(`No se pudo leer ${table}: ${error.message}`, error)
    return data ?? []
  }
  const [subjects, concepts, formulas, notes, questions, calculations, tasks, sessions, sketches, tools, kv, dev_problems] = await Promise.all([
    load('subjects'), load('concepts'), load('formulas'), load('notes'), load('questions'), load('calculations'), load('tasks'), load('sessions'), load('sketches'), load('tools'), load('kv'), load('dev_problems'),
  ])
  return mapRemoteToLocal({ subjects, concepts, formulas, notes, questions, calculations, tasks, sessions, sketches, tools, kv, dev_problems })
}

async function hasPersonalData(): Promise<boolean> {
  const counts = await Promise.all([
    db.notes.count(), db.questions.count(), db.calculations.count(), db.tasks.count(), db.sessions.count(), db.sketches.count(), db.devProblems.count(),
  ])
  if (counts.some((n) => n > 0)) return true
  const [concepts, formulas, subjects, tools, kv] = await Promise.all([
    db.concepts.filter((c) => !c.seed).count(),
    db.formulas.filter((f) => !f.seed).count(),
    db.subjects.filter((s) => !s.seed).count(),
    db.tools.filter((t) => !t.seed).count(),
    db.kv.filter((k) => k.key !== SYNC_USER_KEY).count(),
  ])
  return concepts + formulas + subjects + tools + kv > 0
}

export type PullMode = 'merge' | 'remote-wins'

export function mergeRows<T extends { id?: string; key?: string }>(local: T[], remote: T[], stamp: (r: T) => number, mode: PullMode): T[] {
  const id = (r: T) => r.id ?? r.key ?? ''
  if (mode === 'remote-wins') {
    const byId = new Map(remote.map((r) => [id(r), r]))
    const known = new Set(local.map(id))
    return local.map((row) => byId.get(id(row)) ?? row).concat(remote.filter((r) => !known.has(id(r))))
  }
  const locals = new Map(local.map((r) => [id(r), r]))
  const merged = local.slice()
  for (const row of remote) {
    const prev = locals.get(id(row))
    if (!prev) {
      merged.push(row)
      continue
    }
    if (takeRemote(stamp(prev), stamp(row))) {
      const i = merged.findIndex((m) => id(m) === id(row))
      if (i >= 0) merged[i] = row
    }
  }
  return merged
}

export async function pullRemoteToLocal(mode: PullMode = 'merge'): Promise<number> {
  return guard('No se pudo bajar la nube', async () => {
    const uid = await currentUserId()
    const remote = await fetchRemote()
    const local = (await exportData()).data
    const next: Backup['data'] = {
      subjects: mergeRows(local.subjects, remote.subjects, stampOf.subjects, mode),
      concepts: mergeRows(local.concepts, remote.concepts, stampOf.concepts, mode),
      formulas: mergeRows(local.formulas, remote.formulas, stampOf.formulas, mode),
      notes: mergeRows(local.notes, remote.notes, stampOf.notes, mode),
      questions: mergeRows(local.questions, remote.questions, stampOf.questions, mode),
      calculations: mergeRows(local.calculations, remote.calculations, stampOf.calculations, mode),
      tasks: mergeRows(local.tasks, remote.tasks, stampOf.tasks, mode),
      sessions: mergeRows(local.sessions, remote.sessions, stampOf.sessions, mode),
      sketches: mergeRows(local.sketches, remote.sketches, stampOf.sketches, mode),
      tools: mergeRows(local.tools, remote.tools, stampOf.tools, mode),
      kv: mergeRows(local.kv, remote.kv, stampOf.kv, mode).filter((k) => k.key !== SYNC_USER_KEY).concat([{ key: SYNC_USER_KEY, value: uid }]),
      devProblems: mergeRows(local.devProblems, remote.devProblems, stampOf.devProblems, mode),
    }
    await importData({ app: 'exodia', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: next }, 'replace')
    setConflict(false)
    return TABLE_NAMES.reduce((n, t) => n + remote[t].length, 0)
  })
}

/** Reemplaza el dispositivo con la copia de la cuenta actual. No mezcla dos cuentas. */
export async function replaceLocalWithRemote(): Promise<number> {
  return guard('No se pudo reemplazar con la nube', async () => {
    const uid = await currentUserId()
    const remote = await fetchRemote()
    const total = TABLE_NAMES.reduce((n, t) => n + remote[t].length, 0)
    if (total === 0) throw new StorageError('La nube de esta cuenta está vacía. No se borraron los datos de este dispositivo.')
    remote.kv = remote.kv.filter((k) => k.key !== SYNC_USER_KEY).concat([{ key: SYNC_USER_KEY, value: uid }])
    await importData({ app: 'exodia', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: remote }, 'replace')
    setConflict(false)
    return total
  })
}

let conflict = false
const conflictListeners = new Set<() => void>()
export function subscribeConflict(l: () => void): () => void {
  conflictListeners.add(l)
  return () => conflictListeners.delete(l)
}
export function readConflict(): boolean {
  return conflict
}
function setConflict(v: boolean): void {
  if (conflict === v) return
  conflict = v
  conflictListeners.forEach((l) => l())
}

export type ReconcileResult = 'pulled' | 'same' | 'conflict' | 'skipped'
let reconcileFlight: Promise<ReconcileResult> | null = null

export function reconcileSession(uid: string): Promise<ReconcileResult> {
  if (reconcileFlight) return reconcileFlight
  reconcileFlight = runReconcile(uid).finally(() => {
    reconcileFlight = null
  })
  return reconcileFlight
}

async function runReconcile(uid: string): Promise<ReconcileResult> {
  if (!supabase) return 'skipped'
  await db.open()
  const marker = await db.kv.get(SYNC_USER_KEY)
  const markerId = typeof marker?.value === 'string' ? marker.value : null
  const personal = await hasPersonalData()
  if (markerId && markerId !== uid && personal) {
    setConflict(true)
    return 'conflict'
  }
  setConflict(false)
  if (!personal) {
    await pullRemoteToLocal('remote-wins')
    return 'pulled'
  }
  if (!markerId) await db.kv.put({ key: SYNC_USER_KEY, value: uid })
  return 'same'
}
