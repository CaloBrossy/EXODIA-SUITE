import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '@/db/db'
import { CardOriginLabel, type Card } from '@/db/models'
import { originStale } from '@/lib/flashcards'
import { parseTags } from '@/lib/text'
import { deleteCard, saveCard } from '@/services/cards'
import { listSubjects } from '@/services/focus'
import { Markdown } from '@/components/Markdown'
import { useFeedback } from '@/components/feedback'
import { Button, ErrorText, Field, Input, Select, Textarea } from '@/components/ui'

export function CardPanel({ card, onClose }: { card: Card | null; onClose: () => void }) {
  const { fail, notify, confirm } = useFeedback()
  const subjects = useLiveQuery(listSubjects, []) ?? []
  const origin = useLiveQuery(async () => {
    if (!card || card.originKind === 'manual' || !card.originId) return null
    if (card.originKind === 'concept') {
      const c = await db.concepts.get(card.originId)
      return c ? { to: `/knowledge/${c.id}`, label: c.title, updatedAt: c.updatedAt } : { to: '', label: '', updatedAt: null }
    }
    if (card.originKind === 'formula') {
      const f = await db.formulas.get(card.originId)
      return f ? { to: `/workbench/formulas/${f.id}`, label: f.name, updatedAt: f.updatedAt } : { to: '', label: '', updatedAt: null }
    }
    const q = await db.questions.get(card.originId)
    return q ? { to: q.conceptId ? `/knowledge/${q.conceptId}` : '/knowledge', label: q.text.slice(0, 80), updatedAt: q.resolvedAt ?? q.createdAt } : { to: '', label: '', updatedAt: null }
  }, [card?.id, card?.originKind, card?.originId])
  const [form, setForm] = useState({
    front: card?.front ?? '',
    back: card?.back ?? '',
    subjectId: card?.subjectId ?? '',
    tags: card?.tags.join(', ') ?? '',
  })
  const [error, setError] = useState('')
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setError('')
    try {
      await saveCard({
        front: form.front,
        back: form.back,
        subjectId: form.subjectId || null,
        tags: parseTags(form.tags),
        originKind: card?.originKind ?? 'manual',
        originId: card?.originId,
        originUpdatedAt: card?.originUpdatedAt,
        intervalDays: card?.intervalDays,
        ease: card?.ease,
        reps: card?.reps,
        lapses: card?.lapses,
        dueAt: card?.dueAt,
        lastReviewedAt: card?.lastReviewedAt,
      }, card?.id)
      notify(card ? 'Tarjeta guardada.' : 'Tarjeta creada.', 'ok')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
      fail(e)
    }
  }

  const remove = async () => {
    if (!card) return
    if (!(await confirm({ title: '¿Eliminar esta tarjeta?', danger: true, confirmLabel: 'Eliminar' }))) return
    try {
      await deleteCard(card.id)
      notify('Tarjeta eliminada.', 'ok')
      onClose()
    } catch (e) {
      fail(e)
    }
  }

  const stale = card ? originStale(card, origin?.updatedAt) : false

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-medium">{card ? 'Editar tarjeta' : 'Nueva tarjeta'}</h2>
        <Button size="sm" variant="ghost" onClick={onClose}>Cerrar</Button>
      </div>
      <form
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
        onSubmit={(e) => { e.preventDefault(); void save() }}
      >
        {stale && <ErrorText>Origen modificado. Revisá el frente y el dorso.</ErrorText>}
        {origin && (origin.label
          ? <p className="text-xs text-muted">{CardOriginLabel[card?.originKind ?? 'manual']}: {origin.to ? <Link className="text-accent hover:underline" to={origin.to}>{origin.label}</Link> : 'ya no existe'}</p>
          : <ErrorText>El origen de esta tarjeta ya no está en el laboratorio.</ErrorText>)}
        <Field label="Frente">
          <Textarea rows={4} value={form.front} onChange={(e) => set('front', e.target.value)} required />
        </Field>
        {form.front.trim() && <div className="rounded-lg border border-line px-3 py-2 text-sm"><Markdown source={form.front} /></div>}
        <Field label="Dorso">
          <Textarea rows={5} value={form.back} onChange={(e) => set('back', e.target.value)} required />
        </Field>
        {form.back.trim() && <div className="rounded-lg border border-line px-3 py-2 text-sm"><Markdown source={form.back} /></div>}
        <Field label="Materia">
          <Select value={form.subjectId} onChange={(e) => set('subjectId', e.target.value)}>
            <option value="">Sin materia</option>
            {subjects.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Etiquetas"><Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="mecánica, examen" /></Field>
        {card && (
          <p className="font-mono text-[11px] text-muted">
            intervalo {card.intervalDays} d · facilidad {card.ease.toFixed(2)} · reps {card.reps} · lapsos {card.lapses}
          </p>
        )}
        {error && <ErrorText>{error}</ErrorText>}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button type="submit" variant="primary">Guardar</Button>
          <Button onClick={onClose}>Cancelar</Button>
          {card && <Button variant="danger" onClick={() => void remove()}>Eliminar</Button>}
        </div>
      </form>
    </aside>
  )
}
