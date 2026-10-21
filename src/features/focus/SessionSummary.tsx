import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { workByDay } from './sessionStats'

const dayLabel = new Intl.DateTimeFormat('es-AR', { weekday: 'short' })

export function SessionSummary({ days = 7 }: { days?: number }) {
  const data = useLiveQuery(async () => {
    const since = Date.now() - days * 86_400_000 - 86_400_000
    const sessions = await db.sessions.where('startedAt').above(since).toArray()
    return workByDay(sessions, days)
  }, [days])
  if (!data) return null
  const max = Math.max(25, ...data.map((d) => d.minutes))
  const total = data.reduce((a, d) => a + d.minutes, 0)
  const today = data[data.length - 1]!
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-6 text-sm">
        <div><p className="font-mono text-xl tabular">{Math.round(today.minutes)}</p><p className="text-xs text-muted">min hoy ({today.count} sesiones)</p></div>
        <div><p className="font-mono text-xl tabular">{Math.round(total)}</p><p className="text-xs text-muted">min en {days} días</p></div>
      </div>
      <div className="flex h-24 items-end gap-1.5" role="img" aria-label={`Minutos de concentración por día: ${data.map((d) => Math.round(d.minutes)).join(', ')}`}>
        {data.map((d) => (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full rounded-sm bg-accent/70" style={{ height: `${(d.minutes / max) * 72}px`, minHeight: d.minutes ? 2 : 0 }} title={`${Math.round(d.minutes)} min`} />
            <span className="text-[10px] text-muted">{dayLabel.format(d.day)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
