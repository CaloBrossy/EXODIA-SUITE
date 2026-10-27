import { z } from 'zod'
import { db } from '@/db/db'
import { MISTAKE_KINDS, MistakeSchema, type Mistake } from '@/db/models'
import { uid } from '@/lib/text'
import { guard } from './errors'

export const MISTAKE_KINDS_KEY = 'mistake.kinds'
export type MistakeInput = Omit<Mistake, 'id' | 'createdAt' | 'updatedAt'>

const extraKinds = z.array(z.string().trim().min(1).max(80)).max(40)

export function listMistakes(): Promise<Mistake[]> {
  return guard('No se pudieron leer los errores', () => db.mistakes.orderBy('at').reverse().toArray())
}

export function readExtraKinds(): Promise<string[]> {
  return guard('No se pudieron leer los tipos de error', async () => {
    const row = await db.kv.get(MISTAKE_KINDS_KEY)
    const parsed = extraKinds.safeParse(row?.value)
    return parsed.success ? [...new Set(parsed.data.filter((k) => !MISTAKE_KINDS.includes(k as (typeof MISTAKE_KINDS)[number])))] : []
  })
}

export function saveExtraKind(kind: string): Promise<string[]> {
  return guard('No se pudo guardar el tipo', async () => {
    const next = kind.trim()
    if (!next) throw new Error('El tipo necesita un nombre.')
    const prev = await readExtraKinds()
    const all = [...prev, next].filter((k, i, xs) => xs.indexOf(k) === i).slice(0, 40)
    await db.kv.put({ key: MISTAKE_KINDS_KEY, value: all })
    return all
  })
}

export function saveMistake(input: MistakeInput, id?: string): Promise<Mistake> {
  return guard('No se pudo guardar el error', async () => {
    if (!input.what.trim()) throw new Error('Contá qué pasó.')
    const now = Date.now()
    const prev = id ? await db.mistakes.get(id) : undefined
    if (id && !prev) throw new Error('El error ya no existe.')
    const parsed = MistakeSchema.safeParse({
      ...input,
      what: input.what.trim(),
      topic: input.topic.trim(),
      kind: input.kind.trim(),
      solution: input.solution.trim(),
      id: prev?.id ?? uid(),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new Error(issue ? `${issue.path.join('.')}: ${issue.message}` : 'Error inválido')
    }
    await db.mistakes.put(parsed.data)
    return parsed.data
  })
}

export function deleteMistake(id: string): Promise<void> {
  return guard('No se pudo borrar el error', () => db.mistakes.delete(id))
}
