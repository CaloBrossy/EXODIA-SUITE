import { db } from '@/db/db'
import { ExamPlanSchema, type ExamPlan } from '@/db/models'
import { uid } from '@/lib/text'
import { guard } from './errors'

export type ExamPlanInput = Omit<ExamPlan, 'id' | 'createdAt' | 'updatedAt'>

export function planForEvent(eventId: string): Promise<ExamPlan | undefined> {
  return guard('No se pudo leer el plan', () => db.examPlans.where('eventId').equals(eventId).first())
}

export function saveExamPlan(input: ExamPlanInput, id?: string): Promise<ExamPlan> {
  return guard('No se pudo guardar el plan', async () => {
    const now = Date.now()
    const prev = id ? await db.examPlans.get(id) : await db.examPlans.where('eventId').equals(input.eventId).first()
    const parsed = ExamPlanSchema.safeParse({
      ...input,
      id: prev?.id ?? uid(),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new Error(issue ? `${issue.path.join('.')}: ${issue.message}` : 'Plan inválido')
    }
    await db.examPlans.put(parsed.data)
    return parsed.data
  })
}

export function deleteExamPlan(id: string): Promise<void> {
  return guard('No se pudo borrar el plan', () => db.examPlans.delete(id))
}
