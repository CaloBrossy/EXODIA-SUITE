import { useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Copy, NotebookPen, Star } from 'lucide-react'
import { db } from '@/db/db'
import { Tex } from '@/components/Markdown'
import { useFeedback } from '@/components/feedback'
import { Button, Field, Input, Panel, Select, Tabs } from '@/components/ui'
import { CONSTANTS } from '@/lib/physicsData'
import {
  BANDS, CALCULUS, CAT_COLOR, E12, E24, E6, E96, ELEMENTS, GREEK, MATERIALS, MULT_EXTRA, PREFIXES, TOL,
  decode4, elemLatex, gridCell, materialLatex, type Element, type Material, type Sheet,
} from '@/lib/refs/catalog'
import { createNote } from '@/services/notes'

const FAV = 'refs.favorites'
type Tab = 'tabla' | 'calculo' | 'resistencias' | 'materiales' | 'simbolos'

const seriesOf = { E6, E12, E24, E96 } as const

export default function Refs() {
  const navigate = useNavigate()
  const { notify, fail } = useFeedback()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [tab, setTab] = useState<Tab>('tabla')
  const [picked, setPicked] = useState<Element | null>(ELEMENTS.find((e) => e.name === 'Hierro') ?? null)
  const [sort, setSort] = useState<'z' | 'mass' | 'en'>('z')
  const [series, setSeries] = useState<keyof typeof seriesOf>('E12')
  const [bands, setBands] = useState<[string, string, string, string]>(['marron', 'negro', 'rojo', 'dorado'])
  const favs = useLiveQuery(async () => {
    const row = await db.kv.get(FAV)
    return Array.isArray(row?.value) ? row.value.filter((x): x is string => typeof x === 'string') : []
  }, [])

  const toggle = async (id: string) => {
    const cur = favs ?? []
    await db.kv.put({ key: FAV, value: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  }
  const copy = async (latex: string) => {
    try {
      await navigator.clipboard.writeText(latex)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = latex
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      if (!ok) { fail(new Error('No se pudo copiar')); return }
    }
    notify('LaTeX copiado')
  }
  const note = async (title: string, latex: string) => {
    try {
      const n = await createNote({ title, content: `$$\n${latex}\n$$` })
      navigate(`/notes/${n.id}`)
    } catch (e) { fail(e) }
  }
  const star = (id: string) => (
    <Button size="sm" variant="ghost" aria-label="Favorito" aria-pressed={favs?.includes(id)} onClick={() => void toggle(id)}>
      <Star size={13} className={favs?.includes(id) ? 'fill-accent text-accent' : ''} />
    </Button>
  )
  const actions = (id: string, title: string, latex: string) => (
    <div className="flex gap-1">
      {star(id)}
      <Button size="sm" variant="ghost" onClick={() => void copy(latex)}><Copy size={13} /> LaTeX</Button>
      <Button size="sm" variant="ghost" onClick={() => void note(title, latex)}><NotebookPen size={13} /> Nota</Button>
    </div>
  )

  const query = q.trim().toLocaleLowerCase('es')
  const match = (text: string) => !query || text.toLocaleLowerCase('es').includes(query)
  const onlyFav = query === 'favoritos'
  const shown = (id: string, text: string) => (onlyFav ? favs?.includes(id) : match(text))

  const ordered = useMemo(() => {
    const list = [...ELEMENTS]
    if (sort === 'mass') list.sort((a, b) => b.mass - a.mass)
    if (sort === 'en') list.sort((a, b) => (b.en ?? -1) - (a.en ?? -1))
    return list
  }, [sort])

  const decoded = useMemo(() => {
    const d1 = BANDS.find((b) => b.id === bands[0])
    const d2 = BANDS.find((b) => b.id === bands[1])
    const mult = [...BANDS, ...MULT_EXTRA].find((b) => b.id === bands[2])
    const tol = TOL.find((b) => b.id === bands[3])
    if (!d1 || !d2 || !mult || !tol || !('digit' in d1) || !('digit' in d2) || !('exp' in mult)) return null
    return decode4(d1.digit, d2.digit, mult.exp, tol.tol)
  }, [bands])

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Referencias" actions={<span className="text-xs text-muted">Datos incluidos. Sin red.</span>}>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Buscar"><Input value={q} placeholder="hierro, seno, kilo…" onChange={(e) => setQ(e.target.value)} /></Field>
          <Tabs value={tab} onChange={setTab} items={[
            { id: 'tabla', label: 'Tabla' },
            { id: 'calculo', label: 'Cálculo' },
            { id: 'resistencias', label: 'Resistencias' },
            { id: 'materiales', label: 'Materiales' },
            { id: 'simbolos', label: 'Símbolos' },
          ]} />
        </div>
      </Panel>

      {tab === 'tabla' && (
        <Panel title="Tabla periódica" actions={
          <Select className="h-8" aria-label="Orden" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="z">Por número</option>
            <option value="mass">Por masa</option>
            <option value="en">Por electronegatividad</option>
          </Select>
        }>
          {sort === 'z' ? (
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}>
              {Array.from({ length: 18 * 4 }, (_, i) => {
                const r = Math.floor(i / 18) + 1
                const c = (i % 18) + 1
                const el = ELEMENTS.find((e) => { const p = gridCell(e.z); return p?.r === r && p.c === c })
                return el && shown(`el-${el.z}`, `${el.name} ${el.sym} ${el.cat}`)
                  ? <button key={el.z} type="button" aria-label={el.name} onClick={() => setPicked(el)} className="rounded px-0.5 py-1 text-[10px] leading-tight text-[#102018]" style={{ background: CAT_COLOR[el.cat] }}><b>{el.sym}</b><br />{el.z}</button>
                  : <span key={i} />
              })}
            </div>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {ordered.filter((e) => shown(`el-${e.z}`, `${e.name} ${e.sym}`)).map((e) => (
                <li key={e.z}><button type="button" className="hover:underline" onClick={() => setPicked(e)}>{e.z} {e.name} · {sort === 'mass' ? `${e.mass} u` : (e.en ?? '—')}</button></li>
              ))}
            </ul>
          )}
          {picked && shown(`el-${picked.z}`, picked.name) && <ElementCard el={picked} actions={actions(`el-${picked.z}`, picked.name, elemLatex(picked))} />}
        </Panel>
      )}

      {tab === 'calculo' && <SheetList rows={CALCULUS.filter((s) => shown(s.id, `${s.title} ${s.section} ${s.keywords}`))} actions={actions} />}
      {tab === 'materiales' && (
        <Panel title="Materiales">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted"><th>Material</th><th>ρ kg/m³</th><th>E GPa</th><th>ρₑ Ω·m</th><th>k W/(m·K)</th><th /></tr></thead>
            <tbody>
              {MATERIALS.filter((m) => shown(`mat-${m.id}`, m.name)).map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td><td>{m.density}</td><td>{m.young ?? '—'}</td><td>{m.resistivity ?? '—'}</td><td>{m.thermal ?? '—'}</td>
                  <td>{actions(`mat-${m.id}`, m.name, materialLatex(m))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      {tab === 'resistencias' && (
        <Panel title="Código de colores">
          <div className="mb-3 flex flex-wrap gap-2">
            {(['E6', 'E12', 'E24', 'E96'] as const).map((id) => (
              <Button key={id} size="sm" variant={series === id ? 'primary' : 'ghost'} onClick={() => setSeries(id)}>{id}</Button>
            ))}
          </div>
          <p className="mb-3 font-mono text-xs text-muted">{seriesOf[series].join(' · ')}</p>
          <div className="grid gap-2 sm:grid-cols-4">
            {(['1.ª cifra', '2.ª cifra', 'Multiplicador', 'Tolerancia'] as const).map((label, i) => (
              <Field key={label} label={label}>
                <Select aria-label={label} value={bands[i]} onChange={(e) => setBands(bands.map((b, j) => (j === i ? e.target.value : b)) as typeof bands)}>
                  {(i < 2 ? BANDS : i === 2 ? [...BANDS, ...MULT_EXTRA] : TOL).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
            ))}
          </div>
          {decoded && (
            <div className="mt-3">
              <p className="font-medium">{decoded.value.toLocaleString('es-AR')} Ω ± {decoded.tol} %</p>
              <Tex expr={decoded.latex} block />
              {actions('res-4', 'Resistencia', decoded.latex)}
            </div>
          )}
        </Panel>
      )}
      {tab === 'simbolos' && (
        <>
          <SheetList rows={[...GREEK, ...PREFIXES].filter((s) => shown(s.id, `${s.title} ${s.keywords}`))} actions={actions} />
          <Panel title="Constantes">
            <p className="mb-2 text-sm text-muted">Los valores CODATA están en Física, sin copiarlos acá.</p>
            <ul className="flex flex-col gap-1 text-sm">
              {CONSTANTS.filter((c) => match(c.name)).map((c) => (
                <li key={c.symbol}><Link className="underline" to="/workbench/physics?t=constants">{c.name}</Link></li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  )
}

function ElementCard({ el, actions }: { el: Element; actions: ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-line p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{el.name} <span className="text-muted">{el.sym}</span></h3>
        {actions}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Número</dt><dd>{el.z}</dd>
        <dt className="text-muted">Masa</dt><dd>{el.mass} u</dd>
        <dt className="text-muted">Configuración</dt><dd>{el.conf}</dd>
        <dt className="text-muted">Electronegatividad</dt><dd>{el.en ?? '—'}</dd>
        <dt className="text-muted">Estado</dt><dd>{el.state}</dd>
        <dt className="text-muted">Categoría</dt><dd>{el.cat}</dd>
      </dl>
    </div>
  )
}

function SheetList({ rows, actions }: { rows: Sheet[]; actions: (id: string, title: string, latex: string) => React.ReactNode }) {
  return (
    <Panel title="Fichas">
      <ul className="flex flex-col gap-3">
        {rows.map((s) => (
          <li key={s.id} className="rounded-xl border border-line p-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{s.title} <span className="text-muted">· {s.section}</span></span>
              {actions(s.id, s.title, s.latex)}
            </div>
            <Tex expr={s.latex} block />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export type { Material }
