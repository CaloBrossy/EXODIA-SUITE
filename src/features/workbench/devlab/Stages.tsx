import { useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Play, Plus, X, XCircle } from 'lucide-react'
import { Tex } from '@/components/Markdown'
import { Button, cx, Input, Select, Textarea } from '@/components/ui'
import { entryFn } from '@/lib/devlab/ir'
import { formatValue, parseArg, runProgram, sameValue, type RunResult } from '@/lib/devlab/interpreter'
import { toPseudocode } from '@/lib/devlab/emit/pseudocode'
import { CODE_LANGS, generateCode, testLabel, type CodeLang } from '@/lib/devlab/emit/code'
import { explainConstructs, LANGS, pseudoDifferences, type LangId } from '@/lib/devlab/languages'
import type { Analysis, Solution } from '@/lib/devlab/types'
import { CodeBlock } from './CodeBlock'

export function List({ title, items, tone }: { title: string; items: ReactNode[]; tone?: 'warn' | 'muted' }) {
  if (!items.length) return null
  return (
    <div>
      <h4 className="mb-1 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">{title}</h4>
      <ul className={cx('flex flex-col gap-1 text-sm', tone === 'warn' && 'text-amber-500', tone === 'muted' && 'text-muted')}>
        {items.map((x, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent/70" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-sm">{children}</p>
}

export function statementFromAnalysis(a: Analysis): string {
  let head = a.summary.trim()
  const assigns = a.known.flatMap((k) => {
    const m = k.trim().match(/^(.+?)\s*=\s*(.+)$/)
    return m ? [{ name: m[1]!.trim(), value: m[2]!.trim() }] : []
  })
  for (const { name, value } of assigns) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    head = head.replace(new RegExp(`(${esc}\\s*=\\s*)([^,;.\\n]+)`, 'gi'), `$1${value}`)
  }
  const n = assigns.find((x) => /^n$/i.test(x.name))
  if (n) head = head.replace(/\b(t[eé]rmino)\s+\d+/gi, `$1 ${n.value}`)
  head = head.replace(/a₁/g, 'a_1').replace(/aₙ/g, 'a_n')
  const facts = a.known.map((x) => x.trim().replace(/a₁/g, 'a_1').replace(/aₙ/g, 'a_n')).filter(Boolean)
  return [head, ...facts].filter(Boolean).join('\n')
}

function EditableList({ title, items, onChange, tone }: { title: string; items: string[]; onChange: (xs: string[]) => void; tone?: 'warn' }) {
  return (
    <div>
      <h4 className="mb-1 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">{title}</h4>
      <ul className={cx('flex flex-col gap-1', tone === 'warn' && 'text-amber-500')}>
        {items.map((x, i) => (
          <li key={i} className="flex items-center gap-1">
            <Input value={x} aria-label={`${title} ${i + 1}`} onChange={(e) => onChange(items.map((y, j) => (j === i ? e.target.value : y)))} />
            <Button size="icon" variant="ghost" aria-label={`Quitar ${title} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <X size={13} />
            </Button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" className="mt-1" onClick={() => onChange([...items, ''])}>
        <Plus size={13} /> Añadir
      </Button>
    </div>
  )
}

export function ProblemStage({ sol, onApply }: { sol: Solution; onApply: (text: string) => void }) {
  const [a, setA] = useState<Analysis>(() => structuredClone(sol.analysis))
  const dirty = JSON.stringify(a) !== JSON.stringify(sol.analysis)
  const set = <K extends keyof Analysis>(k: K, v: Analysis[K]) => setA((s) => ({ ...s, [k]: v }))
  return (
    <div className="flex flex-col gap-4">
      <Textarea rows={3} value={a.summary} aria-label="Problema" onChange={(e) => set('summary', e.target.value)} />
      <div className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2">
        <span className="mb-1 block text-xs text-muted">Objetivo</span>
        <Input value={a.goal} aria-label="Objetivo" onChange={(e) => set('goal', e.target.value)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <EditableList title="Datos conocidos" items={a.known} onChange={(xs) => set('known', xs)} />
        <EditableList title="Incógnitas" items={a.unknown} onChange={(xs) => set('unknown', xs)} />
        <EditableList title="Restricciones" items={a.constraints} onChange={(xs) => set('constraints', xs)} />
        <EditableList title="Condiciones" items={a.conditions} onChange={(xs) => set('conditions', xs)} />
        <EditableList title="Casos límite" items={a.edgeCases} onChange={(xs) => set('edgeCases', xs)} />
        <EditableList title="Supuestos explícitos" items={a.assumptions} onChange={(xs) => set('assumptions', xs)} tone="warn" />
      </div>
      <List title="Ambigüedades" items={a.ambiguities} tone="warn" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Editá un dato erróneo y aplicá: se reinterpreta el enunciado y se regeneran matemática, algoritmo y código.</p>
        <Button variant="primary" disabled={!dirty || !a.summary.trim()} onClick={() => onApply(statementFromAnalysis(a))}>
          Aplicar y regenerar
        </Button>
      </div>
    </div>
  )
}

export function MathStage({ sol }: { sol: Solution }) {
  const m = sol.math
  if (!m) return <Note>{sol.mathNote ?? 'Este problema no requiere un desarrollo matemático previo.'}</Note>
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {m.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 font-mono text-xs text-accent">{String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">{s.text}</p>
              {s.tex && <Tex expr={s.tex} block />}
            </div>
          </li>
        ))}
      </ol>
      {m.result && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-2">
          <p className="text-xs text-muted">{m.result.text}</p>
          {m.result.tex && <Tex expr={m.result.tex} block />}
        </div>
      )}
      <List title="Validez" items={m.validity} />
      <Note><span className="text-muted">Resolver ≠ programar: </span>{m.symbolicVsProgram}</Note>
    </div>
  )
}

export function AlgorithmStage({ sol, onStrategy }: { sol: Solution; onStrategy: (id: string) => void }) {
  if (!sol.design) return <Note>No hay diseño algorítmico: el resultado es una consulta.</Note>
  const d = sol.design
  return (
    <div className="flex flex-col gap-4">
      {sol.strategies.length > 1 && (
        <div className="flex flex-col gap-2">
          <h4 className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Estrategias</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {sol.strategies.map((s) => (
              <button key={s.id} type="button" onClick={() => onStrategy(s.id)} className={cx('rounded-xl border px-3 py-2 text-left text-sm transition-colors', s.id === sol.strategy ? 'border-accent bg-accent/10' : 'border-line hover:border-accent/50')}>
                <span className="font-medium">{s.label}</span>
                <span className="block text-xs text-muted">{s.summary}</span>
              </button>
            ))}
          </div>
          {d.comparison && <Note>{d.comparison}</Note>}
          <p className="text-xs text-muted">Cambiar la estrategia regenera el pseudocódigo, el código de todos los lenguajes y las pruebas a partir del mismo algoritmo.</p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <List title="Entradas" items={d.inputs} />
        <List title="Salidas" items={d.outputs} />
        <List title="Variables" items={d.variables} />
      </div>
      <div>
        <h4 className="mb-1 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Pasos</h4>
        <ol className="flex flex-col gap-1 text-sm">
          {d.steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-6 shrink-0 font-mono text-xs leading-5 text-accent">P{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <List title="Condiciones" items={d.conditions} />
        <List title="Bucles" items={d.loops} />
        <List title="Casos especiales" items={d.special} />
        <div>
          <h4 className="mb-1 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Complejidad</h4>
          <p className="font-mono text-sm">tiempo {d.complexity.time} · espacio {d.complexity.space}</p>
          <p className="text-xs text-muted">{d.complexity.why}</p>
        </div>
      </div>
    </div>
  )
}

export function PseudoStage({ sol }: { sol: Solution }) {
  const lines = useMemo(() => (sol.program ? toPseudocode(sol.program) : []), [sol])
  if (!sol.program) return <Note>Este problema no genera pseudocódigo de la IR: el artefacto es la consulta SQL.</Note>
  const steps = sol.design?.steps ?? []
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="overflow-x-auto rounded-xl border border-line bg-sunken/70 p-3 font-mono text-[12.5px] leading-relaxed">
        {lines.map((l, i) => (
          <div key={i} onMouseEnter={() => setHover(l.step ?? null)} onMouseLeave={() => setHover(null)} className={cx('flex gap-3 rounded px-1', l.step !== undefined && hover === l.step && 'bg-accent/10')}>
            <span className="w-7 shrink-0 text-right text-[10px] leading-5 text-accent/80">{l.step !== undefined && !l.comment ? `P${l.step}` : ''}</span>
            <span className={cx('whitespace-pre', l.comment && 'text-muted italic')}>{'    '.repeat(l.indent)}{l.text}</span>
          </div>
        ))}
      </div>
      <ol className="flex flex-col gap-1 text-sm">
        <li className="mb-1 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Pasos del algoritmo</li>
        {steps.map((s, i) => (
          <li key={i} className={cx('flex gap-2 rounded px-1 transition-colors', hover === i + 1 && 'bg-accent/10')}>
            <span className="w-6 shrink-0 font-mono text-xs leading-5 text-accent">P{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  )
}

export const LANG_OPTIONS: LangId[] = [...CODE_LANGS, 'sql']

export function CodeStage({ sol, lang, onLang }: { sol: Solution; lang: LangId; onLang: (l: LangId) => void }) {
  const info = LANGS[lang]
  const gen = useMemo(() => (lang === 'sql' || !sol.program ? null : generateCode(lang, sol.program, sol.tests)), [lang, sol])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={lang} onChange={(e) => onLang(e.target.value as LangId)} className="max-w-44" aria-label="Lenguaje">
          {LANG_OPTIONS.map((l) => (
            <option key={l} value={l}>{LANGS[l].label}</option>
          ))}
        </Select>
        <span className="text-xs text-muted">{info.typing}</span>
      </div>
      {sol.kind === 'query' && <Note>SQL acá es el tipo de problema (consulta de entrada), no solo el lenguaje de salida de los otros tipos.</Note>}
      {lang === 'sql' ? (
        sol.sql ? (
          <>
            <CodeBlock code={sol.sql.code} lang="sql" fileName="consulta.sql" />
            <p className="text-sm"><span className="text-muted">Resultado esperado con los datos del enunciado: </span><span className="font-mono">{String(sol.sql.expected).split('\n').join(' · ')}</span></p>
            <List title="Cómo piensa SQL" items={sol.sql.explanation} />
          </>
        ) : (
          <Note>{sol.sqlNote ?? 'SQL no aplica a este problema.'} Elegí otro lenguaje para ver la implementación.</Note>
        )
      ) : (
        gen && (
          <>
            <CodeBlock code={gen.code} lang={lang} fileName={gen.fileName} />
            <div className="grid gap-4 md:grid-cols-2">
              <List title={`Construcciones en ${info.label}`} items={explainConstructs(lang, sol.program!).map((c) => <><span className="font-medium">{c.label}: </span>{c.text}</>)} />
              <List title="Diferencias con el pseudocódigo" items={pseudoDifferences(lang as CodeLang, sol.program!)} />
              <List title="Errores comunes" items={info.pitfalls} tone="warn" />
              <List title="Para ejecutarlo" items={[<code className="font-mono text-xs">{info.run}</code>]} />
            </div>
          </>
        )
      )}
      <p className="text-xs text-muted">El algoritmo es el mismo en todos los lenguajes: solo cambia la forma de escribirlo. Los traductores se verifican compilando y ejecutando los ejemplos con las herramientas reales de cada lenguaje.</p>
    </div>
  )
}

const CAT_CLS = { normal: 'text-ok', límite: 'text-amber-500', inválido: 'text-danger' } as const

export function TestsStage({ sol }: { sol: Solution }) {
  if (!sol.program) return <Note>Este problema se verifica con el script SQL, no con el intérprete de la IR.</Note>
  return <ProgramTests sol={sol} />
}

function ProgramTests({ sol }: { sol: Solution }) {
  const fn = entryFn(sol.program!)
  const types = fn.params.map((p) => p.type)
  const [runs, setRuns] = useState<RunResult[] | null>(null)
  const [custom, setCustom] = useState<string[]>(() => fn.params.map(() => ''))
  const [customOut, setCustomOut] = useState<{ label: string; r: RunResult } | { error: string } | null>(null)
  const runAll = () => setRuns(sol.tests.map((t) => runProgram(sol.program!, t.args)))
  const runCustom = () => {
    try {
      const args = fn.params.map((p, i) => parseArg(custom[i] ?? '', p.type))
      setCustomOut({ label: testLabel(fn.name, args, types), r: runProgram(sol.program!, args) })
    } catch (e) {
      setCustomOut({ error: (e as Error).message })
    }
  }
  const passed = runs?.filter((r, i) => {
    const e = sol.tests[i]!.expect
    return 'error' in e ? !r.ok && r.error === e.error : r.ok && sameValue(r.value, e.value)
  }).length
  const show = (r: RunResult) => (r.ok ? formatValue(r.value, fn.returns) : `error: ${r.error}`)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={runAll}><Play size={14} /> Ejecutar pruebas</Button>
        {runs && <span className={cx('text-sm', passed === runs.length ? 'text-ok' : 'text-danger')}>{passed} de {runs.length} coinciden</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-1.5 pr-3 font-medium">Tipo</th>
              <th className="py-1.5 pr-3 font-medium">Entrada</th>
              <th className="py-1.5 pr-3 font-medium">Esperado (calculado aparte)</th>
              <th className="py-1.5 pr-3 font-medium">Obtenido (ejecutado)</th>
              <th className="py-1.5 font-medium">Por qué</th>
            </tr>
          </thead>
          <tbody>
            {sol.tests.map((t, i) => {
              const r = runs?.[i]
              const ok = r && ('error' in t.expect ? !r.ok && r.error === t.expect.error : r.ok && sameValue(r.value, t.expect.value))
              return (
                <tr key={i} className="border-b border-line/60 align-top">
                  <td className={cx('py-1.5 pr-3 text-xs', CAT_CLS[t.category])}>{t.category}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs break-all">{testLabel(fn.name, t.args, types)}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{'error' in t.expect ? `error: ${t.expect.error}` : formatValue(t.expect.value, fn.returns)}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">
                    {r ? (
                      <span className="inline-flex items-start gap-1">
                        {ok ? <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-ok" /> : <XCircle size={13} className="mt-0.5 shrink-0 text-danger" />}
                        {show(r)}
                      </span>
                    ) : (
                      <span className="text-muted">sin ejecutar</span>
                    )}
                  </td>
                  <td className="py-1.5 text-xs text-muted">{t.why}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
        <h4 className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Probar con otra entrada</h4>
        <div className="flex flex-wrap items-end gap-2">
          {fn.params.map((p, i) => (
            <label key={p.name} className="flex flex-col gap-1 text-xs text-muted">
              {p.name} <span className="text-[10px]">({p.type.endsWith('[]') ? 'lista: 1, 2, 3' : p.type === 'int' ? 'entero' : p.type === 'float' ? 'real' : p.type})</span>
              <Input value={custom[i] ?? ''} onChange={(e) => setCustom((c) => c.map((x, j) => (j === i ? e.target.value : x)))} className="max-w-40 font-mono" />
            </label>
          ))}
          <Button onClick={runCustom}><Play size={14} /> Ejecutar</Button>
        </div>
        {customOut && ('error' in customOut ? <p className="text-sm text-danger">{customOut.error}</p> : <p className="font-mono text-sm">{customOut.label} → {show(customOut.r)} <span className="font-sans text-xs text-muted">(sin valor esperado: comprobalo a mano)</span></p>)}
      </div>
      <Note>
        <span className="text-muted">Qué se ejecuta: </span>
        las pruebas corren en un intérprete del algoritmo (no se usa eval ni se ejecuta texto del usuario), con límite de pasos. El código de cada lenguaje no se compila en el navegador; los traductores se verifican con compiladores reales (<code className="font-mono text-xs">npm run verify:devlab</code>). La columna «Esperado» se calcula con una fórmula o razonamiento independiente del algoritmo.
      </Note>
    </div>
  )
}
