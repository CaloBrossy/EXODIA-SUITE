import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EVENT_KINDS, EventKindLabel, type CalendarEvent, type EventKind, type EventStatus, type Subject } from '@/db/models'
import { addDays, dayKey, parseDayKey, proposeStudyPlan, type Occurrence, type StudySlot } from '@/lib/calendar'
import { deleteEvent, EXAM_KINDS, listStudyBlocks, replaceStudyPlan, saveEvent, writeSubjectColor, type EventInput } from '@/services/calendar'
import { usePomodoro } from '@/hooks/usePomodoro'
import { useFeedback } from '@/components/feedback'
import { Button, ErrorText, Field, Input, Select, Textarea } from '@/components/ui'
import { ExamPlanner } from './ExamPlanner'

const COLORS = ['#5ee7f7', '#8b7cf6', '#e879c6', '#4ade9b', '#fb7185', '#8d98b8']

const pad = (n: number) => String(n).padStart(2, '0')
const toDateTime = (ts: number) => {
  const d = new Date(ts)
  return `${dayKey(ts)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromDateTime = (s: string) => {
  const [date, time] = s.split('T')
  const [y, m, d] = (date ?? '').split('-').map(Number)
  const [h, min] = (time ?? '00:00').split(':').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0).getTime()
}

export type PanelTarget =
  | { mode: 'new'; startAt: number; endAt: number; allDay: boolean }
  | { mode: 'edit'; event: CalendarEvent; occurrence: Occurrence }

type Form = {
  title: string
  kind: EventKind
  subjectId: string
  allDay: boolean
  start: string
  end: string
  weekly: boolean
  repeatUntil: string
  location: string
  notes: string
  status: EventStatus
  color: string
}

function formFrom(target: PanelTarget): Form {
  if (target.mode === 'new') {
    return {
      title: '',
      kind: 'clase',
      subjectId: '',
      allDay: target.allDay,
      start: target.allDay ? dayKey(target.startAt) : toDateTime(target.startAt),
      end: target.allDay ? dayKey(addDays(target.endAt, -1)) : toDateTime(target.endAt),
      weekly: false,
      repeatUntil: '',
      location: '',
      notes: '',
      status: 'pendiente',
      color: COLORS[0]!,
    }
  }
  const e = target.event
  const occ = target.occurrence
  return {
    title: e.title,
    kind: e.kind,
    subjectId: e.subjectId ?? '',
    allDay: e.allDay,
    start: e.allDay ? dayKey(occ.startAt) : toDateTime(occ.startAt),
    end: e.allDay ? dayKey(addDays(occ.endAt, -1)) : toDateTime(occ.endAt),
    weekly: e.repeat === 'weekly',
    repeatUntil: e.repeatUntil ? dayKey(e.repeatUntil) : '',
    location: e.location,
    notes: e.notes,
    status: e.status,
    color: COLORS[0]!,
  }
}

function toInput(form: Form): EventInput {
  const startAt = form.allDay ? parseDayKey(form.start) : fromDateTime(form.start)
  const endAt = form.allDay ? addDays(parseDayKey(form.end || form.start), 1) : fromDateTime(form.end)
  return {
    title: form.title,
    kind: form.kind,
    subjectId: form.subjectId || null,
    startAt,
    endAt,
    allDay: form.allDay,
    repeat: form.weekly ? 'weekly' : 'none',
    repeatUntil: form.weekly && form.repeatUntil ? addDays(parseDayKey(form.repeatUntil), 1) - 1 : null,
    location: form.location,
    notes: form.notes,
    status: form.status,
  }
}

export function EventPanel({
  target,
  subjects,
  colors,
  events,
  threshold,
  onClose,
  onBecameSaved,
}: {
  target: PanelTarget
  subjects: Subject[]
  colors: Record<string, string>
  events: CalendarEvent[]
  threshold: number
  onClose: () => void
  onBecameSaved: (event: CalendarEvent) => void
}) {
  const { fail, notify, confirm } = useFeedback()
  const navigate = useNavigate()
  const pomodoro = usePomodoro()
  const [form, setForm] = useState<Form>(() => formFrom(target))
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<StudySlot[] | null>(null)
  const eventKey = target.mode === 'edit' ? target.event.id : 'new'
  const prevKey = useRef(eventKey)
  const editing = target.mode === 'edit' ? target.event : null
  const occurrence = target.mode === 'edit' ? target.occurrence : null
  const isExam = EXAM_KINDS.includes(form.kind)

  useEffect(() => {
    const next = formFrom(target)
    next.color = (next.subjectId && colors[next.subjectId]) || COLORS[0]!
    setForm(next)
    setError('')
    const key = target.mode === 'edit' ? target.event.id : 'new'
    if (prevKey.current !== key) {
      setDraft(null)
      prevKey.current = key
    }
  }, [target, colors])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setError('')
    try {
      let input = toInput(form)
      if (form.subjectId) await writeSubjectColor(form.subjectId, form.color)
      if (editing && occurrence) {
        input = {
          ...input,
          startAt: editing.startAt + (input.startAt - occurrence.startAt),
          endAt: editing.endAt + (input.endAt - occurrence.endAt),
        }
        const blocks = EXAM_KINDS.includes(editing.kind) ? await listStudyBlocks(editing.id) : []
        if (blocks.length && input.startAt !== editing.startAt) {
          notify('El examen se movió. Los bloques de estudio no se cambiaron.', 'info')
        }
        await saveEvent({ ...input, skipOn: editing.skipOn, doneOn: editing.doneOn, originId: editing.originId, seriesId: editing.seriesId }, editing.id)
      } else {
        const created = await saveEvent(input)
        if (created.kind === 'parcial' || created.kind === 'final') {
          notify('Evento creado.', 'ok')
          onBecameSaved(created)
          return
        }
      }
      notify(editing ? 'Evento guardado.' : 'Evento creado.', 'ok')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
      fail(e)
    }
  }

  const remove = async () => {
    if (!editing) return
    const blocks = await listStudyBlocks(editing.id)
    const ok = await confirm({
      title: blocks.length ? '¿Borrar el examen y su plan de estudio?' : `¿Eliminar «${editing.title}»?`,
      body: blocks.length ? `Hay ${blocks.length} bloque${blocks.length === 1 ? '' : 's'} de estudio ligado${blocks.length === 1 ? '' : 's'} a este evento.` : undefined,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteEvent(editing.id, { cascadeStudy: blocks.length > 0 })
      notify('Evento eliminado.', 'ok')
      onClose()
    } catch (e) {
      fail(e)
    }
  }

  const persistExam = async (): Promise<CalendarEvent> => {
    let input = toInput(form)
    if (form.subjectId) await writeSubjectColor(form.subjectId, form.color)
    if (editing && occurrence) {
      input = {
        ...input,
        startAt: editing.startAt + (input.startAt - occurrence.startAt),
        endAt: editing.endAt + (input.endAt - occurrence.endAt),
        skipOn: editing.skipOn,
        doneOn: editing.doneOn,
        originId: editing.originId,
        seriesId: editing.seriesId,
      }
      return saveEvent(input, editing.id)
    }
    return saveEvent(input)
  }

  const generate = async () => {
    setError('')
    try {
      const exam = await persistExam()
      prevKey.current = exam.id
      if (!editing) onBecameSaved(exam)
      const slots = proposeStudyPlan({
        examStart: exam.startAt,
        examEnd: exam.endAt,
        events,
        now: Date.now(),
        loadThreshold: threshold,
        ignoreOriginId: exam.id,
      })
      if (slots.length === 0) {
        notify('No hay huecos libres antes del examen.', 'info')
        setDraft([])
        return
      }
      setDraft(slots)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo armar el plan')
      fail(e)
    }
  }

  const acceptPlan = async () => {
    if (!draft?.length) return
    const exam = editing
    if (!exam) return
    const existing = await listStudyBlocks(exam.id)
    if (existing.length) {
      const ok = await confirm({
        title: '¿Reemplazar el plan de estudio?',
        body: `Se van a borrar ${existing.length} bloque${existing.length === 1 ? '' : 's'} actual${existing.length === 1 ? '' : 'es'}.`,
        confirmLabel: 'Reemplazar',
      })
      if (!ok) return
    }
    try {
      await replaceStudyPlan(exam.id, draft, { title: exam.title, subjectId: exam.subjectId ?? null })
      notify('Plan de estudio guardado.', 'ok')
      onClose()
    } catch (e) {
      fail(e)
    }
  }

  const skipDay = async () => {
    if (!editing || !occurrence) return
    try {
      await saveEvent({
        title: editing.title,
        kind: editing.kind,
        subjectId: editing.subjectId,
        startAt: editing.startAt,
        endAt: editing.endAt,
        allDay: editing.allDay,
        repeat: editing.repeat,
        repeatUntil: editing.repeatUntil,
        skipOn: [...editing.skipOn, occurrence.dayKey],
        location: editing.location,
        notes: editing.notes,
        status: editing.status,
        doneOn: editing.doneOn,
        originId: editing.originId,
        seriesId: editing.seriesId,
      }, editing.id)
      notify('Ese día queda fuera de la serie.', 'ok')
      onClose()
    } catch (e) {
      fail(e)
    }
  }

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-medium">{editing ? 'Editar evento' : 'Nuevo evento'}</h2>
        <Button size="sm" variant="ghost" onClick={onClose}>Cerrar</Button>
      </div>
      <form
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
        onSubmit={(e) => { e.preventDefault(); void save() }}
      >
        <Field label="Título">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <Select value={form.kind} onChange={(e) => set('kind', e.target.value as EventKind)}>
              {EVENT_KINDS.map((k) => <option key={k} value={k}>{EventKindLabel[k]}</option>)}
            </Select>
          </Field>
          <Field label="Materia">
            <Select value={form.subjectId} onChange={(e) => set('subjectId', e.target.value)}>
              <option value="">Sin materia</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        {form.subjectId && (
          <Field label="Color">
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={form.color === c}
                  onClick={() => set('color', c)}
                  className="h-6 w-6 rounded-full border border-line"
                  style={{ background: c, boxShadow: form.color === c ? '0 0 0 2px var(--nx-accent)' : undefined }}
                />
              ))}
            </div>
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.allDay}
            onChange={(e) => {
              const on = e.target.checked
              setForm((f) => ({
                ...f,
                allDay: on,
                start: on ? f.start.slice(0, 10) : `${f.start.slice(0, 10)}T09:00`,
                end: on ? f.end.slice(0, 10) : `${f.end.slice(0, 10)}T10:00`,
              }))
            }}
          />
          Todo el día
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio">
            <Input type={form.allDay ? 'date' : 'datetime-local'} value={form.start} onChange={(e) => set('start', e.target.value)} required />
          </Field>
          <Field label="Fin">
            <Input type={form.allDay ? 'date' : 'datetime-local'} value={form.end} onChange={(e) => set('end', e.target.value)} required />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.weekly} onChange={(e) => set('weekly', e.target.checked)} />
          Repetir cada semana
        </label>
        {form.weekly && (
          <Field label="Hasta" hint="Vacío: sin fecha de corte">
            <Input type="date" value={form.repeatUntil} onChange={(e) => set('repeatUntil', e.target.value)} />
          </Field>
        )}
        <Field label="Lugar">
          <Input value={form.location} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="Notas">
          <Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <Field label="Estado">
          <Select value={form.status} onChange={(e) => set('status', e.target.value as EventStatus)}>
            <option value="pendiente">Pendiente</option>
            <option value="hecho">Hecho</option>
          </Select>
        </Field>
        <ErrorText>{error}</ErrorText>
        {draft && (
          <div className="rounded-xl border border-line bg-sunken/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted">
              {draft.length === 0 ? 'Sin huecos' : `Plan propuesto · ${draft.length} bloque${draft.length === 1 ? '' : 's'} · ${(draft.reduce((s, b) => s + (b.endAt - b.startAt), 0) / 3_600_000).toFixed(1)} h`}
            </p>
            <ul className="flex flex-col gap-2">
              {draft.map((slot, i) => (
                <li key={`${slot.startAt}-${slot.endAt}`} className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    className="font-mono text-xs"
                    value={toDateTime(slot.startAt)}
                    onChange={(e) => {
                      const startAt = fromDateTime(e.target.value)
                      setDraft((d) => d?.map((s, j) => j === i ? { startAt, endAt: startAt + (s.endAt - s.startAt) } : s) ?? d)
                    }}
                  />
                  <span className="shrink-0 font-mono text-[11px] text-muted">{toDateTime(slot.endAt).slice(11)}</span>
                  <Button size="sm" variant="ghost" onClick={() => setDraft((d) => d?.filter((_, j) => j !== i) ?? d)}>Quitar</Button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" disabled={!draft.length} onClick={() => void acceptPlan()}>Aceptar plan</Button>
              <Button size="sm" onClick={() => setDraft(null)}>Descartar</Button>
            </div>
          </div>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button type="submit" variant="primary">Guardar</Button>
          <Button onClick={onClose}>Cancelar</Button>
          {isExam && <Button onClick={() => void generate()}>Generar plan</Button>}
          {editing?.kind === 'estudio' && (
            <Button onClick={() => {
              void pomodoro.link(null, editing.subjectId ?? null).then(() => pomodoro.start()).then(() => {
                onClose()
                navigate('/focus')
              }).catch(fail)
            }}>Pomodoro</Button>
          )}
          {editing && <Button variant="danger" onClick={() => void remove()}>Eliminar</Button>}
          {editing?.repeat === 'weekly' && occurrence && (
            <Button onClick={() => void skipDay()}>Omitir este día</Button>
          )}
        </div>
        {editing && (editing.kind === 'parcial' || editing.kind === 'final') && (
          <ExamPlanner exam={editing} events={events} threshold={threshold} />
        )}
      </form>
    </aside>
  )
}
