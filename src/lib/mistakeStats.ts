import { startOfMonth, startOfWeek } from '@/lib/studyStats'

const addDays = (ts: number, n: number) => {
  const d = new Date(ts)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

export function kindRanking(rows: { kind: string }[]) {
  const map = new Map<string, number>()
  for (const r of rows) map.set(r.kind, (map.get(r.kind) ?? 0) + 1)
  return [...map.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind, 'es'))
}

export function topicRanking(rows: { topic: string }[]) {
  const map = new Map<string, number>()
  for (const r of rows) {
    const topic = r.topic.trim() || 'Sin tema'
    map.set(topic, (map.get(topic) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic, 'es'))
}

export function mistakeEvolution(rows: { at: number }[], weeks = 8, now = Date.now()) {
  const end = startOfWeek(now)
  const out: { weekStart: number; count: number }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(end, -i * 7)
    const stop = addDays(start, 7)
    out.push({ weekStart: start, count: rows.filter((r) => r.at >= start && r.at < stop).length })
  }
  return out
}

export function topKindThisMonth(rows: { kind: string; at: number }[], now = Date.now()) {
  const start = startOfMonth(now)
  const endDate = new Date(start)
  endDate.setMonth(endDate.getMonth() + 1)
  const month = rows.filter((r) => r.at >= start && r.at < endDate.getTime())
  return kindRanking(month)[0] ?? null
}
