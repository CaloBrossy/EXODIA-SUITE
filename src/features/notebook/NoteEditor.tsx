import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bold, Code, Columns2, Eye, Heading, Italic, List, ListChecks, PencilLine, Quote, Sigma, SquareFunction, Star, Trash2 } from 'lucide-react'
import { db } from '@/db/db'
import type { Note } from '@/db/models'
import { deleteNote, getNote, toggleLink, updateNote } from '@/services/notes'
import { listSubjects } from '@/services/focus'
import { useAutosave, type SaveStatus } from '@/hooks/useAutosave'
import { useFeedback } from '@/components/feedback'
import { Markdown } from '@/components/Markdown'
import { Button, cx, Input, Loading, Panel, Select } from '@/components/ui'
import { formatDateTime, parseTags } from '@/lib/text'
import { NoteLinks } from './NoteLinks'
import { insertBlock, prefixLines, wrap, type EditResult } from './editing'

type Mode = 'edit' | 'split' | 'preview'
interface Draft {
  title: string
  content: string
}
const draftKey = (id: string) => `nexus.draft.${id}`

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: 'Guardado',
  pending: 'Cambios sin guardar…',
  saving: 'Guardando…',
  error: 'Error al guardar — se reintentará',
}

export function NoteEditor({ id }: { id: string }) {
  const [initial, setInitial] = useState<Note | null | undefined>(undefined)
  const [recovered, setRecovered] = useState(false)

  useEffect(() => {
    let alive = true
    void getNote(id).then((n) => {
      if (!alive) return
      if (n) {
        try {
          const raw = localStorage.getItem(draftKey(id))
          const d = raw ? (JSON.parse(raw) as Draft & { ts: number }) : null
          if (d && d.ts > n.updatedAt && (d.content !== n.content || d.title !== n.title)) {
            n = { ...n, title: d.title, content: d.content }
            setRecovered(true)
          }
        } catch {
          /* borrador local ilegible: se ignora */
        }
      }
      setInitial(n ?? null)
    })
    return () => {
      alive = false
    }
  }, [id])

  if (initial === undefined) return <div className="p-6"><Loading /></div>
  if (initial === null)
    return (
      <div className="p-6 text-sm">
        <p>La nota no existe o fue eliminada.</p>
        <Link to="/notes" className="text-accent">Volver al Notebook</Link>
      </div>
    )
  return <EditorBody note={initial} recovered={recovered} />
}

function EditorBody({ note, recovered }: { note: Note; recovered: boolean }) {
  const navigate = useNavigate()
  const { fail, confirm, notify } = useFeedback()
  const live = useLiveQuery(() => db.notes.get(note.id), [note.id])
  const subjects = useLiveQuery(() => listSubjects(), [])
  const [draft, setDraft] = useState<Draft>({ title: note.title, content: note.content })
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('nexus.editorMode') as Mode | null) ?? 'split')
  const [tagText, setTagText] = useState(note.tags.join(', '))
  const ta = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!recovered) return
    notify('Se recuperó un borrador local más reciente que la versión guardada.', 'info')
    setDraft((d) => ({ ...d }))
  }, [recovered, notify])
  useEffect(() => localStorage.setItem('nexus.editorMode', mode), [mode])

  const save = useCallback(
    async (d: Draft) => {
      await updateNote(note.id, d)
      localStorage.removeItem(draftKey(note.id))
    },
    [note.id],
  )
  const { status, flush, isDirty } = useAutosave(draft, save, 600)

  // Si la pestaña se cierra antes de que IndexedDB confirme, queda un borrador en localStorage.
  const draftRef = useRef(draft)
  draftRef.current = draft
  useEffect(() => {
    const onUnload = () => {
      if (isDirty()) localStorage.setItem(draftKey(note.id), JSON.stringify({ ...draftRef.current, ts: Date.now() }))
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [note.id, isDirty])

  useEffect(() => {
    if (status === 'error') {
      localStorage.setItem(draftKey(note.id), JSON.stringify({ ...draftRef.current, ts: Date.now() }))
      const t = setTimeout(() => void flush(), 3000)
      return () => clearTimeout(t)
    }
  }, [status, flush, note.id])

  const meta = live ?? note
  const updateMeta = (changes: Partial<Note>) => updateNote(note.id, changes).catch(fail)

  const apply = (fn: (v: string, s: number, e: number) => EditResult) => {
    const el = ta.current
    if (!el) return
    const r = fn(draft.content, el.selectionStart, el.selectionEnd)
    setDraft((d) => ({ ...d, content: r.value }))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(r.selStart, r.selEnd)
    })
  }

  const tools = useMemo(
    () => [
      { icon: Heading, label: 'Título', run: (v: string, s: number, e: number) => prefixLines(v, s, e, '## ') },
      { icon: Bold, label: 'Negrita (Ctrl+B)', run: (v: string, s: number, e: number) => wrap(v, s, e, '**') },
      { icon: Italic, label: 'Cursiva (Ctrl+I)', run: (v: string, s: number, e: number) => wrap(v, s, e, '_') },
      { icon: List, label: 'Lista', run: (v: string, s: number, e: number) => prefixLines(v, s, e, '- ') },
      { icon: ListChecks, label: 'Lista de tareas', run: (v: string, s: number, e: number) => prefixLines(v, s, e, '- [ ] ') },
      { icon: Quote, label: 'Cita', run: (v: string, s: number, e: number) => prefixLines(v, s, e, '> ') },
      { icon: Code, label: 'Código', run: (v: string, s: number, e: number) => (v.slice(s, e).includes('\n') ? wrap(v, s, e, '```\n', '\n```', 'código') : wrap(v, s, e, '`')) },
      { icon: Sigma, label: 'Fórmula en línea ($…$)', run: (v: string, s: number, e: number) => wrap(v, s, e, '$', '$', 'x^2') },
      { icon: SquareFunction, label: 'Fórmula en bloque ($$…$$)', run: (v: string, s: number, e: number) => insertBlock(v, s, e, '$$\n\n$$\n', 3) },
    ],
    [],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return
    const k = e.key.toLowerCase()
    if (k === 'b') {
      e.preventDefault()
      apply((v, s, en) => wrap(v, s, en, '**'))
    } else if (k === 'i') {
      e.preventDefault()
      apply((v, s, en) => wrap(v, s, en, '_'))
    } else if (k === 's') {
      e.preventDefault()
      void flush()
    }
  }

  const remove = async () => {
    const ok = await confirm({ title: '¿Eliminar esta nota?', body: 'Esta acción no se puede deshacer. Exportá tus datos si querés conservar una copia.', danger: true, confirmLabel: 'Eliminar' })
    if (!ok) return
    try {
      await flush()
      await deleteNote(note.id)
      localStorage.removeItem(draftKey(note.id))
      navigate('/notes')
    } catch (e) {
      fail(e)
    }
  }

  const commitTags = () => {
    const tags = parseTags(tagText)
    setTagText(tags.join(', '))
    if (tags.join() !== meta.tags.join()) void updateMeta({ tags })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <Link to="/notes" className="rounded p-1 hover:bg-sunken md:hidden" aria-label="Volver"><ArrowLeft size={16} /></Link>
        <div className="flex items-center gap-0.5">
          {tools.map((t) => (
            <button key={t.label} title={t.label} aria-label={t.label} disabled={mode === 'preview'} onClick={() => apply(t.run)} className="rounded p-1.5 text-muted hover:bg-sunken hover:text-fg disabled:opacity-30">
              <t.icon size={15} />
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className={cx('mr-2 text-xs', status === 'error' ? 'text-danger' : 'text-muted')} aria-live="polite">{STATUS_TEXT[status]}</span>
          {([['edit', PencilLine, 'Editar'], ['split', Columns2, 'Dividido'], ['preview', Eye, 'Vista previa']] as const).map(([m, Icon, label]) => (
            <button key={m} title={label} aria-label={label} aria-pressed={mode === m} onClick={() => setMode(m)} className={cx('rounded p-1.5 hover:bg-sunken', mode === m ? 'text-fg bg-sunken' : 'text-muted')}>
              <Icon size={15} />
            </button>
          ))}
          <button title={meta.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'} aria-label="Favorita" onClick={() => void updateMeta({ favorite: !meta.favorite })} className="rounded p-1.5 hover:bg-sunken">
            <Star size={15} className={meta.favorite ? 'fill-accent text-accent' : 'text-muted'} />
          </button>
          <button title="Eliminar nota" aria-label="Eliminar nota" onClick={remove} className="rounded p-1.5 text-muted hover:bg-sunken hover:text-danger">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="flex min-w-0 shrink-0 flex-col lg:min-h-0 lg:flex-1 lg:shrink lg:overflow-y-auto">
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Título"
            aria-label="Título de la nota"
            className="w-full bg-transparent px-5 pt-4 pb-2 text-xl font-semibold outline-none placeholder:text-muted/60"
          />
          <div className={cx('grid min-h-[50vh] flex-1', mode === 'split' && 'md:grid-cols-2')}>
            {mode !== 'preview' && (
              <textarea
                ref={ta}
                value={draft.content}
                onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                onKeyDown={onKeyDown}
                spellCheck
                aria-label="Contenido de la nota (Markdown)"
                placeholder={'Escribí en Markdown. Fórmulas: $E = mc^2$ o bloques $$…$$'}
                className="min-h-[50vh] w-full resize-none bg-transparent px-5 py-2 font-mono text-[13.5px] leading-relaxed outline-none"
              />
            )}
            {mode !== 'edit' && (
              <div className={cx('min-w-0 px-5 py-2', mode === 'split' && 'border-t border-line md:border-t-0 md:border-l')}>
                {draft.content.trim() ? <Markdown source={draft.content} /> : <p className="text-sm text-muted">La vista previa aparece aquí.</p>}
              </div>
            )}
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3 border-t border-line p-3 lg:w-72 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <Panel title="Detalles" bodyClass="flex flex-col gap-2.5 p-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Etiquetas (separadas por coma)
              <Input value={tagText} onChange={(e) => setTagText(e.target.value)} onBlur={commitTags} onKeyDown={(e) => e.key === 'Enter' && commitTags()} className="h-8" placeholder="termo, parcial-1" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Materia
              <Select value={meta.subjectId ?? ''} onChange={(e) => void updateMeta({ subjectId: e.target.value || null })} className="h-8">
                <option value="">— Ninguna —</option>
                {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 text-xs text-muted">
              <dt>Creada</dt>
              <dd>{formatDateTime(meta.createdAt)}</dd>
              <dt>Modificada</dt>
              <dd>{formatDateTime(meta.updatedAt)}</dd>
            </dl>
          </Panel>
          <NoteLinks note={meta} onChange={(c) => void updateMeta(c)} toggle={toggleLink} />
        </aside>
      </div>
      {status === 'error' && (
        <div className="border-t border-danger/40 bg-danger/10 px-4 py-1.5 text-xs text-danger">
          No se pudo guardar en la base local. El texto se conserva en un borrador del navegador y se reintentará automáticamente.
          <Button size="sm" variant="ghost" className="ml-2" onClick={() => void flush()}>Reintentar ahora</Button>
        </div>
      )}
    </div>
  )
}
