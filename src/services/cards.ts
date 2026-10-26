import { db } from '@/db/db'
import { CardReviewSchema, CardSchema, DEFAULT_EASE, MIN_EASE, type Card, type CardOrigin, type CardReview } from '@/db/models'
import type { CardDraft } from '@/lib/flashcards'
import { scheduleReview, type Rating } from '@/lib/sm2'
import { uid } from '@/lib/text'
import { guard } from './errors'

export const NEW_LIMIT_KEY = 'review.newLimit'
export const DEFAULT_NEW_LIMIT = 20

export type CardInput = {
  front: string
  back: string
  subjectId?: string | null
  tags?: string[]
  originKind?: CardOrigin
  originId?: string | null
  originUpdatedAt?: number | null
  intervalDays?: number
  ease?: number
  reps?: number
  lapses?: number
  dueAt?: number
  lastReviewedAt?: number | null
}

function normalize(input: CardInput, id: string, createdAt: number, updatedAt: number): Card {
  const originKind = input.originKind ?? 'manual'
  const manual = originKind === 'manual'
  const card: Card = {
    id,
    front: input.front.trim(),
    back: input.back.trim(),
    subjectId: input.subjectId ?? null,
    tags: [...new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))].slice(0, 100),
    originKind,
    originId: manual ? null : input.originId ?? null,
    originUpdatedAt: manual ? null : input.originUpdatedAt ?? null,
    intervalDays: input.intervalDays ?? 0,
    ease: input.ease ?? DEFAULT_EASE,
    reps: input.reps ?? 0,
    lapses: input.lapses ?? 0,
    dueAt: input.dueAt ?? createdAt,
    lastReviewedAt: input.lastReviewedAt ?? null,
    createdAt,
    updatedAt,
  }
  const parsed = CardSchema.safeParse(card)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(issue ? `${issue.path.join('.')}: ${issue.message}` : 'Tarjeta inválida')
  }
  if (parsed.data.ease < MIN_EASE) throw new Error('La facilidad no puede bajar de 1.3.')
  if (!manual && !parsed.data.originId) throw new Error('La tarjeta generada necesita un origen.')
  return parsed.data
}

export function listCards(): Promise<Card[]> {
  return guard('No se pudieron leer las tarjetas', () => db.cards.toArray())
}

export function listCardsByOrigin(originKind: CardOrigin, originId: string): Promise<Card[]> {
  return guard('No se pudieron leer las tarjetas del origen', () =>
    db.cards.where('originId').equals(originId).filter((c) => c.originKind === originKind).toArray(),
  )
}

export function saveCard(input: CardInput, id?: string): Promise<Card> {
  return guard('No se pudo guardar la tarjeta', async () => {
    if (!input.front.trim()) throw new Error('La tarjeta necesita un frente.')
    if (!input.back.trim()) throw new Error('La tarjeta necesita un dorso.')
    const now = Date.now()
    if (id) {
      const prev = await db.cards.get(id)
      if (!prev) throw new Error('La tarjeta ya no existe.')
      const next = normalize(input, id, prev.createdAt, now)
      await db.cards.put(next)
      return next
    }
    const next = normalize(input, uid(), now, now)
    await db.cards.add(next)
    return next
  })
}

export function deleteCard(id: string): Promise<void> {
  return guard('No se pudo eliminar la tarjeta', () =>
    db.transaction('rw', [db.cards, db.reviews], async () => {
      await db.reviews.where('cardId').equals(id).delete()
      await db.cards.delete(id)
    }),
  )
}

export function applyReview(id: string, rating: Rating, now = Date.now()): Promise<Card> {
  return guard('No se pudo registrar el repaso', () =>
    db.transaction('rw', [db.cards, db.reviews], async () => {
      const prev = await db.cards.get(id)
      if (!prev) throw new Error('La tarjeta ya no existe.')
      const next = scheduleReview(prev, rating, now)
      const saved = normalize({ ...prev, ...next }, id, prev.createdAt, now)
      const log = CardReviewSchema.parse({
        id: uid(),
        cardId: id,
        rating,
        intervalDays: saved.intervalDays,
        ease: saved.ease,
        at: now,
      })
      await db.cards.put(saved)
      await db.reviews.add(log)
      return saved
    }),
  )
}

export function listReviews(): Promise<CardReview[]> {
  return guard('No se pudieron leer los repasos', () => db.reviews.toArray())
}

export function saveDrafts(drafts: CardDraft[]): Promise<Card[]> {
  return guard('No se pudieron crear las tarjetas', async () => {
    const out: Card[] = []
    for (const d of drafts) {
      if (!d.front.trim() || !d.back.trim()) continue
      out.push(await saveCard(d))
    }
    if (!out.length) throw new Error('No quedó ninguna tarjeta para crear.')
    return out
  })
}

export async function readNewLimit(): Promise<number> {
  const row = await db.kv.get(NEW_LIMIT_KEY)
  const n = typeof row?.value === 'number' ? row.value : DEFAULT_NEW_LIMIT
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_NEW_LIMIT
}

export function writeNewLimit(n: number): Promise<void> {
  return guard('No se pudo guardar el cupo de tarjetas nuevas', async () => {
    if (!Number.isFinite(n) || n < 1) throw new Error('El cupo tiene que ser un entero positivo.')
    await db.kv.put({ key: NEW_LIMIT_KEY, value: Math.floor(n) })
  })
}
