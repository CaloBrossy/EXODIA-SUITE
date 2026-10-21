import { db } from '@/db/db'
import { type Priority, type Subject, type Task } from '@/db/models'
import {
  complete,
  DEFAULT_CONFIG,
  initialState,
  isExpired,
  type CompletedSession,
  type PomodoroConfig,
  type TimerState,
} from '@/lib/pomodoro'
import { uid } from '@/lib/text'
import { guard } from './errors'

// ---------- Tareas ----------

export type TaskInput = Pick<Task, 'title' | 'details' | 'priority' | 'subjectId' | 'project' | 'dueDate'>

export function createTask(input: TaskInput): Promise<Task> {
  return guard('No se pudo crear la tarea', async () => {
    if (!input.title.trim()) throw new Error('La tarea necesita un título')
    const t: Task = { ...input, title: input.title.trim(), id: uid(), done: false, createdAt: Date.now(), completedAt: null }
    await db.tasks.add(t)
    return t
  })
}

export const updateTask = (id: string, changes: Partial<TaskInput>) =>
  guard('No se pudo actualizar la tarea', () => db.tasks.update(id, changes))

export const setTaskDone = (t: Task, done: boolean) =>
  guard('No se pudo actualizar la tarea', () => db.tasks.update(t.id, { done, completedAt: done ? Date.now() : null }))

export const deleteTask = (id: string) => guard('No se pudo eliminar la tarea', () => db.tasks.delete(id))

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
      b.createdAt - a.createdAt,
  )
}

// ---------- Materias ----------

/** Orden alfabético según el idioma (IndexedDB ordena por código, dejando "Álgebra" al final). */
export const listSubjects = async (): Promise<Subject[]> =>
  (await db.subjects.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'es'))

export type SubjectInput = Pick<Subject, 'name' | 'period' | 'objectives' | 'notes' | 'archived'>

export function saveSubject(input: SubjectInput, id?: string): Promise<string> {
  return guard('No se pudo guardar la materia', async () => {
    if (!input.name.trim()) throw new Error('La materia necesita un nombre')
    const now = Date.now()
    if (id) {
      await db.subjects.update(id, { ...input, name: input.name.trim(), updatedAt: now })
      return id
    }
    const s: Subject = { ...input, name: input.name.trim(), id: uid(), createdAt: now, updatedAt: now }
    await db.subjects.add(s)
    return s.id
  })
}

export function deleteSubject(id: string): Promise<void> {
  return guard('No se pudo eliminar la materia', () =>
    db.transaction('rw', [db.subjects, db.tasks, db.notes, db.sessions], async () => {
      await db.tasks.where('subjectId').equals(id).modify({ subjectId: null })
      await db.notes.where('subjectId').equals(id).modify({ subjectId: null })
      await db.sessions.where('subjectId').equals(id).modify({ subjectId: null })
      await db.subjects.delete(id)
    }),
  )
}

// ---------- Pomodoro ----------

const TIMER_KEY = 'pomodoro.state'
const CONFIG_KEY = 'pomodoro.config'

export async function loadConfig(): Promise<PomodoroConfig> {
  const row = await db.kv.get(CONFIG_KEY)
  return { ...DEFAULT_CONFIG, ...((row?.value as Partial<PomodoroConfig>) ?? {}) }
}

export function validateConfig(c: PomodoroConfig): string | null {
  const ok = (v: number, max: number) => Number.isFinite(v) && v > 0 && v <= max
  if (!ok(c.workMin, 240) || !ok(c.shortMin, 120) || !ok(c.longMin, 240)) return 'Las duraciones deben estar entre 0 y 240 minutos'
  if (!Number.isInteger(c.longEvery) || c.longEvery < 1 || c.longEvery > 12) return 'El descanso largo debe ocurrir cada 1 a 12 sesiones'
  return null
}

export const saveConfig = (c: PomodoroConfig) =>
  guard('No se pudo guardar la configuración', async () => {
    const err = validateConfig(c)
    if (err) throw new Error(err)
    await db.kv.put({ key: CONFIG_KEY, value: c })
  })

export async function loadTimer(): Promise<TimerState> {
  const row = await db.kv.get(TIMER_KEY)
  return (row?.value as TimerState | undefined) ?? initialState(await loadConfig())
}

export const saveTimer = (s: TimerState) =>
  guard('No se pudo guardar el temporizador', () => db.kv.put({ key: TIMER_KEY, value: s }))

/** Aplica una transición leyendo el estado persistido dentro de una transacción. */
export function updateTimer(fn: (s: TimerState, cfg: PomodoroConfig) => TimerState): Promise<TimerState> {
  return guard('No se pudo actualizar el temporizador', () =>
    db.transaction('rw', db.kv, async () => {
      const [s, cfg] = await Promise.all([loadTimer(), loadConfig()])
      const next = fn(s, cfg)
      await db.kv.put({ key: TIMER_KEY, value: next })
      return next
    }),
  )
}

/**
 * Si la fase en curso venció, la registra (una sola vez por runId, aunque haya varias
 * pestañas) y avanza a la siguiente. Devuelve la sesión cerrada, o null.
 */
export function settleTimer(now = Date.now()): Promise<CompletedSession | null> {
  return guard('No se pudo cerrar la sesión', () =>
    db.transaction('rw', db.kv, db.sessions, async () => {
      const [s, cfg] = await Promise.all([loadTimer(), loadConfig()])
      if (!isExpired(s, now) || !s.runId) return null
      const { state, session } = complete(s, cfg, now)
      const sessionId = `run-${s.runId}`
      if (!(await db.sessions.get(sessionId))) await db.sessions.add({ id: sessionId, ...session })
      await db.kv.put({ key: TIMER_KEY, value: state })
      return session
    }),
  )
}

export const deleteSession = (id: string) => guard('No se pudo eliminar la sesión', () => db.sessions.delete(id))
