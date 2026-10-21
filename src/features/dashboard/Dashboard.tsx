import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Calculator, Check, NotebookPen, Search } from 'lucide-react'
import { db } from '@/db/db'
import { listSubjects, setTaskDone, sortTasks } from '@/services/focus'
import { createNote } from '@/services/notes'
import { useFeedback } from '@/components/feedback'
import { Button, ButtonLink, Empty, Kbd, Panel } from '@/components/ui'
import { formatLongDate, relativeTime, snippet } from '@/lib/text'
import { PomodoroTimer } from '@/features/focus/PomodoroTimer'
import { SessionSummary } from '@/features/focus/SessionSummary'
import { QuestionsPanel } from '@/features/knowledge/QuestionsPanel'
import { PriorityLabel } from '@/db/models'
import { NAV } from '@/app/nav'

export default function Dashboard() {
  const navigate = useNavigate()
  const { fail } = useFeedback()
  const data = useLiveQuery(async () => {
    const [notes, tasks, concepts, subjects, noteCount, conceptCount] = await Promise.all([
      db.notes.orderBy('updatedAt').reverse().limit(5).toArray(),
      db.tasks.toArray(),
      db.concepts.orderBy('lastViewedAt').reverse().limit(5).toArray(),
      listSubjects(),
      db.notes.count(),
      db.concepts.count(),
    ])
    return {
      noteCount,
      conceptCount,
      notes,
      tasks: sortTasks(tasks.filter((t) => !t.done)),
      concepts: concepts.filter((c) => c.lastViewedAt),
      subjects: subjects.filter((s) => !s.archived),
      subjectNames: new Map(subjects.map((s) => [s.id, s.name])),
    }
  }, [])

  const newNote = async () => {
    try {
      const n = await createNote()
      navigate(`/notes/${n.id}`)
    } catch (e) {
      fail(e)
    }
  }

  const today = formatLongDate(Date.now())

  const counts: Record<string, string | undefined> = {
    '/notes': data && `${data.noteCount} notas`,
    '/knowledge': data && `${data.conceptCount} conceptos`,
    '/focus': data && `${data.tasks.length} pendientes`,
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted first-letter:uppercase">{today}</p>
          <h1 className="text-gradient text-3xl font-semibold tracking-tight">¿Qué vas a investigar hoy?</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={newNote} title="Alt+N"><NotebookPen size={15} /> Nueva nota</Button>
          <ButtonLink to="/workbench/calculator"><Calculator size={15} /> Calculadora</ButtonLink>
          <ButtonLink to="/knowledge"><BookOpen size={15} /> Conceptos</ButtonLink>
          <Button variant="ghost" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}><Search size={15} /> <Kbd>Ctrl K</Kbd></Button>
        </div>
      </div>

      <ul className="stagger mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {NAV.slice(1, 7).map((n) => (
          <li key={n.to}>
            <Link to={n.to} data-tilt="12" className="group tilt-card flex h-full flex-col gap-3 rounded-2xl p-4">
              <span className="icon-chip depth h-11 w-11"><n.icon size={20} className={n.anim} /></span>
              <span className="depth-sm">
                <span className="block text-sm font-semibold">{n.label}</span>
                <span className="block text-xs text-muted">{counts[n.to] ?? n.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="stagger grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="stagger flex flex-col gap-5">
          <Panel title="Tareas pendientes" actions={<ButtonLink size="sm" variant="ghost" to="/focus/tasks">Ver todas</ButtonLink>} bodyClass="p-0">
            {data && data.tasks.length === 0 && (
              <div className="p-4"><Empty title="Sin tareas pendientes" action={<ButtonLink size="sm" to="/focus/tasks">Agregar tarea</ButtonLink>}>Registrá lo que tenés que estudiar o entregar.</Empty></div>
            )}
            <ul>
              {data?.tasks.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-0">
                  <button aria-label="Completar" onClick={() => setTaskDone(t, true).catch(fail)} className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-line hover:border-accent hover:text-ok"><Check size={10} className="opacity-0 hover:opacity-100" /></button>
                  <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                  <span className="shrink-0 text-xs text-muted">{[t.subjectId && data.subjectNames.get(t.subjectId), t.dueDate, PriorityLabel[t.priority]].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Últimas notas" actions={<ButtonLink size="sm" variant="ghost" to="/notes">Notebook</ButtonLink>} bodyClass="p-0">
            {data && data.notes.length === 0 && (
              <div className="p-4"><Empty title="Todavía no escribiste notas" action={<Button size="sm" onClick={newNote}>Crear nota</Button>}>Las notas admiten Markdown, código y fórmulas LaTeX.</Empty></div>
            )}
            <ul>
              {data?.notes.map((n) => (
                <li key={n.id}>
                  <Link to={`/notes/${n.id}`} className="block border-b border-line px-4 py-2.5 last:border-0 hover:bg-sunken">
                    <div className="flex justify-between gap-2"><span className="truncate text-sm font-medium">{n.title || 'Sin título'}</span><span className="shrink-0 text-xs text-muted">{relativeTime(n.updatedAt)}</span></div>
                    <p className="truncate text-xs text-muted">{snippet(n.content, 120) || 'Vacía'}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Preguntas pendientes de investigación" bodyClass="p-3">
            <QuestionsPanel showOrigin limit={6} />
          </Panel>
        </div>

        <div className="stagger flex flex-col gap-5">
          <Panel title="Pomodoro" actions={<ButtonLink size="sm" variant="ghost" to="/focus">Abrir</ButtonLink>}>
            <PomodoroTimer compact />
          </Panel>
          <Panel title="Sesiones de estudio"><SessionSummary /></Panel>
          <Panel title="Conceptos recientes" bodyClass="p-3">
            {data && data.concepts.length === 0 ? (
              <p className="text-sm text-muted">Todavía no consultaste conceptos. <Link className="text-accent" to="/knowledge">Explorá la biblioteca</Link>.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {data?.concepts.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2 text-sm"><Link className="truncate text-accent hover:underline" to={`/knowledge/${c.id}`}>{c.title}</Link><span className="shrink-0 text-xs text-muted">{relativeTime(c.lastViewedAt!)}</span></li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Materias" actions={<ButtonLink size="sm" variant="ghost" to="/focus/subjects">Gestionar</ButtonLink>} bodyClass="p-3">
            {data && data.subjects.length === 0 && <p className="text-sm text-muted">Sin materias activas.</p>}
            <ul className="flex flex-col gap-0.5 text-sm">
              {data?.subjects.map((s) => {
                const pending = data.tasks.filter((t) => t.subjectId === s.id).length
                return <li key={s.id} className="flex justify-between"><span className="truncate">{s.name}</span>{pending > 0 && <span className="text-xs text-muted">{pending} pend.</span>}</li>
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
