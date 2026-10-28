import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Field, Input, Panel, Select, Tabs, Textarea } from '@/components/ui'
import { Tex } from '@/components/Markdown'
import { useFeedback } from '@/components/feedback'
import { Plot } from '@/features/workbench/data/Plot'
import { CircuitError, currentDivider, elementPower, network, parseMatrix, parseVector, resistorBank, seriesRlc, thevenin, transient, twoMesh, voltageDivider, type CircuitOut, type PowerElement } from '@/lib/math/circuits'
import { NumField, ResultBox, SaveCalcButton, parseNum } from './shared'

const TOOLS = [
  { id: 'div', label: 'Divisores' },
  { id: 'eq', label: 'Equivalente' },
  { id: 'net', label: 'Mallas y nodos' },
  { id: 'th', label: 'Thévenin' },
  { id: 'tr', label: 'Transitorios' },
  { id: 'rlc', label: 'RLC' },
  { id: 'pow', label: 'Potencia' },
] as const
type Tool = (typeof TOOLS)[number]['id']

function show(out: CircuitOut) {
  return out.rows.map((r) => `${r.label} = ${r.value} ${r.unit}`).join('; ')
}

export default function Circuits() {
  const { fail } = useFeedback()
  const [tool, setTool] = useState<Tool>('net')
  const [out, setOut] = useState<CircuitOut | null>(null)
  const [input, setInput] = useState('')
  const go = (label: string, fn: () => CircuitOut) => {
    try {
      const r = fn()
      setInput(label)
      setOut(r)
    } catch (e) {
      setOut(null)
      fail(e instanceof CircuitError ? e : e)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tool} onChange={(id) => { setTool(id); setOut(null) }} items={[...TOOLS]} />
      <p className="text-sm text-muted">Ohm y el equivalente de resistencias se calculan con las mismas funciones que en <Link to="/workbench/physics?t=circuits" className="underline">Física › Circuitos</Link>.</p>
      {tool === 'div' && <Dividers go={go} />}
      {tool === 'eq' && <Bank go={go} />}
      {tool === 'net' && <Network go={go} />}
      {tool === 'th' && <Thevenin go={go} />}
      {tool === 'tr' && <Transient go={go} />}
      {tool === 'rlc' && <Rlc go={go} />}
      {tool === 'pow' && <Power go={go} />}
      {out && <Result out={out} input={input} />}
    </div>
  )
}

function Result({ out, input }: { out: CircuitOut; input: string }) {
  const points = useMemo(() => {
    if (!out.curve) return []
    return Array.from({ length: 80 }, (_, i) => {
      const x = (out.curve!.tMax * i) / 79
      return { x, y: out.curve!.y(x) }
    })
  }, [out])
  return (
    <Panel title="Resultado">
      <div className="flex flex-col gap-3">
        {out.latex.map((e) => <div key={e} className="overflow-x-auto rounded-md bg-sunken px-3 py-2"><Tex expr={e} block /></div>)}
        <ol className="list-decimal pl-5 text-sm">{out.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <ResultBox>
          <ul>{out.rows.map((r) => <li key={r.label}><span className="text-muted">{r.label}</span> = {r.value} {r.unit}</li>)}</ul>
        </ResultBox>
        {out.curve && <Plot points={points} xAxis={{ label: out.curve.x, unit: out.curve.xUnit, log: false }} yAxis={{ label: out.curve.yLabel, unit: out.curve.yUnit, log: false }} grid curve={out.curve.y} height={280} />}
        <SaveCalcButton kind="circuit" input={input} result={show(out)} />
      </div>
    </Panel>
  )
}

function Dividers({ go }: { go: (label: string, fn: () => CircuitOut) => void }) {
  const [vin, setVin] = useState('12')
  const [r1, setR1] = useState('2')
  const [r2, setR2] = useState('4')
  const [iin, setIin] = useState('3')
  return (
    <Panel title="Divisor de tensión y de corriente">
      <div className="grid gap-3 sm:grid-cols-3">
        <NumField label="Vin" unit="V" value={vin} onChange={setVin} />
        <NumField label="R1" unit="Ω" value={r1} onChange={setR1} />
        <NumField label="R2" unit="Ω" value={r2} onChange={setR2} />
        <NumField label="Iin" unit="A" value={iin} onChange={setIin} />
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={() => go(`divisor V ${vin}`, () => voltageDivider(parseNum(vin), parseNum(r1), parseNum(r2)))}>Tensión</Button>
        <Button onClick={() => go(`divisor I ${iin}`, () => currentDivider(parseNum(iin), parseNum(r1), parseNum(r2)))}>Corriente</Button>
      </div>
    </Panel>
  )
}

function Bank({ go }: { go: (label: string, fn: () => CircuitOut) => void }) {
  const [text, setText] = useState('4, 6, 12')
  const [mode, setMode] = useState<'series' | 'parallel'>('series')
  const values = () => text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean).map(parseNum)
  return (
    <Panel title="Resistencias equivalentes">
      <Field label="Resistencias (Ω)"><Input value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <div className="mt-3 flex gap-2">
        <Select value={mode} onChange={(e) => setMode(e.target.value as 'series' | 'parallel')} aria-label="Conexión"><option value="series">Serie</option><option value="parallel">Paralelo</option></Select>
        <Button variant="primary" onClick={() => go(text, () => resistorBank(values(), mode))}>Calcular</Button>
      </div>
    </Panel>
  )
}

function Network({ go }: { go: (label: string, fn: () => CircuitOut) => void }) {
  const [r1, setR1] = useState('2')
  const [r2, setR2] = useState('6')
  const [rs, setRs] = useState('4')
  const [v1, setV1] = useState('10')
  const [v2, setV2] = useState('-8')
  const [kind, setKind] = useState<'mesh' | 'nodal'>('mesh')
  const [matrix, setMatrix] = useState('6 -4\n-4 10')
  const [sources, setSources] = useState('10\n-8')
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Dos mallas">
        <div className="grid grid-cols-2 gap-3">
          <NumField label="R1" unit="Ω" value={r1} onChange={setR1} />
          <NumField label="R2" unit="Ω" value={r2} onChange={setR2} />
          <NumField label="Rs compartida" unit="Ω" value={rs} onChange={setRs} />
          <NumField label="V1" unit="V" value={v1} onChange={setV1} />
          <NumField label="V2" unit="V" value={v2} onChange={setV2} />
        </div>
        <Button className="mt-3" variant="primary" onClick={() => go('2 mallas', () => twoMesh(parseNum(r1), parseNum(r2), parseNum(rs), parseNum(v1), parseNum(v2)))}>Resolver</Button>
      </Panel>
      <Panel title="Matriz de mallas o nodos">
        <Field label="Matriz"><Textarea rows={4} className="font-mono" value={matrix} onChange={(e) => setMatrix(e.target.value)} /></Field>
        <Field label="Fuentes"><Textarea rows={3} className="font-mono" value={sources} onChange={(e) => setSources(e.target.value)} /></Field>
        <div className="mt-3 flex gap-2">
          <Select value={kind} onChange={(e) => setKind(e.target.value as 'mesh' | 'nodal')} aria-label="Método"><option value="mesh">Mallas</option><option value="nodal">Nodos</option></Select>
          <Button variant="primary" onClick={() => go('matriz', () => { const A = parseMatrix(matrix); return network(kind, A, parseVector(sources, A.length)) })}>Resolver</Button>
        </div>
      </Panel>
    </div>
  )
}

function Thevenin({ go }: { go: (label: string, fn: () => CircuitOut) => void }) {
  const [voc, setVoc] = useState('10')
  const [isc, setIsc] = useState('2')
  const [rl, setRl] = useState('5')
  return (
    <Panel title="Equivalente de Thévenin y Norton">
      <div className="grid gap-3 sm:grid-cols-3">
        <NumField label="Voc" unit="V" value={voc} onChange={setVoc} />
        <NumField label="Isc" unit="A" value={isc} onChange={setIsc} />
        <NumField label="RL" unit="Ω" value={rl} onChange={setRl} hint="Opcional, para la carga" />
      </div>
      <Button className="mt-3" variant="primary" onClick={() => go('thévenin', () => thevenin(parseNum(voc), parseNum(isc), rl.trim() ? parseNum(rl) : undefined))}>Calcular</Button>
    </Panel>
  )
}

function Transient({ go }: { go: (label: string, fn: () => CircuitOut) => void }) {
  const [kind, setKind] = useState<'rc' | 'rl'>('rc')
  const [R, setR] = useState('1000')
  const [S, setS] = useState('0.001')
  const [y0, setY0] = useState('0')
  const [y1, setY1] = useState('5')
  const [t, setT] = useState('1')
  return (
    <Panel title="Transitorios RC y RL">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Circuito"><Select value={kind} onChange={(e) => setKind(e.target.value as 'rc' | 'rl')}><option value="rc">RC</option><option value="rl">RL</option></Select></Field>
        <NumField label="R" unit="Ω" value={R} onChange={setR} />
        <NumField label={kind === 'rc' ? 'C' : 'L'} unit={kind === 'rc' ? 'F' : 'H'} value={S} onChange={setS} />
        <NumField label="Inicial" value={y0} onChange={setY0} />
        <NumField label="Final" value={y1} onChange={setY1} />
        <NumField label="t" unit="s" value={t} onChange={setT} />
      </div>
      <Button className="mt-3" variant="primary" onClick={() => go(kind, () => transient(kind, parseNum(R), parseNum(S), parseNum(y0), parseNum(y1), parseNum(t)))}>Calcular</Button>
    </Panel>
  )
}

function Rlc({ go }: { go: (label: string, fn: () => CircuitOut) => void }) {
  const [R, setR] = useState('1')
  const [L, setL] = useState('1')
  const [C, setC] = useState('1')
  return (
    <Panel title="RLC serie">
      <div className="grid gap-3 sm:grid-cols-3">
        <NumField label="R" unit="Ω" value={R} onChange={setR} />
        <NumField label="L" unit="H" value={L} onChange={setL} />
        <NumField label="C" unit="F" value={C} onChange={setC} />
      </div>
      <Button className="mt-3" variant="primary" onClick={() => go('rlc', () => seriesRlc(parseNum(R), parseNum(L), parseNum(C)))}>Calcular</Button>
    </Panel>
  )
}

function Power({ go }: { go: (label: string, fn: () => CircuitOut) => void }) {
  const [freq, setFreq] = useState('50')
  const [rows, setRows] = useState<PowerElement[]>([{ kind: 'R', value: 10, current: 2 }, { kind: 'L', value: 0.1, current: 2 }])
  const set = (i: number, patch: Partial<PowerElement>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <Panel title="Potencia en cada elemento">
      <NumField label="Frecuencia" unit="Hz" value={freq} onChange={setFreq} />
      <div className="mt-3 flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[6rem_1fr_1fr] gap-2">
            <Select value={r.kind} aria-label={`Tipo ${i + 1}`} onChange={(e) => set(i, { kind: e.target.value as PowerElement['kind'] })}><option>R</option><option>L</option><option>C</option></Select>
            <Input inputMode="decimal" aria-label={`Valor ${i + 1}`} value={String(r.value)} onChange={(e) => set(i, { value: parseNum(e.target.value) })} />
            <Input inputMode="decimal" aria-label={`Corriente ${i + 1}`} value={String(r.current)} onChange={(e) => set(i, { current: parseNum(e.target.value) })} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => setRows([...rows, { kind: 'C', value: 1e-4, current: 2 }])}>Agregar</Button>
        <Button variant="primary" onClick={() => go('potencia', () => elementPower(rows, parseNum(freq)))}>Calcular</Button>
      </div>
    </Panel>
  )
}
