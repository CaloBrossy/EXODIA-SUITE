import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { ClipboardPaste, Copy, Download, FilePlus2, FileUp, Image as ImageIcon, NotebookPen, Plus, Save, Sigma, Trash2, X } from 'lucide-react'
import { db } from '@/db/db'
import { DATASET_FITS, type Dataset, type DatasetAxis, type DatasetFit } from '@/db/models'
import { Button, Field, Input, Panel, Select, Textarea, cx } from '@/components/ui'
import { Tex } from '@/components/Markdown'
import { useFeedback } from '@/components/feedback'
import { cellsToRows, emptyCell, parseXYTable, rowsToCells, rowsToCsv, type Cell } from '@/lib/dataTable'
import { parseNum } from '@/lib/csv'
import { fitData, FitKindLabel, fmtSig, type Fit } from '@/lib/math/fit'
import { deleteDataset, emptyDataset, listDatasets, saveDataset, type DatasetInput } from '@/services/datasets'
import { listSubjects } from '@/services/focus'
import { emptyFormula, saveFormula } from '@/services/formulas'
import { createNote, updateNote } from '@/services/notes'
import { downloadFile } from '@/services/backup'
import { Plot } from './data/Plot'
import { exportPng, exportSvg } from './data/exportSvg'

const FIT_LABEL: Record<DatasetFit, string> = { none: 'Sin ajuste', ...FitKindLabel }
const blankCells = () => Array.from({ length: 8 }, emptyCell)
const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'grafico'

function fitMarkdown(fit: Fit, d: DatasetInput): string {
  const rows = fit.params.map((p) => `| ${p.name} | ${fmtSig(p.value, 6)} | ${p.se == null ? '—' : fmtSig(p.se, 3)} |`)
  return [
    `### Ajuste ${FitKindLabel[fit.kind].toLowerCase()}${fit.kind === 'poly' ? ` (grado ${fit.degree})` : ''}: ${d.name || 'datos'}`,
    '',
    `$$${fit.latex}$$`,
    '',
    `R² = ${fit.r2 == null ? '—' : fit.r2.toFixed(6)} · n = ${fit.n} · x: ${d.xAxis.label}${d.xAxis.unit ? ` (${d.xAxis.unit})` : ''} · y: ${d.yAxis.label}${d.yAxis.unit ? ` (${d.yAxis.unit})` : ''}`,
    '',
    '| Parámetro | Valor | Error estándar |',
    '| --- | --- | --- |',
    ...rows,
  ].join('\n')
}

function AxisFields({ title, axis, onChange }: { title: string; axis: DatasetAxis; onChange: (a: DatasetAxis) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={`${title}: magnitud`} className="w-32"><Input className="h-8" value={axis.label} onChange={(e) => onChange({ ...axis, label: e.target.value })} /></Field>
      <Field label="Unidad" className="w-20"><Input className="h-8" value={axis.unit} onChange={(e) => onChange({ ...axis, unit: e.target.value })} /></Field>
      <label className="flex h-8 items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={axis.log} onChange={(e) => onChange({ ...axis, log: e.target.checked })} /> log</label>
    </div>
  )
}

export default function DataLab() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notify, fail, confirm } = useFeedback()
  const saved = useLiveQuery(listDatasets, [])
  const subjects = useLiveQuery(listSubjects, [])
  const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().limit(60).toArray(), [])
  const [meta, setMeta] = useState<DatasetInput>(() => ({ ...emptyDataset(), name: '' }))
  const [cells, setCells] = useState<Cell[]>(blankCells)
  const [grid, setGrid] = useState(true)
  const [paste, setPaste] = useState<string | null>(null)
  const [predX, setPredX] = useState('')
  const [noteId, setNoteId] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = (d: Dataset) => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = d
    setMeta(rest)
    setCells(d.rows.length ? rowsToCells(d.rows) : blankCells())
  }

  useEffect(() => {
    if (!id) return
    let alive = true
    db.datasets.get(id).then((d) => alive && (d ? load(d) : navigate('/workbench/data', { replace: true }))).catch(fail)
    return () => { alive = false }
  }, [id, navigate, fail])

  const { rows, invalid } = useMemo(() => cellsToRows(cells), [cells])
  const result = useMemo((): { fit: Fit | null; error: string | null } => {
    if (meta.fit === 'none' || rows.length === 0) return { fit: null, error: null }
    try {
      return { fit: fitData(rows, meta.fit, meta.degree), error: null }
    } catch (e) {
      return { fit: null, error: (e as Error).message }
    }
  }, [rows, meta.fit, meta.degree])
  const fit = result.fit
  const residuals = useMemo(() => fit?.residuals.map((r) => ({ x: r.x, y: r.r })) ?? [], [fit])
  const predicted = fit && parseNum(predX) != null ? fit.predict(parseNum(predX)!) : null

  const setCell = (i: number, k: keyof Cell, v: string) =>
    setCells((cs) => {
      const next = cs.map((c, j) => (j === i ? { ...c, [k]: v } : c))
      return i === next.length - 1 && v.trim() ? [...next, emptyCell()] : next
    })

  /** Pegar un bloque de Excel en una celda: reemplaza desde esa fila hacia abajo. */
  const onCellPaste = (i: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (!/[\t\n;]/.test(text.trim())) return
    e.preventDefault()
    const { cells: pasted } = parseXYTable(text)
    if (!pasted.length) return notify('No se encontraron números en lo pegado.', 'error')
    setCells((cs) => {
      const next = [...cs.slice(0, i), ...pasted, ...cs.slice(i + pasted.length)]
      return Object.values(next[next.length - 1]!).some((v) => v.trim()) ? [...next, emptyCell()] : next
    })
    notify(`${pasted.length} filas pegadas.`, 'ok')
  }

  const loadText = (text: string) => {
    const { cells: parsed, header } = parseXYTable(text)
    if (!parsed.length) return notify('No se encontraron filas con números.', 'error')
    setCells([...parsed, emptyCell()])
    if (header && header.length >= 2) {
      const unit = (h: string) => /\(([^)]*)\)|\[([^\]]*)\]/.exec(h)
      const axis = (h: string, a: DatasetAxis): DatasetAxis => {
        const m = unit(h)
        return { ...a, label: h.replace(/\(.*\)|\[.*\]/g, '').trim() || a.label, unit: m ? (m[1] ?? m[2] ?? '').trim() : a.unit }
      }
      setMeta((m) => ({ ...m, xAxis: axis(header[0]!, m.xAxis), yAxis: axis(header[1]!, m.yAxis) }))
    }
    setPaste(null)
    notify(`${parsed.length} filas cargadas.`, 'ok')
  }

  const save = () =>
    saveDataset({ ...meta, rows }, id)
      .then((d) => {
        notify(`Serie «${d.name}» guardada.`, 'ok')
        if (d.id !== id) navigate(`/workbench/data/${d.id}`, { replace: true })
      })
      .catch(fail)

  const reset = () => {
    setMeta(emptyDataset())
    setCells(blankCells())
    setPredX('')
    navigate('/workbench/data')
  }

  const remove = async () => {
    if (!id || !(await confirm({ title: `¿Eliminar la serie «${meta.name}»?`, danger: true, confirmLabel: 'Eliminar' }))) return
    await deleteDataset(id).then(reset).catch(fail)
  }

  const fileName = slug(meta.name || 'grafico')
  const curveLabel = fit ? `${FitKindLabel[fit.kind]}${fit.kind === 'poly' ? ` (grado ${fit.degree})` : ''}${fit.r2 == null ? '' : ` · R² = ${fit.r2.toFixed(4)}`}` : undefined

  const asFormula = () => {
    if (!fit) return
    saveFormula({
      ...emptyFormula(),
      name: `Ajuste ${FitKindLabel[fit.kind].toLowerCase()}: ${meta.name || 'datos'}`.slice(0, 200),
      latex: fit.latex,
      description: `Ajuste por mínimos cuadrados de ${fit.n} puntos${fit.r2 == null ? '' : ` (R² = ${fit.r2.toFixed(4)})`}. ${fit.params.map((p) => `${p.name} = ${fmtSig(p.value, 6)}${p.se == null ? '' : ` ± ${fmtSig(p.se, 2)}`}`).join(', ')}.`,
      variables: [{ symbol: 'x', meaning: meta.xAxis.label, unit: meta.xAxis.unit }],
      resultUnit: meta.yAxis.unit,
      discipline: 'Datos experimentales',
      tags: ['ajuste'],
      evalExpression: fit.expression,
      evalTarget: 'y',
    })
      .then((fid) => notify(`Guardada en Fórmulas (/workbench/formulas/${fid}).`, 'ok'))
      .catch(fail)
  }

  const toNote = async () => {
    if (!fit) return
    const md = fitMarkdown(fit, meta)
    try {
      if (!noteId) {
        const n = await createNote({ title: `Ajuste: ${meta.name || 'datos'}`, content: md, subjectId: meta.subjectId ?? null })
        notify(`Nota «${n.title}» creada.`, 'ok')
      } else {
        const n = await db.notes.get(noteId)
        if (!n) throw new Error('La nota ya no existe')
        await updateNote(noteId, { content: `${n.content.trimEnd()}\n\n${md}\n` })
        notify(`Insertado en «${n.title || 'Sin título'}».`, 'ok')
      }
    } catch (e) {
      fail(e)
    }
  }

  const exportImage = (kind: 'png' | 'svg') => {
    const svg = svgRef.current
    if (!svg) return
    if (kind === 'svg') return exportSvg(svg, fileName)
    exportPng(svg, fileName).catch(fail)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Panel
          title="Datos"
          actions={
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setPaste(paste == null ? '' : null)} title="Pegar desde Excel o CSV"><ClipboardPaste size={13} /> Pegar</Button>
              <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} title="Importar CSV"><FileUp size={13} /></Button>
              <Button size="sm" variant="ghost" disabled={!rows.length} onClick={() => downloadFile(rowsToCsv(rows, meta.xAxis, meta.yAxis), `${fileName}.csv`, 'text/csv')} title="Exportar CSV"><Download size={13} /></Button>
              <Button size="sm" variant="ghost" onClick={() => setCells(blankCells())} title="Vaciar tabla"><Trash2 size={13} /></Button>
            </div>
          }
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              f?.text().then(loadText).catch(fail)
            }}
          />
          {paste != null && (
            <div className="mb-3 flex flex-col gap-2">
              <Textarea rows={5} autoFocus className="font-mono text-xs" placeholder={'x\ty\terrY\n1\t2,1\t0,1\n…'} value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Datos pegados" />
              <div className="flex gap-2">
                <Button size="sm" variant="primary" disabled={!paste.trim()} onClick={() => loadText(paste)}>Cargar</Button>
                <Button size="sm" variant="ghost" onClick={() => setPaste(null)}>Cancelar</Button>
              </div>
            </div>
          )}
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-panel text-muted">
                <tr><th className="w-6" /><th className="px-1 text-left font-medium">X</th><th className="px-1 text-left font-medium">Y</th><th className="px-1 text-left font-medium">σx</th><th className="px-1 text-left font-medium">σy</th><th className="w-6" /></tr>
              </thead>
              <tbody>
                {cells.map((c, i) => (
                  <tr key={i}>
                    <td className="pr-1 text-right text-muted">{i + 1}</td>
                    {(['x', 'y', 'ex', 'ey'] as const).map((k) => (
                      <td key={k} className="p-0.5">
                        <Input
                          className={cx('h-7 px-1.5 font-mono text-xs', c[k].trim() && parseNum(c[k]) == null && 'border-danger')}
                          inputMode="decimal"
                          value={c[k]}
                          aria-label={`${k} fila ${i + 1}`}
                          onChange={(e) => setCell(i, k, e.target.value)}
                          onPaste={onCellPaste(i)}
                        />
                      </td>
                    ))}
                    <td>
                      <button type="button" className="text-muted hover:text-danger" aria-label={`Quitar fila ${i + 1}`} onClick={() => setCells((cs) => (cs.length > 1 ? cs.filter((_, j) => j !== i) : [emptyCell()]))}><X size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>{rows.length} puntos{invalid > 0 && <span className="text-danger"> · {invalid} incompletos</span>}</span>
            <Button size="sm" variant="ghost" onClick={() => setCells((cs) => [...cs, emptyCell()])}><Plus size={13} /> Fila</Button>
          </div>
        </Panel>

        <Panel title="Serie">
          <div className="flex flex-col gap-3">
            <Select className="h-8" value={id ?? ''} aria-label="Series guardadas" onChange={(e) => (e.target.value ? navigate(`/workbench/data/${e.target.value}`) : reset())}>
              <option value="">{saved?.length ? 'Series guardadas…' : 'Sin series guardadas'}</option>
              {saved?.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.rows.length})</option>)}
            </Select>
            <Field label="Nombre"><Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Péndulo, ley de Ohm…" /></Field>
            <Field label="Materia">
              <Select value={meta.subjectId ?? ''} onChange={(e) => setMeta({ ...meta, subjectId: e.target.value || null })}>
                <option value="">Sin materia</option>
                {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Notas"><Textarea rows={3} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} placeholder="Condiciones de medición, instrumento…" /></Field>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={save}><Save size={13} /> {id ? 'Guardar' : 'Guardar serie'}</Button>
              <Button size="sm" onClick={reset}><FilePlus2 size={13} /> Nueva</Button>
              {id && <Button size="sm" variant="danger" onClick={remove}><Trash2 size={13} /> Eliminar</Button>}
              {id && <Button size="sm" onClick={() => navigate(`/workbench/reports/new?dataset=${id}`)}><NotebookPen size={13} /> Informe</Button>}
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel
          title="Gráfico"
          actions={
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={!rows.length} onClick={() => exportImage('png')}><ImageIcon size={13} /> PNG</Button>
              <Button size="sm" variant="ghost" disabled={!rows.length} onClick={() => exportImage('svg')}><Download size={13} /> SVG</Button>
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap items-end gap-x-5 gap-y-2">
            <AxisFields title="X" axis={meta.xAxis} onChange={(xAxis) => setMeta({ ...meta, xAxis })} />
            <AxisFields title="Y" axis={meta.yAxis} onChange={(yAxis) => setMeta({ ...meta, yAxis })} />
            <label className="flex h-8 items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Grilla</label>
          </div>
          <Plot ref={svgRef} points={rows} xAxis={meta.xAxis} yAxis={meta.yAxis} grid={grid} curve={fit?.predict} curveLabel={curveLabel} title={meta.name || 'Gráfico de datos'} />
        </Panel>

        <Panel title="Ajuste">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Modelo" className="w-44">
                <Select className="h-8" value={meta.fit} onChange={(e) => setMeta({ ...meta, fit: e.target.value as DatasetFit })}>
                  {DATASET_FITS.map((k) => <option key={k} value={k}>{FIT_LABEL[k]}</option>)}
                </Select>
              </Field>
              {meta.fit === 'poly' && (
                <Field label="Grado" className="w-20">
                  <Select className="h-8" value={meta.degree} onChange={(e) => setMeta({ ...meta, degree: Number(e.target.value) })}>
                    {[2, 3, 4, 5].map((d) => <option key={d}>{d}</option>)}
                  </Select>
                </Field>
              )}
            </div>
            {result.error && <p className="text-sm text-danger">{result.error}</p>}
            {fit && (
              <>
                <div className="overflow-x-auto rounded-md bg-sunken px-4 py-3"><Tex expr={fit.latex} block /></div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>R² = <b className="font-mono" data-testid="r2">{fit.r2 == null ? '—' : fit.r2.toFixed(6)}</b></span>
                  <span className="text-muted">n = {fit.n}{fit.dropped > 0 && ` (${fit.dropped} fuera del dominio del modelo)`}</span>
                </div>
                <table className="w-full max-w-md text-sm">
                  <thead className="text-xs text-muted"><tr><th className="text-left font-medium">Parámetro</th><th className="text-left font-medium">Valor</th><th className="text-left font-medium">Error estándar</th></tr></thead>
                  <tbody className="font-mono">
                    {fit.params.map((p) => <tr key={p.name}><td>{p.name}</td><td>{fmtSig(p.value, 6)}</td><td>{p.se == null ? '—' : `± ${fmtSig(p.se, 3)}`}</td></tr>)}
                  </tbody>
                </table>
                {fit.linearized && <p className="text-xs text-muted">Ajuste por linealización (logaritmos); los errores de A se propagan desde ln A. R² se calcula sobre y original.</p>}
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Predecir y para x =" className="w-40"><Input className="h-8 font-mono" inputMode="decimal" value={predX} onChange={(e) => setPredX(e.target.value)} /></Field>
                  <p className="h-8 font-mono text-sm leading-8">{predicted == null ? '' : `y = ${Number.isFinite(predicted) ? fmtSig(predicted, 6) : 'fuera de dominio'}${meta.yAxis.unit ? ` ${meta.yAxis.unit}` : ''}`}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <Button size="sm" onClick={() => navigator.clipboard.writeText(fit.latex).then(() => notify('LaTeX copiado.', 'ok')).catch(fail)}><Copy size={13} /> Copiar LaTeX</Button>
                  <Button size="sm" onClick={asFormula}><Sigma size={13} /> Guardar como fórmula</Button>
                  <Select className="h-8 w-48" value={noteId} onChange={(e) => setNoteId(e.target.value)} aria-label="Nota destino">
                    <option value="">Nota nueva</option>
                    {notes?.map((n) => <option key={n.id} value={n.id}>{n.title || 'Sin título'}</option>)}
                  </Select>
                  <Button size="sm" onClick={toNote}><NotebookPen size={13} /> Insertar en nota</Button>
                </div>
              </>
            )}
          </div>
        </Panel>

        {fit && (
          <Panel title="Residuos (y − ŷ)">
            <Plot points={residuals} xAxis={meta.xAxis} yAxis={{ label: 'Residuo', unit: meta.yAxis.unit, log: false }} grid={grid} zeroLine pointsLabel="Residuos" height={220} />
          </Panel>
        )}
      </div>
    </div>
  )
}
