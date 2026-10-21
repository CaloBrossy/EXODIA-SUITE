import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Pencil, Trash2 } from 'lucide-react'
import { db } from '@/db/db'
import { PRIORITIES, PriorityLabel, type Priority, type Subject, type Task } from '@/db/models'
import { createTask, deleteTask, listSubjects, setTaskDone, sortTasks, updateTask, type TaskInput } from '@/services/focus'
import { useFeedback } from '@/components/feedback'
import { Button, cx, Empty, Input, Loading, Select, Tabs, Textarea } from '@/components/ui'

const PRIORITY_DOT: Record<Priority, string> = { high: 'bg-danger', medium: 'bg-accent', low: 'bg-muted' }

const blank = (subjectId: string | null = null): TaskInput => ({ title: '', details: '', priority: 'medium', subjectId, project: '', dueDate: null })

function TaskForm({ initial, subjects, onSubmit, onCancel, submitLabel }: { initial: TaskInput; subjects: Subject[]; onSubmit: (t: TaskInput) => Promise<void>; onCancel?: () => void; submitLabel: string }) {
  const [t, setT] = useState(initial)
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!t.title.trim()) return
        setBusy(true)
        try {
          await onSubmit(t)
          if (!onCancel) setT(blank(t.subjectId))
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="flex flex-wrap gap-2">
        <Input value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="Nueva tarea…" className="min-w-48 flex-1" aria-label="Título" />
        <Select value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value as Priority })} className="w-28" aria-label="Prioridad">
          {PRIORITIES.map((p) => <option key={p} value={p}>{PriorityLabel[p]}</option>)}
        </Select>
        <Select value={t.subjectId ?? ''} onChange={(e) => setT({ ...t, subjectId: e.target.value || null })} className="w-48" aria-label="Materia">
          <option value="">Sin materia</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Input value={t.project} onChange={(e) => setT({ ...t, project: e.target.value })} placeholder="Proyecto" className="w-36" aria-label="Proyecto" />
        <Input type="date" value={t.dueDate ?? ''} onChange={(e) => setT({ ...t, dueDate: e.target.value || null })} className="w-40" aria-label="Fecha límite" />
      </div>
      {onCancel && <Textarea rows={2} value={t.details} onChange={(e) => setT({ ...t, details: e.target.value })} placeholder="Detalles" />}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={busy || !t.title.trim()}>{submitLabel}</Button>
        {onCancel && <Button size="sm" onClick={onCancel}>Cancelar</Button>}
      </div>
    </form>
  )
}

function TaskRow({ t, subjects }: { t: Task; subjects: Subject[] }) {
  const { fail, confirm } = useFeedback()
  const [editing, setEditing] = useState(false)
  const subject = subjects.find((s) => s.id === t.subjectId)
  if (editing)
    return (
      <li className="border-b border-line px-3 py-3">
        <TaskForm
          initial={{ title: t.title, details: t.details, priority: t.priority, subjectId: t.subjectId ?? null, project: t.project, dueDate: t.dueDate ?? null }}
          subjects={subjects}
          submitLabel="Guardar"
          onCancel={() => setEditing(false)}
          onSubmit={async (v) => {
            try {
              await updateTask(t.id, v)
              setEditing(false)
            } catch (e) {
              fail(e)
            }
          }}
        />
      </li>
    )
  const overdue = !t.done && t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10)
  return (
    <li className="group flex items-start gap-3 border-b border-line px-3 py-2.5 last:border-0">
      <button
        aria-label={t.done ? 'Marcar como pendiente' : 'Completar'}
        onClick={() => setTaskDone(t, !t.done).catch(fail)}
        className={cx('mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border', t.done ? 'border-ok bg-ok/20 text-ok' : 'border-line hover:border-accent')}
      >
        {t.done && <Check size={12} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm', t.done && 'text-muted line-through')}>
          <span className={cx('mr-2 inline-block h-2 w-2 rounded-full', PRIORITY_DOT[t.priority])} title={`Prioridad ${PriorityLabel[t.priority]}`} />
          {t.title}
        </p>
        <p className="text-xs text-muted">
          {[subject?.name, t.project, t.dueDate && `vence ${t.dueDate}`].filter(Boolean).join(' · ')}
          {overdue && <span className="ml-1 text-danger">(vencida)</span>}
        </p>
        {t.details && <p className="mt-1 text-xs whitespace-pre-wrap text-muted">{t.details}</p>}
      </div>
      <div className="flex gap-0.5 opacity-60 group-hover:opacity-100">
        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditing(true)}><Pencil size={13} /></Button>
        <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={async () => { if (await confirm({ title: `¿Eliminar «${t.title}»?`, danger: true, confirmLabel: 'Eliminar' })) deleteTask(t.id).catch(fail) }}><Trash2 size={13} /></Button>
      </div>
    </li>
  )
}

type Filter = 'pending' | 'done' | 'all'

export function Tasks({ subjectId }: { subjectId?: string }) {
  const { fail } = useFeedback()
  const data = useLiveQuery(async () => ({ tasks: await db.tasks.toArray(), subjects: await listSubjects() }), [])
  const [filter, setFilter] = useState<Filter>('pending')
  const [subjectFilter, setSubjectFilter] = useState<string>(subjectId ?? '')
  const tasks = useMemo(() => {
    if (!data) return []
    return sortTasks(
      data.tasks.filter((t) => (filter === 'all' || (filter === 'done' ? t.done : !t.done)) && (!subjectFilter || t.subjectId === subjectFilter)),
    )
  }, [data, filter, subjectFilter])
  if (!data) return <Loading />
  const pending = data.tasks.filter((t) => !t.done).length

  return (
    <div className="flex flex-col gap-3">
      <TaskForm initial={blank(subjectId ?? null)} subjects={data.subjects} submitLabel="Agregar tarea" onSubmit={async (t) => { await createTask(t).catch(fail) }} />
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onChange={setFilter} items={[{ id: 'pending', label: `Pendientes (${pending})` }, { id: 'done', label: 'Completadas' }, { id: 'all', label: 'Todas' }]} />
        {!subjectId && (
          <Select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="h-8 w-52" aria-label="Filtrar por materia">
            <option value="">Todas las materias</option>
            {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
      </div>
      {tasks.length === 0 ? (
        <Empty title={filter === 'done' ? 'Sin tareas completadas' : 'No hay tareas pendientes'}>Agregá una tarea con el formulario de arriba.</Empty>
      ) : (
        <ul className="glass rounded-xl">{tasks.map((t) => <TaskRow key={t.id} t={t} subjects={data.subjects} />)}</ul>
      )}
    </div>
  )
}
