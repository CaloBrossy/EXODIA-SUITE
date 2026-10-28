import type { Card, CardOrigin, CardReview, Concept, Formula, Question } from '@/db/models'
import { startOfDay } from './text'

export type CardDraft = {
  front: string
  back: string
  tags: string[]
  subjectId?: string | null
  originKind: Exclude<CardOrigin, 'manual'>
  originId: string
  originUpdatedAt: number
}

function draft(
  front: string,
  back: string,
  originKind: CardDraft['originKind'],
  originId: string,
  originUpdatedAt: number,
  tags: string[],
  subjectId?: string | null,
): CardDraft | null {
  const f = front.trim()
  const b = back.trim()
  if (!f || !b) return null
  return { front: f, back: b, tags, originKind, originId, originUpdatedAt, subjectId: subjectId ?? null }
}

export function proposeFromConcept(c: Concept, subjectId?: string | null): CardDraft[] {
  const tags = c.tags.slice(0, 8)
  const at = c.updatedAt
  return [
    draft(`¿Qué es ${c.title}?`, c.summary, 'concept', c.id, at, tags, subjectId),
    draft(`Formalización de ${c.title}`, c.formalism, 'concept', c.id, at, tags, subjectId),
    draft(`Ejemplo de ${c.title}`, c.examples, 'concept', c.id, at, tags, subjectId),
  ].filter((x): x is CardDraft => !!x)
}

export function proposeFromQuestion(q: Question, subjectId?: string | null): CardDraft[] {
  const card = draft(q.text, q.answer.trim() || '(sin respuesta aún)', 'question', q.id, q.resolvedAt ?? q.createdAt, [], subjectId)
  return card ? [card] : []
}

export function proposeFromFormula(f: Formula, subjectId?: string | null): CardDraft[] {
  const tags = f.tags.slice(0, 8)
  const at = f.updatedAt
  const latex = f.latex.trim() ? `$$${f.latex.trim()}$$` : ''
  return [
    draft(`¿Cuál es la fórmula de ${f.name}?`, latex, 'formula', f.id, at, tags, subjectId),
    draft(`¿Qué describe ${f.name}?`, f.description, 'formula', f.id, at, tags, subjectId),
  ].filter((x): x is CardDraft => !!x)
}

export function skipExisting(drafts: CardDraft[], cards: Card[]): CardDraft[] {
  const keys = new Set(cards.map((c) => `${c.originKind}:${c.originId ?? ''}:${c.front}`))
  return drafts.filter((d) => !keys.has(`${d.originKind}:${d.originId}:${d.front}`))
}

export function originStale(card: Card, originUpdatedAt: number | null | undefined): boolean {
  if (card.originKind === 'manual' || !card.originId) return false
  if (originUpdatedAt == null) return true
  return (card.originUpdatedAt ?? 0) < originUpdatedAt
}

function dayStamp(ts: number): number {
  return startOfDay(ts)
}

export function reviewStats(logs: CardReview[], now: number): {
  byDay: { at: number; count: number }[]
  retention: number | null
  streak: number
  today: number
} {
  const start = dayStamp(now)
  const byDayMap = new Map<number, number>()
  for (const r of logs) {
    const d = dayStamp(r.at)
    byDayMap.set(d, (byDayMap.get(d) ?? 0) + 1)
  }
  const byDay: { at: number; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(start)
    d.setDate(d.getDate() - i)
    byDay.push({ at: d.getTime(), count: byDayMap.get(d.getTime()) ?? 0 })
  }
  const weekFrom = new Date(start)
  weekFrom.setDate(weekFrom.getDate() - 6)
  const week = logs.filter((r) => r.at >= weekFrom.getTime())
  const retention = week.length ? week.filter((r) => r.rating !== 'again').length / week.length : null
  let streak = 0
  for (let i = 0; i < 400; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() - i)
    if ((byDayMap.get(d.getTime()) ?? 0) === 0) {
      if (i === 0) continue
      break
    }
    streak += 1
  }
  return { byDay, retention, streak, today: byDayMap.get(start) ?? 0 }
}
