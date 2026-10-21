import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { NotebookPen, Plus, Star } from 'lucide-react'
import { listNotes, createNote, filterNotes } from '@/services/notes'
import { collectFacets } from '@/services/concepts'
import { useFeedback } from '@/components/feedback'
import { Button, cx, Empty, Input, Kbd, Loading, Tag } from '@/components/ui'
import { relativeTime, snippet } from '@/lib/text'
import { NoteEditor } from './NoteEditor'

export default function NotebookPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { fail } = useFeedback()
  const notes = useLiveQuery(listNotes, [])
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [favorites, setFavorites] = useState(false)

  const filtered = useMemo(() => (notes ? filterNotes(notes, { query, tag, favorites }) : []), [notes, query, tag, favorites])
  const { tags } = useMemo(() => collectFacets(notes ?? []), [notes])

  const newNote = async () => {
    try {
      const n = await createNote({ tags: tag ? [tag] : [] })
      navigate(`/notes/${n.id}`)
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className={cx('flex w-full flex-col border-r border-line md:w-72 md:shrink-0', id && 'hidden md:flex')}>
        <div className="flex flex-col gap-2 border-b border-line p-3">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold">Notebook</h1>
            <Button size="sm" variant="primary" onClick={newNote} title="Nueva nota (Alt+N)">
              <Plus size={14} /> Nota
            </Button>
          </div>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en títulos y contenido…" className="h-8" />
          <div className="flex flex-wrap gap-1">
            <Tag active={favorites} onClick={() => setFavorites((f) => !f)}>★ Favoritas</Tag>
            {tags.map((t) => (
              <Tag key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>#{t}</Tag>
            ))}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {!notes && <li className="px-3"><Loading /></li>}
          {notes && filtered.length === 0 && (
            <li className="p-3">
              <Empty title={notes.length ? 'Ninguna nota coincide' : 'Todavía no hay notas'} action={!notes.length && <Button size="sm" onClick={newNote}>Crear la primera</Button>}>
                {notes.length ? 'Probá con otra búsqueda o quitá filtros.' : 'Las notas admiten Markdown y fórmulas LaTeX.'}
              </Empty>
            </li>
          )}
          {filtered.map((n) => (
            <li key={n.id}>
              <Link
                to={`/notes/${n.id}`}
                className={cx('block border-b border-line px-3 py-2.5 hover:bg-sunken', n.id === id && 'bg-sunken')}
              >
                <div className="flex items-center gap-1.5">
                  {n.favorite && <Star size={12} className="shrink-0 fill-accent text-accent" />}
                  <span className="truncate text-sm font-medium">{n.title || 'Sin título'}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{snippet(n.content) || 'Vacía'}</p>
                <p className="mt-1 text-[11px] text-muted">{relativeTime(n.updatedAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className={cx('min-w-0 flex-1', !id && 'hidden md:block')}>
        {id ? (
          <NoteEditor key={id} id={id} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted">
            <NotebookPen size={28} />
            <p>Elegí una nota o creá una nueva.</p>
            <p><Kbd>Alt N</Kbd> nueva nota · <Kbd>Ctrl K</Kbd> buscar</p>
          </div>
        )}
      </section>
    </div>
  )
}
