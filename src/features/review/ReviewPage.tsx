import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CardOriginLabel, CardRatingLabel, type Card } from '@/db/models'
import { originStale, reviewStats } from '@/lib/flashcards'
import { isNewCard, reviewQueue, type Rating } from '@/lib/sm2'
import { matchesQuery, snippet } from '@/lib/text'
import { applyReview, listCards, listReviews, readNewLimit, writeNewLimit } from '@/services/cards'
import { listSubjects } from '@/services/focus'
import { db } from '@/db/db'
import { Markdown } from '@/components/Markdown'
import { useFeedback } from '@/components/feedback'
import { Button, Empty, Field, Input, Kbd, Loading, PageHeader, Panel, Tabs, cx } from '@/components/ui'
import { CardPanel } from './CardPanel'

type Tab = 'sesion' | 'mazos' | 'tarjetas' | 'stats'
const RATINGS: Rating[] = ['again', 'hard', 'good', 'easy']

type Run = {
  ids: string[]
  i: number
  revealed: boolean
  done: { id: string; rating: Rating }[]
  startedAt: number
}

export default function ReviewPage() {
  const { fail, notify } = useFeedback()
  const [params, setParams] = useSearchParams()
  const tab = (['sesion', 'mazos', 'tarjetas', 'stats'] as const).includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'sesion'
  const subjectFilter = params.get('subject') ?? ''
  const data = useLiveQuery(async () => ({
    cards: await listCards(),
    reviews: await listReviews(),
    subjects: await listSubjects(),
    newLimit: await readNewLimit(),
    concepts: await db.concepts.toArray(),
    formulas: await db.formulas.toArray(),
    questions: await db.questions.toArray(),
  }), [])
  const [run, setRun] = useState<Run | null>(null)
  const [editing, setEditing] = useState<Card | null | 'new'>(null)
  const [query, setQuery] = useState('')
  const [limitDraft, setLimitDraft] = useState('')

  useEffect(() => {
    if (data) setLimitDraft(String(data.newLimit))
  }, [data?.newLimit])

  const names = useMemo(() => new Map(data?.subjects.map((s) => [s.id, s.name]) ?? []), [data?.subjects])
  const originAt = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of data?.concepts ?? []) m.set(`concept:${c.id}`, c.updatedAt)
    for (const f of data?.formulas ?? []) m.set(`formula:${f.id}`, f.updatedAt)
    for (const q of data?.questions ?? []) m.set(`question:${q.id}`, q.resolvedAt ?? q.createdAt)
    return m
  }, [data])

  const scoped = useMemo(() => {
    const all = data?.cards ?? []
    return subjectFilter ? all.filter((c) => c.subjectId === subjectFilter) : all
  }, [data?.cards, subjectFilter])

  const queue = useMemo(() => reviewQueue(scoped, Date.now(), data?.newLimit ?? 20), [scoped, data?.newLimit])
  const byId = useMemo(() => new Map((data?.cards ?? []).map((c) => [c.id, c])), [data?.cards])

  const start = () => {
    const ids = [...queue.reviews, ...queue.news].map((c) => c.id)
    if (!ids.length) {
      notify('No hay tarjetas para hoy.', 'info')
      return
    }
    setRun({ ids, i: 0, revealed: false, done: [], startedAt: Date.now() })
  }

  const grade = async (rating: Rating) => {
    if (!run) return
    const id = run.ids[run.i]
    if (!id) return
    try {
      await applyReview(id, rating)
      const done = [...run.done, { id, rating }]
      if (run.i + 1 >= run.ids.length) setRun({ ...run, revealed: false, done, i: run.i + 1 })
      else setRun({ ...run, i: run.i + 1, revealed: false, done })
    } catch (e) {
      fail(e)
    }
  }

  useEffect(() => {
    if (tab !== 'sesion' || !run || run.i >= run.ids.length) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setRun((r) => (r && !r.revealed ? { ...r, revealed: true } : r))
      }
      const map: Record<string, Rating> = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }
      const rating = map[e.key]
      if (rating) {
        e.preventDefault()
        setRun((r) => {
          if (!r?.revealed) return r
          void grade(rating)
          return r
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, run?.i, run?.revealed, run?.ids.length])

  const setTab = (id: Tab) => {
    const next = new URLSearchParams(params)
    if (id === 'sesion') next.delete('tab')
    else next.set('tab', id)
    setParams(next, { replace: true })
  }

  if (!data) return <div className="p-6"><Loading /></div>

  const current = run ? byId.get(run.ids[run.i] ?? '') : undefined
  const finished = run && run.i >= run.ids.length
  const dueN = queue.reviews.length
  const newN = queue.news.length
  const stats = reviewStats(data.reviews, Date.now())
  const decks = [...data.subjects.filter((s) => !s.archived), { id: '', name: 'Sin materia', period: '', objectives: '', notes: '', archived: false, createdAt: 0, updatedAt: 0 }]
  const explored = data.cards.filter((c) => matchesQuery(query, c.front, c.back, c.tags, CardOriginLabel[c.originKind]))

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <PageHeader
        title="Repaso"
        subtitle="Tarjetas con SM-2 en este dispositivo."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={tab} onChange={setTab} items={[{ id: 'sesion', label: 'Sesión' }, { id: 'mazos', label: 'Mazos' }, { id: 'tarjetas', label: 'Tarjetas' }, { id: 'stats', label: 'Estadísticas' }]} />
            <Button onClick={() => setEditing('new')}>Nueva</Button>
          </div>
        }
      />

      {tab === 'sesion' && (
        <div className={cx('grid gap-4', editing !== null && 'lg:grid-cols-[minmax(0,1fr)_360px]')}>
          <div className="flex flex-col gap-4">
            <Panel>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="text-sm">{dueN} vencida{dueN === 1 ? '' : 's'} · {newN} nueva{newN === 1 ? '' : 's'}{subjectFilter && ` · ${names.get(subjectFilter) ?? 'materia'}`}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Field label="Nuevas / día">
                    <div className="flex gap-1">
                      <Input className="w-20 font-mono" type="number" min={1} value={limitDraft} onChange={(e) => setLimitDraft(e.target.value)} />
                      <Button size="sm" onClick={() => writeNewLimit(Number(limitDraft)).then(() => notify('Cupo guardado.', 'ok')).catch(fail)}>Aplicar</Button>
                    </div>
                  </Field>
                  {!run && <Button variant="primary" onClick={start}>Empezar</Button>}
                  {run && !finished && <Button onClick={() => setRun(null)}>Abortar</Button>}
                </div>
              </div>
            </Panel>

            {!run && <Empty title="Sesión de hoy">Espacio muestra el dorso. {<Kbd>1</Kbd>}–{<Kbd>4</Kbd>} califican. Tocá Empezar.</Empty>}

            {run && current && !finished && (
              <Panel>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full bg-accent" style={{ width: `${(run.done.length / run.ids.length) * 100}%` }} />
                </div>
                <p className="mb-2 text-xs text-muted">{run.done.length + 1} / {run.ids.length} · {isNewCard(current) ? 'Nueva' : 'Repaso'}{current.subjectId && ` · ${names.get(current.subjectId)}`}</p>
                {originStale(current, originAt.get(`${current.originKind}:${current.originId ?? ''}`)) && (
                  <p className="mb-2 text-xs text-danger">Origen modificado</p>
                )}
                <div className="min-h-40 rounded-xl border border-line bg-sunken/40 p-4">
                  <Markdown source={current.front} />
                  {run.revealed && (
                    <>
                      <hr className="my-4 border-line" />
                      <Markdown source={current.back} />
                    </>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!run.revealed && <Button variant="primary" onClick={() => setRun({ ...run, revealed: true })}>Mostrar <Kbd>espacio</Kbd></Button>}
                  {run.revealed && RATINGS.map((r, i) => (
                    <Button key={r} variant={r === 'good' ? 'primary' : 'outline'} onClick={() => void grade(r)}>
                      {CardRatingLabel[r]} <Kbd>{i + 1}</Kbd>
                    </Button>
                  ))}
                </div>
              </Panel>
            )}

            {finished && run && (
              <Panel title="Fin de sesión">
                <p className="text-sm">{run.done.length} tarjeta{run.done.length === 1 ? '' : 's'} · {Math.round((Date.now() - run.startedAt) / 60_000)} min</p>
                <ul className="mt-2 text-sm">
                  {RATINGS.map((r) => <li key={r}>{CardRatingLabel[r]}: {run.done.filter((d) => d.rating === r).length}</li>)}
                </ul>
                <Button className="mt-3" variant="primary" onClick={() => setRun(null)}>Cerrar</Button>
              </Panel>
            )}
          </div>
          {editing !== null && (
            <div className="glass min-h-80 overflow-hidden rounded-2xl">
              <CardPanel key={editing === 'new' ? 'new' : editing.id} card={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
            </div>
          )}
        </div>
      )}

      {tab === 'mazos' && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {decks.map((s) => {
            const cards = data.cards.filter((c) => (s.id ? c.subjectId === s.id : !c.subjectId))
            if (!cards.length && s.id === '') return null
            const q = reviewQueue(cards, Date.now(), data.newLimit)
            return (
              <li key={s.id || 'none'}>
                <button
                  type="button"
                  className="glass w-full rounded-2xl p-4 text-left hover:border-accent/40"
                  onClick={() => {
                    const next = new URLSearchParams()
                    if (s.id) next.set('subject', s.id)
                    setParams(next)
                    setRun(null)
                  }}
                >
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted">{cards.length} tarjetas · {q.reviews.length} hoy · {cards.filter(isNewCard).length} nuevas</p>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {tab === 'tarjetas' && (
        <div className={cx('grid gap-4', editing !== null && 'lg:grid-cols-[minmax(0,1fr)_360px]')}>
          <div>
            <Input className="mb-3" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar frente, dorso o etiquetas…" />
            {explored.length === 0 && <Empty title="Sin tarjetas">Creá una o generá desde un concepto.</Empty>}
            <ul className="flex flex-col">
              {explored.map((c) => (
                <li key={c.id}>
                  <button type="button" className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left hover:bg-sunken" onClick={() => setEditing(c)}>
                    <span className="text-sm">{snippet(c.front, 90)}</span>
                    <span className="text-xs text-muted">{c.subjectId ? names.get(c.subjectId) : 'Sin materia'} · {CardOriginLabel[c.originKind]}{originStale(c, originAt.get(`${c.originKind}:${c.originId ?? ''}`)) ? ' · origen modificado' : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {editing !== null && (
            <div className="glass min-h-80 overflow-hidden rounded-2xl">
              <CardPanel key={editing === 'new' ? 'new' : editing.id} card={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
            </div>
          )}
        </div>
      )}

      {tab === 'stats' && (
        <div className="grid gap-4 md:grid-cols-3">
          <Panel title="Hoy"><p className="text-2xl font-semibold">{stats.today}</p><p className="text-xs text-muted">repasos</p></Panel>
          <Panel title="Racha"><p className="text-2xl font-semibold">{stats.streak}</p><p className="text-xs text-muted">días seguidos</p></Panel>
          <Panel title="Retención 7 días"><p className="text-2xl font-semibold">{stats.retention == null ? '—' : `${Math.round(stats.retention * 100)}%`}</p><p className="text-xs text-muted">no fueron «Otra vez»</p></Panel>
          <Panel title="Tarjetas por día" className="md:col-span-3">
            <div className="flex h-24 items-end gap-1">
              {stats.byDay.map((d) => (
                <div key={d.at} className="flex-1 rounded-t bg-accent/70" style={{ height: `${Math.max(6, (d.count / Math.max(1, ...stats.byDay.map((x) => x.count))) * 100)}%` }} title={`${d.count}`} />
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
