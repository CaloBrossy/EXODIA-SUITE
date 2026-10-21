import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Calculator as CalcIcon, Pencil, Plus, Trash2, X } from 'lucide-react'
import { db } from '@/db/db'
import type { Formula, FormulaVariable } from '@/db/models'
import { collectFacets } from '@/services/concepts'
import { deleteFormula, emptyFormula, evaluableVariables, evaluateFormula, filterFormulas, saveFormula, validateEvalExpression, type FormulaInput } from '@/services/formulas'
import { recordCalculation } from '@/services/knowledge'
import { toggleLink } from '@/services/notes'
import { CalcError } from '@/lib/math/calculator'
import { parseTags } from '@/lib/text'
import { useFeedback } from '@/components/feedback'
import { EntityPicker } from '@/components/EntityPicker'
import { Markdown, Tex } from '@/components/Markdown'
import { Button, ButtonLink, cx, Empty, ErrorText, Field, Input, Loading, Panel, Select, Tag, Textarea } from '@/components/ui'
import { ResultBox } from './shared'

function Evaluator({ f }: { f: Formula }) {
  const { fail, notify } = useFeedback()
  const vars = evaluableVariables(f)
  const [values, setValues] = useState<Record<string, string>>({})
  const [out, setOut] = useState<{ ok: boolean; text: string } | null>(null)
  const run = () => {
    try {
      setOut({ ok: true, text: evaluateFormula(f, values) })
    } catch (e) {
      if (e instanceof CalcError) setOut({ ok: false, text: e.message })
      else fail(e)
    }
  }
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); run() }}>
      <p className="text-xs text-muted">
        Evaluación numérica de <code className="font-mono">{f.evalTarget || 'resultado'} = {f.evalExpression}</code>. Ingresá los valores en las unidades indicadas: NEXUS no verifica la coherencia dimensional.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {vars.map((s) => {
          const meta = f.variables.find((v) => v.symbol === s)
          return (
            <Field key={s} label={`${s}${meta?.meaning ? ` — ${meta.meaning}` : ''}`}>
              <div className="flex items-center gap-2">
                <Input value={values[s] ?? ''} onChange={(e) => setValues({ ...values, [s]: e.target.value })} className="font-mono" placeholder="Valor o expresión" />
                {meta?.unit && <span className="shrink-0 text-xs text-muted">{meta.unit}</span>}
              </div>
            </Field>
          )
        })}
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm">Evaluar</Button>
        {out?.ok && (
          <Button size="sm" onClick={() => recordCalculation('formula', `${f.name}: ${vars.map((s) => `${s}=${values[s]}`).join(', ')}`, `${f.evalTarget || ''} = ${out.text} ${f.resultUnit}`.trim()).then(() => notify('Guardado en historial.', 'ok')).catch(fail)}>
            Guardar en historial
          </Button>
        )}
      </div>
      {out && (out.ok ? <ResultBox><span className="font-mono text-lg">{f.evalTarget || 'Resultado'} = {out.text} {f.resultUnit}</span></ResultBox> : <ErrorText>{out.text}</ErrorText>)}
    </form>
  )
}

function FormulaDetail({ f }: { f: Formula }) {
  const navigate = useNavigate()
  const { fail, confirm } = useFeedback()
  const concepts = useLiveQuery(() => db.concepts.bulkGet(f.conceptIds), [f.conceptIds.join()])
  const remove = async () => {
    if (!(await confirm({ title: `¿Eliminar «${f.name}»?`, danger: true, confirmLabel: 'Eliminar' }))) return
    try {
      await deleteFormula(f.id)
      navigate('/workbench/formulas')
    } catch (e) {
      fail(e)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted">{f.discipline}</p>
          <h2 className="text-lg font-semibold">{f.name}</h2>
        </div>
        <div className="flex gap-1">
          <ButtonLink size="sm" to={`/workbench/formulas/${f.id}?edit=1`}><Pencil size={13} /> Editar</ButtonLink>
          <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={remove}><Trash2 size={14} /></Button>
        </div>
      </div>
      <div className="rounded-md border border-line px-4 py-3 text-lg"><Tex block expr={f.latex || '\\text{(sin expresión)}'} /></div>
      {f.description && <p className="text-sm">{f.description}</p>}
      {f.variables.length > 0 && (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">Símbolo</th><th className="font-medium">Significado</th><th className="font-medium">Unidad</th></tr></thead>
          <tbody>
            {f.variables.map((v) => (
              <tr key={v.symbol} className="border-t border-line"><td className="py-1 pr-3 font-mono">{v.symbol}</td><td className="pr-3">{v.meaning}</td><td className="text-muted">{v.unit}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {f.resultUnit && <p className="text-sm text-muted">Unidad del resultado: {f.resultUnit}</p>}
      {f.example && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-muted uppercase">Ejemplo resuelto</h3>
          <Markdown source={f.example} />
        </div>
      )}
      {f.tags.length > 0 && <div className="flex flex-wrap gap-1">{f.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>}
      {concepts && concepts.some(Boolean) && (
        <p className="text-sm">Conceptos: {concepts.filter(Boolean).map((c, i) => <span key={c!.id}>{i > 0 && ', '}<Link className="text-accent hover:underline" to={`/knowledge/${c!.id}`}>{c!.title}</Link></span>)}</p>
      )}
      <Panel title="Evaluación numérica" bodyClass="p-3">
        {f.toolPath && (
          <p className="mb-2 text-sm">
            Esta fórmula tiene una calculadora dedicada con validación de entradas y supuestos: <Link className="text-accent hover:underline" to={f.toolPath}><CalcIcon size={13} className="inline" /> abrir</Link>.
          </p>
        )}
        {f.evalExpression.trim() ? <Evaluator f={f} /> : !f.toolPath && <p className="text-sm text-muted">Solo visualización: esta fórmula no tiene un evaluador numérico definido. Podés agregar una expresión evaluable desde Editar.</p>}
      </Panel>
    </div>
  )
}

function FormulaEditor({ id }: { id?: string }) {
  const navigate = useNavigate()
  const { fail, notify } = useFeedback()
  const concepts = useLiveQuery(() => db.concepts.toArray(), [])
  const [form, setForm] = useState<FormulaInput | null>(id ? null : emptyFormula())
  const [tagText, setTagText] = useState('')
  useEffect(() => {
    if (!id) return
    void db.formulas.get(id).then((f) => {
      if (!f) return
      const { id: _i, createdAt: _c, updatedAt: _u, seed: _s, ...rest } = f
      setForm(rest)
      setTagText(f.tags.join(', '))
    })
  }, [id])
  if (!form || !concepts) return <Loading />
  const set = <K extends keyof FormulaInput>(k: K, v: FormulaInput[K]) => setForm({ ...form, [k]: v })
  const setVar = (i: number, v: Partial<FormulaVariable>) => set('variables', form.variables.map((x, j) => (j === i ? { ...x, ...v } : x)))
  const evalError = validateEvalExpression(form)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const saved = await saveFormula({ ...form, tags: parseTags(tagText) }, id)
      notify('Fórmula guardada.', 'ok')
      navigate(`/workbench/formulas/${saved}`)
    } catch (err) {
      fail(err)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{id ? 'Editar fórmula' : 'Nueva fórmula'}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nombre *"><Input required value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Disciplina"><Input value={form.discipline} onChange={(e) => set('discipline', e.target.value)} /></Field>
      </div>
      <Field label="Expresión (LaTeX)">
        <Textarea rows={2} className="font-mono" value={form.latex} onChange={(e) => set('latex', e.target.value)} placeholder="F = m a" />
      </Field>
      {form.latex && <div className="rounded-md border border-line px-3 py-2"><Tex block expr={form.latex} /></div>}
      <Field label="Descripción y condiciones de validez"><Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Variables</span>
        {form.variables.map((v, i) => (
          <div key={i} className="grid grid-cols-[6rem_1fr_7rem_auto] gap-1.5">
            <Input className="font-mono" placeholder="Símbolo" value={v.symbol} onChange={(e) => setVar(i, { symbol: e.target.value })} />
            <Input placeholder="Significado" value={v.meaning} onChange={(e) => setVar(i, { meaning: e.target.value })} />
            <Input placeholder="Unidad" value={v.unit} onChange={(e) => setVar(i, { unit: e.target.value })} />
            <Button size="icon" variant="ghost" aria-label="Quitar variable" onClick={() => set('variables', form.variables.filter((_, j) => j !== i))}><X size={14} /></Button>
          </div>
        ))}
        <Button size="sm" variant="ghost" className="self-start" onClick={() => set('variables', [...form.variables, { symbol: '', meaning: '', unit: '' }])}><Plus size={13} /> Variable</Button>
      </div>
      <Field label="Unidad del resultado"><Input value={form.resultUnit} onChange={(e) => set('resultUnit', e.target.value)} /></Field>
      <Field label="Ejemplo resuelto (Markdown + LaTeX)"><Textarea rows={3} value={form.example} onChange={(e) => set('example', e.target.value)} /></Field>
      <Field label="Etiquetas (separadas por coma)"><Input value={tagText} onChange={(e) => setTagText(e.target.value)} /></Field>
      <fieldset className="flex flex-col gap-2 rounded-md border border-line p-3">
        <legend className="px-1 text-xs font-medium text-muted">Evaluación numérica (opcional)</legend>
        <p className="text-xs text-muted">Si la completás, NEXUS podrá evaluar la fórmula con la sintaxis de la calculadora (p. ej. <code>0.5 * m * v^2</code>). Solo se admiten variables declaradas arriba cuyo símbolo sea un identificador simple (letras, dígitos y _).</p>
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
          <Input className="font-mono" placeholder="Resultado" value={form.evalTarget} onChange={(e) => set('evalTarget', e.target.value)} aria-label="Variable resultado" />
          <Input className="font-mono" placeholder="Expresión evaluable" value={form.evalExpression} onChange={(e) => set('evalExpression', e.target.value)} aria-label="Expresión evaluable" />
        </div>
        {evalError && <ErrorText>{evalError}</ErrorText>}
      </fieldset>
      <Field label="Conceptos vinculados">
        <div className="rounded-md border border-line p-3">
          <EntityPicker items={concepts.map((c) => ({ id: c.id, label: c.title, sub: c.discipline }))} selected={form.conceptIds} onToggle={(cid) => set('conceptIds', toggleLink(form.conceptIds, cid))} emptyText="Ninguno." />
        </div>
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!!evalError}>Guardar</Button>
        <Button onClick={() => navigate(id ? `/workbench/formulas/${id}` : '/workbench/formulas')}>Cancelar</Button>
      </div>
    </form>
  )
}

export default function Formulas() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const edit = params.has('edit')
  const formulas = useLiveQuery(() => db.formulas.toArray(), [])
  const [q, setQ] = useState('')
  const [discipline, setDiscipline] = useState<string | null>(null)
  const facets = useMemo(() => collectFacets(formulas ?? []), [formulas])
  const list = useMemo(() => (formulas ? filterFormulas(formulas, q, discipline) : []), [formulas, q, discipline])
  const current = formulas?.find((f) => f.id === id)

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar fórmulas…" className="h-8" />
          <ButtonLink size="sm" variant="primary" to="/workbench/formulas/new"><Plus size={13} /> Nueva</ButtonLink>
        </div>
        <Select value={discipline ?? ''} onChange={(e) => setDiscipline(e.target.value || null)} className="h-8" aria-label="Disciplina">
          <option value="">Todas las disciplinas</option>
          {facets.disciplines.map((d) => <option key={d}>{d}</option>)}
        </Select>
        {!formulas && <Loading />}
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-panel">
          {list.map((f) => (
            <li key={f.id}>
              <Link to={`/workbench/formulas/${f.id}`} className={cx('block px-3 py-2 hover:bg-sunken', f.id === id && 'bg-sunken')}>
                <p className="flex items-center gap-1.5 text-sm font-medium">{f.name}{(f.evalExpression || f.toolPath) && <CalcIcon size={12} className="text-accent" aria-label="Evaluable" />}</p>
                <div className="overflow-hidden text-sm"><Tex expr={f.latex} /></div>
              </Link>
            </li>
          ))}
        </ul>
        {formulas && list.length === 0 && <Empty title="Sin fórmulas">Creá una con «Nueva».</Empty>}
      </div>
      <Panel>
        {id === 'new' ? (
          <FormulaEditor />
        ) : current ? (
          edit ? <FormulaEditor key={`${id}-edit`} id={id} /> : <FormulaDetail f={current} />
        ) : id && formulas ? (
          <p className="text-sm text-muted">La fórmula no existe.</p>
        ) : (
          <p className="text-sm text-muted">Elegí una fórmula para ver sus variables, su ejemplo y, si existe un evaluador, calcularla. El ícono <CalcIcon size={12} className="inline text-accent" /> indica fórmulas evaluables.</p>
        )}
      </Panel>
    </div>
  )
}
