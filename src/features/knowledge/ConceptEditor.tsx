import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/db/db'
import { collectFacets, emptyConcept, saveConcept, type ConceptInput } from '@/services/concepts'
import { useFeedback } from '@/components/feedback'
import { EntityPicker } from '@/components/EntityPicker'
import { Markdown } from '@/components/Markdown'
import { Button, ErrorText, Field, Input, Loading, PageHeader, Textarea } from '@/components/ui'
import { parseTags } from '@/lib/text'
import { toggleLink } from '@/services/notes'

const SECTIONS: { key: 'explanation' | 'formalism' | 'examples' | 'observations'; label: string }[] = [
  { key: 'explanation', label: 'Explicación' },
  { key: 'formalism', label: 'Formalización matemática' },
  { key: 'examples', label: 'Ejemplos' },
  { key: 'observations', label: 'Observaciones' },
]

export default function ConceptEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { fail, notify } = useFeedback()
  const all = useLiveQuery(() => db.concepts.toArray(), [])
  const [form, setForm] = useState<ConceptInput | null>(id ? null : emptyConcept())
  const [tagText, setTagText] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    void db.concepts.get(id).then((c) => {
      if (!c) return setError('El concepto no existe.')
      const { id: _i, createdAt: _c, updatedAt: _u, lastViewedAt: _l, seed: _s, ...rest } = c
      setForm(rest)
      setTagText(c.tags.join(', '))
    })
  }, [id])

  if (error && !form) return <div className="p-6"><ErrorText>{error}</ErrorText></div>
  if (!form || !all) return <div className="p-6"><Loading /></div>
  const set = <K extends keyof ConceptInput>(k: K, v: ConceptInput[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const facets = collectFacets(all)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return setError('El título es obligatorio.')
    try {
      const savedId = await saveConcept({ ...form, tags: parseTags(tagText) }, id)
      notify('Concepto guardado.', 'ok')
      navigate(`/knowledge/${savedId}`)
    } catch (err) {
      fail(err)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-4xl flex-col gap-4 p-4 md:p-6">
      <Link to={id ? `/knowledge/${id}` : '/knowledge'} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={14} /> Volver
      </Link>
      <PageHeader title={id ? 'Editar concepto' : 'Nuevo concepto'} subtitle="Las secciones admiten Markdown y LaTeX ($…$ y $$…$$)." />
      <ErrorText>{error}</ErrorText>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Título *" hint="Si dos conceptos comparten nombre, distinguilos: «Entropía (termodinámica)».">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} required />
        </Field>
        <Field label="Disciplina">
          <Input value={form.discipline} onChange={(e) => set('discipline', e.target.value)} list="disciplines" />
          <datalist id="disciplines">{facets.disciplines.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
      </div>
      <Field label="Etiquetas (separadas por coma)">
        <Input value={tagText} onChange={(e) => setTagText(e.target.value)} />
      </Field>
      <Field label="Definición breve">
        <Textarea rows={2} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
      </Field>
      {SECTIONS.map((s) => (
        <div key={s.key} className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">{s.label}</span>
            <button type="button" className="text-xs text-accent" onClick={() => setPreview(preview === s.key ? null : s.key)}>
              {preview === s.key ? 'Editar' : 'Vista previa'}
            </button>
          </div>
          {preview === s.key ? (
            <div className="min-h-24 glass rounded-xl p-3"><Markdown source={form[s.key] || '_Vacío_'} /></div>
          ) : (
            <Textarea rows={s.key === 'explanation' ? 8 : 5} className="font-mono text-[13px]" value={form[s.key]} onChange={(e) => set(s.key, e.target.value)} />
          )}
        </div>
      ))}
      <Field label="Conceptos relacionados (la relación es bidireccional)">
        <div className="glass rounded-xl p-3">
          <EntityPicker
            items={all.filter((c) => c.id !== id).map((c) => ({ id: c.id, label: c.title, sub: c.discipline }))}
            selected={form.relatedIds}
            onToggle={(rid) => set('relatedIds', toggleLink(form.relatedIds, rid))}
            emptyText="Sin relaciones."
          />
        </div>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.favorite} onChange={(e) => set('favorite', e.target.checked)} /> Favorito
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="primary">Guardar</Button>
        <Button onClick={() => navigate(-1)}>Cancelar</Button>
      </div>
    </form>
  )
}
