import { db } from '@/db/db'
import type { Calculation, Question } from '@/db/models'
import { uid } from '@/lib/text'
import { guard } from './errors'

export function addQuestion(text: string, links: { conceptId?: string | null; noteId?: string | null } = {}) {
  return guard('No se pudo guardar la pregunta', async () => {
    const t = text.trim()
    if (!t) throw new Error('La pregunta está vacía')
    const q: Question = {
      id: uid(),
      text: t,
      resolved: false,
      answer: '',
      conceptId: links.conceptId ?? null,
      noteId: links.noteId ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      resolvedAt: null,
    }
    await db.questions.add(q)
    return q
  })
}

export const updateQuestion = (id: string, changes: Partial<Pick<Question, 'text' | 'answer'>>) =>
  guard('No se pudo actualizar la pregunta', () => db.questions.update(id, { ...changes, updatedAt: Date.now() }))

export const setQuestionResolved = (q: Question, resolved: boolean) =>
  guard('No se pudo actualizar la pregunta', () =>
    db.questions.update(q.id, { resolved, resolvedAt: resolved ? Date.now() : null, updatedAt: Date.now() }),
  )

export const deleteQuestion = (id: string) => guard('No se pudo eliminar la pregunta', () => db.questions.delete(id))

const HISTORY_LIMIT = 500

export function recordCalculation(kind: string, input: string, result: string): Promise<Calculation> {
  return guard('No se pudo registrar el cálculo', async () => {
    const c: Calculation = { id: uid(), kind, input, result, createdAt: Date.now() }
    await db.calculations.add(c)
    const count = await db.calculations.count()
    if (count > HISTORY_LIMIT) {
      const linked = new Set((await db.notes.toArray()).flatMap((n) => n.calculationIds))
      const old = await db.calculations.orderBy('createdAt').limit(count - HISTORY_LIMIT).primaryKeys()
      await db.calculations.bulkDelete(old.filter((k) => !linked.has(k)))
    }
    return c
  })
}

export const listCalculations = (limit = 50) => db.calculations.orderBy('createdAt').reverse().limit(limit).toArray()

/** Borra el historial, conservando los cálculos vinculados a notas. */
export function clearCalculations(kind?: string): Promise<void> {
  return guard('No se pudo borrar el historial', async () => {
    const linked = new Set((await db.notes.toArray()).flatMap((n) => n.calculationIds))
    const all = kind ? await db.calculations.where('kind').equals(kind).toArray() : await db.calculations.toArray()
    await db.calculations.bulkDelete(all.filter((c) => !linked.has(c.id)).map((c) => c.id))
  })
}
