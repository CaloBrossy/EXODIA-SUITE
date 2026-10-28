import { db } from '@/db/db'
import {
  ExamRunSchema,
  ExerciseSchema,
  type ExamRun,
  type Exercise,
  type ExerciseStatus,
  type PracticeResult,
} from '@/db/models'
import { uid } from '@/lib/text'
import { guard } from './errors'

export type ExerciseInput = {
  prompt: string
  subjectId?: string | null
  topic?: string
  difficulty?: number
  source?: string
  solution?: string
  answer?: string
  status?: ExerciseStatus
  attempts?: number
  lastAttemptMs?: number
  lastAttemptAt?: number | null
  tags?: string[]
  conceptIds?: string[]
}

function normalize(input: ExerciseInput, id: string, createdAt: number, updatedAt: number): Exercise {
  const rec: Exercise = {
    id,
    prompt: input.prompt.trim(),
    subjectId: input.subjectId ?? null,
    topic: input.topic?.trim() ?? '',
    difficulty: input.difficulty ?? 1,
    source: input.source?.trim() ?? '',
    solution: input.solution ?? '',
    answer: input.answer?.trim() ?? '',
    status: input.status ?? 'sin_intentar',
    attempts: input.attempts ?? 0,
    lastAttemptMs: input.lastAttemptMs ?? 0,
    lastAttemptAt: input.lastAttemptAt ?? null,
    tags: [...new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))].slice(0, 100),
    conceptIds: [...new Set(input.conceptIds ?? [])],
    createdAt,
    updatedAt,
  }
  const parsed = ExerciseSchema.safeParse(rec)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(issue ? `${issue.path.join('.')}: ${issue.message}` : 'Ejercicio inválido')
  }
  return parsed.data
}

export function listExercises(): Promise<Exercise[]> {
  return guard('No se pudieron leer los ejercicios', () => db.exercises.toArray())
}

export function saveExercise(input: ExerciseInput, id?: string): Promise<Exercise> {
  return guard('No se pudo guardar el ejercicio', async () => {
    if (!input.prompt.trim()) throw new Error('El ejercicio necesita un enunciado.')
    const now = Date.now()
    if (id) {
      const prev = await db.exercises.get(id)
      if (!prev) throw new Error('El ejercicio ya no existe.')
      const next = normalize({ ...prev, ...input, prompt: input.prompt }, id, prev.createdAt, now)
      await db.exercises.put(next)
      return next
    }
    const next = normalize(input, uid(), now, now)
    await db.exercises.add(next)
    return next
  })
}

export function deleteExercise(id: string): Promise<void> {
  return guard('No se pudo eliminar el ejercicio', () => db.exercises.delete(id))
}

/** Hook para el registro de errores cuando exista ese módulo. */
export function onExerciseFail(_exercise: Exercise): void {}

const nextStatus = (result: PracticeResult): ExerciseStatus => {
  if (result === 'bien') return 'resuelto'
  if (result === 'mal') return 'fallo'
  return 'repasar'
}

export function recordAttempt(id: string, result: PracticeResult, ms: number, now = Date.now()): Promise<Exercise> {
  return guard('No se pudo registrar el intento', async () => {
    const prev = await db.exercises.get(id)
    if (!prev) throw new Error('El ejercicio ya no existe.')
    const next = normalize({
      ...prev,
      status: nextStatus(result),
      attempts: prev.attempts + 1,
      lastAttemptMs: Math.max(0, ms),
      lastAttemptAt: now,
    }, id, prev.createdAt, now)
    await db.exercises.put(next)
    if (result === 'mal') onExerciseFail(next)
    return next
  })
}

export function saveExamRun(run: Omit<ExamRun, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): Promise<ExamRun> {
  return guard('No se pudo guardar el simulado', async () => {
    const now = Date.now()
    const rec = ExamRunSchema.parse({
      ...run,
      id: run.id ?? uid(),
      createdAt: run.createdAt ?? now,
    })
    await db.examRuns.put(rec)
    return rec
  })
}

export function listExamRuns(): Promise<ExamRun[]> {
  return guard('No se pudieron leer los simulados', () => db.examRuns.orderBy('startedAt').reverse().toArray())
}
