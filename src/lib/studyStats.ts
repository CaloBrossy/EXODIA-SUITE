import type { CardReview, ExamRun, Exercise, FocusSession, Task } from '@/db/models'
import { startOfDay } from '@/lib/text'

export type Span = 'day' | 'week' | 'month'

const addDays = (ts: number, n: number) => {
  const d = new Date(ts)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

export const startOfWeek = (ts: number) => {
  const d = new Date(startOfDay(ts))
  const delta = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - delta)
  return d.getTime()
}

export const startOfMonth = (ts: number) => {
  const d = new Date(ts)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function spanRange(span: Span, now: number) {
  if (span === 'day') {
    const start = startOfDay(now)
    return { start, end: addDays(start, 1) }
  }
  if (span === 'week') {
    const start = startOfWeek(now)
    return { start, end: addDays(start, 7) }
  }
  const start = startOfMonth(now)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return { start, end: end.getTime() }
}

const workBetween = (sessions: FocusSession[], start: number, end: number) =>
  sessions.filter((s) => s.phase === 'work' && s.endedAt >= start && s.endedAt < end)

export function hoursBySubject(sessions: FocusSession[], span: Span, now = Date.now()) {
  const { start, end } = spanRange(span, now)
  const map = new Map<string | null, { minutes: number; count: number }>()
  for (const s of workBetween(sessions, start, end)) {
    const key = s.subjectId ?? null
    const row = map.get(key) ?? { minutes: 0, count: 0 }
    row.minutes += s.durationMs / 60_000
    row.count += 1
    map.set(key, row)
  }
  return [...map.entries()]
    .map(([subjectId, row]) => ({ subjectId, minutes: row.minutes, count: row.count }))
    .sort((a, b) => b.minutes - a.minutes)
}

/** Días seguidos con al menos un Pomodoro. Si hoy todavía no hubo, cuenta hasta ayer. */
export function studyStreak(sessions: FocusSession[], now = Date.now()) {
  const days = new Set(sessions.filter((s) => s.phase === 'work').map((s) => startOfDay(s.endedAt)))
  let cursor = startOfDay(now)
  if (!days.has(cursor)) cursor = addDays(cursor, -1)
  let n = 0
  while (days.has(cursor)) {
    n += 1
    cursor = addDays(cursor, -1)
  }
  return n
}

export function pomodorosByWeek(sessions: FocusSession[], weeks = 8, now = Date.now()) {
  const end = startOfWeek(now)
  const out: { weekStart: number; count: number }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(end, -i * 7)
    out.push({ weekStart: start, count: workBetween(sessions, start, addDays(start, 7)).length })
  }
  return out
}

/** Franja de 2 horas con más minutos de concentración. */
export function bestBand(sessions: FocusSession[]) {
  const bins = Array.from({ length: 12 }, () => 0)
  for (const s of sessions) {
    if (s.phase !== 'work') continue
    bins[Math.floor(new Date(s.startedAt).getHours() / 2)]! += s.durationMs / 60_000
  }
  let best = -1
  let minutes = 0
  bins.forEach((m, i) => {
    if (m > minutes) {
      minutes = m
      best = i
    }
  })
  return best < 0 ? null : { from: best * 2, minutes }
}

export function tasksDone(tasks: Task[], span: Span, now = Date.now()) {
  const { start, end } = spanRange(span, now)
  return tasks.filter((t) => t.done && t.completedAt != null && t.completedAt >= start && t.completedAt < end).length
}

export function weekCompare(sessions: FocusSession[], now = Date.now()) {
  const start = startOfWeek(now)
  const minutes = (a: number, b: number) => workBetween(sessions, a, b).reduce((n, s) => n + s.durationMs, 0) / 60_000
  const thisMin = minutes(start, addDays(start, 7))
  const prevMin = minutes(addDays(start, -7), start)
  return { thisMin, prevMin, delta: thisMin - prevMin }
}

export function yearHeat(sessions: FocusSession[], now = Date.now()) {
  const year = new Date(now).getFullYear()
  const start = new Date(year, 0, 1).getTime()
  const end = new Date(year + 1, 0, 1).getTime()
  const map = new Map<number, number>()
  for (const s of workBetween(sessions, start, end)) {
    const day = startOfDay(s.endedAt)
    map.set(day, (map.get(day) ?? 0) + s.durationMs / 60_000)
  }
  const days: { day: number; minutes: number }[] = []
  for (let t = startOfDay(start); t < end; t = addDays(t, 1)) days.push({ day: t, minutes: map.get(t) ?? 0 })
  return days
}

export function reviewsInSpan(reviews: CardReview[], span: Span, now = Date.now()) {
  const { start, end } = spanRange(span, now)
  return reviews.filter((r) => r.at >= start && r.at < end).length
}

export function exercisesInSpan(exercises: Exercise[], runs: ExamRun[], span: Span, now = Date.now()) {
  const { start, end } = spanRange(span, now)
  const attempts = exercises.filter((e) => e.lastAttemptAt != null && e.lastAttemptAt >= start && e.lastAttemptAt < end).length
  const exams = runs.filter((r) => r.endedAt != null && r.endedAt >= start && r.endedAt < end).length
  return { attempts, exams }
}
