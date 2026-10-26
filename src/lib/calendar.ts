import type { CalendarEvent } from '@/db/models'
import { startOfDay } from './text'

export { startOfDay }

const pad = (n: number) => String(n).padStart(2, '0')

export type Occurrence = {
  eventId: string
  startAt: number
  endAt: number
  allDay: boolean
  dayKey: string
  days: string[]
  done: boolean
}

export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDayKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime()
}

export function addDays(ts: number, n: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

/** Lunes 00:00 local. */
export function startOfWeek(ts: number): number {
  const start = startOfDay(ts)
  const d = new Date(start)
  const wd = d.getDay()
  d.setDate(d.getDate() - (wd === 0 ? 6 : wd - 1))
  return d.getTime()
}

export function endOfWeek(ts: number): number {
  return addDays(startOfWeek(ts), 7)
}

export function startOfMonth(ts: number): number {
  const d = new Date(startOfDay(ts))
  d.setDate(1)
  return d.getTime()
}

/** 42 celdas (lunes a domingo) que cubren el mes. */
export function monthGrid(ts: number): number[] {
  const start = startOfWeek(startOfMonth(ts))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function occupiedDays(startAt: number, endAt: number): string[] {
  const days: string[] = []
  let t = startOfDay(startAt)
  const last = startOfDay(endAt - 1)
  while (t <= last) {
    days.push(dayKey(t))
    t = addDays(t, 1)
  }
  return days.length ? days : [dayKey(startAt)]
}

function occurrenceDone(event: CalendarEvent, start: number): boolean {
  if (event.repeat === 'weekly') return event.doneOn.includes(dayKey(start))
  return event.status === 'hecho'
}

function occurrenceOf(event: CalendarEvent, start: number, end: number): Occurrence {
  const days = occupiedDays(start, end)
  return {
    eventId: event.id,
    startAt: start,
    endAt: end,
    allDay: event.allDay,
    dayKey: days[0] ?? dayKey(start),
    days,
    done: occurrenceDone(event, start),
  }
}

function overlapsRange(start: number, end: number, from: number, to: number): boolean {
  return start < to && end > from
}

/** Expande una serie semanal (o un evento único) en el intervalo [from, to). */
export function expandEvent(event: CalendarEvent, from: number, to: number): Occurrence[] {
  const duration = event.endAt - event.startAt
  if (duration <= 0) return []
  const skip = new Set(event.skipOn)
  const out: Occurrence[] = []

  if (event.repeat !== 'weekly') {
    if (overlapsRange(event.startAt, event.endAt, from, to) && !skip.has(dayKey(event.startAt))) {
      out.push(occurrenceOf(event, event.startAt, event.endAt))
    }
    return out
  }

  const until = event.repeatUntil ?? to - 1
  let start = event.startAt
  let n = 0
  while (start <= until && n < 800) {
    const end = start + duration
    if (start > to) break
    if (overlapsRange(start, end, from, to) && !skip.has(dayKey(start))) out.push(occurrenceOf(event, start, end))
    start = addDays(start, 7)
    n += 1
  }
  return out
}

export function expandEvents(events: CalendarEvent[], from: number, to: number): Occurrence[] {
  return events.flatMap((e) => expandEvent(e, from, to)).sort((a, b) => a.startAt - b.startAt || a.endAt - b.endAt)
}

export function occurrencesOnDay(occurrences: Occurrence[], key: string): Occurrence[] {
  return occurrences.filter((o) => o.days.includes(key))
}

/** Primera ocurrencia que todavía no terminó. */
export function nextOccurrence(event: CalendarEvent, now: number): Occurrence | null {
  const horizon = addDays(now, 400 * 7)
  const upcoming = expandEvent(event, now, horizon).find((o) => o.endAt > now)
  return upcoming ?? null
}

const EXAM_KIND = new Set(['parcial', 'final', 'entrega'])

/** Próximo parcial, final o entrega que todavía no terminó. */
export function nextExam(events: CalendarEvent[], now: number): { event: CalendarEvent; occurrence: Occurrence } | null {
  let best: { event: CalendarEvent; occurrence: Occurrence } | null = null
  for (const event of events) {
    if (!EXAM_KIND.has(event.kind)) continue
    const occurrence = nextOccurrence(event, now)
    if (!occurrence) continue
    if (!best || occurrence.startAt < best.occurrence.startAt) best = { event, occurrence }
  }
  return best
}

export type Conflict = { a: Occurrence; b: Occurrence }

/** Solapamiento de eventos con hora. Si uno termina cuando el otro empieza, no hay conflicto. */
export function findConflicts(occurrences: Occurrence[]): Conflict[] {
  const timed = occurrences.filter((o) => !o.allDay).sort((a, b) => a.startAt - b.startAt)
  const out: Conflict[] = []
  for (let i = 0; i < timed.length; i++) {
    const a = timed[i]!
    for (let j = i + 1; j < timed.length; j++) {
      const b = timed[j]!
      if (b.startAt >= a.endAt) break
      if (a.eventId === b.eventId && a.startAt === b.startAt) continue
      if (a.startAt < b.endAt && b.startAt < a.endAt) out.push({ a, b })
    }
  }
  return out
}

/** Horas de eventos con hora (incluye bloques de estudio guardados). Los de día completo no suman. */
export function loadHours(occurrences: Occurrence[]): number {
  return occurrences.reduce((sum, o) => (o.allDay ? sum : sum + (o.endAt - o.startAt) / 3_600_000), 0)
}

export function weekLoadHours(events: CalendarEvent[], ts: number): number {
  const from = startOfWeek(ts)
  return loadHours(expandEvents(events, from, addDays(from, 7)).filter((o) => o.startAt >= from && o.startAt < addDays(from, 7)))
}

export function weekOverloaded(hours: number, threshold: number): boolean {
  return hours > threshold
}

const HOUR = 3_600_000
export const STUDY_SLOT_MS = 90 * 60_000
const TARGET_DAY_H = 2
const MAX_DAY_H = 3
const LOOKBACK_DAYS = 14
const WIN_START_H = 8
const WIN_END_H = 22

export type StudySlot = { startAt: number; endAt: number }

export type StudyPlanInput = {
  examStart: number
  examEnd: number
  events: CalendarEvent[]
  now: number
  loadThreshold: number
  ignoreOriginId?: string | null
}

function atHour(day: number, h: number, min = 0): number {
  const d = new Date(startOfDay(day))
  d.setHours(h, min, 0, 0)
  return d.getTime()
}

function mergeRanges(ranges: { start: number; end: number }[]): { start: number; end: number }[] {
  const sorted = ranges.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start)
  const out: { start: number; end: number }[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else out.push({ start: r.start, end: r.end })
  }
  return out
}

function freeGaps(busy: { start: number; end: number }[], from: number, to: number): { start: number; end: number }[] {
  const gaps: { start: number; end: number }[] = []
  let cursor = from
  for (const b of mergeRanges(busy)) {
    if (b.start > cursor) gaps.push({ start: cursor, end: Math.min(b.start, to) })
    cursor = Math.max(cursor, b.end)
    if (cursor >= to) break
  }
  if (cursor < to) gaps.push({ start: cursor, end: to })
  return gaps.filter((g) => g.end - g.start >= STUDY_SLOT_MS)
}

function latestSlotsInGap(gap: { start: number; end: number }): StudySlot[] {
  const out: StudySlot[] = []
  let end = gap.end
  while (end - gap.start >= STUDY_SLOT_MS) {
    out.push({ startAt: end - STUDY_SLOT_MS, endAt: end })
    end -= STUDY_SLOT_MS
  }
  return out
}

function studyHoursOnDay(events: CalendarEvent[], day: number): number {
  return loadHours(expandEvents(events.filter((e) => e.kind === 'estudio'), day, addDays(day, 1)))
}

function proposedHoursInWeek(slots: StudySlot[], ts: number): number {
  const from = startOfWeek(ts)
  const to = addDays(from, 7)
  return slots.reduce((sum, s) => (s.startAt >= from && s.startAt < to ? sum + (s.endAt - s.startAt) / HOUR : sum), 0)
}

/** Bloques de 90 min hacia atrás (lun–sáb), ~2 h/día, tope 3 h de estudio, sin chocar ni pasar el umbral. */
export function proposeStudyPlan(input: StudyPlanInput): StudySlot[] {
  const examDay = startOfDay(input.examStart)
  const events = input.events.filter((e) => e.originId !== input.ignoreOriginId)
  const placed: StudySlot[] = []
  const slotH = STUDY_SLOT_MS / HOUR

  for (let i = 1; i <= LOOKBACK_DAYS; i++) {
    const day = addDays(examDay, -i)
    if (new Date(day).getDay() === 0) continue
    const winEnd = atHour(day, WIN_END_H)
    const winStart = Math.max(atHour(day, WIN_START_H), input.now)
    if (winEnd - winStart < STUDY_SLOT_MS) continue

    const existingStudy = studyHoursOnDay(events, day)
    if (existingStudy + slotH > MAX_DAY_H) continue

    const occ = expandEvents(events, day, addDays(day, 1))
    const busy = occ
      .filter((o) => !o.allDay)
      .map((o) => ({ start: Math.max(o.startAt, winStart), end: Math.min(o.endAt, winEnd) }))
    if (input.examStart < winEnd && input.examEnd > winStart) {
      busy.push({ start: Math.max(input.examStart, winStart), end: Math.min(input.examEnd, winEnd) })
    }

    const candidates = freeGaps(busy, winStart, winEnd).reverse().flatMap(latestSlotsInGap)
    let dayAdded = 0
    for (const slot of candidates) {
      if (dayAdded > 0 && dayAdded + slotH > TARGET_DAY_H) break
      if (existingStudy + dayAdded + slotH > MAX_DAY_H) break
      const weekH = weekLoadHours(events, slot.startAt) + proposedHoursInWeek(placed, slot.startAt) + slotH
      if (weekH > input.loadThreshold) continue
      placed.push(slot)
      dayAdded += slotH
    }
  }

  return placed.sort((a, b) => a.startAt - b.startAt)
}

function localDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function localDateTime(ts: number): string {
  const d = new Date(ts)
  return `${localDate(ts)}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function utcStamp(ts: number): string {
  const d = new Date(ts)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

const encoder = new TextEncoder()

export function foldIcsLine(line: string): string {
  const parts: string[] = []
  let rest = line
  let first = true
  while (encoder.encode(rest).length > 75) {
    let lo = 1
    let hi = rest.length
    let cut = 1
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      const prefix = first ? '' : ' '
      if (encoder.encode(prefix + rest.slice(0, mid)).length <= 75) {
        cut = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    parts.push((first ? '' : ' ') + rest.slice(0, cut))
    rest = rest.slice(cut)
    first = false
  }
  parts.push((first ? '' : ' ') + rest)
  return parts.join('\r\n')
}

function allDayExclusiveEnd(event: CalendarEvent): number {
  const endDay = startOfDay(event.endAt)
  if (endDay === event.endAt && event.endAt > event.startAt) return event.endAt
  return addDays(startOfDay(event.endAt), 1)
}

function icsEvent(event: CalendarEvent): string[] {
  const uid = `${event.id}@exodia`
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(event.updatedAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ]
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`)
  if (event.notes) lines.push(`DESCRIPTION:${escapeIcsText(event.notes)}`)
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${localDate(event.startAt)}`)
    lines.push(`DTEND;VALUE=DATE:${localDate(allDayExclusiveEnd(event))}`)
  } else {
    lines.push(`DTSTART:${localDateTime(event.startAt)}`)
    lines.push(`DTEND:${localDateTime(event.endAt)}`)
  }
  if (event.repeat === 'weekly') {
    const until = event.repeatUntil != null
      ? event.allDay
        ? `;UNTIL=${localDate(event.repeatUntil)}`
        : `;UNTIL=${localDateTime(event.repeatUntil)}`
      : ''
    lines.push(`RRULE:FREQ=WEEKLY${until}`)
    for (const skip of event.skipOn) {
      const t = parseDayKey(skip)
      const stamp = event.allDay
        ? `EXDATE;VALUE=DATE:${localDate(t)}`
        : `EXDATE:${localDate(t)}T${localDateTime(event.startAt).slice(9)}`
      lines.push(stamp)
    }
  }
  lines.push('END:VEVENT')
  return lines
}

export function eventsToIcs(events: CalendarEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EXODIA//Observatorio//ES',
    'CALSCALE:GREGORIAN',
    ...events.flatMap(icsEvent),
    'END:VCALENDAR',
  ]
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}
