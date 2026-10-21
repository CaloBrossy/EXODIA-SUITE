import { db } from '@/db/db'
import { DevProblemSchema, type DevProblem } from '@/db/models'
import { uid } from '@/lib/text'
import { guard } from './errors'

export type DevProblemInput = Omit<DevProblem, 'id' | 'createdAt' | 'updatedAt'>

export const saveDevProblem = (input: DevProblemInput, id?: string) =>
  guard('No se pudo guardar el problema', async () => {
    const now = Date.now()
    const prev = id ? await db.devProblems.get(id) : undefined
    const rec = DevProblemSchema.parse({ ...input, id: prev?.id ?? uid(), createdAt: prev?.createdAt ?? now, updatedAt: now })
    await db.devProblems.put(rec)
    return rec
  })

export const deleteDevProblem = (id: string) => guard('No se pudo eliminar el problema', () => db.devProblems.delete(id))

export const listDevProblems = () => db.devProblems.orderBy('updatedAt').reverse().toArray()
