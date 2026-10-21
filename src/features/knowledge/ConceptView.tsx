import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, NotebookPen, Pencil, Star, Trash2 } from 'lucide-react'
import { db } from '@/db/db'
import { deleteConcept, markConceptViewed, toggleConceptFavorite } from '@/services/concepts'
import { createNote } from '@/services/notes'
import { useFeedback } from '@/components/feedback'
import { Markdown, Tex } from '@/components/Markdown'
import { Button, ButtonLink, Loading, Panel, Tag } from '@/components/ui'
import { formatDateTime } from '@/lib/text'
import { QuestionsPanel } from './QuestionsPanel'

function Section({ title, source }: { title: string; source: string }) {
  if (!source.trim()) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <Markdown source={source} />
    </section>
  )
}

export default function ConceptView() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { fail, confirm } = useFeedback()
  const data = useLiveQuery(async () => {
    const c = await db.concepts.get(id)
    if (!c) return { c: null }
    const [related, notes, formulas] = await Promise.all([
      db.concepts.bulkGet(c.relatedIds),
      db.notes.filter((n) => n.conceptIds.includes(id)).toArray(),
      db.formulas.filter((f) => f.conceptIds.includes(id)).toArray(),
    ])
    return { c, related: related.filter((x) => !!x), notes, formulas }
  }, [id])

  useEffect(() => {
    if (id) void markConceptViewed(id)
  }, [id])

  if (!data) return <div className="p-6"><Loading /></div>
  const { c } = data
  if (!c)
    return (
      <div className="p-6 text-sm">
        Concepto no encontrado. <Link to="/knowledge" className="text-accent">Volver</Link>
      </div>
    )

  const noteFromConcept = async () => {
    try {
      const n = await createNote({ title: `Notas: ${c.title}`, conceptIds: [c.id], tags: c.tags.slice(0, 3) })
      navigate(`/notes/${n.id}`)
    } catch (e) {
      fail(e)
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: `¿Eliminar «${c.title}»?`,
      body: 'Se quitarán también sus vínculos con otros conceptos, notas y fórmulas. Las notas no se borran.',
      danger: true,
      confirmLabel: 'Eliminar',
    })
    if (!ok) return
    try {
      await deleteConcept(c.id)
      navigate('/knowledge')
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <Link to="/knowledge" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={14} /> Knowledge Lab
      </Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="flex min-w-0 flex-col gap-5">
          <header className="flex flex-col gap-2 border-b border-line pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted">{c.discipline}</p>
                <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" aria-label="Favorito" title="Favorito" onClick={() => toggleConceptFavorite(c).catch(fail)}>
                  <Star size={16} className={c.favorite ? 'fill-accent text-accent' : ''} />
                </Button>
                <Button size="sm" onClick={noteFromConcept}><NotebookPen size={14} /> Tomar nota</Button>
                <ButtonLink size="sm" to={`/knowledge/${c.id}/edit`}><Pencil size={14} /> Editar</ButtonLink>
                <Button size="icon" variant="ghost" aria-label="Eliminar" title="Eliminar" onClick={remove}><Trash2 size={15} /></Button>
              </div>
            </div>
            {c.summary && <p className="text-[15px] leading-relaxed">{c.summary}</p>}
            {c.tags.length > 0 && <div className="flex flex-wrap gap-1">{c.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>}
          </header>
          <Section title="Explicación" source={c.explanation} />
          <Section title="Formalización matemática" source={c.formalism} />
          <Section title="Ejemplos" source={c.examples} />
          <Section title="Observaciones" source={c.observations} />
          <p className="text-xs text-muted">Actualizado {formatDateTime(c.updatedAt)}{c.seed && ' · contenido inicial de NEXUS, editable'}</p>
        </article>

        <aside className="flex flex-col gap-3">
          <Panel title="Relacionados" bodyClass="p-3">
            {data.related.length === 0 ? (
              <p className="text-xs text-muted">Sin relaciones. Agregalas desde Editar.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.related.map((r) => (
                  <li key={r!.id}>
                    <Link to={`/knowledge/${r!.id}`} className="text-sm text-accent hover:underline">{r!.title}</Link>
                    <p className="line-clamp-1 text-xs text-muted">{r!.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Fórmulas" bodyClass="p-3">
            {data.formulas.length === 0 ? (
              <p className="text-xs text-muted">Ninguna fórmula vinculada.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.formulas.map((f) => (
                  <li key={f.id}>
                    <Link to={`/workbench/formulas/${f.id}`} className="block rounded px-1 py-1 hover:bg-sunken">
                      <p className="text-xs text-muted">{f.name}</p>
                      <Tex expr={f.latex} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Notas vinculadas" bodyClass="p-3">
            {data.notes.length === 0 ? (
              <p className="text-xs text-muted">Ninguna nota todavía.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.notes.map((n) => (
                  <li key={n.id}><Link to={`/notes/${n.id}`} className="text-sm text-accent hover:underline">{n.title || 'Sin título'}</Link></li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Preguntas" bodyClass="p-3">
            <QuestionsPanel conceptId={c.id} />
          </Panel>
        </aside>
      </div>
    </div>
  )
}
