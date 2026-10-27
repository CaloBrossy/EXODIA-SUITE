import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { CHAPTER_STATUSES, ChapterStatusLabel, LIBRARY_KINDS, LibraryKindLabel, type Chapter, type ChapterStatus, type LibraryItem, type LibraryKind } from '@/db/models'
import { continueChapter, continueReading, itemProgress, subjectProgress } from '@/lib/libraryProgress'
import { parseTags, uid } from '@/lib/text'
import { deleteLibraryItem, listLibrary, saveLibraryItem } from '@/services/library'
import { useFeedback } from '@/components/feedback'
import { Button, ButtonLink, Empty, Field, Input, PageHeader, Panel, Select, Textarea } from '@/components/ui'

const empty = (): Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: '',
  author: '',
  kind: 'libro',
  subjectId: null,
  url: '',
  physical: '',
  chapters: [],
  notes: '',
  tags: [],
  favorite: false,
})

const chapter = (n: number): Chapter => ({ id: uid(), title: `Capítulo ${n}`, status: 'pendiente', noteId: null, conceptId: null })

export default function LibraryPage() {
  const { fail, notify } = useFeedback()
  const data = useLiveQuery(async () => ({
    items: await listLibrary(),
    subjects: await db.subjects.toArray(),
    notes: await db.notes.toArray(),
    concepts: await db.concepts.toArray(),
  }), [])
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState(empty())
  const [count, setCount] = useState('10')
  const [query, setQuery] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [kind, setKind] = useState('')
  const [state, setState] = useState('')
  const [onlyFav, setOnlyFav] = useState(false)
  const [focusChapter, setFocusChapter] = useState<string | null>(null)

  const names = useMemo(() => new Map(data?.subjects.map((s) => [s.id, s.name]) ?? []), [data?.subjects])
  const items = data?.items ?? []
  const next = continueReading(items)
  const nextChapter = next ? continueChapter(next) : null
  const bySubject = subjectProgress(items)
  const visible = items.filter((item) => {
    if (onlyFav && !item.favorite) return false
    if (subjectId && item.subjectId !== subjectId) return false
    if (kind && item.kind !== kind) return false
    const ratio = itemProgress(item)
    if (state === 'nuevo' && (item.chapters.length === 0 || ratio > 0)) return false
    if (state === 'curso' && (ratio === 0 || ratio === 1)) return false
    if (state === 'listo' && ratio !== 1) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [item.title, item.author, item.notes, item.tags.join(' ')].some((t) => t.toLowerCase().includes(q))
  })

  const open = (item?: LibraryItem) => {
    setEditing(item?.id ?? 'new')
    setForm(item ? { ...item } : empty())
    setFocusChapter(null)
  }
  const save = async () => {
    try {
      const saved = await saveLibraryItem({ ...form, tags: form.tags }, editing && editing !== 'new' ? editing : undefined)
      notify('Ítem guardado.', 'ok')
      setEditing(saved.id)
    } catch (e) {
      fail(e)
    }
  }
  const setChapter = (id: string, patch: Partial<Chapter>) => {
    setForm({ ...form, chapters: form.chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  }

  if (!data) return null
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Biblioteca"
        subtitle="Solo enlaces y metadatos: los archivos no se suben. Una ruta local no se abre en otro dispositivo."
        actions={<><ButtonLink to="/tools">Tool Shelf</ButtonLink><Button variant="primary" onClick={() => open()}>Agregar</Button></>}
      />
      {next && nextChapter && (
        <Panel title="Continuar leyendo">
          <p className="text-sm">{next.title} · {nextChapter.title}</p>
          <Button className="mt-2" size="sm" onClick={() => { open(next); setFocusChapter(nextChapter.id) }}>Abrir</Button>
        </Panel>
      )}
      {bySubject.length > 0 && (
        <Panel title="Progreso por materia">
          <ul className="flex flex-col gap-2">
            {bySubject.map((row) => (
              <li key={row.subjectId ?? 'none'}>
                <div className="mb-1 flex justify-between text-sm"><span>{row.subjectId ? names.get(row.subjectId) ?? 'Materia' : 'Sin materia'}</span><span className="font-mono text-xs">{row.done}/{row.total}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-sunken"><div className="h-full bg-accent" style={{ width: `${row.ratio * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" aria-label="Buscar en la biblioteca" />
        <Select aria-label="Filtrar materia" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}><option value="">Materia</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        <Select aria-label="Filtrar tipo" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Tipo</option>{LIBRARY_KINDS.map((k) => <option key={k} value={k}>{LibraryKindLabel[k]}</option>)}</Select>
        <Select aria-label="Filtrar estado" value={state} onChange={(e) => setState(e.target.value)}><option value="">Estado</option><option value="nuevo">Sin empezar</option><option value="curso">En curso</option><option value="listo">Terminado</option></Select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} /> Favoritos</label>
      </div>
      {visible.length === 0 && !editing && <Empty title="La biblioteca está vacía" action={<Button onClick={() => open()}>Cargar un libro</Button>} />}
      <ul className="flex flex-col">
        {visible.map((item) => (
          <li key={item.id}>
            <button type="button" className="flex w-full items-baseline gap-3 border-b border-line py-2 text-left text-sm" onClick={() => open(item)}>
              <span className="min-w-0 flex-1 truncate">{item.favorite ? '★ ' : ''}{item.title}</span>
              <span className="text-xs text-muted">{LibraryKindLabel[item.kind]}</span>
              <span className="font-mono text-xs">{item.chapters.filter((c) => c.status === 'leido').length}/{item.chapters.length}</span>
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <Panel title={form.title || 'Nuevo ítem'}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Título"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Autor"><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></Field>
            <Field label="Tipo">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as LibraryKind })}>
                {LIBRARY_KINDS.map((k) => <option key={k} value={k}>{LibraryKindLabel[k]}</option>)}
              </Select>
            </Field>
            <Field label="Materia">
              <Select value={form.subjectId ?? ''} onChange={(e) => setForm({ ...form, subjectId: e.target.value || null })}>
                <option value="">Sin materia</option>
                {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="URL"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Referencia física"><Input value={form.physical} onChange={(e) => setForm({ ...form, physical: e.target.value })} placeholder="Estante, fotocopia…" /></Field>
            <Field label="Notas" className="md:col-span-2"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <Field label="Etiquetas"><Input value={form.tags.join(', ')} onChange={(e) => setForm({ ...form, tags: parseTags(e.target.value) })} /></Field>
            <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.favorite} onChange={(e) => setForm({ ...form, favorite: e.target.checked })} /> Favorito</label>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Field label="Generar capítulos"><Input type="number" min={1} max={80} value={count} onChange={(e) => setCount(e.target.value)} className="w-24" /></Field>
            <Button size="sm" onClick={() => setForm({ ...form, chapters: [...form.chapters, ...Array.from({ length: Math.min(80, Math.max(1, Number(count) || 1)) }, (_, i) => chapter(form.chapters.length + i + 1))] })}>Generar</Button>
            <Button size="sm" onClick={() => setForm({ ...form, chapters: [...form.chapters, chapter(form.chapters.length + 1)] })}>Un capítulo</Button>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {form.chapters.map((c) => (
              <li key={c.id} className={focusChapter === c.id ? 'grid gap-2 rounded-lg border border-accent/50 p-2 md:grid-cols-[1fr_140px_1fr_1fr_auto]' : 'grid gap-2 md:grid-cols-[1fr_140px_1fr_1fr_auto]'}>
                <Input aria-label="Título del capítulo" value={c.title} onChange={(e) => setChapter(c.id, { title: e.target.value })} />
                <Select aria-label="Estado del capítulo" value={c.status} onChange={(e) => setChapter(c.id, { status: e.target.value as ChapterStatus })}>
                  {CHAPTER_STATUSES.map((s) => <option key={s} value={s}>{ChapterStatusLabel[s]}</option>)}
                </Select>
                <Select aria-label="Nota del capítulo" value={c.noteId ?? ''} onChange={(e) => setChapter(c.id, { noteId: e.target.value || null })}>
                  <option value="">Nota</option>
                  {data.notes.map((n) => <option key={n.id} value={n.id}>{n.title || 'Sin título'}</option>)}
                </Select>
                <Select aria-label="Concepto del capítulo" value={c.conceptId ?? ''} onChange={(e) => setChapter(c.id, { conceptId: e.target.value || null })}>
                  <option value="">Concepto</option>
                  {data.concepts.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
                </Select>
                <Button size="sm" variant="danger" onClick={() => setForm({ ...form, chapters: form.chapters.filter((x) => x.id !== c.id) })}>Quitar</Button>
                {(c.noteId || c.conceptId) && (
                  <span className="md:col-span-5 text-xs">
                    {c.noteId && <Link className="text-accent" to={`/notes/${c.noteId}`}>Abrir nota</Link>}
                    {c.conceptId && <Link className="ml-3 text-accent" to={`/knowledge/${c.conceptId}`}>Abrir concepto</Link>}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" onClick={() => void save()}>Guardar</Button>
            {editing !== 'new' && <Button variant="danger" onClick={() => deleteLibraryItem(editing).then(() => setEditing(null)).catch(fail)}>Borrar</Button>}
            <Button onClick={() => setEditing(null)}>Cerrar</Button>
          </div>
        </Panel>
      )}
    </div>
  )
}
