import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  EntropyInputError,
  heatingEntropy,
  idealGasEntropy,
  isothermalReversible,
  parseProbabilities,
  R_GAS,
  shannonEntropy,
  toKelvin,
  type EntropyResult,
  type TempUnit,
} from '@/lib/math/entropy'
import { Tex } from '@/components/Markdown'
import { ErrorText, Field, Panel, Select, Tabs, Textarea, Button } from '@/components/ui'
import { NumField, parseNum, ResultBox, SaveCalcButton } from './shared'

type Mode = 'isothermal' | 'gas' | 'heating' | 'shannon'

function TempUnitSelect({ value, onChange }: { value: TempUnit; onChange: (u: TempUnit) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as TempUnit)} className="h-9 w-20" aria-label="Unidad de temperatura">
      <option value="K">K</option>
      <option value="C">°C</option>
      <option value="F">°F</option>
    </Select>
  )
}

function compute<T>(fn: () => T): { result: T | null; error: string } {
  try {
    return { result: fn(), error: '' }
  } catch (e) {
    if (e instanceof EntropyInputError) return { result: null, error: e.message }
    throw e
  }
}

function PhysicalResult({ r, kind, input }: { r: EntropyResult; kind: string; input: string }) {
  const text = `${Number(r.value.toPrecision(6))} ${r.unit}`
  return (
    <div className="flex flex-col gap-3">
      <ResultBox>
        <p className="text-xs text-muted">Cambio de entropía del sistema</p>
        <p className="font-mono text-2xl tabular">ΔS = {Math.abs(r.value) >= 1e5 || (Math.abs(r.value) < 1e-3 && r.value !== 0) ? r.value.toExponential(5) : Number(r.value.toPrecision(6))} <span className="text-base text-muted">{r.unit}</span></p>
      </ResultBox>
      <div>
        <h3 className="mb-1 text-xs font-semibold text-muted uppercase">Pasos</h3>
        <ol className="flex flex-col gap-0.5 font-mono text-[13px] break-words">
          {r.steps.map((s) => <li key={s.label}><span className="text-muted">{s.label}:</span> {s.value}</li>)}
        </ol>
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold text-muted uppercase">Supuestos</h3>
        <ul className="list-disc pl-5 text-sm text-muted">{r.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      </div>
      <SaveCalcButton kind={kind} input={input} result={text} />
    </div>
  )
}

function Isothermal() {
  const [q, setQ] = useState('334000')
  const [t, setT] = useState('273.15')
  const [tu, setTu] = useState<TempUnit>('K')
  const { result, error } = compute(() => isothermalReversible(parseNum(q), toKelvin(parseNum(t), tu)))
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Tex block expr={String.raw`\Delta S = \frac{Q_{\mathrm{rev}}}{T}`} />
        <p className="text-sm text-muted">
          Solo para calor intercambiado <strong>reversiblemente</strong> a temperatura constante (p. ej., un cambio de fase en equilibrio o un gas ideal en expansión isotérmica cuasiestática). Para un proceso irreversible, ΔS no es el calor real dividido por T: calculalo por un camino reversible entre los mismos estados.
        </p>
        <NumField label="Calor reversible recibido por el sistema, Q" value={q} onChange={setQ} unit="J" hint="Q > 0 entra al sistema; Q < 0 sale." />
        <NumField label="Temperatura del sistema, T" value={t} onChange={setT} unit={<TempUnitSelect value={tu} onChange={setTu} />} />
        {tu !== 'K' && Number.isFinite(parseNum(t)) && <p className="text-xs text-muted">T = {toKelvin(parseNum(t), tu).toFixed(4)} K</p>}
      </div>
      <div>{error ? <ErrorText>{error}</ErrorText> : result && <PhysicalResult r={result} kind="entropy" input={`ΔS isotérmico: Q=${q} J, T=${t} ${tu}`} />}</div>
    </div>
  )
}

const GAS_PRESETS = [
  { id: 'mono', label: 'Monoatómico ideal (C_V = 3/2 R)', cv: 1.5 * R_GAS },
  { id: 'di', label: 'Diatómico ideal, T ambiente (C_V = 5/2 R)', cv: 2.5 * R_GAS },
  { id: 'custom', label: 'Personalizado', cv: NaN },
]

function IdealGas() {
  const [n, setN] = useState('1')
  const [preset, setPreset] = useState('mono')
  const [cv, setCv] = useState('')
  const [t1, setT1] = useState('300')
  const [t2, setT2] = useState('300')
  const [tu, setTu] = useState<TempUnit>('K')
  const [v1, setV1] = useState('1')
  const [v2, setV2] = useState('2')
  const cvValue = preset === 'custom' ? parseNum(cv) : GAS_PRESETS.find((p) => p.id === preset)!.cv
  const { result, error } = compute(() =>
    idealGasEntropy({ n: parseNum(n), cv: cvValue, t1: toKelvin(parseNum(t1), tu), t2: toKelvin(parseNum(t2), tu), v1: parseNum(v1), v2: parseNum(v2) }),
  )
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Tex block expr={String.raw`\Delta S = n C_V \ln\frac{T_2}{T_1} + n R \ln\frac{V_2}{V_1}`} />
        <NumField label="Cantidad de sustancia, n" value={n} onChange={setN} unit="mol" />
        <Field label="Capacidad calorífica molar a volumen constante">
          <Select value={preset} onChange={(e) => setPreset(e.target.value)}>{GAS_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
        </Field>
        {preset === 'custom' && <NumField label="C_V" value={cv} onChange={setCv} unit="J/(mol·K)" />}
        <div className="flex items-end gap-2">
          <NumField label="T₁" value={t1} onChange={setT1} />
          <NumField label="T₂" value={t2} onChange={setT2} />
          <TempUnitSelect value={tu} onChange={setTu} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="V₁" value={v1} onChange={setV1} hint="Misma unidad para ambos" />
          <NumField label="V₂" value={v2} onChange={setV2} />
        </div>
      </div>
      <div>{error ? <ErrorText>{error}</ErrorText> : result && <PhysicalResult r={result} kind="entropy" input={`ΔS gas ideal: n=${n}, Cv=${cvValue.toFixed(3)}, T ${t1}→${t2} ${tu}, V ${v1}→${v2}`} />}</div>
    </div>
  )
}

function Heating() {
  const [m, setM] = useState('1')
  const [c, setC] = useState('4186')
  const [t1, setT1] = useState('20')
  const [t2, setT2] = useState('80')
  const [tu, setTu] = useState<TempUnit>('C')
  const { result, error } = compute(() => heatingEntropy(parseNum(m), parseNum(c), toKelvin(parseNum(t1), tu), toKelvin(parseNum(t2), tu)))
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Tex block expr={String.raw`\Delta S = m\,c\,\ln\frac{T_2}{T_1}`} />
        <p className="text-sm text-muted">Calentamiento o enfriamiento sin cambio de fase, con calor específico constante. El logaritmo usa temperaturas absolutas.</p>
        <NumField label="Masa, m" value={m} onChange={setM} unit="kg" />
        <NumField label="Calor específico, c" value={c} onChange={setC} unit="J/(kg·K)" hint="Agua líquida ≈ 4186 J/(kg·K) (aprox., varía con T)" />
        <div className="flex items-end gap-2">
          <NumField label="T₁" value={t1} onChange={setT1} />
          <NumField label="T₂" value={t2} onChange={setT2} />
          <TempUnitSelect value={tu} onChange={setTu} />
        </div>
      </div>
      <div>{error ? <ErrorText>{error}</ErrorText> : result && <PhysicalResult r={result} kind="entropy" input={`ΔS calentamiento: m=${m} kg, c=${c}, T ${t1}→${t2} ${tu}`} />}</div>
    </div>
  )
}

function Shannon() {
  const [text, setText] = useState('0.5, 0.25, 0.125, 0.125')
  const { result, error } = useMemo(() => compute(() => shannonEntropy(parseProbabilities(text))), [text])
  const uniform = (n: number) => setText(Array.from({ length: n }, () => `1/${n}`).join(', '))
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Tex block expr={String.raw`H(X) = -\sum_i p_i \log_2 p_i`} />
        <p className="text-sm text-muted">Medida informacional (bits), no termodinámica. Ingresá probabilidades separadas por coma, espacio o punto y coma; se admiten fracciones como 1/3.</p>
        <Field label="Probabilidades p₁, p₂, …" hint="Cada una en [0, 1]; deben sumar 1 (tolerancia 10⁻⁶).">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="font-mono" />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => setText('0.5, 0.5')}>Moneda justa</Button>
          <Button size="sm" onClick={() => setText('0.9, 0.1')}>Moneda cargada</Button>
          <Button size="sm" onClick={() => uniform(6)}>Dado</Button>
          <Button size="sm" onClick={() => uniform(26)}>26 letras uniformes</Button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          result && (
            <>
              <ResultBox>
                <p className="text-xs text-muted">Entropía</p>
                <p className="font-mono text-2xl tabular">H = {result.bits.toFixed(6)} <span className="text-base text-muted">bits</span></p>
                <p className="font-mono text-xs text-muted">= {result.nats.toFixed(6)} nats · máximo log₂ {result.terms.length} = {result.maxBits.toFixed(4)} bits</p>
              </ResultBox>
              <p className="text-sm">{result.interpretation}</p>
              <div>
                <h3 className="mb-1 text-xs font-semibold text-muted uppercase">Contribución −pᵢ log₂ pᵢ</h3>
                <ul className="flex flex-col gap-1">
                  {result.terms.slice(0, 40).map((t, i) => (
                    <li key={i} className="grid grid-cols-[4rem_1fr_5rem] items-center gap-2 font-mono text-xs">
                      <span className="text-muted">p{i + 1}={Number(t.p.toPrecision(4))}</span>
                      <span className="h-2 rounded bg-accent/70" style={{ width: `${result.bits > 0 ? (t.contribution / result.bits) * 100 : 0}%` }} />
                      <span className="text-right">{t.contribution.toFixed(4)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <SaveCalcButton kind="entropy" input={`H(${text.slice(0, 120)})`} result={`${result.bits.toFixed(6)} bits`} />
            </>
          )
        )}
      </div>
    </div>
  )
}

export default function EntropyLab() {
  const [mode, setMode] = useState<Mode>('isothermal')
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={mode}
          onChange={setMode}
          items={[
            { id: 'isothermal', label: 'Isotérmico reversible' },
            { id: 'gas', label: 'Gas ideal' },
            { id: 'heating', label: 'Calentamiento' },
            { id: 'shannon', label: 'Shannon (información)' },
          ]}
        />
        <span className="text-xs text-muted">
          Ver <Link className="text-accent" to="/knowledge/c-entropia-termo">entropía termodinámica</Link> y <Link className="text-accent" to="/knowledge/c-entropia-shannon">entropía de Shannon</Link>.
        </span>
      </div>
      <Panel title={mode === 'shannon' ? 'Modelo informacional' : 'Modelo físico (termodinámica)'}>
        {mode === 'isothermal' && <Isothermal />}
        {mode === 'gas' && <IdealGas />}
        {mode === 'heating' && <Heating />}
        {mode === 'shannon' && <Shannon />}
      </Panel>
    </div>
  )
}
