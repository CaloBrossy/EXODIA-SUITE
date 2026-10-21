import type { FocusSession } from '@/db/models'
import { startOfDay } from '@/lib/text'

export interface DayStat {
  day: number
  minutes: number
  count: number
}

/** Minutos de concentración por día para los últimos `days` días (incluye hoy). */
export function workByDay(sessions: FocusSession[], days: number, now = Date.now()): DayStat[] {
  const today = startOfDay(now)
  const out: DayStat[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    out.push({ day: d.getTime(), minutes: 0, count: 0 })
  }
  for (const s of sessions) {
    if (s.phase !== 'work') continue
    const day = startOfDay(s.endedAt)
    const slot = out.find((o) => o.day === day)
    if (slot) {
      slot.minutes += s.durationMs / 60000
      slot.count++
    }
  }
  return out
}
