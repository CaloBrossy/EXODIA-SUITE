import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NavLink, Navigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { db } from '@/db/db'
import { usePomodoro } from '@/hooks/usePomodoro'
import { PhaseLabel, type PomodoroConfig } from '@/lib/pomodoro'
import { deleteSession, saveConfig, validateConfig } from '@/services/focus'
import { useFeedback } from '@/components/feedback'
import { Button, cx, ErrorText, Field, Input, Panel, pillClass } from '@/components/ui'
import { formatDateTime } from '@/lib/text'
import { PomodoroTimer } from './PomodoroTimer'
import { SessionSummary } from './SessionSummary'
import { Plan } from './Plan'
import { Subjects } from './Subjects'
import { Tasks } from './Tasks'
import { StudyStats } from './StudyStats'

function PomodoroSettings() {
  const { config, state } = usePomodoro()
  const { fail, notify } = useFeedback()
  const [form, setForm] = useState<PomodoroConfig>(config)
  useEffect(() => setForm(config), [config.workMin, config.shortMin, config.longMin, config.longEvery, config.autoStartNext])
  const err = validateConfig(form)
  const num = (k: keyof PomodoroConfig, label: string, unit: string) => (
    <Field label={label}>
      <div className="flex items-center gap-1.5">
        <Input type="number" min={1} step={k === 'longEvery' ? 1 : 0.5} value={String(form[k])} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} className="w-20 font-mono" />
        <span className="text-xs text-muted">{unit}</span>
      </div>
    </Field>
  )
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        try {
          await saveConfig(form)
          notify(state.status === 'idle' ? 'Configuración guardada.' : 'Guardada. Se aplicará al reiniciar o en la próxima fase.', 'ok')
        } catch (x) {
          fail(x)
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {num('workMin', 'Concentración', 'min')}
        {num('shortMin', 'Descanso corto', 'min')}
        {num('longMin', 'Descanso largo', 'min')}
        {num('longEvery', 'Descanso largo cada', 'sesiones')}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoStartNext} onChange={(e) => setForm({ ...form, autoStartNext: e.target.checked })} /> Iniciar automáticamente la siguiente fase</label>
      {err && <ErrorText>{err}</ErrorText>}
      <Button type="submit" size="sm" variant="primary" className="self-start" disabled={!!err}>Guardar</Button>
      <p className="text-xs text-muted">
        El tiempo se calcula con la hora del sistema, no con el ritmo de los temporizadores del navegador: sigue siendo exacto en segundo plano. La notificación de escritorio requiere permiso y que EXODIA esté abierto en alguna pestaña.
      </p>
    </form>
  )
}

function SessionLog() {
  const { fail } = useFeedback()
  const data = useLiveQuery(async () => {
    const sessions = await db.sessions.orderBy('startedAt').reverse().limit(30).toArray()
    const [tasks, subjects] = await Promise.all([db.tasks.toArray(), db.subjects.toArray()])
    return { sessions, tasks: new Map(tasks.map((t) => [t.id, t.title])), subjects: new Map(subjects.map((s) => [s.id, s.name])) }
  }, [])
  if (!data) return null
  if (data.sessions.length === 0) return <p className="text-sm text-muted">Las fases que completes se registrarán aquí.</p>
  return (
    <ul className="flex flex-col">
      {data.sessions.map((s) => (
        <li key={s.id} className="group flex items-center gap-3 border-b border-line py-1.5 text-sm last:border-0">
          <span className={cx('w-28 shrink-0', s.phase === 'work' ? '' : 'text-muted')}>{PhaseLabel[s.phase]}</span>
          <span className="font-mono text-xs tabular">{Math.round(s.durationMs / 60000)} min</span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted">{[s.subjectId && data.subjects.get(s.subjectId), s.taskId && data.tasks.get(s.taskId)].filter(Boolean).join(' · ')}</span>
          <span className="text-xs text-muted">{formatDateTime(s.endedAt)}</span>
          <button aria-label="Eliminar registro" onClick={() => deleteSession(s.id).catch(fail)} className="text-muted opacity-40 group-hover:opacity-100 hover:text-danger"><Trash2 size={12} /></button>
        </li>
      ))}
    </ul>
  )
}

const TABS = [
  { id: 'timer', label: 'Pomodoro', to: '/focus' },
  { id: 'tasks', label: 'Tareas', to: '/focus/tasks' },
  { id: 'subjects', label: 'Materias', to: '/focus/subjects' },
  { id: 'plan', label: 'Plan de estudios', to: '/focus/plan' },
  { id: 'stats', label: 'Estadísticas', to: '/focus/stats' },
]

export default function FocusPage() {
  const { tab = 'timer' } = useParams()
  if (!TABS.some((t) => t.id === tab)) return <Navigate to="/focus" replace />
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-gradient text-2xl font-semibold tracking-tight">Focus</h1>
        <nav className="glass inline-flex flex-wrap gap-1 rounded-xl p-1">
          {TABS.map((t) => (
            <NavLink key={t.id} to={t.to} end className={({ isActive }) => pillClass(isActive)}>{t.label}</NavLink>
          ))}
        </nav>
      </div>
      {tab === 'timer' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-5">
            <Panel bodyClass="py-8 flex justify-center"><PomodoroTimer /></Panel>
            <Panel title="Últimas sesiones"><SessionLog /></Panel>
          </div>
          <div className="flex flex-col gap-5">
            <Panel title="Resumen (7 días)"><SessionSummary /></Panel>
            <Panel title="Configuración"><PomodoroSettings /></Panel>
          </div>
        </div>
      )}
      {tab === 'tasks' && <Tasks />}
      {tab === 'subjects' && <Subjects />}
      {tab === 'plan' && <Plan />}
      {tab === 'stats' && <StudyStats />}
    </div>
  )
}
