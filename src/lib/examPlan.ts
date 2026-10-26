export type PlanTopic = { id: string; title: string; mastery: number }
export type SessionKind = 'tema' | 'repaso' | 'simulacro'
export type PlanSession = {
  id: string
  startAt: number
  endAt: number
  topicId?: string | null
  kind: SessionKind
  done: boolean
  reason: string
}

const startOfDay = (ts: number) => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const weight = (mastery: number) => 6 - Math.min(5, Math.max(1, Math.round(mastery)))
const label = (n: number) => `${n} ${n === 1 ? 'sesión' : 'sesiones'}`

/** Reparte huecos: los temas flojos primero; los dos últimos días son repaso y simulacro. */
export function assignSessions(slots: { startAt: number; endAt: number }[], topics: PlanTopic[], examStart: number): PlanSession[] {
  if (!topics.length) return []
  const sorted = [...slots].sort((a, b) => a.startAt - b.startAt)
  const examDay = startOfDay(examStart)
  const days = [...new Set(sorted.map((s) => startOfDay(s.startAt)))].filter((d) => d < examDay).sort((a, b) => a - b)
  const mockDay = days.at(-1) ?? null
  const reviewDay = days.length > 1 ? days[days.length - 2]! : null
  const study = sorted.filter((s) => {
    const d = startOfDay(s.startAt)
    return d !== mockDay && d !== reviewDay
  })
  const ranked = [...topics].sort((a, b) => a.mastery - b.mastery || a.title.localeCompare(b.title, 'es'))
  const counts = new Map(ranked.map((t) => [t.id, 0]))
  if (study.length) {
    const total = ranked.reduce((s, t) => s + weight(t.mastery), 0)
    const parts = ranked.map((t) => ({ id: t.id, n: Math.floor(study.length * weight(t.mastery) / total), frac: (study.length * weight(t.mastery) / total) % 1 }))
    let left = study.length - parts.reduce((s, p) => s + p.n, 0)
    parts.sort((a, b) => b.frac - a.frac).forEach((p) => { if (left > 0) { p.n++; left-- } })
    parts.forEach((p) => counts.set(p.id, p.n))
  }
  const seq: string[] = []
  const bags = new Map(counts)
  while (seq.length < study.length) {
    let grew = false
    for (const t of ranked) {
      const n = bags.get(t.id) ?? 0
      if (n <= 0) continue
      seq.push(t.id)
      bags.set(t.id, n - 1)
      grew = true
      if (seq.length >= study.length) break
    }
    if (!grew) break
  }
  const byId = new Map(topics.map((t) => [t.id, t]))
  const out: PlanSession[] = study.map((s, i) => {
    const topic = byId.get(seq[i]!)!
    const n = counts.get(topic.id) ?? 0
    return { id: `tema-${s.startAt}`, startAt: s.startAt, endAt: s.endAt, topicId: topic.id, kind: 'tema', done: false, reason: `${topic.title}: dominio ${topic.mastery}, ${label(n)}` }
  })
  for (const s of sorted) {
    const d = startOfDay(s.startAt)
    if (d === reviewDay && reviewDay !== mockDay) out.push({ id: `repaso-${s.startAt}`, startAt: s.startAt, endAt: s.endAt, topicId: null, kind: 'repaso', done: false, reason: 'Repaso general de todos los temas' })
    if (d === mockDay) out.push({ id: `sim-${s.startAt}`, startAt: s.startAt, endAt: s.endAt, topicId: null, kind: 'simulacro', done: false, reason: 'Simulacro: último día antes del examen' })
  }
  return out.sort((a, b) => a.startAt - b.startAt)
}

/** Conserva las sesiones hechas y vuelve a repartir las pendientes. */
export function reassignSessions(prev: PlanSession[], topics: PlanTopic[], examStart: number): PlanSession[] {
  const done = prev.filter((s) => s.done)
  const open = prev.filter((s) => !s.done).sort((a, b) => a.startAt - b.startAt)
  const fresh = assignSessions(open, topics, examStart)
  const ids = new Map(open.map((s) => [s.startAt, s.id]))
  return [...done, ...fresh.map((s) => ({ ...s, id: ids.get(s.startAt) ?? s.id }))].sort((a, b) => a.startAt - b.startAt)
}

export function topicSummary(sessions: PlanSession[], topics: PlanTopic[]) {
  return topics.map((t) => {
    const count = sessions.filter((s) => s.topicId === t.id).length
    return { id: t.id, title: t.title, mastery: t.mastery, count, reason: `${t.title}: dominio ${t.mastery}, ${label(count)}` }
  })
}

export function planStatus(sessions: PlanSession[], now: number) {
  const done = sessions.filter((s) => s.done).length
  const behind = sessions.filter((s) => !s.done && s.endAt < now).length
  return { done, total: sessions.length, behind, ratio: sessions.length ? done / sessions.length : 0 }
}
