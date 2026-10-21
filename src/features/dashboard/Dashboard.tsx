import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Calculator, Check, Compass, NotebookPen, Search, Telescope } from 'lucide-react'
import { db } from '@/db/db'
import { listSubjects, setTaskDone, sortTasks } from '@/services/focus'
import { createNote } from '@/services/notes'
import { useFeedback } from '@/components/feedback'
import { ObservatoryCore } from '@/components/ObservatoryCore'
import { Button, ButtonLink, Kbd, Panel } from '@/components/ui'
import { formatLongDate, relativeTime, startOfDay } from '@/lib/text'
import { formatClock, PhaseLabel, remaining } from '@/lib/pomodoro'
import { usePomodoro } from '@/hooks/usePomodoro'
import { QuestionsPanel } from '@/features/knowledge/QuestionsPanel'
import { openSearch } from '@/app/CommandPalette'
import { NAV } from '@/app/nav'

const INVESTIGATION_TEMPLATE = `## Pregunta
¿Qué quiero entender?

## Lo que ya sé


## Hipótesis


## Exploración
- Conceptos relacionados:
- Cálculos:

## Conclusiones


## Preguntas que quedan abiertas
- `

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 13) return 'Buen día'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function Readout({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="eyebrow !text-[9.5px]">{label}</span>
      <span className="font-mono text-sm text-fg tabular">{value ?? '—'}</span>
    </div>
  )
}

function StudyStatus({ todayMinutes, todaySessions }: { todayMinutes?: number; todaySessions?: number }) {
  const { state, now } = usePomodoro()
  const running = state.status !== 'idle'
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line">
        <span className={running && state.status === 'running' ? 'absolute inset-1 animate-ping rounded-full bg-accent/15 [animation-duration:2.4s]' : 'hidden'} />
        <span className={running ? 'h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_var(--nx-glow)]' : 'h-2 w-2 rounded-full bg-muted/50'} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {running ? (
            <>
              {PhaseLabel[state.phase]}{state.status === 'paused' && ' en pausa'} · <span className="font-mono tabular">{formatClock(remaining(state, now))}</span>
            </>
          ) : (
            'Sin sesión en curso'
          )}
        </p>
        <p className="text-xs text-muted">{Math.round(todayMinutes ?? 0)} min de concentración hoy · {todaySessions ?? 0} sesiones</p>
      </div>
      <ButtonLink size="sm" variant="ghost" to="/focus">{running ? 'Ver' : 'Iniciar'} <ArrowRight size={13} className="ico-bounce" /></ButtonLink>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { fail } = useFeedback()
  const [query, setQuery] = useState('')
  const data = useLiveQuery(async () => {
    const dayStart = startOfDay(Date.now())
    const [notes, tasks, viewed, subjects, noteCount, conceptCount, todaySessions, someConcepts] = await Promise.all([
      db.notes.orderBy('updatedAt').reverse().limit(4).toArray(),
      db.tasks.toArray(),
      db.concepts.orderBy('lastViewedAt').reverse().limit(5).toArray(),
      listSubjects(),
      db.notes.count(),
      db.concepts.count(),
      db.sessions.where('startedAt').aboveOrEqual(dayStart - 86_400_000).toArray(),
      db.concepts.limit(5).toArray(),
    ])
    const work = todaySessions.filter((s) => s.phase === 'work' && s.endedAt >= dayStart)
    const recent = viewed.filter((c) => c.lastViewedAt)
    return {
      notes,
      tasks: sortTasks(tasks.filter((t) => !t.done)),
      concepts: recent.length ? recent : someConcepts,
      conceptsAreSuggestions: recent.length === 0,
      subjectNames: new Map(subjects.map((s) => [s.id, s.name])),
      noteCount,
      conceptCount,
      todayMinutes: work.reduce((a, s) => a + s.durationMs, 0) / 60_000,
      todaySessions: work.length,
    }
  }, [])

  const newInvestigation = async () => {
    try {
      const n = await createNote({ title: 'Nueva investigación', content: INVESTIGATION_TEMPLATE, tags: ['investigación'] })
      navigate(`/notes/${n.id}`)
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 md:p-8">
      <section className="stagger grid items-center gap-8 pt-2 md:grid-cols-[minmax(0,1fr)_auto] md:pt-6">
        <div className="flex flex-col gap-5">
          <p className="eyebrow first-letter:uppercase">{formatLongDate(Date.now())}</p>
          <div>
            <h1 className="text-gradient text-[clamp(1.9rem,3.6vw,2.8rem)] leading-[1.1] font-semibold tracking-tight">{greeting()}.</h1>
            <p className="text-aurora text-[clamp(1.9rem,3.6vw,2.8rem)] leading-[1.15] font-semibold tracking-tight">¿Qué querés explorar hoy?</p>
            <p className="mt-3 max-w-xl text-sm text-muted">Tu universo de conocimiento: conceptos, cálculos, notas e ideas en un solo lugar, sin conexión y solo en este dispositivo.</p>
          </div>
          <form
            className="group flex max-w-xl items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 transition-colors focus-within:border-accent/50 focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--nx-accent)_10%,transparent)]"
            onSubmit={(e) => {
              e.preventDefault()
              openSearch(query)
              setQuery('')
            }}
          >
            <Search size={17} className="shrink-0 text-muted transition-colors group-focus-within:text-accent" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (e.target.value.trim().length >= 2) {
                  openSearch(e.target.value)
                  setQuery('')
                }
              }}
              placeholder="Buscar conceptos, notas, fórmulas o herramientas…"
              aria-label="Buscar en EXODIA"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted/80"
            />
            <Kbd>Ctrl K</Kbd>
          </form>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={newInvestigation}><Telescope size={15} className="ico-pop" /> Nueva investigación</Button>
            <ButtonLink to="/workbench/calculator"><Calculator size={15} className="ico-pop" /> Calculadora</ButtonLink>
            <ButtonLink to="/notes"><NotebookPen size={15} className="ico-draw" /> Cuaderno</ButtonLink>
            <ButtonLink variant="ghost" to="/knowledge"><Compass size={15} className="ico-spin" /> Explorar conceptos</ButtonLink>
          </div>
        </div>
        <div className="relative hidden justify-self-center md:block">
          <ObservatoryCore size={250} detailed />
          <div className="absolute top-3 -left-10"><Readout label="Conceptos" value={data?.conceptCount} /></div>
          <div className="absolute -right-6 bottom-10 text-right"><Readout label="Notas" value={data?.noteCount} /></div>
          <div className="absolute bottom-0 -left-4"><Readout label="Pendientes" value={data?.tasks.length} /></div>
        </div>
      </section>

      <section className="glass stagger grid gap-4 rounded-2xl p-4 md:grid-cols-2 md:divide-x md:divide-line">
        <StudyStatus todayMinutes={data?.todayMinutes} todaySessions={data?.todaySessions} />
        <div className="flex min-w-0 flex-col gap-1.5 md:pl-4">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Tareas pendientes · {data?.tasks.length ?? 0}</span>
            <Link to="/focus/tasks" className="text-xs text-muted hover:text-accent">Ver todas</Link>
          </div>
          {data && data.tasks.length === 0 && <p className="text-sm text-muted">Nada pendiente. <Link className="text-accent" to="/focus/tasks">Agregar tarea</Link></p>}
          <ul className="flex flex-col">
            {data?.tasks.slice(0, 3).map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 py-0.5 text-sm">
                <button aria-label="Completar" onClick={() => setTaskDone(t, true).catch(fail)} className="group flex h-4 w-4 shrink-0 items-center justify-center rounded border border-line transition-colors hover:border-accent">
                  <Check size={10} className="text-accent opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {t.subjectId && <span className="shrink-0 truncate text-xs text-muted">{data.subjectNames.get(t.subjectId)}</span>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="stagger grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title={data?.conceptsAreSuggestions ? 'Para empezar a explorar' : 'Conceptos recientes'} actions={<ButtonLink size="sm" variant="ghost" to="/knowledge">Biblioteca</ButtonLink>} bodyClass="p-2">
          <ul className="flex flex-col">
            {data?.concepts.map((c) => (
              <li key={c.id}>
                <Link to={`/knowledge/${c.id}`} className="group flex items-baseline gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-sunken">
                  <span className="h-1 w-1 shrink-0 translate-y-[-2px] rounded-full bg-accent2" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm group-hover:text-accent">{c.title}</span>
                    <span className="block truncate text-xs text-muted">{c.summary}</span>
                  </span>
                  {c.lastViewedAt && <span className="shrink-0 text-[11px] text-muted">{relativeTime(c.lastViewedAt)}</span>}
                </Link>
              </li>
            ))}
          </ul>
          {data && data.notes.length > 0 && (
            <>
              <p className="eyebrow px-2 pt-3 pb-1">Notas recientes</p>
              <ul className="flex flex-col">
                {data.notes.map((n) => (
                  <li key={n.id}>
                    <Link to={`/notes/${n.id}`} className="flex justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-sunken">
                      <span className="truncate">{n.title || 'Sin título'}</span>
                      <span className="shrink-0 text-[11px] text-muted">{relativeTime(n.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
        <Panel title="Preguntas abiertas" bodyClass="p-3">
          <QuestionsPanel showOrigin limit={6} />
        </Panel>
      </div>

      <section>
        <p className="eyebrow mb-3">Módulos</p>
        <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {NAV.slice(1, 7).map((n) => (
            <li key={n.to}>
              <Link to={n.to} data-tilt="8" className="group tilt-card flex h-full flex-col gap-3 rounded-xl p-3.5">
                <span className="icon-chip depth h-9 w-9"><n.icon size={17} strokeWidth={1.75} className={n.anim} /></span>
                <span className="depth-sm">
                  <span className="block text-[13px] font-medium">{n.label}</span>
                  <span className="block text-[11px] text-muted">{n.tagline}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
