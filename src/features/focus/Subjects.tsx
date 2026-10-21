import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { db } from '@/db/db'
import type { Subject } from '@/db/models'
import { deleteSubject, listSubjects, saveSubject, type SubjectInput } from '@/services/focus'
import { createNote } from '@/services/notes'
import { useFeedback } from '@/components/feedback'
import { Button, cx, Field, Input, Loading, Panel, Textarea } from '@/components/ui'
import { relativeTime } from '@/lib/text'
import { Tasks } from './Tasks'

function SubjectEditor({ s, onDeleted }: { s: Subject; onDeleted: () => void }) {
  const { fail, notify, confirm } = useFeedback()
  const navigate = useNavigate()
  const [form, setForm] = useState<SubjectInput>(s)
  const related = useLiveQuery(async () => {
    const [notes, sessions] = await Promise.all([db.notes.where('subjectId').equals(s.id).toArray(), db.sessions.where('subjectId').equals(s.id).toArray()])
    return { notes: notes.sort((a, b) => b.updatedAt - a.updatedAt), minutes: sessions.filter((x) => x.phase === 'work').reduce((a, x) => a + x.durationMs / 60000, 0) }
  }, [s.id])
  const dirty = form.name !== s.name || form.period !== s.period || form.objectives !== s.objectives || form.notes !== s.notes || form.archived !== s.archived

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await saveSubject(form, s.id)
            notify('Materia guardada.', 'ok')
          } catch (err) {
            fail(err)
          }
        }}
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
          <Field label="Nombre"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Período"><Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="1.er cuatrimestre 2026" /></Field>
        </div>
        <Field label="Objetivos"><Textarea rows={4} value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} placeholder="Qué querés dominar al terminar la cursada" /></Field>
        <Field label="Notas de la materia"><Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Horarios, bibliografía, criterios de aprobación…" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.archived} onChange={(e) => setForm({ ...form, archived: e.target.checked })} /> Archivada (aprobada o fuera de cursada)</label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={!dirty}>Guardar</Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!(await confirm({ title: `¿Eliminar «${s.name}»?`, body: 'Las tareas, notas y sesiones asociadas se conservan, sin materia.', danger: true, confirmLabel: 'Eliminar' }))) return
              try {
                await deleteSubject(s.id)
                onDeleted()
              } catch (err) {
                fail(err)
              }
            }}
          >
            Eliminar
          </Button>
        </div>
      </form>
      <Panel
        title={`Notas relacionadas${related ? ` (${related.notes.length})` : ''}`}
        actions={<Button size="sm" variant="ghost" onClick={() => createNote({ subjectId: s.id, title: `${s.name}: ` }).then((n) => navigate(`/notes/${n.id}`)).catch(fail)}><Plus size={13} /> Nota</Button>}
        bodyClass="p-3"
      >
        {related?.notes.length === 0 && <p className="text-xs text-muted">Ninguna nota asociada. Asociá notas desde el panel de detalles del Notebook.</p>}
        <ul className="flex flex-col gap-1">
          {related?.notes.map((n) => <li key={n.id} className="flex justify-between gap-2 text-sm"><Link className="truncate text-accent hover:underline" to={`/notes/${n.id}`}>{n.title || 'Sin título'}</Link><span className="shrink-0 text-xs text-muted">{relativeTime(n.updatedAt)}</span></li>)}
        </ul>
        {related && related.minutes > 0 && <p className="mt-2 text-xs text-muted">Tiempo de concentración registrado: {Math.round(related.minutes)} min</p>}
      </Panel>
      <Panel title="Tareas de la materia" bodyClass="p-3"><Tasks key={s.id} subjectId={s.id} /></Panel>
    </div>
  )
}

export function Subjects() {
  const { fail } = useFeedback()
  const subjects = useLiveQuery(() => listSubjects(), [])
  const [sel, setSel] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  if (!subjects) return <Loading />
  const visible = subjects.filter((s) => showArchived || !s.archived)
  const current = subjects.find((s) => s.id === sel) ?? visible[0]

  const add = async () => {
    try {
      const id = await saveSubject({ name: 'Nueva materia', period: '', objectives: '', notes: '', archived: false })
      setSel(id)
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <Button size="sm" onClick={add} className="self-start"><Plus size={13} /> Materia</Button>
        <ul className="glass rounded-xl">
          {visible.map((s) => (
            <li key={s.id}>
              <button onClick={() => setSel(s.id)} className={cx('w-full border-b border-line px-3 py-2 text-left text-sm last:border-0 hover:bg-sunken', current?.id === s.id && 'bg-sunken font-medium', s.archived && 'text-muted')}>
                {s.name}
                {s.period && <span className="block text-xs font-normal text-muted">{s.period}</span>}
              </button>
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar archivadas</label>
        <p className="text-xs text-muted">Las materias iniciales son datos editables; verificá programa y fechas con tu facultad.</p>
      </div>
      <Panel>{current ? <SubjectEditor key={current.id} s={current} onDeleted={() => setSel(null)} /> : <p className="text-sm text-muted">No hay materias. Creá una.</p>}</Panel>
    </div>
  )
}
