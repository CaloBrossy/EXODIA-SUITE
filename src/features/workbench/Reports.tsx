import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Download, FilePlus2, Printer, Trash2 } from 'lucide-react'
import { db } from '@/db/db'
import { ReportSectionLabel, type Measurement, type PropagationInput } from '@/db/models'
import { Markdown, Tex } from '@/components/Markdown'
import { useFeedback } from '@/components/feedback'
import { Button, ButtonLink, Field, Input, Loading, Panel, Select, Textarea } from '@/components/ui'
import { compileExpression } from '@/lib/math/calculator'
import { fitData } from '@/lib/math/fit'
import { propagate, type Propagation } from '@/lib/math/uncertainty'
import { downloadFile } from '@/services/backup'
import { listSubjects } from '@/services/focus'
import { deleteReport, emptyReport, listReports, saveReport, type ReportInput } from '@/services/reports'
import { Plot } from './data/Plot'

const esc = (s: string) => s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'))

function toMarkdown(r: ReportInput, result: Propagation | null, concepts: { id: string; title: string }[]) {
  const lines = [`# ${r.title}`, '']
  for (const s of r.sections) {
    lines.push(`## ${ReportSectionLabel[s.key]}`, '', s.markdown || '_Sin completar._', '')
  }
  if (r.measurements.length) {
    lines.push('## Mediciones', '', '| Magnitud | Valor | Incertidumbre | Unidad |', '| --- | --- | --- | --- |')
    for (const m of r.measurements) lines.push(`| ${m.name} | ${m.value} | ${m.uncertainty} | ${m.unit} |`)
    lines.push('')
  }
  if (r.propagation) {
    lines.push('## Propagación', '', `\`${r.propagation.formula}\``, '')
    if (result) {
      lines.push(result.rounded, '', ...result.steps, '')
    }
  }
  const linked = concepts.filter((c) => r.conceptIds.includes(c.id))
  if (linked.length) lines.push('## Conceptos', '', ...linked.map((c) => `- ${c.title}`), '')
  return lines.join('\n')
}

function toHtml(md: string, title: string) {
  const body = esc(md).replace(/^# (.+)$/gm, '<h1>$1</h1>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/\n/g, '<br>')
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Georgia,serif;max-width:740px;margin:2rem auto;padding:0 1rem;color:#1c1917;background:#faf7f2}h1{font-size:1.7rem}h2{font-size:1.15rem;margin-top:1.4rem}</style><article>${body}</article></html>`
}

export default function Reports() {
  const { id } = useParams()
  if (!id) return <ReportList />
  return <ReportEditor key={id} id={id} />
}

function ReportList() {
  const rows = useLiveQuery(listReports, [])
  return (
    <Panel title="Informes" actions={<ButtonLink to="/workbench/reports/new" size="sm" variant="primary"><FilePlus2 size={13} /> Nuevo</ButtonLink>}>
      {!rows ? <Loading /> : rows.length === 0 ? <p className="text-sm text-muted">Todavía no hay informes.</p> : (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => <li key={r.id}><Link className="text-sm hover:underline" to={`/workbench/reports/${r.id}`}>{r.title}</Link></li>)}
        </ul>
      )}
    </Panel>
  )
}

function ReportEditor({ id }: { id: string }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { fail, notify, confirm } = useFeedback()
  const [draft, setDraft] = useState<ReportInput | null>(null)
  const [savedId, setSavedId] = useState<string | undefined>(id === 'new' ? undefined : id)
  const [result, setResult] = useState<Propagation | null>(null)
  const [error, setError] = useState('')
  const subjects = useLiveQuery(listSubjects, [])
  const concepts = useLiveQuery(() => db.concepts.toArray(), [])
  const datasets = useLiveQuery(() => db.datasets.toArray(), [])
  const dataset = useLiveQuery(() => (draft?.datasetId ? db.datasets.get(draft.datasetId) : undefined), [draft?.datasetId])

  useEffect(() => {
    let alive = true
    void (async () => {
      if (id === 'new') {
        const base = emptyReport()
        base.title = 'Informe de laboratorio'
        const note = params.get('note') ? await db.notes.get(params.get('note')!) : undefined
        const series = params.get('dataset') ? await db.datasets.get(params.get('dataset')!) : undefined
        if (note) {
          base.title = note.title || base.title
          base.noteId = note.id
          base.subjectId = note.subjectId ?? null
          base.conceptIds = note.conceptIds
          base.sections = base.sections.map((s) => (s.key === 'procedimiento' ? { ...s, markdown: note.content } : s))
        }
        if (series) {
          base.datasetId = series.id
          base.subjectId = base.subjectId ?? series.subjectId ?? null
          base.title = note ? base.title : series.name
          base.sections = base.sections.map((s) => (s.key === 'datos' ? { ...s, markdown: series.notes } : s))
        }
        if (alive) setDraft(base)
        return
      }
      const row = await db.reports.get(id)
      if (!alive) return
      if (!row) { navigate('/workbench/reports', { replace: true }); return }
      setDraft(row)
      if (row.propagation) {
        try { setResult(propagate(row.propagation.formula, row.propagation.variables, row.propagation.unit)) } catch { setResult(null) }
      }
    })()
    return () => { alive = false }
  }, [id, navigate, params])

  const curve = useMemo(() => {
    if (!dataset || dataset.fit === 'none') return null
    try {
      const fit = fitData(dataset.rows, dataset.fit, dataset.degree)
      const fn = compileExpression(fit.expression, ['x'])
      return (x: number) => fn({ x })
    } catch { return null }
  }, [dataset])

  if (!draft) return <Loading />
  const done = draft.sections.filter((s) => s.markdown.trim()).length
  const prop = draft.propagation ?? { formula: '', unit: '', variables: [{ symbol: 'L', value: 1, uncertainty: 0.01 }] }
  const setProp = (propagation: PropagationInput) => setDraft({ ...draft, propagation })
  const setMeasure = (measurements: Measurement[]) => setDraft({ ...draft, measurements })

  const save = async () => {
    try {
      const propagation = draft.propagation?.formula.trim()
        ? { ...draft.propagation, formula: draft.propagation.formula.trim(), variables: draft.propagation.variables.filter((v) => v.symbol.trim()) }
        : null
      const row = await saveReport({ ...draft, propagation, measurements: draft.measurements.filter((m) => m.name.trim()) }, savedId)
      setSavedId(row.id)
      notify('Informe guardado')
      if (id === 'new') navigate(`/workbench/reports/${row.id}`, { replace: true })
    } catch (e) { fail(e) }
  }

  const remove = async () => {
    if (!savedId) return navigate('/workbench/reports')
    if (!await confirm({ title: '¿Eliminar este informe?', danger: true, confirmLabel: 'Eliminar' })) return
    try { await deleteReport(savedId); navigate('/workbench/reports') } catch (e) { fail(e) }
  }

  const calc = () => {
    try {
      const vars = prop.variables.filter((v) => v.symbol.trim())
      setResult(propagate(prop.formula, vars, prop.unit))
      setError('')
    } catch (e) { setResult(null); setError(e instanceof Error ? e.message : 'No se pudo propagar') }
  }

  const md = toMarkdown(draft, result, concepts ?? [])
  const file = draft.title.trim() || 'informe'

  return (
    <div className="flex flex-col gap-4">
      <style>{`@media print { body * { visibility: hidden; } #informe, #informe * { visibility: visible; } #informe { position: absolute; left: 0; top: 0; width: 100%; background: #fff; color: #111; } }`}</style>
      <Panel title={draft.title || 'Informe'} actions={
        <div className="flex flex-wrap gap-1">
          <span className="self-center text-xs text-muted">{done}/9</span>
          <Button size="sm" variant="primary" onClick={() => void save()}>Guardar</Button>
          <Button size="sm" variant="ghost" onClick={() => downloadFile(md, `${file}.md`, 'text/markdown')}><Download size={13} /> Markdown</Button>
          <Button size="sm" variant="ghost" onClick={() => downloadFile(toHtml(md, file), `${file}.html`, 'text/html')}>HTML</Button>
          <Button size="sm" variant="ghost" onClick={() => window.print()}><Printer size={13} /> PDF</Button>
          <Button size="sm" variant="danger" onClick={() => void remove()}><Trash2 size={13} /></Button>
        </div>
      }>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Título"><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="Materia">
            <Select value={draft.subjectId ?? ''} onChange={(e) => setDraft({ ...draft, subjectId: e.target.value || null })}>
              <option value="">Sin materia</option>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Serie de Gráficas">
            <Select value={draft.datasetId ?? ''} onChange={(e) => setDraft({ ...draft, datasetId: e.target.value || null })}>
              <option value="">Sin gráfica</option>
              {datasets?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Concepto">
            <Select value="" aria-label="Vincular concepto" onChange={(e) => { const v = e.target.value; if (v && !draft.conceptIds.includes(v)) setDraft({ ...draft, conceptIds: [...draft.conceptIds, v] }) }}>
              <option value="">Vincular concepto…</option>
              {concepts?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {draft.conceptIds.map((cid) => {
            const c = concepts?.find((x) => x.id === cid)
            return <button key={cid} type="button" className="rounded-full bg-sunken px-2 py-0.5 text-xs" onClick={() => setDraft({ ...draft, conceptIds: draft.conceptIds.filter((x) => x !== cid) })}>{c?.title ?? cid} ×</button>
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {draft.sections.map((s) => (
          <Field key={s.key} label={`${ReportSectionLabel[s.key]}${s.markdown.trim() ? '' : ' · vacío'}`}>
            <Textarea rows={5} value={s.markdown} onChange={(e) => setDraft({ ...draft, sections: draft.sections.map((x) => (x.key === s.key ? { ...x, markdown: e.target.value } : x)) })} />
          </Field>
        ))}
      </div>

      <Panel title="Mediciones" actions={<Button size="sm" variant="ghost" onClick={() => setMeasure([...draft.measurements, { name: '', value: 0, uncertainty: 0, unit: '' }])}>Fila</Button>}>
        <div className="flex flex-col gap-2">
          {draft.measurements.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_6rem_5rem_auto] gap-1">
              <Input aria-label={`Magnitud ${i + 1}`} placeholder="L" value={m.name} onChange={(e) => setMeasure(draft.measurements.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input aria-label={`Valor ${i + 1}`} value={String(m.value)} onChange={(e) => setMeasure(draft.measurements.map((x, j) => (j === i ? { ...x, value: Number(e.target.value.replace(',', '.')) } : x)))} />
              <Input aria-label={`Incertidumbre ${i + 1}`} value={String(m.uncertainty)} onChange={(e) => setMeasure(draft.measurements.map((x, j) => (j === i ? { ...x, uncertainty: Number(e.target.value.replace(',', '.')) } : x)))} />
              <Input aria-label={`Unidad ${i + 1}`} placeholder="m" value={m.unit} onChange={(e) => setMeasure(draft.measurements.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} />
              <Button size="sm" variant="ghost" aria-label={`Quitar medición ${i + 1}`} onClick={() => setMeasure(draft.measurements.filter((_, j) => j !== i))}>×</Button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Propagación de errores" actions={<Button size="sm" variant="primary" onClick={calc}>Propagar</Button>}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Fórmula"><Input value={prop.formula} placeholder="g = 4*pi^2*L/T^2" onChange={(e) => setProp({ ...prop, formula: e.target.value })} /></Field>
          <Field label="Unidad del resultado"><Input value={prop.unit} placeholder="m/s²" onChange={(e) => setProp({ ...prop, unit: e.target.value })} /></Field>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {prop.variables.map((v, i) => (
            <div key={i} className="grid grid-cols-[6rem_6rem_6rem_auto] gap-1">
              <Input aria-label={`Símbolo ${i + 1}`} value={v.symbol} onChange={(e) => setProp({ ...prop, variables: prop.variables.map((x, j) => (j === i ? { ...x, symbol: e.target.value } : x)) })} />
              <Input aria-label={`Valor de ${v.symbol || i + 1}`} value={String(v.value)} onChange={(e) => setProp({ ...prop, variables: prop.variables.map((x, j) => (j === i ? { ...x, value: Number(e.target.value.replace(',', '.')) } : x)) })} />
              <Input aria-label={`Incertidumbre de ${v.symbol || i + 1}`} value={String(v.uncertainty)} onChange={(e) => setProp({ ...prop, variables: prop.variables.map((x, j) => (j === i ? { ...x, uncertainty: Number(e.target.value.replace(',', '.')) } : x)) })} />
              <Button size="sm" variant="ghost" aria-label={`Quitar variable ${i + 1}`} onClick={() => setProp({ ...prop, variables: prop.variables.filter((_, j) => j !== i) })}>×</Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setProp({ ...prop, variables: [...prop.variables, { symbol: '', value: 0, uncertainty: 0 }] })}>Variable</Button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {result && (
          <div className="mt-3">
            <p className="font-medium">{result.rounded}</p>
            <Tex expr={result.latex} block />
            <ul className="mt-2 list-disc pl-5 text-sm text-muted">{result.steps.map((s) => <li key={s}>{s}</li>)}</ul>
            <Button size="sm" className="mt-2" onClick={() => setDraft({ ...draft, sections: draft.sections.map((s) => (s.key === 'calculos' ? { ...s, markdown: `${s.markdown}\n\n${result.rounded}\n\n${result.steps.join('\n')}`.trim() } : s)) })}>Pasar a cálculos</Button>
          </div>
        )}
      </Panel>

      <article id="informe" className="rounded-xl border border-line bg-panel p-4">
        <h2 className="text-xl font-semibold">{draft.title}</h2>
        {draft.sections.map((s) => (
          <section key={s.key} className="mt-4">
            <h3 className="text-sm font-medium">{ReportSectionLabel[s.key]}</h3>
            {s.markdown.trim() ? <Markdown source={s.markdown} /> : <p className="text-sm text-muted">Sin completar.</p>}
          </section>
        ))}
        {draft.measurements.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-left text-muted"><th>Magnitud</th><th>Valor</th><th>Incertidumbre</th><th>Unidad</th></tr></thead>
            <tbody>{draft.measurements.map((m, i) => <tr key={i}><td>{m.name}</td><td>{m.value}</td><td>{m.uncertainty}</td><td>{m.unit}</td></tr>)}</tbody>
          </table>
        )}
        {result && <p className="mt-4 font-medium">{result.rounded}</p>}
        {dataset && dataset.rows.length > 0 && (
          <div className="mt-4">
            <Plot points={dataset.rows} xAxis={dataset.xAxis} yAxis={dataset.yAxis} grid curve={curve} height={280} title={dataset.name} />
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {draft.conceptIds.map((cid) => {
            const c = concepts?.find((x) => x.id === cid)
            return c ? <Link key={cid} className="underline" to={`/knowledge/${cid}`}>{c.title}</Link> : null
          })}
        </div>
      </article>
    </div>
  )
}
