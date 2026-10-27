import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { MISTAKE_KINDS, MISTAKE_ORIGINS, MistakeOriginLabel, type Mistake, type MistakeOrigin } from '@/db/models'
import { kindRanking, mistakeEvolution, topicRanking } from '@/lib/mistakeStats'
import { deleteMistake, listMistakes, readExtraKinds, saveExtraKind, saveMistake } from '@/services/mistakes'
import { saveCard } from '@/services/cards'
import { useFeedback } from '@/components/feedback'
import { Button, Empty, Field, Input, PageHeader, Panel, Select, Tabs, Textarea } from '@/components/ui'

const blank = (): Omit<Mistake, 'id' | 'createdAt' | 'updatedAt'> => ({
  subjectId: null,
  topic: '',
  what: '',
  solution: '',
  kind: MISTAKE_KINDS[0],
  origin: 'ejercicio',
  at: Date.now(),
  overcome: false,
  exerciseId: null,
  conceptId: null,
  cardId: null,
})

const dayValue = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fromDay = (v: string) => {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime()
}

export default function MistakesPage() {
  const { fail, notify } = useFeedback()
  const [params, setParams] = useSearchParams()
  const data = useLiveQuery(async () => ({
    mistakes: await listMistakes(),
    subjects: await db.subjects.toArray(),
    concepts: await db.concepts.toArray(),
    exercises: await db.exercises.toArray(),
    kinds: await readExtraKinds(),
  }), [])
  const [tab, setTab] = useState<'lista' | 'patrones' | 'repasar'>('lista')
  const [form, setForm] = useState(blank())
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [kind, setKind] = useState('')
  const [origin, setOrigin] = useState('')
  const [overcome, setOvercome] = useState('')
  const [extra, setExtra] = useState('')
  const [reviewAt, setReviewAt] = useState(0)
  const [showSolution, setShowSolution] = useState(false)

  useEffect(() => {
    if (params.get('nuevo') === '1') {
      setOpen(true)
      setTab('lista')
    }
  }, [params])

  const names = useMemo(() => new Map(data?.subjects.map((s) => [s.id, s.name]) ?? []), [data?.subjects])
  const kinds = [...MISTAKE_KINDS, ...(data?.kinds ?? [])]
  const filtered = (data?.mistakes ?? []).filter((m) => {
    if (subjectId && m.subjectId !== subjectId) return false
    if (kind && m.kind !== kind) return false
    if (origin && m.origin !== origin) return false
    if (overcome === 'si' && !m.overcome) return false
    if (overcome === 'no' && m.overcome) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [m.what, m.solution, m.topic, m.kind].some((t) => t.toLowerCase().includes(q))
  })
  const pending = (data?.mistakes ?? []).filter((m) => !m.overcome)
  const current = pending[reviewAt]
  const ranks = kindRanking(data?.mistakes ?? [])
  const topics = topicRanking(data?.mistakes ?? [])
  const weeks = mistakeEvolution(data?.mistakes ?? [])
  const maxKind = Math.max(1, ...ranks.map((r) => r.count))

  const save = async () => {
    try {
      await saveMistake(form, editing ?? undefined)
      notify('Error registrado.', 'ok')
      setForm(blank())
      setEditing(null)
      setOpen(false)
      if (params.get('nuevo')) setParams({}, { replace: true })
    } catch (e) {
      fail(e)
    }
  }
  const addKind = async () => {
    try {
      await saveExtraKind(extra)
      setForm({ ...form, kind: extra.trim() })
      setExtra('')
    } catch (e) {
      fail(e)
    }
  }
  const toCard = async (m: Mistake) => {
    try {
      const card = await saveCard({
        front: m.what,
        back: m.solution || m.what,
        subjectId: m.subjectId,
        tags: ['error'],
        originKind: 'manual',
      })
      await saveMistake({ ...m, cardId: card.id }, m.id)
      notify('Tarjeta creada en Repaso.', 'ok')
    } catch (e) {
      fail(e)
    }
  }

  if (!data) return null
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Registro de errores"
        subtitle="Alta rápida con Alt+E. El análisis usa todos los errores cargados."
        actions={<Button variant="primary" onClick={() => { setOpen(true); setEditing(null); setForm(blank()) }}>Nuevo error</Button>}
      />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'lista', label: 'Lista' }, { id: 'patrones', label: 'Patrones' }, { id: 'repasar', label: `Repasar (${pending.length})` }]} />

      {open && (
        <Panel title={editing ? 'Editar error' : 'Nuevo error'}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Qué pasó" className="md:col-span-2"><Textarea rows={3} value={form.what} onChange={(e) => setForm({ ...form, what: e.target.value })} autoFocus /></Field>
            <Field label="Tipo">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {kinds.map((k) => <option key={k}>{k}</option>)}
              </Select>
            </Field>
            <Field label="Materia">
              <Select value={form.subjectId ?? ''} onChange={(e) => setForm({ ...form, subjectId: e.target.value || null })}>
                <option value="">Sin materia</option>
                {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Tema"><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></Field>
            <Field label="Origen">
              <Select value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value as MistakeOrigin })}>
                {MISTAKE_ORIGINS.map((o) => <option key={o} value={o}>{MistakeOriginLabel[o]}</option>)}
              </Select>
            </Field>
            <Field label="Fecha"><Input type="date" value={dayValue(form.at)} onChange={(e) => setForm({ ...form, at: fromDay(e.target.value) })} /></Field>
            <Field label="Solución correcta" className="md:col-span-2"><Textarea rows={2} value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} /></Field>
            <Field label="Ejercicio del banco">
              <Select value={form.exerciseId ?? ''} onChange={(e) => setForm({ ...form, exerciseId: e.target.value || null })}>
                <option value="">Sin vínculo</option>
                {data.exercises.map((x) => <option key={x.id} value={x.id}>{x.prompt.slice(0, 80)}</option>)}
              </Select>
            </Field>
            <Field label="Concepto">
              <Select value={form.conceptId ?? ''} onChange={(e) => setForm({ ...form, conceptId: e.target.value || null })}>
                <option value="">Sin vínculo</option>
                {data.concepts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Nuevo tipo"><Input value={extra} onChange={(e) => setExtra(e.target.value)} className="w-48" /></Field>
            <Button size="sm" onClick={() => void addKind()}>Agregar tipo</Button>
            <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.overcome} onChange={(e) => setForm({ ...form, overcome: e.target.checked })} /> Ya lo superé</label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" onClick={() => void save()}>Guardar</Button>
            <Button onClick={() => { setOpen(false); setEditing(null) }}>Cancelar</Button>
          </div>
        </Panel>
      )}

      {tab === 'lista' && (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" aria-label="Buscar errores" />
            <Select aria-label="Filtrar materia" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}><option value="">Materia</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            <Select aria-label="Filtrar tipo" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Tipo</option>{kinds.map((k) => <option key={k}>{k}</option>)}</Select>
            <Select aria-label="Filtrar origen" value={origin} onChange={(e) => setOrigin(e.target.value)}><option value="">Origen</option>{MISTAKE_ORIGINS.map((o) => <option key={o} value={o}>{MistakeOriginLabel[o]}</option>)}</Select>
            <Select aria-label="Filtrar superados" value={overcome} onChange={(e) => setOvercome(e.target.value)}><option value="">Estado</option><option value="no">Sin superar</option><option value="si">Superados</option></Select>
          </div>
          {filtered.length === 0 && <Empty title="Sin errores con ese filtro" />}
          <ul className="flex flex-col">
            {filtered.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start gap-2 border-b border-line py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className={m.overcome ? 'text-muted line-through' : ''}>{m.what}</p>
                  <p className="text-xs text-muted">{m.kind} · {MistakeOriginLabel[m.origin]}{m.topic ? ` · ${m.topic}` : ''}{m.subjectId ? ` · ${names.get(m.subjectId) ?? ''}` : ''}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {m.exerciseId && <Link className="text-accent" to="/exercises">Ejercicio</Link>}
                    {m.conceptId && <Link className="text-accent" to={`/knowledge/${m.conceptId}`}>Concepto</Link>}
                    {m.cardId && <Link className="text-accent" to="/review">Tarjeta</Link>}
                  </div>
                </div>
                <Button size="sm" onClick={() => { setForm(m); setEditing(m.id); setOpen(true) }}>Editar</Button>
                <Button size="sm" onClick={() => void toCard(m)}>Tarjeta</Button>
                <Button size="sm" variant="danger" onClick={() => deleteMistake(m.id).catch(fail)}>Borrar</Button>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'patrones' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Tipos de error">
            {ranks.length === 0 && <p className="text-sm text-muted">Cargá errores para ver el ranking.</p>}
            <ul className="flex flex-col gap-2">
              {ranks.map((r) => (
                <li key={r.kind}>
                  <div className="mb-1 flex justify-between text-sm"><span>{r.kind}</span><span className="font-mono text-xs">{r.count}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-sunken"><div className="h-full bg-accent" style={{ width: `${(r.count / maxKind) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Temas">
            <ul className="flex flex-col gap-1 text-sm">
              {topics.map((t) => <li key={t.topic} className="flex justify-between"><span>{t.topic}</span><span className="font-mono text-xs">{t.count}</span></li>)}
            </ul>
            <p className="mt-3 text-xs text-muted">Por semana: {weeks.map((w) => w.count).join(' · ')}</p>
          </Panel>
        </div>
      )}

      {tab === 'repasar' && (
        current ? (
          <Panel title={`${reviewAt + 1} / ${pending.length}`}>
            <p className="text-sm">{current.what}</p>
            <p className="mt-1 text-xs text-muted">{current.kind}{current.topic ? ` · ${current.topic}` : ''}</p>
            {showSolution ? <p className="mt-3 text-sm">{current.solution || 'Sin solución cargada.'}</p> : <Button className="mt-3" onClick={() => setShowSolution(true)}>Ver solución</Button>}
            <div className="mt-3 flex gap-2">
              <Button variant="primary" onClick={() => saveMistake({ ...current, overcome: true }, current.id).then(() => { setShowSolution(false); setReviewAt(0) }).catch(fail)}>Lo superé</Button>
              <Button onClick={() => { setShowSolution(false); setReviewAt((reviewAt + 1) % pending.length) }}>Siguiente</Button>
            </div>
          </Panel>
        ) : <Empty title="No quedan errores sin superar" />
      )}
    </div>
  )
}
