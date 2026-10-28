import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db/db'
import type { CalendarEvent, ExamPlan, ExamTopic } from '@/db/models'
import { proposeStudyPlan } from '@/lib/calendar'
import { assignSessions, planStatus, reassignSessions, topicSummary, type PlanSession } from '@/lib/examPlan'
import { uid } from '@/lib/text'
import { saveNamedStudyPlan } from '@/services/calendar'
import { planForEvent, saveExamPlan } from '@/services/examPlans'
import { usePomodoro } from '@/hooks/usePomodoro'
import { useFeedback } from '@/components/feedback'
import { Button, Field, Input, Select } from '@/components/ui'

const fmt = (ts: number) => new Date(ts).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function ExamPlanner({ exam, events, threshold }: { exam: CalendarEvent; events: CalendarEvent[]; threshold: number }) {
  const navigate = useNavigate()
  const pomodoro = usePomodoro()
  const { fail, notify } = useFeedback()
  const concepts = useLiveQuery(() => db.concepts.toArray(), [])
  const subject = useLiveQuery(() => (exam.subjectId ? db.subjects.get(exam.subjectId) : undefined), [exam.subjectId])
  const [plan, setPlan] = useState<ExamPlan | null>(null)
  const [hours, setHours] = useState('2')
  const [title, setTitle] = useState('')
  const [topics, setTopics] = useState<ExamTopic[]>([])
  const [sessions, setSessions] = useState<PlanSession[]>([])
  const [ask, setAsk] = useState<{ id: string; mastery: number } | null>(null)

  useEffect(() => {
    let alive = true
    void planForEvent(exam.id).then((p) => {
      if (!alive || !p) return
      setPlan(p)
      setHours(String(p.hoursPerDay))
      setTopics(p.topics)
      setSessions(p.sessions)
    }).catch(() => {})
    return () => { alive = false }
  }, [exam.id])

  const addTopic = (partial: Partial<ExamTopic> & { title: string }) => {
    const name = partial.title.trim()
    if (!name || topics.some((t) => t.title === name)) return
    setTopics([...topics, { id: partial.id ?? uid(), title: name, conceptId: partial.conceptId ?? null, mastery: partial.mastery ?? 3 }])
  }

  const persist = async (nextTopics: ExamTopic[], nextSessions: PlanSession[], nextHours = Number(hours) || 2) => {
    const saved = await saveExamPlan({
      eventId: exam.id,
      subjectId: exam.subjectId ?? null,
      hoursPerDay: nextHours,
      topics: nextTopics,
      sessions: nextSessions,
    }, plan?.id)
    setPlan(saved)
    setTopics(saved.topics)
    setSessions(saved.sessions)
    return saved
  }

  const build = async (keepDone = false) => {
    try {
      const h = Number(hours)
      if (!topics.length) throw new Error('Agregá al menos un tema')
      if (!(h >= 1)) throw new Error('Indicá las horas por día')
      const slots = proposeStudyPlan({
        examStart: exam.startAt,
        examEnd: exam.endAt,
        events,
        now: Date.now(),
        loadThreshold: threshold,
        ignoreOriginId: exam.id,
        targetDayHours: h,
      })
      if (!slots.length) throw new Error('No hay huecos libres antes del examen')
      const done = keepDone ? sessions.filter((s) => s.done) : []
      const fresh = assignSessions(slots, topics, exam.startAt).filter((s) => !done.some((d) => d.startAt === s.startAt))
      await persist(topics, [...done, ...fresh].sort((a, b) => a.startAt - b.startAt), h)
      notify(keepDone ? 'Plan reajustado.' : 'Plan armado.', 'ok')
    } catch (e) { fail(e) }
  }

  const finish = async (session: PlanSession, mastery?: number) => {
    try {
      const nextTopics = mastery && session.topicId
        ? topics.map((t) => (t.id === session.topicId ? { ...t, mastery } : t))
        : topics
      const marked = sessions.map((s) => (s.id === session.id ? { ...s, done: true } : s))
      const next = mastery && mastery !== topics.find((t) => t.id === session.topicId)?.mastery
        ? reassignSessions(marked, nextTopics, exam.startAt)
        : marked
      await persist(nextTopics, next)
      setAsk(null)
    } catch (e) { fail(e) }
  }

  const send = async () => {
    try {
      await saveNamedStudyPlan(exam.id, sessions.map((s) => ({
        startAt: s.startAt,
        endAt: s.endAt,
        title: s.kind === 'tema' ? `Estudio: ${topics.find((t) => t.id === s.topicId)?.title ?? exam.title}` : s.kind === 'repaso' ? `Repaso: ${exam.title}` : `Simulacro: ${exam.title}`,
        notes: `${s.reason}\nplan:${s.id}`,
        status: s.done ? 'hecho' as const : 'pendiente' as const,
      })), exam.subjectId ?? null)
      notify('Sesiones en el calendario.', 'ok')
    } catch (e) { fail(e) }
  }

  const status = planStatus(sessions, Date.now())
  const summary = topicSummary(sessions, topics)

  return (
    <div className="mt-2 border-t border-line pt-3">
      <h3 className="mb-2 text-sm font-medium">Plan por temas</h3>
      <Field label="Horas por día">
        <Input type="number" min={1} max={8} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} />
      </Field>
      <p className="mt-1 text-xs text-muted">Cada sesión dura 90 min. Con 2 h entra una por día; con 3 h, dos.</p>
      <div className="mt-2 flex gap-2">
        <Input value={title} placeholder="Tema" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic({ title }); setTitle('') } }} />
        <Button size="sm" onClick={() => { addTopic({ title }); setTitle('') }}>Agregar</Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Select className="h-8" aria-label="Concepto" value="" onChange={(e) => { const c = concepts?.find((x) => x.id === e.target.value); if (c) addTopic({ title: c.title, conceptId: c.id, id: uid() }) }}>
          <option value="">Desde un concepto…</option>
          {concepts?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </Select>
        {subject?.objectives && (
          <Button size="sm" onClick={() => subject.objectives.split('\n').forEach((line) => addTopic({ title: line }))}>Objetivos de la materia</Button>
        )}
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {topics.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <Select className="h-8 w-16" aria-label={`Dominio de ${t.title}`} value={String(t.mastery)} onChange={(e) => setTopics(topics.map((x) => (x.id === t.id ? { ...x, mastery: Number(e.target.value) } : x)))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
            <Button size="sm" variant="ghost" aria-label={`Quitar ${t.title}`} onClick={() => setTopics(topics.filter((x) => x.id !== t.id))}>×</Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => void build()}>Armar plan</Button>
        {sessions.length > 0 && <Button size="sm" onClick={() => void send()}>Enviar al calendario</Button>}
      </div>
      {sessions.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 h-2 overflow-hidden rounded-full bg-sunken">
            <div className="h-full bg-accent" style={{ width: `${Math.round(status.ratio * 100)}%` }} />
          </div>
          <p className="text-xs text-muted">{status.done}/{status.total} sesiones</p>
          {status.behind > 0 && (
            <p className="mt-1 text-xs text-danger">
              Vas atrasado: {status.behind} sesión{status.behind === 1 ? '' : 'es'} vencida{status.behind === 1 ? '' : 's'}.
              <Button size="sm" className="ml-2" onClick={() => void build(true)}>Reajustar</Button>
            </p>
          )}
          <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
            {summary.filter((t) => t.count).map((t) => <li key={t.id}>{t.reason}</li>)}
          </ul>
          <ul className="mt-2 flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-lg border border-line p-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{fmt(s.startAt)} · {s.kind === 'tema' ? topics.find((t) => t.id === s.topicId)?.title : s.kind === 'repaso' ? 'Repaso' : 'Simulacro'}</span>
                  <span className="flex gap-1">
                    {!s.done && <Button size="sm" onClick={() => s.topicId ? setAsk({ id: s.id, mastery: topics.find((t) => t.id === s.topicId)?.mastery ?? 3 }) : void finish(s)}>Hecha</Button>}
                    <Button size="sm" variant="ghost" onClick={() => {
                      void pomodoro.link(null, exam.subjectId ?? null).then(() => pomodoro.start()).then(() => navigate('/focus')).catch(fail)
                    }}>Pomodoro</Button>
                  </span>
                </div>
                <p className="text-xs text-muted">{s.reason}{s.done ? ' · hecha' : ''}</p>
                {ask?.id === s.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs">¿El dominio quedó en</span>
                    <Select className="h-8 w-16" aria-label="Nuevo dominio" value={String(ask.mastery)} onChange={(e) => setAsk({ ...ask, mastery: Number(e.target.value) })}>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                    <Button size="sm" variant="primary" onClick={() => void finish(s, ask.mastery)}>Recalcular</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
