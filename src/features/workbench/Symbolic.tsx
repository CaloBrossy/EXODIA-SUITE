import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Copy } from 'lucide-react'
import { Button, Field, Input, Panel, Select, Textarea } from '@/components/ui'
import { Tex } from '@/components/Markdown'
import { useFeedback } from '@/components/feedback'
import { db } from '@/db/db'
import { expressionToTex, freeSymbols } from '@/lib/math/calculator'
import { runNumeric, type NumericValue } from '@/lib/math/numeric'
import { solveSymbolic } from '@/lib/math/symbolicClient'
import { DEFAULT_VARIABLE, SYMBOLIC_OPS, SymbolicOpLabel, numericPlanFor, type SymbolicOp, type SymbolicRequest, type SymbolicResult } from '@/lib/math/symbolicTypes'
import { emptyFormula, saveFormula } from '@/services/formulas'
import { createNote, updateNote } from '@/services/notes'

const HIST_KEY = 'symbolic.history'
type Hist = { at: number; label: string; expr: string; latex: string }

function previewOf(op: SymbolicOp, expr: string): string {
  const one = (s: string) => {
    try { return expressionToTex(s) } catch { return '' }
  }
  if (op === 'solve' || op === 'ode') {
    return expr.split(/\n|;/).map((eq) => eq.trim()).filter(Boolean).map((eq) => {
      const i = eq.indexOf('=')
      if (i < 0) return one(eq)
      const a = one(eq.slice(0, i))
      const b = one(eq.slice(i + 1))
      return a && b ? `${a} = ${b}` : ''
    }).filter(Boolean).join(' \\\\ ')
  }
  return one(expr)
}

export default function Symbolic() {
  const { fail, notify } = useFeedback()
  const [op, setOp] = useState<SymbolicOp>('derive')
  const [expr, setExpr] = useState('x^2 sin(x)')
  const [variable, setVariable] = useState('x')
  const [order, setOrder] = useState('1')
  const [lower, setLower] = useState('')
  const [upper, setUpper] = useState('')
  const [point, setPoint] = useState('0')
  const [conditions, setConditions] = useState('y(0)=1')
  const [unknowns, setUnknowns] = useState('')
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<SymbolicResult | null>(null)
  const [numeric, setNumeric] = useState<NumericValue | null>(null)
  const [at, setAt] = useState('0')
  const [noteId, setNoteId] = useState('')
  const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().limit(40).toArray(), [])
  const history = useLiveQuery(async () => ((await db.kv.get(HIST_KEY))?.value as Hist[] | undefined) ?? [], [])
  const preview = useMemo(() => previewOf(op, expr), [op, expr])

  const request = (): SymbolicRequest => ({
    op,
    expr,
    variable: variable.trim() || DEFAULT_VARIABLE[op] || 'x',
    order: Number(order) || undefined,
    lower: lower.trim() || undefined,
    upper: upper.trim() || undefined,
    point: point.trim() || undefined,
    conditions: conditions.trim() || undefined,
    unknowns: unknowns.trim() || undefined,
  })

  const run = async () => {
    setBusy(true)
    setNumeric(null)
    try {
      const req = request()
      const res = await solveSymbolic(req)
      setOut(res)
      if (res.ok) {
        const row: Hist = { at: Date.now(), label: SymbolicOpLabel[op], expr: expr.trim(), latex: res.latex }
        const prev = ((await db.kv.get(HIST_KEY))?.value as Hist[] | undefined) ?? []
        await db.kv.put({ key: HIST_KEY, value: [row, ...prev].slice(0, 40) })
      }
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const plan = out?.numeric ?? numericPlanFor(request())
  const numericRun = () => {
    if (!plan) return
    try {
      setNumeric(runNumeric(plan, { at }))
    } catch (e) {
      fail(e)
    }
  }

  const latex = out?.ok ? out.latex : ''
  const asFormula = () => {
    if (!out?.ok) return
    let symbols: string[] = []
    const plain = out.result.includes('=') ? '' : out.result
    try { symbols = plain ? freeSymbols(plain) : [] } catch { symbols = [] }
    saveFormula({
      ...emptyFormula(),
      name: `${SymbolicOpLabel[op]}: ${expr.trim()}`.slice(0, 200),
      latex: out.latex,
      description: out.notes.join(' '),
      variables: symbols.map((symbol) => ({ symbol, meaning: '', unit: '' })),
      discipline: 'Matemática',
      tags: ['simbólico'],
      evalExpression: symbols.length ? plain : '',
      evalTarget: 'y',
    }).then((id) => notify(`Guardada en Fórmulas (/workbench/formulas/${id}).`, 'ok')).catch(fail)
  }

  const toNote = async () => {
    if (!latex) return
    const md = `**${SymbolicOpLabel[op]}** \`${expr.trim()}\`\n\n$$${latex}$$\n`
    try {
      if (!noteId) {
        const n = await createNote({ title: `${SymbolicOpLabel[op]}: ${expr.trim()}`.slice(0, 200), content: md })
        notify(`Nota «${n.title}» creada.`, 'ok')
      } else {
        const n = await db.notes.get(noteId)
        if (!n) throw new Error('La nota ya no existe')
        await updateNote(noteId, { content: `${n.content.trimEnd()}\n\n${md}` })
        notify(`Insertado en «${n.title || 'Sin título'}».`, 'ok')
      }
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Panel title="Solver simbólico">
        <div className="flex flex-col gap-3">
          <Field label="Operación">
            <Select value={op} onChange={(e) => setOp(e.target.value as SymbolicOp)}>{SYMBOLIC_OPS.map((id) => <option key={id} value={id}>{SymbolicOpLabel[id]}</option>)}</Select>
          </Field>
          <Field label={op === 'solve' ? 'Ecuaciones (una por línea)' : op === 'ode' ? "Ecuación (y, y', y'')" : 'Expresión'}>
            <Textarea rows={3} className="font-mono" value={expr} onChange={(e) => setExpr(e.target.value)} aria-label="Expresión" />
          </Field>
          {preview && <div className="overflow-x-auto rounded-md bg-sunken px-3 py-2"><Tex expr={preview} block /></div>}
          <div className="grid gap-3 sm:grid-cols-3">
            {op !== 'solve' && <Field label="Variable"><Input value={variable} onChange={(e) => setVariable(e.target.value)} /></Field>}
            {(op === 'derive' || op === 'taylor') && <Field label="Orden"><Input inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} /></Field>}
            {(op === 'integrate' || op === 'sum') && <Field label="Desde"><Input value={lower} onChange={(e) => setLower(e.target.value)} placeholder="0" /></Field>}
            {(op === 'integrate' || op === 'sum') && <Field label="Hasta"><Input value={upper} onChange={(e) => setUpper(e.target.value)} placeholder="1" /></Field>}
            {(op === 'limit' || op === 'taylor') && <Field label={op === 'taylor' ? 'Centro' : 'Punto'}><Input value={point} onChange={(e) => setPoint(e.target.value)} /></Field>}
            {op === 'solve' && <Field label="Incógnitas"><Input value={unknowns} onChange={(e) => setUnknowns(e.target.value)} placeholder="x, y" /></Field>}
            {op === 'ode' && <Field label="Condiciones"><Input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="y(0)=1, y'(0)=0" /></Field>}
          </div>
          <Button variant="primary" disabled={busy || !expr.trim()} onClick={() => void run()}>{busy ? 'Resolviendo…' : 'Resolver'}</Button>
          {out && !out.ok && <p className="text-sm text-danger">{out.error}</p>}
          {out?.ok && (
            <div className="flex flex-col gap-2">
              <div className="overflow-x-auto rounded-md bg-sunken px-4 py-3"><Tex expr={out.latex} block /></div>
              {out.recognized && <p className="text-sm text-muted">Valor reconocido: <Tex expr={out.recognized} /></p>}
              {out.notes.map((n) => <p key={n} className="text-xs text-muted">{n}</p>)}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigator.clipboard.writeText(out.latex).then(() => notify('LaTeX copiado.', 'ok')).catch(fail)}><Copy size={13} /> Copiar LaTeX</Button>
                <Button size="sm" onClick={asFormula}>Guardar como fórmula</Button>
                <Button size="sm" onClick={() => void toNote()}>{noteId ? 'Insertar en la nota' : 'Guardar como nota'}</Button>
              </div>
              <Select value={noteId} onChange={(e) => setNoteId(e.target.value)} aria-label="Nota destino">
                <option value="">Nota nueva</option>
                {(notes ?? []).map((n) => <option key={n.id} value={n.id}>{n.title || 'Sin título'}</option>)}
              </Select>
            </div>
          )}
          {plan && (
            <div className="flex flex-wrap items-end gap-2">
              {(plan.kind === 'derivative' || plan.kind === 'ode') && <Field label="Punto"><Input className="w-28" value={at} onChange={(e) => setAt(e.target.value)} /></Field>}
              <Button size="sm" onClick={numericRun}>Alternativa numérica</Button>
              {numeric && <p className="text-sm">{numeric.text} <span className="text-muted">· {numeric.note}</span></p>}
            </div>
          )}
        </div>
      </Panel>
      <Panel title="Historial">
        <ul className="flex flex-col gap-2">
          {(history ?? []).map((h) => (
            <li key={h.at}>
              <button type="button" className="w-full rounded-md px-2 py-1 text-left hover:bg-sunken" onClick={() => { setExpr(h.expr); setOut({ ok: true, latex: h.latex, resultLatex: h.latex, result: '', approx: null, recognized: null, notes: [] }) }}>
                <span className="block text-xs text-muted">{h.label}</span>
                <span className="block truncate font-mono text-xs">{h.expr}</span>
              </button>
            </li>
          ))}
          {!history?.length && <li className="text-sm text-muted">Todavía no hay resultados.</li>}
        </ul>
      </Panel>
    </div>
  )
}
