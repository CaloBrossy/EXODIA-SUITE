import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShannonTool } from './Shannon'
import {
  add,
  angleBetween,
  cross,
  cross2,
  degToRad,
  dot,
  magnitude,
  MathInputError,
  normalize,
  percentChange,
  percentOf,
  radToDeg,
  solveLinear1,
  solveSystem,
  sub,
  toEngineering,
  toScientific,
  whatPercent,
} from '@/lib/math/linear'
import { Tex } from '@/components/Markdown'
import { ErrorText, Input, Panel, Tabs } from '@/components/ui'
import { NumField, parseNum, ResultBox } from './shared'

const f = (x: number) => (Math.abs(x) < 1e-12 ? '0' : Number(x.toPrecision(8)).toString())
const fv = (v: number[]) => `(${v.map(f).join(', ')})`

function attempt(fn: () => string): string {
  try {
    return fn()
  } catch (e) {
    if (e instanceof MathInputError) return `— ${e.message}`
    throw e
  }
}

function VectorTool() {
  const [dim, setDim] = useState<'2' | '3'>('3')
  const [a, setA] = useState(['1', '2', '3'])
  const [b, setB] = useState(['4', '5', '6'])
  const n = Number(dim)
  const va = a.slice(0, n).map(parseNum)
  const vb = b.slice(0, n).map(parseNum)
  const invalid = [...va, ...vb].some((x) => !Number.isFinite(x))
  const row = (label: string, v: string[], set: (v: string[]) => void) => (
    <div className="flex items-center gap-2">
      <span className="w-6 font-mono text-sm">{label}</span>
      {v.slice(0, n).map((c, i) => (
        <Input key={i} value={c} inputMode="decimal" aria-label={`${label} componente ${i + 1}`} className="w-24 font-mono" onChange={(e) => set(v.map((x, j) => (j === i ? e.target.value : x)))} />
      ))}
    </div>
  )
  const results: [string, string][] = invalid
    ? []
    : [
        ['|a|', attempt(() => f(magnitude(va)))],
        ['|b|', attempt(() => f(magnitude(vb)))],
        ['â', attempt(() => fv(normalize(va)))],
        ['b̂', attempt(() => fv(normalize(vb)))],
        ['a + b', fv(add(va, vb))],
        ['a − b', fv(sub(va, vb))],
        ['a · b', f(dot(va, vb))],
        n === 3 ? ['a × b', fv(cross(va, vb))] : ['(a × b)_z', f(cross2(va, vb))],
        ['∠(a, b)', attempt(() => `${f(angleBetween(va, vb))} rad = ${f(radToDeg(angleBetween(va, vb)))}°`)],
      ]
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={dim} onChange={setDim} items={[{ id: '2', label: '2D' }, { id: '3', label: '3D' }]} />
      {row('a', a, setA)}
      {row('b', b, setB)}
      {invalid ? (
        <ErrorText>Todas las componentes deben ser números.</ErrorText>
      ) : (
        <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-sm">
          {results.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className={v.startsWith('—') ? 'text-muted' : ''}>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {n === 2 && <p className="text-xs text-muted">En 2D el producto vectorial se interpreta como la componente z de (a₁, a₂, 0) × (b₁, b₂, 0).</p>}
    </div>
  )
}

function AngleTool() {
  const [deg, setDeg] = useState('180')
  const [rad, setRad] = useState('1')
  const d = parseNum(deg)
  const r = parseNum(rad)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <NumField label="Grados" value={deg} onChange={setDeg} unit="°" />
        <ResultBox><span className="font-mono">{Number.isFinite(d) ? `${f(degToRad(d))} rad = ${f(d / 180)}π rad` : '—'}</span></ResultBox>
      </div>
      <div className="flex flex-col gap-2">
        <NumField label="Radianes" value={rad} onChange={setRad} unit="rad" />
        <ResultBox><span className="font-mono">{Number.isFinite(r) ? `${f(radToDeg(r))}°` : '—'}</span></ResultBox>
      </div>
    </div>
  )
}

function LinearTool() {
  const [abc, setAbc] = useState(['2', '3', '11'])
  const [n, setN] = useState<'2' | '3'>('2')
  const [m, setM] = useState<string[][]>([['2', '1', '-1', '8'], ['-3', '-1', '2', '-11'], ['-2', '1', '2', '-3']])
  const [a, b, c] = abc.map(parseNum) as [number, number, number]
  const one = attempt(() => {
    const r = solveLinear1(a, b, c)
    return r.kind === 'unique' ? `x = ${f(r.x)}` : r.kind === 'none' ? 'Sin solución' : 'Infinitas soluciones (identidad)'
  })
  const size = Number(n)
  const sys = attempt(() => {
    const A = m.slice(0, size).map((row) => row.slice(0, size).map(parseNum))
    const B = m.slice(0, size).map((row) => parseNum(row[3]!))
    const r = solveSystem(A, B)
    return r.kind === 'unique' ? r.x.map((v, i) => `${['x', 'y', 'z'][i]} = ${f(v)}`).join(',  ') : 'Sistema singular: no tiene solución única (ninguna o infinitas).'
  })
  const vars = ['x', 'y', 'z']
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Ecuación lineal en una variable</h3>
        <div className="flex flex-wrap items-center gap-2 font-mono">
          <Input className="w-20" value={abc[0]} aria-label="a" onChange={(e) => setAbc([e.target.value, abc[1]!, abc[2]!])} /> · x +
          <Input className="w-20" value={abc[1]} aria-label="b" onChange={(e) => setAbc([abc[0]!, e.target.value, abc[2]!])} /> =
          <Input className="w-20" value={abc[2]} aria-label="c" onChange={(e) => setAbc([abc[0]!, abc[1]!, e.target.value])} />
        </div>
        <ResultBox><span className="font-mono">{one}</span></ResultBox>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium">Sistema lineal</h3>
          <Tabs value={n} onChange={setN} items={[{ id: '2', label: '2×2' }, { id: '3', label: '3×3' }]} />
        </div>
        {m.slice(0, size).map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5 font-mono text-sm">
            {row.slice(0, size).map((v, j) => (
              <span key={j} className="flex items-center gap-1">
                {j > 0 && '+'}
                <Input className="w-16" value={v} aria-label={`a${i + 1}${j + 1}`} onChange={(e) => setM(m.map((r, ri) => (ri === i ? r.map((x, cj) => (cj === j ? e.target.value : x)) : r)))} />
                {vars[j]}
              </span>
            ))}
            =
            <Input className="w-16" value={row[3]} aria-label={`b${i + 1}`} onChange={(e) => setM(m.map((r, ri) => (ri === i ? r.map((x, cj) => (cj === 3 ? e.target.value : x)) : r)))} />
          </div>
        ))}
        <ResultBox><span className="font-mono">{sys}</span></ResultBox>
        <p className="text-xs text-muted">Eliminación gaussiana con pivoteo parcial.</p>
      </div>
    </div>
  )
}

function PercentSciTool() {
  const [p, setP] = useState('15')
  const [t, setT] = useState('200')
  const [x, setX] = useState('0.00047')
  const [sig, setSig] = useState('3')
  const P = parseNum(p)
  const T = parseNum(t)
  const X = parseNum(x)
  const S = Math.min(15, Math.max(1, Math.round(parseNum(sig)) || 3))
  const valid = Number.isFinite(P) && Number.isFinite(T)
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Porcentajes</h3>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="A" value={p} onChange={setP} />
          <NumField label="B" value={t} onChange={setT} />
        </div>
        <ResultBox>
          {valid ? (
            <ul className="flex flex-col gap-1 font-mono text-sm">
              <li>{p} % de {t} = {f(percentOf(P, T))}</li>
              <li>{p} es el {attempt(() => f(whatPercent(P, T)))} % de {t}</li>
              <li>de {p} a {t}: {attempt(() => `${f(percentChange(P, T))} %`)}</li>
            </ul>
          ) : '—'}
        </ResultBox>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Notación científica y de ingeniería</h3>
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
          <NumField label="Número" value={x} onChange={setX} hint="Admite 4.7e-4" />
          <NumField label="Cifras sig." value={sig} onChange={setSig} />
        </div>
        <ResultBox>
          {Number.isFinite(X) ? (() => {
            const s = toScientific(X, S)
            const e = toEngineering(X, S)
            return (
              <div className="flex flex-col gap-1">
                <Tex expr={`${s.mantissa} \\times 10^{${s.exponent}}`} />
                <Tex expr={`${e.mantissa} \\times 10^{${e.exponent}}`} />
                {e.prefix !== null && <span className="font-mono text-sm">{e.mantissa} {e.prefix || '(sin prefijo)'}<span className="text-muted">·unidad</span></span>}
              </div>
            )
          })() : '—'}
        </ResultBox>
      </div>
    </div>
  )
}

const TOOLS = [
  { id: 'vectors', label: 'Vectores' },
  { id: 'angles', label: 'Grados ↔ radianes' },
  { id: 'linear', label: 'Ecuaciones lineales' },
  { id: 'percent', label: 'Porcentajes y notación' },
  { id: 'shannon', label: 'Información (Shannon)' },
] as const
type Tool = (typeof TOOLS)[number]['id']

export default function MathTools() {
  const [params, setParams] = useSearchParams()
  const t = params.get('t')
  const tool: Tool = TOOLS.some((x) => x.id === t) ? (t as Tool) : 'vectors'
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tool} onChange={(id) => setParams({ t: id }, { replace: true })} items={[...TOOLS]} />
      <Panel>
        {tool === 'vectors' && <VectorTool />}
        {tool === 'angles' && <AngleTool />}
        {tool === 'linear' && <LinearTool />}
        {tool === 'percent' && <PercentSciTool />}
        {tool === 'shannon' && <ShannonTool />}
      </Panel>
    </div>
  )
}
