import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, ChevronRight, Eye, Lock, Sparkles, Trash2 } from 'lucide-react'
import { useFeedback } from '@/components/feedback'
import { Button, cx, Empty, Panel, pillClass, Select, Tabs, Tag, Textarea } from '@/components/ui'
import { KINDS, kindById, solve } from '@/lib/devlab/problems'
import { LANGS, type LangId } from '@/lib/devlab/languages'
import { STAGES, type KindId, type StageId } from '@/lib/devlab/types'
import type { DevProblem } from '@/db/models'
import { deleteDevProblem, listDevProblems, saveDevProblem } from '@/services/devProblems'
import { AlgorithmStage, CodeStage, LANG_OPTIONS, List, MathStage, ProblemStage, PseudoStage, TestsStage } from './Stages'
import { LangGuide } from './LangGuide'

type Mode = 'guided' | 'consult'
interface Session {
  id?: string
  text: string
  kind: KindId | 'auto'
  strategy?: string
  stage: StageId
  revealed: number
}

const isLang = (x: string): x is LangId => x in LANGS
const isKind = (x: string): x is KindId => KINDS.some((k) => k.id === x)
const isStage = (x: string): x is StageId => STAGES.some((s) => s.id === x)

export default function DevLab() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('t') === 'guia' ? 'guia' : 'resolver'
  const guideLang = params.get('lang')
  const setTab = (t: 'resolver' | 'guia', lang?: LangId) => {
    const p = new URLSearchParams(params)
    p.set('t', t)
    if (lang) p.set('lang', lang)
    setParams(p, { replace: true })
  }
  const [lang, setLang] = useState<LangId>('python')
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Dev Lab</h2>
          <p className="text-sm text-muted">Problema → matemática → algoritmo → pseudocódigo → código → pruebas.</p>
        </div>
        <Tabs value={tab} onChange={(t) => setTab(t)} items={[{ id: 'resolver', label: 'Resolver' }, { id: 'guia', label: 'Guía de lenguajes' }]} />
      </div>
      <div hidden={tab !== 'resolver'}>
        <Solver lang={lang} setLang={setLang} openGuide={(l) => setTab('guia', l)} />
      </div>
      {tab === 'guia' && <LangGuide key={guideLang ?? lang} initial={guideLang && isLang(guideLang) ? guideLang : lang} />}
    </div>
  )
}

function Solver({ lang, setLang, openGuide }: { lang: LangId; setLang: (l: LangId) => void; openGuide: (l: LangId) => void }) {
  const { fail, confirm } = useFeedback()
  const [draft, setDraft] = useState('')
  const [kind, setKind] = useState<KindId | 'auto'>('auto')
  const [mode, setMode] = useState<Mode>('guided')
  const [session, setSession] = useState<Session | null>(null)
  const history = useLiveQuery(listDevProblems, [])

  const sol = useMemo(() => (session ? solve(session.text, session.kind, session.strategy) : null), [session])

  useEffect(() => {
    if (!session || sol?.status !== 'ok') return
    const t = setTimeout(() => {
      saveDevProblem({ title: sol.title, text: session.text, kind: session.kind, strategy: sol.strategy, lang, mode, stage: session.stage, revealed: session.revealed }, session.id)
        .then((r) => {
          if (!session.id) setSession((s) => (s && !s.id && s.text === session.text ? { ...s, id: r.id } : s))
        })
        .catch(fail)
    }, 250)
    return () => clearTimeout(t)
  }, [session, sol, lang, mode, fail])

  const analyze = (text = draft) => {
    if (!text.trim()) return
    setDraft(text)
    setSession({ text: text.trim(), kind, stage: 'problem', revealed: 0 })
  }
  const load = (r: DevProblem) => {
    setDraft(r.text)
    const k = r.kind === 'auto' || isKind(r.kind) ? r.kind : 'auto'
    setKind(k)
    if (isLang(r.lang)) setLang(r.lang)
    setMode(r.mode)
    setSession({ id: r.id, text: r.text, kind: k, strategy: r.strategy, stage: isStage(r.stage) ? r.stage : 'problem', revealed: r.revealed })
  }
  const remove = async (r: DevProblem) => {
    if (!(await confirm({ title: `¿Eliminar «${r.title}» del historial?`, danger: true, confirmLabel: 'Eliminar' }))) return
    await deleteDevProblem(r.id).catch(fail)
    if (session?.id === r.id) setSession(null)
  }
  const examples = kind === 'auto' ? KINDS.map((k) => ({ ...k.examples[0]!, kind: k.label === k.examples[0]!.title ? '' : k.label })) : (kindById(kind)?.examples ?? []).map((e) => ({ ...e, kind: kindById(kind)!.label }))

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_270px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="Problema">
          <div className="flex flex-col gap-3">
            <Textarea
              rows={3}
              value={draft}
              maxLength={2000}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) analyze()
              }}
              placeholder="Escribí el enunciado. Ej.: Promedio de 7.5, 9, 6 y 10"
              aria-label="Enunciado del problema"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={kind} onChange={(e) => setKind(e.target.value as KindId | 'auto')} className="max-w-64" aria-label="Tipo de problema">
                <option value="auto">Tipo: detectar automáticamente</option>
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>{k.label}</option>
                ))}
              </Select>
              <Select value={lang} onChange={(e) => setLang(e.target.value as LangId)} className="max-w-44" aria-label="Lenguaje de destino">
                {LANG_OPTIONS.map((l) => (
                  <option key={l} value={l}>{LANGS[l].label}</option>
                ))}
              </Select>
              <Tabs value={mode} onChange={setMode} items={[{ id: 'guided', label: 'Guiado' }, { id: 'consult', label: 'Consulta' }]} />
              <Button variant="primary" onClick={() => analyze()} disabled={!draft.trim()} className="ml-auto">
                <Sparkles size={15} /> Analizar
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {examples.map((e) => (
                <Tag key={e.text} onClick={() => analyze(e.text)}>
                  {e.kind && <span className="text-muted">{e.kind}&nbsp;·&nbsp;</span>}{e.title}
                </Tag>
              ))}
            </div>
          </div>
        </Panel>
        {sol && session ? (
          sol.status === 'clarify' ? (
            <Panel title="Hace falta una aclaración">
              <div className="flex flex-col gap-3">
                <p className="text-sm">{sol.analysis.summary}</p>
                <List title="Ambigüedades" items={sol.analysis.ambiguities} tone="warn" />
                <p className="text-xs text-muted">En lugar de suponer en silencio, elegí cómo interpretarlo:</p>
                <div className="flex flex-col gap-2">
                  {sol.analysis.clarifications?.map((c) => (
                    <button key={c.text} type="button" onClick={() => analyze(c.text)} className="rounded-xl border border-line px-3 py-2 text-left text-sm transition-colors hover:border-accent">
                      <span className="font-medium">{c.label}</span>
                      <span className="block font-mono text-xs text-muted">{c.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Panel>
          ) : sol.status === 'unsupported' ? (
            <Panel title="Fuera del alcance de esta versión">
              <div className="flex flex-col gap-3 text-sm">
                <p>{sol.limitation}</p>
                <List title="Ambigüedades" items={sol.analysis.ambiguities} tone="warn" />
                <p className="text-xs text-muted">Tipos admitidos: {KINDS.map((k) => k.label.toLowerCase()).join(', ')}. Probá con un ejemplo o elegí el tipo manualmente.</p>
              </div>
            </Panel>
          ) : (
            <Workspace
              key={`${session.text}|${session.kind}|${sol.strategy}`}
              session={session}
              setSession={setSession}
              sol={sol}
              mode={mode}
              lang={lang}
              setLang={setLang}
              openGuide={openGuide}
            />
          )
        ) : (
          <Empty title="Empezá por el problema">Escribí un enunciado o elegí un ejemplo. Dev Lab separa la comprensión, la matemática y el algoritmo antes de llegar al código.</Empty>
        )}
      </div>
      <aside className="flex flex-col gap-4">
        <Panel title="Historial" bodyClass="p-2">
          {!history?.length ? (
            <p className="px-2 py-1 text-xs text-muted">Los problemas analizados se guardan acá, en este dispositivo.</p>
          ) : (
            <ul className="flex max-h-[420px] flex-col gap-0.5 overflow-y-auto">
              {history.map((r) => (
                <li key={r.id} className={cx('group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors hover:bg-sunken', session?.id === r.id && 'bg-accent/10')}>
                  <button type="button" onClick={() => load(r)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm">{r.title}</span>
                    <span className="block truncate text-[11px] text-muted">{LANGS[isLang(r.lang) ? r.lang : 'python'].label} · {new Date(r.updatedAt).toLocaleDateString()}</span>
                  </button>
                  <Button size="icon" variant="ghost" aria-label="Eliminar" className="opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => void remove(r)}>
                    <Trash2 size={13} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Guías">
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-xs text-muted">Convenciones, errores comunes y ejemplos por lenguaje.</p>
            <Button onClick={() => openGuide(lang)}><BookOpen size={14} /> Guía de {LANGS[lang].label}</Button>
          </div>
        </Panel>
      </aside>
    </div>
  )
}

function Workspace({ session, setSession, sol, mode, lang, setLang, openGuide }: {
  session: Session
  setSession: (f: (s: Session | null) => Session | null) => void
  sol: NonNullable<ReturnType<typeof solve>>
  mode: Mode
  lang: LangId
  setLang: (l: LangId) => void
  openGuide: (l: LangId) => void
}) {
  const idx = STAGES.findIndex((s) => s.id === session.stage)
  const unlocked = (i: number) => mode === 'consult' || i <= session.revealed
  const go = (stage: StageId) => setSession((s) => (s ? { ...s, stage } : s))
  const next = () => {
    const n = STAGES[idx + 1]
    if (n) setSession((s) => (s ? { ...s, stage: n.id, revealed: Math.max(s.revealed, idx + 1) } : s))
  }
  const strategy = (id: string) => setSession((s) => (s ? { ...s, strategy: id } : s))
  const render = (id: StageId) => {
    switch (id) {
      case 'problem':
        return <ProblemStage sol={sol} />
      case 'math':
        return <MathStage sol={sol} />
      case 'algorithm':
        return <AlgorithmStage sol={sol} onStrategy={strategy} />
      case 'pseudo':
        return <PseudoStage sol={sol} />
      case 'code':
        return <CodeStage sol={sol} lang={lang} onLang={setLang} />
      case 'tests':
        return <TestsStage sol={sol} />
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <nav className="glass flex flex-wrap items-center gap-1 rounded-xl p-1" aria-label="Etapas">
        {STAGES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            disabled={!unlocked(i)}
            onClick={() => (mode === 'consult' ? document.getElementById(`stage-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : go(s.id))}
            className={cx('flex items-center gap-1.5', mode === 'guided' ? pillClass(session.stage === s.id) : pillClass(false), !unlocked(i) && 'cursor-not-allowed opacity-40')}
          >
            <span className="font-mono text-[10px] text-accent">{String.fromCharCode(65 + i)}</span>
            {s.label}
            {!unlocked(i) && <Lock size={11} />}
          </button>
        ))}
        <span className="ml-auto pr-2 text-xs text-muted">{sol.title}</span>
      </nav>
      {mode === 'consult' ? (
        STAGES.map((s, i) => (
          <div key={s.id} id={`stage-${s.id}`} className="scroll-mt-4">
            <Panel title={`${String.fromCharCode(65 + i)} · ${s.label}`} actions={s.id === 'code' ? <Button size="sm" variant="ghost" onClick={() => openGuide(lang)}><BookOpen size={13} /> Guía</Button> : undefined}>
              {render(s.id)}
            </Panel>
          </div>
        ))
      ) : (
        <Panel title={`${String.fromCharCode(65 + idx)} · ${STAGES[idx]!.label}`} actions={session.stage === 'code' ? <Button size="sm" variant="ghost" onClick={() => openGuide(lang)}><BookOpen size={13} /> Guía</Button> : undefined}>
          <div className="flex flex-col gap-5">
            {render(session.stage)}
            <Questions sol={sol} stage={session.stage} />
            {idx < STAGES.length - 1 && (
              <div className="flex justify-end">
                <Button variant="primary" onClick={next}>
                  Siguiente: {STAGES[idx + 1]!.label} <ChevronRight size={15} />
                </Button>
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  )
}

function Questions({ sol, stage }: { sol: NonNullable<ReturnType<typeof solve>>; stage: StageId }) {
  const qs = sol.questions.filter((q) => q.stage === stage)
  const [open, setOpen] = useState<number[]>([])
  if (!qs.length) return null
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-accent/40 p-3">
      <h4 className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">Antes de seguir, pensá</h4>
      {qs.map((q, i) => (
        <div key={i} className="text-sm">
          <p>{q.question}</p>
          {open.includes(i) ? (
            <p className="mt-1 text-muted">{q.answer}</p>
          ) : (
            <Button size="sm" variant="ghost" className="mt-1" onClick={() => setOpen((o) => [...o, i])}>
              <Eye size={13} /> Ver respuesta
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
