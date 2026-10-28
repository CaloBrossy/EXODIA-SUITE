import { CARD_RATINGS, CardRatingLabel, DEFAULT_EASE, MIN_EASE, type Card, type CardRating } from '@/db/models'
import { startOfDay } from './text'

export const RATINGS = CARD_RATINGS
export type Rating = CardRating
export const RatingLabel = CardRatingLabel

export const EASY_BONUS = 1.3
export const HARD_FACTOR = 1.2

export type Sm2State = {
  intervalDays: number
  ease: number
  reps: number
  lapses: number
}

export type Sm2Result = Sm2State & {
  dueAt: number
  lastReviewedAt: number
}

function addLocalDays(ts: number, n: number): number {
  const d = new Date(startOfDay(ts))
  d.setDate(d.getDate() + n)
  return d.getTime()
}

export function endOfDay(ts: number): number {
  return addLocalDays(ts, 1)
}

function clampEase(ease: number): number {
  return Math.max(MIN_EASE, ease)
}

function days(n: number): number {
  return Math.max(1, Math.round(n))
}

/** SM-2 estilo Anki: Otra vez / Difícil / Bien / Fácil. */
export function scheduleReview(state: Sm2State, rating: Rating, now: number): Sm2Result {
  let { intervalDays, ease, reps, lapses } = state
  if (!Number.isFinite(ease) || ease <= 0) ease = DEFAULT_EASE
  if (!Number.isFinite(intervalDays) || intervalDays < 0) intervalDays = 0
  if (!Number.isFinite(reps) || reps < 0) reps = 0
  if (!Number.isFinite(lapses) || lapses < 0) lapses = 0

  if (rating === 'again') {
    lapses += 1
    reps = 0
    ease = clampEase(ease - 0.2)
    intervalDays = 1
  } else if (rating === 'hard') {
    ease = clampEase(ease - 0.15)
    intervalDays = reps === 0 ? 1 : days(Math.max(intervalDays * HARD_FACTOR, intervalDays + 1))
    reps += 1
  } else if (rating === 'good') {
    if (reps === 0) intervalDays = 1
    else if (reps === 1) intervalDays = 6
    else intervalDays = days(intervalDays * ease)
    reps += 1
  } else {
    ease += 0.15
    if (reps === 0) intervalDays = 4
    else if (reps === 1) intervalDays = days(Math.max(6, intervalDays * ease * EASY_BONUS))
    else intervalDays = days(intervalDays * ease * EASY_BONUS)
    reps += 1
  }

  return {
    intervalDays,
    ease,
    reps,
    lapses,
    dueAt: addLocalDays(now, intervalDays),
    lastReviewedAt: now,
  }
}

export function isNewCard(card: Pick<Card, 'lastReviewedAt'>): boolean {
  return card.lastReviewedAt == null
}

export function isDueReview(card: Pick<Card, 'dueAt' | 'lastReviewedAt'>, now: number): boolean {
  return !isNewCard(card) && card.dueAt < endOfDay(now)
}

export function reviewQueue(cards: Card[], now: number, newLimit: number): { reviews: Card[]; news: Card[] } {
  const cap = Number.isFinite(newLimit) && newLimit > 0 ? Math.floor(newLimit) : 0
  const reviews = cards.filter((c) => isDueReview(c, now)).sort((a, b) => a.dueAt - b.dueAt || a.createdAt - b.createdAt)
  const news = cards
    .filter(isNewCard)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, cap)
  return { reviews, news }
}
