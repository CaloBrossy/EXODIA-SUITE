import { useLiveQuery } from 'dexie-react-hooks'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { db } from '@/db/db'
import { usePomodoro } from '@/hooks/usePomodoro'
import { formatClock, PhaseLabel, progress, remaining, type Phase } from '@/lib/pomodoro'
import { listSubjects } from '@/services/focus'
import { useFeedback } from '@/components/feedback'
import { Button, cx, Select } from '@/components/ui'

function Ring({ value, size }: { value: number; size: number }) {
  const r = size / 2 - 6
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--nx-line)" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--nx-accent)" strokeWidth={5} strokeDasharray={c} strokeDashoffset={c * (1 - value)} strokeLinecap="round" />
    </svg>
  )
}

export function PomodoroTimer({ compact = false }: { compact?: boolean }) {
  const p = usePomodoro()
  const { fail } = useFeedback()
  const links = useLiveQuery(async () => ({
    tasks: (await db.tasks.toArray()).filter((t) => !t.done),
    subjects: (await listSubjects()).filter((s) => !s.archived),
  }), [])
  const { state, now } = p
  const rem = remaining(state, now)
  const size = compact ? 132 : 220
  const run = (fn: () => Promise<unknown>) => void fn().catch(fail)

  return (
    <div className={cx('flex items-center gap-5', compact ? 'flex-row' : 'flex-col')}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <Ring value={progress(state, now)} size={size} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cx('font-mono tabular', compact ? 'text-2xl' : 'text-5xl')} role="timer" aria-live="off">{formatClock(rem)}</span>
          <span className="text-xs text-muted">{PhaseLabel[state.phase]}{state.status === 'paused' && ' · en pausa'}</span>
        </div>
      </div>
      <div className={cx('flex flex-col gap-3', compact ? 'min-w-0 flex-1' : 'w-full max-w-sm items-center')}>
        {!compact && (
          <div className="inline-flex gap-1 rounded-md border border-line p-0.5">
            {(['work', 'short', 'long'] as Phase[]).map((ph) => (
              <button key={ph} disabled={state.status === 'running'} onClick={() => run(() => p.switchPhase(ph))} className={cx('rounded px-2.5 py-1 text-xs disabled:opacity-50', state.phase === ph ? 'bg-sunken font-medium' : 'text-muted')}>
                {PhaseLabel[ph]}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {state.status === 'running' ? (
            <Button variant="primary" onClick={() => run(p.pause)}><Pause size={15} /> Pausar</Button>
          ) : (
            <Button variant="primary" onClick={() => run(p.start)}><Play size={15} /> {state.status === 'paused' ? 'Reanudar' : 'Iniciar'}</Button>
          )}
          <Button onClick={() => run(p.reset)} disabled={state.status === 'idle'} title="Reiniciar fase"><RotateCcw size={15} /> Reiniciar</Button>
        </div>
        {!compact && links && (
          <div className="grid w-full grid-cols-2 gap-2">
            <Select aria-label="Materia" value={state.subjectId ?? ''} onChange={(e) => run(() => p.link(state.taskId, e.target.value || null))} className="h-8 text-xs">
              <option value="">Sin materia</option>
              {links.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select aria-label="Tarea" value={state.taskId ?? ''} onChange={(e) => run(() => p.link(e.target.value || null, state.subjectId))} className="h-8 text-xs">
              <option value="">Sin tarea</option>
              {links.tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>
          </div>
        )}
        <p className="text-xs text-muted">Sesiones de concentración en este ciclo: {state.completedWork % p.config.longEvery}/{p.config.longEvery}</p>
      </div>
    </div>
  )
}
