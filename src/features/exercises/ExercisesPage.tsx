import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { ExerciseStatusLabel, PracticeResultLabel, type ExamItem, type Exercise, type PracticeResult } from '@/db/models'
import { examReport, filterExercises, pickExam } from '@/lib/exam'
import { parseTags, snippet } from '@/lib/text'
import { deleteExercise, listExercises, recordAttempt, saveExamRun, saveExercise } from '@/services/exercises'
import { listSubjects } from '@/services/focus'
import { Markdown } from '@/components/Markdown'
import { EntityPicker } from '@/components/EntityPicker'
import { useFeedback } from '@/components/feedback'
import { useNow, usePomodoro } from '@/hooks/usePomodoro'
import { Button, ButtonLink, Empty, Field, Input, Loading, PageHeader, Panel, Select, Tabs, Textarea } from '@/components/ui'

type Tab = 'banco' | 'practica' | 'simulado'

export default function ExercisesPage() {
  const { fail, notify } = useFeedback()
  const pomodoro = usePomodoro()
  const data = useLiveQuery(async () => ({
    exercises: await listExercises(),
    subjects: await listSubjects(),
    concepts: await db.concepts.toArray(),
  }), [])
  const [tab, setTab] = useState<Tab>('banco')
  const [query, setQuery] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const [practice, setPractice] = useState<{ id: string; startedAt: number; show: boolean } | null>(null)
  const [exam, setExam] = useState<{
    ids: string[]
    i: number
    startedAt: number
    limitMs: number
    subjectId: string | null
    topics: string[]
    items: ExamItem[]
    show: boolean
    itemStarted: number
    done?: ReturnType<typeof examReport>
  } | null>(null)
  const [setup, setSetup] = useState({ subjectId: '', topics: '', n: '5', min: '30' })

  const now = useNow(!!practice || (!!exam && !exam.done))
  const names = useMemo(() => new Map(data?.subjects.map((s) => [s.id, s.name]) ?? []), [data?.subjects])
  const finishExam = async (run: NonNullable<typeof exam>, endedAt: number) => {
    if (!run || run.done) return
    const items = run.items.length === run.ids.length ? run.items : [
      ...run.items,
      ...run.ids.slice(run.items.length).map((id) => ({ exerciseId: id, result: null, ms: 0 })),
    ]
    const report = examReport(items, data?.exercises ?? [])
    try {
      await saveExamRun({
        subjectId: run.subjectId,
        topics: run.topics,
        count: run.ids.length,
        limitMs: run.limitMs,
        startedAt: run.startedAt,
        endedAt,
        items,
      })
      setExam({ ...run, items, done: report })
    } catch (e) {
      fail(e)
    }
  }
  const list = useMemo(() => filterExercises(data?.exercises ?? [], {
    query, subjectId, topic, difficulty: difficulty ? Number(difficulty) : undefined, status,
  }), [data?.exercises, query, subjectId, topic, difficulty, status])
  const topics = [...new Set((data?.exercises ?? []).map((e) => e.topic).filter(Boolean))].sort()
  const current = practice ? data?.exercises.find((e) => e.id === practice.id) : undefined
  const examEx = exam ? data?.exercises.find((e) => e.id === exam.ids[exam.i]) : undefined
  const remain = exam && !exam.done ? Math.max(0, Math.min(exam.limitMs, exam.limitMs - (now - exam.startedAt))) : 0

  useEffect(() => {
    if (exam && !exam.done && remain === 0) void finishExam(exam, now)
  }, [remain, exam?.done])

  const gradePractice = async (result: PracticeResult) => {
    if (!practice || !current) return
    try {
      await recordAttempt(current.id, result, Date.now() - practice.startedAt)
      notify(PracticeResultLabel[result], result === 'bien' ? 'ok' : 'info')
      setPractice(null)
    } catch (e) {
      fail(e)
    }
  }

  const gradeExam = async (result: PracticeResult) => {
    if (!exam || !examEx) return
    const items = [...exam.items, { exerciseId: examEx.id, result, ms: Date.now() - exam.itemStarted }]
    if (exam.i + 1 >= exam.ids.length) {
      await finishExam({ ...exam, items }, Date.now())
      return
    }
    setExam({ ...exam, items, i: exam.i + 1, show: false, itemStarted: Date.now() })
  }

  if (!data) return <div className="p-6"><Loading /></div>

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <PageHeader
        title="Ejercicios"
        subtitle="Banco, práctica y simulados en este dispositivo."
        actions={
          <div className="flex flex-wrap gap-2">
            <Tabs value={tab} onChange={setTab} items={[{ id: 'banco', label: 'Banco' }, { id: 'practica', label: 'Práctica' }, { id: 'simulado', label: 'Simulado' }]} />
            <ButtonLink to="/exercises/errores">Errores</ButtonLink>
            <Button onClick={() => { setEditing('new'); setTab('banco') }}>Nuevo</Button>
          </div>
        }
      />

      {tab === 'banco' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" />
              <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Materia</option>
                {data.subjects.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">Tema</option>
                {topics.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Estado</option>
                {Object.entries(ExerciseStatusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <Select className="mb-3 w-40" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">Dificultad</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
            {list.length === 0 && <Empty title="Sin ejercicios">Cargá enunciados o cambiá los filtros.</Empty>}
            <ul>
              {list.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-2 border-b border-line py-2">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(e)}>
                    <p className="text-sm">{snippet(e.prompt, 110)}</p>
                    <p className="text-xs text-muted">{e.subjectId ? names.get(e.subjectId) : 'Sin materia'} · {e.topic || 'sin tema'} · {e.difficulty}/5 · {ExerciseStatusLabel[e.status]}</p>
                  </button>
                  <Button size="sm" onClick={() => { setPractice({ id: e.id, startedAt: Date.now(), show: false }); setTab('practica') }}>Practicar</Button>
                </li>
              ))}
            </ul>
          </div>
          {editing !== null && (
            <div className="glass rounded-2xl p-4">
              <ExerciseForm
                key={editing === 'new' ? 'new' : editing.id}
                initial={editing === 'new' ? null : editing}
                subjects={data.subjects}
                concepts={data.concepts}
                onClose={() => setEditing(null)}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'practica' && (
        current ? (
          <Panel>
            <p className="mb-2 text-xs text-muted">{Math.max(0, Math.round((now - practice!.startedAt) / 1000))} s · {current.topic || 'sin tema'}</p>
            <Markdown source={current.prompt} />
            {practice!.show && (
              <div className="mt-4 rounded-lg border border-line p-3">
                {current.answer && <p className="mb-2 text-sm font-medium">Respuesta: {current.answer}</p>}
                {current.solution ? <Markdown source={current.solution} /> : <p className="text-sm text-muted">Sin resolución cargada.</p>}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => setPractice({ ...practice!, show: !practice!.show })}>{practice!.show ? 'Esconder resolución' : 'Ver resolución'}</Button>
              {(['bien', 'mal', 'ayuda'] as const).map((r) => (
                <Button key={r} variant={r === 'bien' ? 'primary' : 'outline'} onClick={() => void gradePractice(r)}>{PracticeResultLabel[r]}</Button>
              ))}
            </div>
          </Panel>
        ) : <Empty title="Elegí un ejercicio">Desde el banco, tocá Practicar.</Empty>
      )}

      {tab === 'simulado' && !exam && (
        <Panel title="Nuevo simulado">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Materia">
              <Select value={setup.subjectId} onChange={(e) => setSetup({ ...setup, subjectId: e.target.value })}>
                <option value="">Todas</option>
                {data.subjects.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Temas (coma)"><Input value={setup.topics} onChange={(e) => setSetup({ ...setup, topics: e.target.value })} /></Field>
            <Field label="Cantidad"><Input type="number" min={1} value={setup.n} onChange={(e) => setSetup({ ...setup, n: e.target.value })} /></Field>
            <Field label="Minutos"><Input type="number" min={1} value={setup.min} onChange={(e) => setSetup({ ...setup, min: e.target.value })} /></Field>
          </div>
          <Button
            className="mt-3"
            variant="primary"
            onClick={() => {
              const topics = setup.topics.split(',').map((t) => t.trim()).filter(Boolean)
              const picked = pickExam(data.exercises, { subjectId: setup.subjectId || undefined, topics, n: Number(setup.n) || 5 })
              if (!picked.length) {
                notify('No hay ejercicios para ese filtro.', 'info')
                return
              }
              const startedAt = Date.now()
              setExam({
                ids: picked.map((e) => e.id),
                i: 0,
                startedAt,
                limitMs: Math.max(1, Number(setup.min) || 30) * 60_000,
                subjectId: setup.subjectId || null,
                topics,
                items: [],
                show: false,
                itemStarted: startedAt,
              })
              void pomodoro.link(null, setup.subjectId || null).then(() => pomodoro.start()).catch(() => undefined)
            }}
          >
            Empezar
          </Button>
        </Panel>
      )}

      {tab === 'simulado' && exam && !exam.done && examEx && (
        <Panel>
          <p className="mb-2 font-mono text-sm">{Math.floor(remain / 60_000)}:{String(Math.floor((remain % 60_000) / 1000)).padStart(2, '0')} · {exam.i + 1}/{exam.ids.length}</p>
          <Markdown source={examEx.prompt} />
          {exam.show && (
            <div className="mt-4 rounded-lg border border-line p-3">
              {examEx.answer && <p className="mb-2 text-sm font-medium">Respuesta: {examEx.answer}</p>}
              {examEx.solution ? <Markdown source={examEx.solution} /> : <p className="text-sm text-muted">Sin resolución.</p>}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => setExam({ ...exam, show: !exam.show })}>{exam.show ? 'Esconder' : 'Ver resolución'}</Button>
            {(['bien', 'mal', 'ayuda'] as const).map((r) => (
              <Button key={r} variant={r === 'bien' ? 'primary' : 'outline'} onClick={() => void gradeExam(r)}>{PracticeResultLabel[r]}</Button>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'simulado' && exam?.done && (
        <Panel title="Reporte">
          <p className="text-sm">{exam.done.hits}/{exam.done.total} bien · {Math.round(exam.done.ms / 1000)} s</p>
          <ul className="mt-2 text-sm">
            {exam.done.weak.map((w) => <li key={w.topic}>{w.topic || 'Sin tema'}: {w.wrong}/{w.total} flojos</li>)}
          </ul>
          <Button className="mt-3" onClick={() => setExam(null)}>Cerrar</Button>
        </Panel>
      )}
    </div>
  )
}

function ExerciseForm({ initial, subjects, concepts, onClose }: {
  initial: Exercise | null
  subjects: { id: string; name: string; archived: boolean }[]
  concepts: { id: string; title: string; summary: string }[]
  onClose: () => void
}) {
  const { fail, notify, confirm } = useFeedback()
  const [form, setForm] = useState({
    prompt: initial?.prompt ?? '',
    subjectId: initial?.subjectId ?? '',
    topic: initial?.topic ?? '',
    difficulty: String(initial?.difficulty ?? 3),
    source: initial?.source ?? '',
    solution: initial?.solution ?? '',
    answer: initial?.answer ?? '',
    tags: initial?.tags.join(', ') ?? '',
    conceptIds: initial?.conceptIds ?? [],
  })
  const set = (k: keyof typeof form, v: string | string[]) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void saveExercise({
          prompt: form.prompt,
          subjectId: form.subjectId || null,
          topic: form.topic,
          difficulty: Number(form.difficulty) || 1,
          source: form.source,
          solution: form.solution,
          answer: form.answer,
          tags: parseTags(form.tags),
          conceptIds: form.conceptIds,
          status: initial?.status,
          attempts: initial?.attempts,
          lastAttemptMs: initial?.lastAttemptMs,
          lastAttemptAt: initial?.lastAttemptAt,
        }, initial?.id).then(() => { notify('Ejercicio guardado.', 'ok'); onClose() }).catch(fail)
      }}
    >
      <h2 className="font-medium">{initial ? 'Editar' : 'Nuevo ejercicio'}</h2>
      <Field label="Enunciado"><Textarea rows={5} value={form.prompt} onChange={(e) => set('prompt', e.target.value)} required /></Field>
      {form.prompt && <div className="text-sm"><Markdown source={form.prompt} /></div>}
      <Field label="Materia">
        <Select value={form.subjectId} onChange={(e) => set('subjectId', e.target.value)}>
          <option value="">Sin materia</option>
          {subjects.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
      <Field label="Tema"><Input value={form.topic} onChange={(e) => set('topic', e.target.value)} /></Field>
      <Field label="Dificultad">
        <Select value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
      </Field>
      <Field label="Fuente"><Input value={form.source} onChange={(e) => set('source', e.target.value)} placeholder="guía, parcial, libro" /></Field>
      <Field label="Respuesta final"><Input value={form.answer} onChange={(e) => set('answer', e.target.value)} /></Field>
      <Field label="Resolución"><Textarea rows={4} value={form.solution} onChange={(e) => set('solution', e.target.value)} /></Field>
      <Field label="Etiquetas"><Input value={form.tags} onChange={(e) => set('tags', e.target.value)} /></Field>
      <Field label="Conceptos">
        <EntityPicker
          items={concepts.map((c) => ({ id: c.id, label: c.title, sub: c.summary }))}
          selected={form.conceptIds}
          onToggle={(id) => set('conceptIds', form.conceptIds.includes(id) ? form.conceptIds.filter((x) => x !== id) : [...form.conceptIds, id])}
          emptyText="Ninguno vinculado."
          renderLink={(it) => <Link className="text-accent hover:underline" to={`/knowledge/${it.id}`}>{it.label}</Link>}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">Guardar</Button>
        <Button onClick={onClose}>Cancelar</Button>
        {initial && (
          <Button variant="danger" onClick={async () => {
            if (await confirm({ title: '¿Eliminar el ejercicio?', danger: true, confirmLabel: 'Eliminar' })) {
              await deleteExercise(initial.id).then(onClose).catch(fail)
            }
          }}>Eliminar</Button>
        )}
      </div>
    </form>
  )
}
