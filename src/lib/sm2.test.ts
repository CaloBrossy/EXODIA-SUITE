import { describe, expect, it } from 'vitest'
import type { Card } from '@/db/models'
import { DEFAULT_EASE, MIN_EASE } from '@/db/models'
import { startOfDay } from './text'
import { isDueReview, isNewCard, reviewQueue, scheduleReview } from './sm2'

const now = new Date(2026, 9, 26, 14, 0).getTime()
const day = (n: number) => {
  const d = new Date(startOfDay(now))
  d.setDate(d.getDate() + n)
  return d.getTime()
}

const fresh = { intervalDays: 0, ease: DEFAULT_EASE, reps: 0, lapses: 0 }

function card(partial: Partial<Card> & Pick<Card, 'id'>): Card {
  return {
    front: 'Q',
    back: 'A',
    subjectId: null,
    tags: [],
    originKind: 'manual',
    originId: null,
    originUpdatedAt: null,
    intervalDays: 0,
    ease: DEFAULT_EASE,
    reps: 0,
    lapses: 0,
    dueAt: now,
    lastReviewedAt: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

describe('SM-2', () => {
  it('gradúa Bien: 1 día, luego 6, luego intervalo × facilidad', () => {
    const first = scheduleReview(fresh, 'good', now)
    expect(first).toMatchObject({ intervalDays: 1, reps: 1, ease: DEFAULT_EASE, lapses: 0 })
    expect(first.dueAt).toBe(day(1))
    const second = scheduleReview(first, 'good', now)
    expect(second.intervalDays).toBe(6)
    expect(second.reps).toBe(2)
    expect(second.dueAt).toBe(day(6))
    const third = scheduleReview(second, 'good', now)
    expect(third.intervalDays).toBe(15)
    expect(third.reps).toBe(3)
    expect(third.dueAt).toBe(day(15))
  })

  it('Otra vez reinicia repeticiones, baja facilidad y deja 1 día', () => {
    const learned = scheduleReview(scheduleReview(fresh, 'good', now), 'good', now)
    const again = scheduleReview(learned, 'again', now)
    expect(again).toMatchObject({ reps: 0, lapses: 1, intervalDays: 1, ease: 2.3 })
    expect(again.dueAt).toBe(day(1))
  })

  it('Difícil alarga menos que Bien; Fácil más y sube facilidad', () => {
    const learned = scheduleReview(scheduleReview(fresh, 'good', now), 'good', now)
    const hard = scheduleReview(learned, 'hard', now)
    const good = scheduleReview(learned, 'good', now)
    const easy = scheduleReview(learned, 'easy', now)
    expect(hard.intervalDays).toBeLessThan(good.intervalDays)
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays)
    expect(hard.ease).toBeCloseTo(2.35)
    expect(easy.ease).toBeCloseTo(2.65)
    expect(scheduleReview(fresh, 'easy', now).intervalDays).toBe(4)
  })

  it('no deja la facilidad bajo 1.3', () => {
    let s = { intervalDays: 1, ease: MIN_EASE, reps: 3, lapses: 4 }
    s = scheduleReview(s, 'again', now)
    s = scheduleReview(s, 'hard', now)
    expect(s.ease).toBe(MIN_EASE)
  })

  it('separa vencidas de nuevas y respeta el cupo', () => {
    const due = card({ id: 'd', lastReviewedAt: now - 1, dueAt: now - 1, createdAt: 2 })
    const later = card({ id: 'l', lastReviewedAt: now - 1, dueAt: day(3), createdAt: 1 })
    const n1 = card({ id: 'n1', createdAt: 10 })
    const n2 = card({ id: 'n2', createdAt: 20 })
    const n3 = card({ id: 'n3', createdAt: 30 })
    expect(isNewCard(n1)).toBe(true)
    expect(isDueReview(due, now)).toBe(true)
    expect(isDueReview(later, now)).toBe(false)
    const q = reviewQueue([n2, due, n3, later, n1], now, 2)
    expect(q.reviews.map((c) => c.id)).toEqual(['d'])
    expect(q.news.map((c) => c.id)).toEqual(['n1', 'n2'])
  })
})
