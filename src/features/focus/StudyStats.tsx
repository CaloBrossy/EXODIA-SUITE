import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { useFeedback } from '@/components/feedback'
import { Button, Field, Input, Panel } from '@/components/ui'
import { bestBand, exercisesInSpan, hoursBySubject, pomodorosByWeek, reviewsInSpan, studyStreak, tasksDone, weekCompare, yearHeat, type Span } from '@/lib/studyStats'
import { readWeekGoal, writeWeekGoal } from '@/services/studyGoal'

const hours = (min: number) => (min / 60).toLocaleString('es', { maximumFractionDigits: 1 })
const SPAN: { id: Span; label: string }[] = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
]

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sunken">
      <div className="h-full bg-accent" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  )
}

export function StudyStats() {
  const { fail, notify } = useFeedback()
  const [span, setSpan] = useState<Span>('week')
  const [goal, setGoal] = useState('10')
  const data = useLiveQuery(async () => {
    const [sessions, tasks, subjects, reviews, exercises, examRuns, cards, weekGoal] = await Promise.all([
      db.sessions.toArray(),
      db.tasks.toArray(),
      db.subjects.toArray(),
      db.reviews.toArray(),
      db.exercises.toArray(),
      db.examRuns.toArray(),
      db.cards.count(),
      readWeekGoal(),
    ])
    return { sessions, tasks, subjects, reviews, exercises, examRuns, cards, weekGoal }
  }, [])
  useEffect(() => {
    if (data) setGoal(String(data.weekGoal))
  }, [data?.weekGoal])
  if (!data) return null
  const names = new Map(data.subjects.map((s) => [s.id, s.name]))
  const bySubject = hoursBySubject(data.sessions, span)
  const maxMin = Math.max(1, ...bySubject.map((r) => r.minutes))
  const weeks = pomodorosByWeek(data.sessions)
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count))
  const band = bestBand(data.sessions)
  const cmp = weekCompare(data.sessions)
  const heat = yearHeat(data.sessions)
  const heatMax = Math.max(1, ...heat.map((d) => d.minutes))
  const lead = heat[0] ? (new Date(heat[0].day).getDay() + 6) % 7 : 0
  const goalHours = data.weekGoal
  const ratio = Math.min(1, cmp.thisMin / (goalHours * 60))
  const practice = exercisesInSpan(data.exercises, data.examRuns, span)
  const saveGoal = async () => {
    try {
      await writeWeekGoal(Number(goal))
      notify('Meta semanal guardada.', 'ok')
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Racha de <span className="font-mono text-fg">{studyStreak(data.sessions)}</span> día{studyStreak(data.sessions) === 1 ? '' : 's'} con Pomodoro.</p>
        <div className="glass inline-flex gap-1 rounded-xl p-1">
          {SPAN.map((s) => (
            <button key={s.id} type="button" className={s.id === span ? 'pill-active rounded-lg px-3 py-1 text-sm' : 'rounded-lg px-3 py-1 text-sm text-muted'} onClick={() => setSpan(s.id)}>{s.label}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Horas por materia">
          {bySubject.length === 0 && <p className="text-sm text-muted">Todavía no hay Pomodoros en este período.</p>}
          <ul className="flex flex-col gap-2">
            {bySubject.map((r) => (
              <li key={r.subjectId ?? 'none'}>
                <div className="mb-1 flex justify-between text-sm"><span>{r.subjectId ? names.get(r.subjectId) ?? 'Materia' : 'Sin materia'}</span><span className="font-mono text-xs">{hours(r.minutes)} h · {r.count}</span></div>
                <Bar value={r.minutes} max={maxMin} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Pomodoros por semana">
          <ul className="flex items-end gap-1 h-28">
            {weeks.map((w) => (
              <li key={w.weekStart} className="flex flex-1 flex-col items-center gap-1" title={`${w.count}`}>
                <div className="w-full rounded-sm bg-accent" style={{ height: `${(w.count / maxWeek) * 100}%`, minHeight: w.count ? 4 : 0 }} />
                <span className="font-mono text-[10px] text-muted">{w.count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">Mejor franja: {band ? <span className="font-mono">{band.from}–{band.from + 2} h</span> : 'sin datos'}.</p>
          <p className="text-sm text-muted">Tareas completadas: {tasksDone(data.tasks, span)}. Esta semana {hours(cmp.thisMin)} h, la anterior {hours(cmp.prevMin)} h ({cmp.delta >= 0 ? '+' : ''}{hours(cmp.delta)} h).</p>
        </Panel>
        <Panel title="Meta semanal">
          <p className="mb-2 text-sm">{hours(cmp.thisMin)} h de {goalHours} h</p>
          <Bar value={ratio} max={1} />
          <div className="mt-3 flex items-end gap-2">
            <Field label="Horas"><Input type="number" min={1} max={80} value={goal} onChange={(e) => setGoal(e.target.value)} className="w-24" /></Field>
            <Button size="sm" variant="primary" onClick={() => void saveGoal()}>Guardar</Button>
          </div>
        </Panel>
        <Panel title={`Mapa ${new Date().getFullYear()}`}>
          <div className="overflow-x-auto">
            <div className="grid grid-flow-col grid-rows-7 gap-0.5" style={{ width: 'max-content' }}>
              {Array.from({ length: lead }, (_, i) => <span key={`p${i}`} className="h-2.5 w-2.5" />)}
              {heat.map((d) => (
                <span key={d.day} title={`${new Date(d.day).toLocaleDateString('es')} · ${Math.round(d.minutes)} min`} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: d.minutes ? `color-mix(in srgb, var(--nx-accent) ${20 + (d.minutes / heatMax) * 80}%, var(--nx-sunken))` : 'var(--nx-sunken)' }} />
              ))}
            </div>
          </div>
        </Panel>
      </div>
      {(data.cards > 0 || data.exercises.length > 0) && (
        <Panel title="Repaso y ejercicios">
          <p className="text-sm">{data.cards > 0 && <>Tarjetas repasadas: {reviewsInSpan(data.reviews, span)}. </>}{data.exercises.length > 0 && <>Ejercicios intentados: {practice.attempts}. Simulados: {practice.exams}.</>}</p>
        </Panel>
      )}
    </div>
  )
}
