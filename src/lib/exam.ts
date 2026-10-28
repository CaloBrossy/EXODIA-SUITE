import type { ExamItem, Exercise, PracticeResult } from '@/db/models'

export function filterExercises(
  list: Exercise[],
  f: { query?: string; subjectId?: string; topic?: string; difficulty?: number; status?: string },
): Exercise[] {
  const q = (f.query ?? '').trim().toLowerCase()
  return list.filter((e) => {
    if (f.subjectId && e.subjectId !== f.subjectId) return false
    if (f.topic && e.topic !== f.topic) return false
    if (f.difficulty && e.difficulty !== f.difficulty) return false
    if (f.status && e.status !== f.status) return false
    if (!q) return true
    const hay = `${e.prompt} ${e.topic} ${e.source} ${e.tags.join(' ')} ${e.answer}`.toLowerCase()
    return hay.includes(q)
  })
}

export function pickExam(list: Exercise[], opts: { subjectId?: string; topics: string[]; n: number }, rng = Math.random): Exercise[] {
  let pool = list
  if (opts.subjectId) pool = pool.filter((e) => e.subjectId === opts.subjectId)
  if (opts.topics.length) pool = pool.filter((e) => opts.topics.includes(e.topic))
  const copy = pool.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = copy[i]!
    copy[i] = copy[j]!
    copy[j] = a
  }
  return copy.slice(0, Math.max(0, opts.n))
}

export function examReport(items: ExamItem[], exercises: Exercise[]): {
  hits: number
  total: number
  ms: number
  weak: { topic: string; wrong: number; total: number }[]
} {
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const byTopic = new Map<string, { wrong: number; total: number }>()
  let hits = 0
  let ms = 0
  for (const it of items) {
    ms += it.ms
    if (it.result === 'bien') hits += 1
    const topic = byId.get(it.exerciseId)?.topic || 'Sin tema'
    const row = byTopic.get(topic) ?? { wrong: 0, total: 0 }
    row.total += 1
    if (it.result && it.result !== 'bien') row.wrong += 1
    byTopic.set(topic, row)
  }
  const weak = [...byTopic.entries()]
    .map(([topic, v]) => ({ topic, ...v }))
    .sort((a, b) => b.wrong / Math.max(1, b.total) - a.wrong / Math.max(1, a.total) || b.wrong - a.wrong)
  return { hits, total: items.length, ms, weak }
}

export function isCorrect(result: PracticeResult | null): boolean {
  return result === 'bien'
}
