import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Copy, Trash2 } from 'lucide-react'
import { db } from '@/db/db'
import { CalcError, CONSTANTS, equationSides, evaluateExpression, formatValue, freeSymbols, sameValue, type AngleMode, type CalcValue, type NumberFormat } from '@/lib/math/calculator'
import { solveSymbolic } from '@/lib/math/symbolicClient'
import { clearCalculations, recordCalculation } from '@/services/knowledge'
import { copyText } from '@/hooks/misc'
import { useFeedback } from '@/components/feedback'
import { Button, cx, Input, Kbd, Panel, Select, Tabs } from '@/components/ui'
import { relativeTime } from '@/lib/text'

const KEYS: { label: string; insert: string; title?: string }[][] = [
  [{ label: 'sin', insert: 'sin(' }, { label: 'cos', insert: 'cos(' }, { label: 'tan', insert: 'tan(' }, { label: '(', insert: '(' }, { label: ')', insert: ')' }],
  [{ label: 'asin', insert: 'asin(' }, { label: 'acos', insert: 'acos(' }, { label: 'atan', insert: 'atan(' }, { label: 'xʸ', insert: '^' }, { label: '√', insert: 'sqrt(' }],
  [{ label: 'ln', insert: 'ln(' }, { label: 'log₁₀', insert: 'log10(' }, { label: 'log₂', insert: 'log2(' }, { label: 'eˣ', insert: 'exp(' }, { label: 'ⁿ√', insert: 'nthRoot(', title: 'nthRoot(x, n)' }],
  [{ label: 'π', insert: 'pi' }, { label: 'e', insert: 'e' }, { label: '×10ⁿ', insert: 'e', title: 'Notación científica: 6.02e23' }, { label: 'n!', insert: '!' }, { label: '|x|', insert: 'abs(' }],
  [{ label: 'ans', insert: 'ans' }, { label: 'i', insert: 'i', title: 'Unidad imaginaria' }, { label: 'mod', insert: ' mod ' }, { label: ',', insert: ', ' }, { label: '÷', insert: '/' }],
]

export default function Calculator() {
  const { fail, notify } = useFeedback()
  const [expr, setExpr] = useState('')
  const [angle, setAngle] = useState<AngleMode>(() => (localStorage.getItem('exodia.angle') as AngleMode | null) ?? 'rad')
  const [fmt, setFmt] = useState<NumberFormat>('auto')
  const [precision, setPrecision] = useState(12)
  const [committed, setCommitted] = useState<{ input: string; value: CalcValue } | { input: string; text: string } | null>(null)
  const [error, setError] = useState('')
  const [histIdx, setHistIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const history = useLiveQuery(() => db.calculations.where('kind').equals('calc').reverse().sortBy('createdAt'), [])

  const ans = committed && 'value' in committed && typeof committed.value === 'number' ? committed.value : undefined
  const variables = useMemo(() => (ans !== undefined ? { ans } : undefined), [ans])
  const preview = useMemo(() => {
    if (!expr.trim()) return null
    try {
      return formatValue(evaluateExpression(expr, { angle, variables }), fmt, precision)
    } catch {
      return null
    }
  }, [expr, angle, variables, fmt, precision])

  const insert = (text: string) => {
    const el = inputRef.current
    const s = el?.selectionStart ?? expr.length
    const e = el?.selectionEnd ?? expr.length
    const next = expr.slice(0, s) + text + expr.slice(e)
    setExpr(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(s + text.length, s + text.length)
    })
  }

  const run = async () => {
    try {
      const sides = equationSides(expr)
      if (sides === 'many') throw new CalcError('Dejá un solo «=» entre los dos lados.')
      let text: string
      if (sides) {
        const symbols = [...new Set([...freeSymbols(sides.lhs), ...freeSymbols(sides.rhs)])].filter((s) => s !== 'ans')
        if (symbols.length === 0) {
          const left = evaluateExpression(sides.lhs, { angle, variables })
          const right = evaluateExpression(sides.rhs, { angle, variables })
          text = sameValue(left, right)
            ? `se cumple · ${formatValue(left, fmt, precision)} = ${formatValue(right, fmt, precision)}`
            : `no se cumple · ${formatValue(left, fmt, precision)} ≠ ${formatValue(right, fmt, precision)}`
          setCommitted({ input: expr, text })
        } else {
          const solved = await solveSymbolic({ op: 'solve', expr })
          if (!solved.ok) throw new CalcError(solved.error)
          text = solved.result
          setCommitted({ input: expr, text })
        }
      } else {
        const value = evaluateExpression(expr, { angle, variables })
        text = formatValue(value, fmt, precision)
        setCommitted({ input: expr, value })
      }
      setError('')
      setHistIdx(-1)
      await recordCalculation('calc', angle === 'deg' && /sin|cos|tan|sec|csc|cot/.test(expr) ? `${expr} [deg]` : expr, text)
    } catch (e) {
      if (e instanceof CalcError) setError(e.message)
      else fail(e)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void run()
    } else if (e.key === 'Escape') {
      setExpr('')
      setError('')
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && history?.length) {
      e.preventDefault()
      const idx = Math.max(-1, Math.min(history.length - 1, histIdx + (e.key === 'ArrowUp' ? 1 : -1)))
      setHistIdx(idx)
      setExpr(idx === -1 ? '' : history[idx]!.input.replace(/ \[deg\]$/, ''))
    }
  }

  const result = !committed ? null : 'text' in committed ? committed.text : formatValue(committed.value, fmt, precision)
  const copy = async (t: string) => notify((await copyText(t)) ? 'Copiado al portapapeles.' : 'No se pudo copiar.', 'info')

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        <Panel>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={angle} onChange={(v) => { setAngle(v); localStorage.setItem('exodia.angle', v) }} items={[{ id: 'rad', label: 'RAD' }, { id: 'deg', label: 'DEG' }]} />
              <Select value={fmt} onChange={(e) => setFmt(e.target.value as NumberFormat)} className="h-8 w-40" aria-label="Formato">
                <option value="auto">Formato automático</option>
                <option value="scientific">Científica</option>
                <option value="engineering">Ingeniería</option>
              </Select>
              <Select value={precision} onChange={(e) => setPrecision(Number(e.target.value))} className="h-8 w-36" aria-label="Cifras significativas">
                {[4, 6, 8, 10, 12, 15].map((p) => <option key={p} value={p}>{p} cifras sig.</option>)}
              </Select>
            </div>
            <Input
              ref={inputRef}
              autoFocus
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ej.: sqrt(2) * sin(pi/4) + 6.02e23 / 1e23"
              className="h-12 font-mono text-lg"
              aria-label="Expresión"
              spellCheck={false}
              autoComplete="off"
            />
            <div className="min-h-[4.5rem] rounded-md bg-sunken px-4 py-3">
              {error ? (
                <p className="text-sm text-danger" role="alert">{error}</p>
              ) : result !== null ? (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-muted">{committed!.input} =</p>
                    <p className="font-mono text-2xl tabular break-all">{result}</p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label="Copiar resultado" title="Copiar" onClick={() => void copy(result)}><Copy size={15} /></Button>
                </div>
              ) : (
                <p className="text-sm text-muted">Presioná <Kbd>Enter</Kbd> para calcular. <Kbd>↑</Kbd> recupera el historial.</p>
              )}
              {preview !== null && expr !== committed?.input && <p className="mt-1 font-mono text-xs text-muted">≈ {preview}</p>}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {KEYS.flat().map((k) => (
                <Button key={k.label} size="sm" title={k.title ?? k.insert} onClick={() => insert(k.insert)} className="justify-center font-mono">
                  {k.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => void run()} disabled={!expr.trim()}>Calcular</Button>
              <Button onClick={() => { setExpr(''); setError('') }}>Limpiar</Button>
            </div>
          </div>
        </Panel>
        <details className="glass rounded-xl px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Funciones y constantes admitidas</summary>
          <div className="mt-2 grid gap-2 text-muted md:grid-cols-2">
            <p>Operadores: <code>+ − * / ^ ! mod</code> y paréntesis. Multiplicación implícita: <code>2pi</code>. Una ecuación se resuelve: <code>x^2 + 1 = 0</code>.</p>
            <p>Funciones: sqrt, cbrt, nthRoot(x,n), exp, ln, log(x[,b]), log10, log2, sin, cos, tan, sec, csc, cot, asin, acos, atan, atan2, sinh, cosh, tanh, abs, round, floor, ceil, sign, min, max, hypot, combinations, permutations, re, im, conj, arg.</p>
            <p>Constantes: {Object.entries(CONSTANTS).map(([k, v]) => `${k} (${v})`).join(', ')}. <code>ans</code> = último resultado real.</p>
            <p>Las expresiones se analizan y validan con mathjs: no se ejecuta código arbitrario.</p>
          </div>
        </details>
      </div>

      <Panel
        title="Historial"
        actions={
          history && history.length > 0 && (
            <Button size="sm" variant="ghost" title="Borra el historial (se conservan los cálculos vinculados a notas)" onClick={() => clearCalculations('calc').catch(fail)}>
              <Trash2 size={13} /> Borrar
            </Button>
          )
        }
        bodyClass="p-0"
      >
        {history?.length === 0 && <p className="p-4 text-sm text-muted">Los cálculos que confirmes aparecerán aquí y podrás vincularlos a notas.</p>}
        <ul className="max-h-[60vh] overflow-y-auto">
          {history?.map((h) => (
            <li key={h.id} className="group flex items-center gap-2 border-b border-line px-4 py-2 last:border-0">
              <button className="min-w-0 flex-1 text-left" onClick={() => setExpr(h.input.replace(/ \[deg\]$/, ''))} title="Usar esta expresión">
                <p className="truncate font-mono text-xs text-muted">{h.input}</p>
                <p className="truncate font-mono text-sm">= {h.result}</p>
              </button>
              <span className="text-[11px] text-muted">{relativeTime(h.createdAt)}</span>
              <button className={cx('text-muted opacity-50 group-hover:opacity-100 hover:text-fg')} aria-label="Copiar" onClick={() => void copy(h.result)}><Copy size={13} /></button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
