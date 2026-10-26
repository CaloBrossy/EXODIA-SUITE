import { describe, expect, it } from 'vitest'
import { assignSessions, planStatus, reassignSessions, topicSummary } from './examPlan'

const day = (n: number, h = 18) => new Date(2026, 5, n, h).getTime()
const slot = (n: number) => ({ startAt: day(n), endAt: day(n) + 90 * 60_000 })

describe('plan de examen', () => {
  const topics = ['Límites', 'Derivadas', 'Integrales', 'Series', 'Ecuaciones', 'Vectores'].map((title, i) => ({
    id: `t${i}`,
    title,
    mastery: [1, 2, 3, 4, 5, 5][i]!,
  }))

  it('prioriza temas débiles y deja repaso y simulacro al final', () => {
    const sessions = assignSessions([1, 2, 3, 4, 5, 6, 7, 8].map(slot), topics, day(10, 9))
    const last = sessions.at(-1)!
    const prev = sessions.filter((s) => new Date(s.startAt).getDate() === 7)
    expect(last.kind).toBe('simulacro')
    expect(prev.every((s) => s.kind === 'repaso')).toBe(true)
    const weak = topicSummary(sessions, topics).find((t) => t.title === 'Límites')!
    const strong = topicSummary(sessions, topics).find((t) => t.title === 'Vectores')!
    expect(weak.count).toBeGreaterThan(strong.count)
    expect(weak.reason).toBe(`Límites: dominio 1, ${weak.count} sesiones`)
  })

  it('al subir un dominio recalcula solo lo pendiente', () => {
    const sessions = assignSessions([1, 2, 3, 4, 5, 6, 7, 8].map(slot), topics, day(10, 9))
    const done = sessions.filter((s) => s.kind === 'tema').slice(0, 2).map((s) => ({ ...s, done: true }))
    const rest = sessions.map((s) => done.find((d) => d.id === s.id) ?? s)
    const raised = topics.map((t) => (t.title === 'Límites' ? { ...t, mastery: 5 } : t))
    const next = reassignSessions(rest, raised, day(10, 9))
    expect(next.filter((s) => s.done)).toHaveLength(2)
    const before = topicSummary(sessions, topics).find((t) => t.id === 't0')!.count
    const after = next.filter((s) => s.topicId === 't0').length
    expect(after).toBeLessThan(before)
    expect(planStatus(next, day(3)).done).toBe(2)
  })
})
