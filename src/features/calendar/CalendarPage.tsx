import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { EventKindLabel, type CalendarEvent } from '@/db/models'
import {
  addDays,
  dayKey,
  eventsToIcs,
  expandEvents,
  findConflicts,
  monthGrid,
  occupiedDays,
  occurrencesOnDay,
  parseDayKey,
  startOfDay,
  startOfMonth,
  startOfWeek,
  weekLoadHours,
  weekOverloaded,
  type Occurrence,
} from '@/lib/calendar'
import { formatLongDate } from '@/lib/text'
import { downloadFile } from '@/services/backup'
import { listEvents, readLoadHours, readSubjectColors, writeLoadHours } from '@/services/calendar'
import { listSubjects } from '@/services/focus'
import { useFeedback } from '@/components/feedback'
import { Button, Empty, ErrorText, Field, Input, Loading, PageHeader, Panel, Tabs, cx } from '@/components/ui'
import { EventPanel, type PanelTarget } from './EventPanel'

type View = 'mes' | 'semana' | 'dia' | 'agenda'
const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7)
const MONTH = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
const DAY_SHORT = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })
const TIME = (ts: number) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function shift(ts: number, view: View, dir: number): number {
  if (view === 'mes') {
    const d = new Date(ts)
    d.setMonth(d.getMonth() + dir)
    return d.getTime()
  }
  return addDays(ts, dir * (view === 'semana' ? 7 : 1))
}

function rangeOf(view: View, cursor: number): [number, number] {
  if (view === 'mes') {
    const cells = monthGrid(cursor)
    return [cells[0]!, addDays(cells[41]!, 1)]
  }
  if (view === 'semana') return [startOfWeek(cursor), addDays(startOfWeek(cursor), 7)]
  if (view === 'agenda') return [startOfDay(cursor), addDays(startOfDay(cursor), 60)]
  return [startOfDay(cursor), addDays(startOfDay(cursor), 1)]
}

function colorOf(event: CalendarEvent, colors: Record<string, string>) {
  return (event.subjectId && colors[event.subjectId]) || '#5ee7f7'
}

function Chip({ occ, event, colors, onOpen }: { occ: Occurrence; event: CalendarEvent; colors: Record<string, string>; onOpen: (o: Occurrence) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(occ) }}
      className="block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight text-[#03141b]"
      style={{ background: colorOf(event, colors) }}
    >
      {event.allDay ? event.title : `${TIME(occ.startAt)} ${event.title}`}
    </button>
  )
}

export default function CalendarPage() {
  const { fail, notify } = useFeedback()
  const [params] = useSearchParams()
  const dayFromUrl = params.get('day')
  const [cursor, setCursor] = useState(() => (dayFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dayFromUrl) ? parseDayKey(dayFromUrl) : Date.now()))
  const [view, setView] = useState<View>('mes')
  const [selectedDay, setSelectedDay] = useState(() => (dayFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dayFromUrl) ? dayFromUrl : dayKey(Date.now())))
  const [target, setTarget] = useState<PanelTarget | null>(null)
  const [thresholdDraft, setThresholdDraft] = useState('')
  useEffect(() => {
    if (!dayFromUrl || !/^\d{4}-\d{2}-\d{2}$/.test(dayFromUrl)) return
    setCursor(parseDayKey(dayFromUrl))
    setSelectedDay(dayFromUrl)
  }, [dayFromUrl])
  const data = useLiveQuery(async () => ({
    events: await listEvents(),
    subjects: await listSubjects(),
    colors: await readSubjectColors(),
    threshold: await readLoadHours(),
  }), [])

  const events = data?.events ?? []
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events])
  const [from, to] = rangeOf(view, cursor)
  const occs = useMemo(() => expandEvents(events, from, to), [events, from, to])
  const conflicts = useMemo(() => findConflicts(occs), [occs])
  const weekHours = useMemo(() => weekLoadHours(events, cursor), [events, cursor])
  const overloaded = data ? weekOverloaded(weekHours, data.threshold) : false

  const openOcc = (occ: Occurrence) => {
    const event = byId.get(occ.eventId)
    if (event) setTarget({ mode: 'edit', event, occurrence: occ })
  }
  const openSlot = (startAt: number, endAt: number, allDay: boolean) => {
    setSelectedDay(dayKey(startAt))
    setTarget({ mode: 'new', startAt, endAt, allDay })
  }

  const label =
    view === 'mes' ? MONTH.format(cursor) :
    view === 'semana' ? `${DAY_SHORT.format(startOfWeek(cursor))} – ${DAY_SHORT.format(addDays(startOfWeek(cursor), 6))}` :
    formatLongDate(startOfDay(cursor))

  if (!data) return <div className="p-6"><Loading /></div>

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col p-4 md:p-6">
      <PageHeader
        title="Calendario"
        subtitle="Clases, exámenes y bloques de estudio en este dispositivo."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={view} onChange={setView} items={[{ id: 'mes', label: 'Mes' }, { id: 'semana', label: 'Semana' }, { id: 'dia', label: 'Día' }, { id: 'agenda', label: 'Agenda' }]} />
            <Button size="sm" onClick={() => { const now = Date.now(); setCursor(now); setSelectedDay(dayKey(now)) }}>Hoy</Button>
            <Button size="icon" aria-label="Anterior" onClick={() => setCursor((c) => shift(c, view, -1))}><ChevronLeft size={16} /></Button>
            <Button size="icon" aria-label="Siguiente" onClick={() => setCursor((c) => shift(c, view, 1))}><ChevronRight size={16} /></Button>
            <Button size="sm" onClick={() => {
              try {
                downloadFile(eventsToIcs(events), `exodia-${dayKey(Date.now())}.ics`, 'text/calendar;charset=utf-8')
                notify('Calendario exportado.', 'ok')
              } catch (e) {
                fail(e)
              }
            }}><Download size={14} /> .ics</Button>
            <Button size="sm" variant="primary" onClick={() => openSlot(startOfDay(cursor), addDays(startOfDay(cursor), 1), true)}>Nuevo</Button>
          </div>
        }
      />
      <p className="mb-3 font-mono text-sm tracking-wide text-muted uppercase">{label}</p>
      <div className="mb-3 flex flex-wrap items-end gap-3 text-sm">
        <p className={cx('font-mono text-xs', overloaded ? 'text-danger' : 'text-muted')}>
          Carga de la semana: {weekHours.toFixed(1)} h / {data.threshold} h
        </p>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const n = Number(thresholdDraft || data.threshold)
            writeLoadHours(n).then(() => { notify('Umbral guardado.', 'ok'); setThresholdDraft('') }).catch(fail)
          }}
        >
          <Field label="Umbral (h)">
            <Input className="w-20 font-mono" type="number" min={1} step={0.5} value={thresholdDraft || String(data.threshold)} onChange={(e) => setThresholdDraft(e.target.value)} />
          </Field>
          <Button size="sm" type="submit">Aplicar</Button>
        </form>
      </div>
      {overloaded && <div className="mb-3"><ErrorText>Esta semana supera el umbral de {data.threshold} h.</ErrorText></div>}
      {conflicts.length > 0 && (
        <p className="mb-3 text-xs text-muted">
          {conflicts.length} conflicto{conflicts.length === 1 ? '' : 's'} de horario: {conflicts.slice(0, 3).map((c) => {
            const a = byId.get(c.a.eventId)?.title
            const b = byId.get(c.b.eventId)?.title
            return `${a} / ${b}`
          }).join(' · ')}
        </p>
      )}

      <div className={cx('grid min-h-0 flex-1 gap-4', target ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : '')}>
        <div className="min-h-0 overflow-y-auto">
          {view === 'mes' && (
            <MonthView
              cursor={cursor}
              selectedDay={selectedDay}
              occs={occs}
              byId={byId}
              colors={data.colors}
              onSelectDay={setSelectedDay}
              onOpen={openOcc}
              onSlot={openSlot}
            />
          )}
          {view === 'semana' && <WeekView cursor={cursor} occs={occs} byId={byId} colors={data.colors} onOpen={openOcc} onSlot={openSlot} />}
          {view === 'dia' && <DayView cursor={cursor} occs={occs} byId={byId} colors={data.colors} onOpen={openOcc} onSlot={openSlot} />}
          {view === 'agenda' && <AgendaView occs={occs} byId={byId} colors={data.colors} onOpen={openOcc} />}
        </div>
        {target && (
          <div className="glass bg-overlay fixed inset-0 z-50 overflow-y-auto md:static md:z-auto md:rounded-2xl">
            <EventPanel
              target={target}
              subjects={data.subjects}
              colors={data.colors}
              events={data.events}
              threshold={data.threshold}
              onClose={() => setTarget(null)}
              onBecameSaved={(event) => {
                const days = occupiedDays(event.startAt, event.endAt)
                setTarget({
                  mode: 'edit',
                  event,
                  occurrence: {
                    eventId: event.id,
                    startAt: event.startAt,
                    endAt: event.endAt,
                    allDay: event.allDay,
                    dayKey: days[0] ?? dayKey(event.startAt),
                    days,
                    done: event.status === 'hecho',
                  },
                })
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function MonthView({
  cursor, selectedDay, occs, byId, colors, onSelectDay, onOpen, onSlot,
}: {
  cursor: number
  selectedDay: string
  occs: Occurrence[]
  byId: Map<string, CalendarEvent>
  colors: Record<string, string>
  onSelectDay: (k: string) => void
  onOpen: (o: Occurrence) => void
  onSlot: (start: number, end: number, allDay: boolean) => void
}) {
  const monthStart = startOfMonth(cursor)
  const cells = monthGrid(cursor)
  const selected = parseDayKey(selectedDay)
  const dayOccs = occurrencesOnDay(occs, selectedDay)
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-px rounded-2xl border border-line bg-line">
        {WEEKDAYS.map((d) => <div key={d} className="bg-panel px-1 py-1.5 text-center font-mono text-[10px] tracking-wider text-muted uppercase">{d}</div>)}
        {cells.map((day) => {
          const key = dayKey(day)
          const inMonth = startOfMonth(day) === monthStart
          const items = occurrencesOnDay(occs, key)
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelectDay(key)
                if (window.matchMedia('(min-width: 768px)').matches) onSlot(day, addDays(day, 1), true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectDay(key)
                  onSlot(day, addDays(day, 1), true)
                }
              }}
              className={cx(
                'flex min-h-16 cursor-pointer flex-col gap-0.5 bg-panel p-1 text-left md:min-h-24',
                !inMonth && 'opacity-40',
                key === selectedDay && 'bg-sunken',
              )}
            >
              <span className="font-mono text-[11px] text-muted">{new Date(day).getDate()}</span>
              <span className="flex gap-0.5 md:hidden">
                {items.slice(0, 3).map((o) => {
                  const ev = byId.get(o.eventId)
                  return ev ? <span key={`${o.eventId}-${o.startAt}`} className="h-1.5 w-1.5 rounded-full" style={{ background: colorOf(ev, colors) }} /> : null
                })}
              </span>
              <div className="hidden flex-col gap-0.5 md:flex">
                {items.slice(0, 3).map((o) => {
                  const ev = byId.get(o.eventId)
                  return ev ? <Chip key={`${o.eventId}-${o.startAt}`} occ={o} event={ev} colors={colors} onOpen={onOpen} /> : null
                })}
                {items.length > 3 && <span className="text-[10px] text-muted">+{items.length - 3}</span>}
              </div>
            </div>
          )
        })}
      </div>
      <Panel title={formatLongDate(selected)} className="md:hidden" actions={<Button size="sm" onClick={() => onSlot(selected, addDays(selected, 1), true)}>Crear</Button>}>
        {dayOccs.length === 0 ? (
          <Empty title="Nada este día" action={<Button size="sm" onClick={() => onSlot(selected, addDays(selected, 1), true)}>Crear</Button>}>
            Tocá Crear o usá Nuevo.
          </Empty>
        ) : (
          <ul className="flex flex-col gap-1">
            {dayOccs.map((o) => {
              const ev = byId.get(o.eventId)
              if (!ev) return null
              return (
                <li key={`${o.eventId}-${o.startAt}`}>
                  <Chip occ={o} event={ev} colors={colors} onOpen={onOpen} />
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function weekdayLabel(day: number) {
  return WEEKDAYS[(new Date(day).getDay() + 6) % 7] ?? ''
}

function blockBox(o: Occurrence, day: number) {
  const visStart = Math.max(o.startAt, day)
  const visEnd = Math.min(o.endAt, addDays(day, 1))
  const startH = (visStart - day) / 3_600_000
  const endH = (visEnd - day) / 3_600_000
  const topH = Math.max(startH, 7)
  const botH = Math.min(endH, 23)
  return {
    top: `${((topH - 7) / 16) * 100}%`,
    height: `${Math.max(((botH - topH) / 16) * 100, 6)}%`,
  }
}

function TimeGrid({
  days, occs, byId, colors, onOpen, onSlot,
}: {
  days: number[]
  occs: Occurrence[]
  byId: Map<string, CalendarEvent>
  colors: Record<string, string>
  onOpen: (o: Occurrence) => void
  onSlot: (start: number, end: number, allDay: boolean) => void
}) {
  const cols = `3rem repeat(${days.length}, minmax(0,1fr))`
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: cols }}>
        <div className="border-b border-line bg-panel" />
        {days.map((day) => (
          <button key={day} type="button" className="border-b border-l border-line bg-panel px-1 py-2 text-center font-mono text-[10px] text-muted uppercase" onClick={() => onSlot(day, addDays(day, 1), true)}>
            {weekdayLabel(day)} {new Date(day).getDate()}
          </button>
        ))}
      </div>
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: cols }}>
        <div className="border-b border-line px-1 py-1 font-mono text-[10px] text-muted">Día</div>
        {days.map((day) => (
          <div key={`ad-${day}`} className="flex min-h-8 flex-col gap-0.5 border-b border-l border-line p-1">
            {occurrencesOnDay(occs, dayKey(day)).filter((o) => o.allDay).map((o) => {
              const ev = byId.get(o.eventId)
              return ev ? <Chip key={`${o.eventId}-${o.startAt}`} occ={o} event={ev} colors={colors} onOpen={onOpen} /> : null
            })}
          </div>
        ))}
      </div>
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: cols }}>
        <div>
          {HOURS.map((h) => (
            <div key={h} className="h-12 border-b border-line pr-1 text-right font-mono text-[10px] text-muted">{padHour(h)}</div>
          ))}
        </div>
        {days.map((day) => (
          <div key={day} className="relative border-l border-line">
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                aria-label={`${dayKey(day)} ${padHour(h)}`}
                className="block h-12 w-full border-b border-line hover:bg-sunken"
                onClick={() => {
                  const start = new Date(day)
                  start.setHours(h, 0, 0, 0)
                  onSlot(start.getTime(), start.getTime() + 3_600_000, false)
                }}
              />
            ))}
            {occurrencesOnDay(occs, dayKey(day)).filter((o) => !o.allDay).map((o) => {
              const ev = byId.get(o.eventId)
              if (!ev) return null
              return (
                <button
                  key={`${o.eventId}-${o.startAt}`}
                  type="button"
                  onClick={() => onOpen(o)}
                  className="absolute right-0.5 left-0.5 overflow-hidden rounded-md px-1 py-0.5 text-left text-[11px] text-[#03141b]"
                  style={{ ...blockBox(o, day), background: colorOf(ev, colors) }}
                >
                  {TIME(o.startAt)} {ev.title}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function padHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}

function WeekView({ cursor, occs, byId, colors, onOpen, onSlot }: { cursor: number; occs: Occurrence[]; byId: Map<string, CalendarEvent>; colors: Record<string, string>; onOpen: (o: Occurrence) => void; onSlot: (s: number, e: number, a: boolean) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))
  return <TimeGrid days={days} occs={occs} byId={byId} colors={colors} onOpen={onOpen} onSlot={onSlot} />
}

function DayView({ cursor, occs, byId, colors, onOpen, onSlot }: { cursor: number; occs: Occurrence[]; byId: Map<string, CalendarEvent>; colors: Record<string, string>; onOpen: (o: Occurrence) => void; onSlot: (s: number, e: number, a: boolean) => void }) {
  return <TimeGrid days={[startOfDay(cursor)]} occs={occs} byId={byId} colors={colors} onOpen={onOpen} onSlot={onSlot} />
}

function AgendaView({ occs, byId, colors, onOpen }: { occs: Occurrence[]; byId: Map<string, CalendarEvent>; colors: Record<string, string>; onOpen: (o: Occurrence) => void }) {
  const groups = new Map<string, Occurrence[]>()
  for (const o of occs) {
    const list = groups.get(o.dayKey) ?? []
    list.push(o)
    groups.set(o.dayKey, list)
  }
  if (groups.size === 0) return <Empty title="Sin eventos en los próximos 60 días">Creá una clase o un examen con Nuevo.</Empty>
  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([key, list]) => (
        <Panel key={key} title={formatLongDate(parseDayKey(key))}>
          <ul className="flex flex-col gap-1">
            {list.map((o) => {
              const ev = byId.get(o.eventId)
              if (!ev) return null
              return (
                <li key={`${o.eventId}-${o.startAt}`} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 font-mono text-xs text-muted">{ev.allDay ? 'Día completo' : `${TIME(o.startAt)}–${TIME(o.endAt)}`}</span>
                  <Chip occ={o} event={ev} colors={colors} onOpen={onOpen} />
                  <span className="text-xs text-muted">{EventKindLabel[ev.kind]}</span>
                </li>
              )
            })}
          </ul>
        </Panel>
      ))}
    </div>
  )
}
