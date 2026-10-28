import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '@/db/models'
import {
  dayKey,
  escapeIcsText,
  eventsToIcs,
  expandEvent,
  expandEvents,
  findConflicts,
  foldIcsLine,
  loadHours,
  monthGrid,
  nextExam,
  nextOccurrence,
  occupiedDays,
  proposeStudyPlan,
  startOfWeek,
  STUDY_SLOT_MS,
  weekLoadHours,
  weekOverloaded,
} from './calendar'

const t = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m, d, h, min).getTime()

function ev(partial: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'title' | 'startAt' | 'endAt'>): CalendarEvent {
  return {
    kind: 'clase',
    subjectId: null,
    allDay: false,
    repeat: 'none',
    repeatUntil: null,
    skipOn: [],
    location: '',
    notes: '',
    status: 'pendiente',
    doneOn: [],
    originId: null,
    seriesId: null,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

describe('días y semanas', () => {
  it('arma la clave local y el lunes como inicio de semana', () => {
    expect(dayKey(t(2026, 2, 9, 22))).toBe('2026-03-09')
    expect(dayKey(startOfWeek(t(2026, 2, 11)))).toBe('2026-03-09')
    expect(occupiedDays(t(2026, 2, 9, 22), t(2026, 2, 10, 1))).toEqual(['2026-03-09', '2026-03-10'])
    expect(occupiedDays(t(2026, 2, 9, 14), t(2026, 2, 9, 16))).toEqual(['2026-03-09'])
  })

  it('la grilla del mes tiene 42 celdas y empieza en lunes', () => {
    const cells = monthGrid(t(2026, 9, 1))
    expect(cells).toHaveLength(42)
    expect(dayKey(cells[0]!)).toBe('2026-09-28')
    expect(new Date(cells[0]!).getDay()).toBe(1)
  })
})

describe('expansión', () => {
  it('repite semanalmente hasta repeatUntil y salta skipOn', () => {
    const clase = ev({
      id: 'c1',
      title: 'Álgebra',
      startAt: t(2026, 2, 9, 14),
      endAt: t(2026, 2, 9, 16),
      repeat: 'weekly',
      repeatUntil: t(2026, 2, 30, 14),
      skipOn: ['2026-03-16'],
    })
    const occ = expandEvent(clase, t(2026, 2, 1), t(2026, 3, 6))
    expect(occ.map((o) => o.dayKey)).toEqual(['2026-03-09', '2026-03-23', '2026-03-30'])
    expect(occ[0]!.endAt - occ[0]!.startAt).toBe(2 * 3_600_000)
  })

  it('un evento que cruza medianoche aparece en los dos días', () => {
    const lab = ev({ id: 'n1', title: 'Lab', kind: 'laboratorio', startAt: t(2026, 2, 9, 22), endAt: t(2026, 2, 10, 1) })
    const occ = expandEvent(lab, t(2026, 2, 9), t(2026, 2, 11))
    expect(occ).toHaveLength(1)
    expect(occ[0]?.days).toEqual(['2026-03-09', '2026-03-10'])
  })

  it('nextOccurrence ignora skipOn y eventos ya terminados', () => {
    const clase = ev({
      id: 'c2',
      title: 'Física',
      startAt: t(2026, 2, 9, 14),
      endAt: t(2026, 2, 9, 16),
      repeat: 'weekly',
      skipOn: ['2026-03-16'],
    })
    const next = nextOccurrence(clase, t(2026, 2, 16, 17))
    expect(next?.dayKey).toBe('2026-03-23')
    expect(nextOccurrence(ev({ id: 'p', title: 'Pasado', startAt: t(2026, 0, 1, 10), endAt: t(2026, 0, 1, 11) }), t(2026, 2, 1))).toBeNull()
  })

  it('nextExam elige el parcial, final o entrega más cercano', () => {
    const now = t(2026, 2, 10, 8)
    const exam = nextExam([
      ev({ id: 'cl', title: 'Clase', startAt: t(2026, 2, 10, 14), endAt: t(2026, 2, 10, 16) }),
      ev({ id: 'p2', title: 'Final lejos', kind: 'final', startAt: t(2026, 2, 20, 9), endAt: t(2026, 2, 20, 11) }),
      ev({ id: 'p1', title: 'Parcial', kind: 'parcial', startAt: t(2026, 2, 12, 9), endAt: t(2026, 2, 12, 11) }),
      ev({ id: 'old', title: 'Pasado', kind: 'entrega', startAt: t(2026, 2, 1, 9), endAt: t(2026, 2, 1, 10) }),
    ], now)
    expect(exam?.event.id).toBe('p1')
    expect(exam?.occurrence.dayKey).toBe('2026-03-12')
  })
})

describe('conflictos y carga', () => {
  it('no marca conflicto si uno termina cuando el otro empieza', () => {
    const a = ev({ id: 'a', title: 'A', startAt: t(2026, 2, 9, 14), endAt: t(2026, 2, 9, 15) })
    const b = ev({ id: 'b', title: 'B', startAt: t(2026, 2, 9, 15), endAt: t(2026, 2, 9, 16) })
    const c = ev({ id: 'c', title: 'C', startAt: t(2026, 2, 9, 14, 30), endAt: t(2026, 2, 9, 15, 30) })
    const range = [t(2026, 2, 9), t(2026, 2, 10)] as const
    expect(findConflicts(expandEvents([a, b], ...range))).toEqual([])
    expect(findConflicts(expandEvents([a, c], ...range))).toHaveLength(1)
  })

  it('suma horas con hora y bloques de estudio; ignora día completo', () => {
    const clase = ev({ id: 'cl', title: 'Clase', startAt: t(2026, 2, 9, 14), endAt: t(2026, 2, 9, 16) })
    const estudio = ev({ id: 'es', title: 'Estudio', kind: 'estudio', startAt: t(2026, 2, 10, 10), endAt: t(2026, 2, 10, 13) })
    const feriado = ev({ id: 'al', title: 'Feriado', allDay: true, startAt: t(2026, 2, 11), endAt: t(2026, 2, 12) })
    expect(loadHours(expandEvents([clase, estudio, feriado], t(2026, 2, 9), t(2026, 2, 13)))).toBe(5)
    expect(weekLoadHours([clase, estudio, feriado], t(2026, 2, 11))).toBe(5)
    expect(weekOverloaded(20, 20)).toBe(false)
    expect(weekOverloaded(20.5, 20)).toBe(true)
  })
})

describe('plan de estudio', () => {
  const examStart = t(2026, 2, 18, 9)
  const examEnd = t(2026, 2, 18, 11)
  const now = t(2026, 2, 9, 8)

  it('reparte 90 min hacia atrás, lun–sáb, y no usa el domingo ni el día del examen', () => {
    const slots = proposeStudyPlan({ examStart, examEnd, events: [], now, loadThreshold: 20 })
    expect(slots.length).toBeGreaterThan(0)
    for (const s of slots) {
      expect(s.endAt - s.startAt).toBe(STUDY_SLOT_MS)
      expect(new Date(s.startAt).getDay()).not.toBe(0)
      expect(s.startAt).toBeGreaterThanOrEqual(now)
      expect(s.endAt).toBeLessThanOrEqual(examStart)
    }
    const days = new Set(slots.map((s) => dayKey(s.startAt)))
    expect(days.has('2026-03-18')).toBe(false)
    expect(days.has('2026-03-15')).toBe(false)
    expect(days.has('2026-03-17')).toBe(true)
    expect(days.has('2026-03-16')).toBe(true)
    expect(days.has('2026-03-14')).toBe(true)
  })

  it('no pisa una clase y deja a lo sumo ~2 h (tope 3 h) ese día', () => {
    const clase = ev({ id: 'c', title: 'Clase', startAt: t(2026, 2, 17, 20, 30), endAt: t(2026, 2, 17, 22) })
    const slots = proposeStudyPlan({ examStart, examEnd, events: [clase], now: t(2026, 2, 16, 8), loadThreshold: 20 })
    const tue = slots.filter((s) => dayKey(s.startAt) === '2026-03-17')
    for (const s of tue) {
      expect(s.endAt <= t(2026, 2, 17, 20, 30) || s.startAt >= t(2026, 2, 17, 22)).toBe(true)
    }
    const hours = tue.reduce((a, s) => a + (s.endAt - s.startAt) / 3_600_000, 0)
    expect(hours).toBeLessThanOrEqual(3)
    expect(hours).toBeLessThanOrEqual(2)
  })

  it('no pasa el umbral semanal', () => {
    const classes = [9, 10, 11, 12, 13, 14].map((d, i) =>
      ev({ id: `h${i}`, title: 'Carga', startAt: t(2026, 2, d, 8), endAt: t(2026, 2, d, 11) }),
    )
    const slots = proposeStudyPlan({ examStart, examEnd, events: classes, now, loadThreshold: 20 })
    const weekTs = t(2026, 2, 11)
    const asEvents = slots
      .filter((s) => dayKey(startOfWeek(s.startAt)) === dayKey(startOfWeek(weekTs)))
      .map((s, i) => ev({ id: `p${i}`, title: 'Estudio', kind: 'estudio', startAt: s.startAt, endAt: s.endAt }))
    expect(weekLoadHours([...classes, ...asEvents], weekTs)).toBeLessThanOrEqual(20)
  })

  it('ignora bloques previos del mismo examen al regenerar', () => {
    const old = ev({
      id: 'old',
      title: 'Estudio',
      kind: 'estudio',
      originId: 'ex1',
      startAt: t(2026, 2, 17, 20, 30),
      endAt: t(2026, 2, 17, 22),
    })
    const withOld = proposeStudyPlan({ examStart, examEnd, events: [old], now: t(2026, 2, 16, 8), loadThreshold: 20, ignoreOriginId: 'ex1' })
    const blocked = proposeStudyPlan({ examStart, examEnd, events: [old], now: t(2026, 2, 16, 8), loadThreshold: 20 })
    const late = (s: { startAt: number; endAt: number }) => s.startAt === t(2026, 2, 17, 20, 30)
    expect(withOld.some(late)).toBe(true)
    expect(blocked.some(late)).toBe(false)
  })
})

describe('ics', () => {
  it('usa DTEND exclusivo en día completo, RRULE con UNTIL y EXDATE', () => {
    const feriado = ev({
      id: 'fer',
      title: 'Feriado',
      allDay: true,
      startAt: t(2026, 2, 9),
      endAt: t(2026, 2, 10),
      updatedAt: Date.UTC(2026, 2, 8, 12),
    })
    const clase = ev({
      id: 'alg',
      title: 'Álgebra; lab, "A"',
      notes: 'Sala 2\nPiso 1',
      location: 'Aula 4',
      startAt: t(2026, 2, 9, 14),
      endAt: t(2026, 2, 9, 16),
      repeat: 'weekly',
      repeatUntil: t(2026, 5, 29, 14),
      skipOn: ['2026-04-06'],
      updatedAt: Date.UTC(2026, 2, 8, 12),
    })
    const ics = eventsToIcs([feriado, clase])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260309')
    expect(ics).toContain('DTEND;VALUE=DATE:20260310')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;UNTIL=20260629T140000')
    expect(ics).toContain('EXDATE:20260406T140000')
    expect(ics).toContain('UID:alg@exodia')
    expect(ics).toContain('DTSTAMP:20260308T120000Z')
    expect(ics).toContain('SUMMARY:Álgebra\\; lab\\, "A"')
    expect(ics).toContain('DESCRIPTION:Sala 2\\nPiso 1')
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('escapa texto y pliega líneas largas', () => {
    expect(escapeIcsText('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne')
    const folded = foldIcsLine(`SUMMARY:${'á'.repeat(80)}`)
    const rows = folded.split('\r\n')
    expect(rows.length).toBeGreaterThan(1)
    expect(rows[1]?.startsWith(' ')).toBe(true)
    for (const row of rows) expect(new TextEncoder().encode(row).length).toBeLessThanOrEqual(75)
  })
})
