import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Plus, Star } from 'lucide-react'
import { db } from '@/db/db'
import { collectFacets, filterConcepts } from '@/services/concepts'
import { ButtonLink, Empty, Input, Loading, PageHeader, Panel, Select, Tag } from '@/components/ui'
import { QuestionsPanel } from './QuestionsPanel'

export default function KnowledgeList() {
  const concepts = useLiveQuery(() => db.concepts.toArray(), [])
  const [query, setQuery] = useState('')
  const [discipline, setDiscipline] = useState<string | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [favorites, setFavorites] = useState(false)
  const facets = useMemo(() => collectFacets(concepts ?? []), [concepts])
  const list = useMemo(() => (concepts ? filterConcepts(concepts, { query, discipline, tag, favorites }) : []), [concepts, query, discipline, tag, favorites])

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <PageHeader
        title="Knowledge Lab"
        subtitle="Biblioteca personal de conceptos. Funciona completamente sin conexión."
        actions={<ButtonLink to="/knowledge/new" variant="primary"><Plus size={15} /> Nuevo concepto</ButtonLink>}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar conceptos…" className="max-w-sm" />
            <Select value={discipline ?? ''} onChange={(e) => setDiscipline(e.target.value || null)} className="w-44" aria-label="Disciplina">
              <option value="">Todas las disciplinas</option>
              {facets.disciplines.map((d) => <option key={d}>{d}</option>)}
            </Select>
            <Select value={tag ?? ''} onChange={(e) => setTag(e.target.value || null)} className="w-44" aria-label="Etiqueta">
              <option value="">Todas las etiquetas</option>
              {facets.tags.map((t) => <option key={t}>{t}</option>)}
            </Select>
            <Tag active={favorites} onClick={() => setFavorites((f) => !f)}>★ Favoritos</Tag>
          </div>
          {!concepts && <Loading />}
          {concepts && list.length === 0 && (
            <Empty title="No hay conceptos que coincidan" action={<ButtonLink size="sm" to="/knowledge/new">Crear concepto</ButtonLink>}>
              Ajustá los filtros o registrá un concepto nuevo.
            </Empty>
          )}
          <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
            {list.map((c) => (
              <li key={c.id}>
                <Link to={`/knowledge/${c.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-sunken">
                  <div className="flex items-center gap-2">
                    {c.favorite && <Star size={13} className="fill-accent text-accent" />}
                    <span className="font-medium">{c.title}</span>
                    <span className="text-xs text-muted">{c.discipline}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">{c.summary}</p>
                  {c.tags.length > 0 && <div className="flex flex-wrap gap-1">{c.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <Panel title="Preguntas pendientes" bodyClass="p-3">
          <QuestionsPanel showOrigin />
        </Panel>
      </div>
    </div>
  )
}
