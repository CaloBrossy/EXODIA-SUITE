import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  collision1D,
  energyConservation,
  equivalentResistance,
  G_STANDARD,
  hydrogenLevel,
  hydrogenTransition,
  idealGasLaw,
  inclinedPlane,
  mruv,
  ohm,
  PhysicsInputError,
  projectile,
  type GasVar,
} from '@/lib/math/physics'
import { ATOMIC_MODELS, BOSONS, CONSTANTS, LEPTONS, PHYSICS_THEORIES, QUARKS, type Particle, type PhysicsModel } from '@/lib/physicsData'
import { toKelvin, type TempUnit } from '@/lib/math/entropy'
import { Tex } from '@/components/Markdown'
import { ErrorText, Input, Panel, Select, Tabs } from '@/components/ui'
import { EntropyTool, TempUnitSelect } from './EntropyLab'
import { NumField, parseNum, ResultBox, SaveCalcButton } from './shared'

const fmt = (x: number) => {
  if (!Number.isFinite(x)) return '—'
  if (x === 0) return '0'
  return Math.abs(x) >= 1e6 || Math.abs(x) < 1e-3 ? x.toExponential(4) : Number(x.toPrecision(6)).toString()
}

function attempt<T>(fn: () => T): { r: T | null; error: string } {
  try {
    return { r: fn(), error: '' }
  } catch (e) {
    if (e instanceof PhysicsInputError) return { r: null, error: e.message }
    throw e
  }
}

function Results({ rows, kind, input }: { rows: [string, string][]; kind: string; input: string }) {
  return (
    <div className="flex flex-col gap-3">
      <ResultBox>
        <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </ResultBox>
      <SaveCalcButton kind={kind} input={input} result={rows.map(([k, v]) => `${k} = ${v}`).join('; ')} />
    </div>
  )
}

function Layout({ form, out }: { form: ReactNode; out: ReactNode }) {
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">{form}</div>
      <div>{out}</div>
    </div>
  )
}

/* ───────── Cinemática ───────── */

function Mruv() {
  const [x0, setX0] = useState('0')
  const [v0, setV0] = useState('10')
  const [a, setA] = useState('2')
  const [t, setT] = useState('5')
  const { r, error } = attempt(() => mruv(parseNum(x0), parseNum(v0), parseNum(a), parseNum(t)))
  return (
    <Layout
      form={<>
        <Tex block expr={String.raw`x = x_0 + v_0 t + \tfrac12 a t^2 \qquad v = v_0 + a t`} />
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Posición inicial x₀" value={x0} onChange={setX0} unit="m" />
          <NumField label="Velocidad inicial v₀" value={v0} onChange={setV0} unit="m/s" />
          <NumField label="Aceleración a" value={a} onChange={setA} unit="m/s²" hint="a = 0 → MRU" />
          <NumField label="Tiempo t" value={t} onChange={setT} unit="s" />
        </div>
      </>}
      out={error ? <ErrorText>{error}</ErrorText> : r && <Results kind="física" input={`MRUV x0=${x0} v0=${v0} a=${a} t=${t}`} rows={[['x(t)', `${fmt(r.x)} m`], ['v(t)', `${fmt(r.v)} m/s`], ['Δx', `${fmt(r.x - parseNum(x0))} m`]]} />}
    />
  )
}

function Projectile() {
  const [v0, setV0] = useState('20')
  const [ang, setAng] = useState('45')
  const [h0, setH0] = useState('0')
  const [g, setG] = useState(String(G_STANDARD))
  const { r, error } = attempt(() => projectile(parseNum(v0), parseNum(ang), parseNum(h0), parseNum(g)))
  return (
    <Layout
      form={<>
        <Tex block expr={String.raw`x = v_0\cos\theta\,t \qquad y = h_0 + v_0\sin\theta\,t - \tfrac12 g t^2`} />
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Rapidez inicial v₀" value={v0} onChange={setV0} unit="m/s" />
          <NumField label="Ángulo θ" value={ang} onChange={setAng} unit="°" hint="Sobre la horizontal" />
          <NumField label="Altura inicial h₀" value={h0} onChange={setH0} unit="m" />
          <NumField label="Gravedad g" value={g} onChange={setG} unit="m/s²" />
        </div>
        <p className="text-xs text-muted">Sin rozamiento con el aire; el vuelo termina al volver a y = 0.</p>
      </>}
      out={error ? <ErrorText>{error}</ErrorText> : r && <Results kind="física" input={`Tiro oblicuo v0=${v0} θ=${ang}° h0=${h0}`} rows={[
        ['vₓ, v_y₀', `${fmt(r.vx)}, ${fmt(r.vy)} m/s`],
        ['Tiempo de vuelo', `${fmt(r.tFlight)} s`],
        ['Alcance', `${fmt(r.range)} m`],
        ['Altura máxima', `${fmt(r.hMax)} m (t = ${fmt(r.tApex)} s)`],
        ['Rapidez de impacto', `${fmt(r.impactSpeed)} m/s`],
      ]} />}
    />
  )
}

/* ───────── Dinámica ───────── */

function Incline() {
  const [m, setM] = useState('5')
  const [ang, setAng] = useState('30')
  const [ms, setMs] = useState('0.4')
  const [mk, setMk] = useState('0.3')
  const { r, error } = attempt(() => inclinedPlane(parseNum(m), parseNum(ang), parseNum(ms), parseNum(mk)))
  return (
    <Layout
      form={<>
        <Tex block expr={String.raw`N = mg\cos\theta \qquad a = g(\sin\theta - \mu_k\cos\theta)`} />
        <p className="text-sm text-muted">Segunda ley de Newton sobre un plano inclinado. El bloque parte del reposo: si mg sen θ ≤ μs N, la fricción estática lo sostiene.</p>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Masa m" value={m} onChange={setM} unit="kg" />
          <NumField label="Inclinación θ" value={ang} onChange={setAng} unit="°" />
          <NumField label="Coef. estático μs" value={ms} onChange={setMs} />
          <NumField label="Coef. cinético μk" value={mk} onChange={setMk} />
        </div>
        <p className="text-xs text-muted">g = {G_STANDARD} m/s². Ángulo crítico: θc = arctan μs = {fmt((Math.atan(parseNum(ms)) * 180) / Math.PI)}°.</p>
      </>}
      out={error ? <ErrorText>{error}</ErrorText> : r && <Results kind="física" input={`Plano inclinado m=${m} θ=${ang}° μs=${ms} μk=${mk}`} rows={[
        ['Peso mg', `${fmt(r.weight)} N`],
        ['Normal N', `${fmt(r.normal)} N`],
        ['mg sen θ', `${fmt(r.parallel)} N`],
        [r.moves ? 'Fricción cinética' : 'Fricción estática', `${fmt(r.friction)} N`],
        ['Estado', r.moves ? 'Desliza' : 'En reposo'],
        ['Aceleración', `${fmt(r.a)} m/s²`],
      ]} />}
    />
  )
}

/* ───────── Energía y choques ───────── */

function Energy() {
  const [m, setM] = useState('2')
  const [v1, setV1] = useState('0')
  const [h1, setH1] = useState('10')
  const [h2, setH2] = useState('0')
  const { r, error } = attempt(() => energyConservation(parseNum(m), parseNum(v1), parseNum(h1), parseNum(h2)))
  return (
    <Layout
      form={<>
        <Tex block expr={String.raw`\tfrac12 m v_1^2 + m g h_1 = \tfrac12 m v_2^2 + m g h_2`} />
        <p className="text-sm text-muted">Conservación de la energía mecánica: solo fuerzas conservativas (sin rozamiento).</p>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Masa m" value={m} onChange={setM} unit="kg" />
          <NumField label="Rapidez inicial v₁" value={v1} onChange={setV1} unit="m/s" />
          <NumField label="Altura inicial h₁" value={h1} onChange={setH1} unit="m" />
          <NumField label="Altura final h₂" value={h2} onChange={setH2} unit="m" />
        </div>
      </>}
      out={error ? <ErrorText>{error}</ErrorText> : r && <Results kind="física" input={`Energía m=${m} v1=${v1} h ${h1}→${h2}`} rows={[
        ['K₁', `${fmt(r.k1)} J`],
        ['U₁', `${fmt(r.u1)} J`],
        ['E mecánica', `${fmt(r.total)} J`],
        ['U₂', `${fmt(r.u2)} J`],
        ['K₂', `${fmt(r.k2)} J`],
        ['v₂', `${fmt(r.v2)} m/s`],
      ]} />}
    />
  )
}

function Collision() {
  const [m1, setM1] = useState('2')
  const [v1, setV1] = useState('3')
  const [m2, setM2] = useState('1')
  const [v2, setV2] = useState('0')
  const [e, setE] = useState('1')
  const { r, error } = attempt(() => collision1D(parseNum(m1), parseNum(v1), parseNum(m2), parseNum(v2), parseNum(e)))
  return (
    <Layout
      form={<>
        <Tex block expr={String.raw`m_1v_1 + m_2v_2 = m_1v_1' + m_2v_2' \qquad e = \frac{v_2' - v_1'}{v_1 - v_2}`} />
        <div className="grid grid-cols-2 gap-2">
          <NumField label="m₁" value={m1} onChange={setM1} unit="kg" />
          <NumField label="v₁" value={v1} onChange={setV1} unit="m/s" />
          <NumField label="m₂" value={m2} onChange={setM2} unit="kg" />
          <NumField label="v₂" value={v2} onChange={setV2} unit="m/s" />
        </div>
        <NumField label="Coeficiente de restitución e" value={e} onChange={setE} hint="1 = elástico · 0 = perfectamente inelástico (quedan unidos)" />
        <p className="text-xs text-muted">Choque en una dimensión: el signo de v indica el sentido.</p>
      </>}
      out={error ? <ErrorText>{error}</ErrorText> : r && <Results kind="física" input={`Choque m1=${m1} v1=${v1} m2=${m2} v2=${v2} e=${e}`} rows={[
        ["v₁'", `${fmt(r.u1)} m/s`],
        ["v₂'", `${fmt(r.u2)} m/s`],
        ['Momento total p', `${fmt(r.p)} kg·m/s (se conserva)`],
        ['K antes → después', `${fmt(r.kBefore)} → ${fmt(r.kAfter)} J`],
        ['Energía disipada', `${fmt(r.kLost)} J`],
      ]} />}
    />
  )
}

/* ───────── Circuitos ───────── */

function Ohm() {
  const [v, setV] = useState('12')
  const [i, setI] = useState('')
  const [rr, setR] = useState('220')
  const { r, error } = attempt(() => ohm(parseNum(v), parseNum(i), parseNum(rr)))
  return (
    <Layout
      form={<>
        <Tex block expr={String.raw`V = I\,R \qquad P = V\,I = I^2R = \frac{V^2}{R}`} />
        <p className="text-sm text-muted">Dejá vacío el valor que quieras calcular.</p>
        <div className="grid grid-cols-3 gap-2">
          <NumField label="Tensión V" value={v} onChange={setV} unit="V" />
          <NumField label="Corriente I" value={i} onChange={setI} unit="A" />
          <NumField label="Resistencia R" value={rr} onChange={setR} unit="Ω" />
        </div>
      </>}
      out={error ? <ErrorText>{error}</ErrorText> : r && <Results kind="física" input={`Ohm V=${v || '?'} I=${i || '?'} R=${rr || '?'}`} rows={[['V', `${fmt(r.V)} V`], ['I', `${fmt(r.I)} A = ${fmt(r.I * 1000)} mA`], ['R', `${fmt(r.R)} Ω`], ['P', `${fmt(r.P)} W`]]} />}
    />
  )
}

function Resistors() {
  const [list, setList] = useState('100, 220, 330')
  const values = list.split(/[;,\s]+/).filter(Boolean).map(parseNum)
  const s = attempt(() => equivalentResistance(values, 'series'))
  const p = attempt(() => equivalentResistance(values, 'parallel'))
  return (
    <Layout
      form={<>
        <Tex block expr={String.raw`R_s = \sum R_i \qquad \frac{1}{R_p} = \sum \frac{1}{R_i}`} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Resistencias (Ω), separadas por coma</span>
          <Input value={list} onChange={(e) => setList(e.target.value)} className="font-mono" />
        </label>
      </>}
      out={s.error ? <ErrorText>{s.error}</ErrorText> : <Results kind="física" input={`Resistencias ${list}`} rows={[['Serie', `${fmt(s.r!)} Ω`], ['Paralelo', `${fmt(p.r!)} Ω`]]} />}
    />
  )
}

/* ───────── Gases ───────── */

function Gases() {
  const [unknown, setUnknown] = useState<GasVar>('V')
  const [P, setP] = useState('101325')
  const [V, setV] = useState('')
  const [n, setN] = useState('1')
  const [T, setT] = useState('0')
  const [tu, setTu] = useState<TempUnit>('C')
  const tK = toKelvin(parseNum(T), tu)
  const { r, error } = attempt(() => idealGasLaw({ P: parseNum(P), V: parseNum(V), n: parseNum(n), T: tK }, unknown))
  const field = (k: GasVar, label: string, value: string, set: (s: string) => void, unit: ReactNode) =>
    k === unknown ? null : <NumField key={k} label={label} value={value} onChange={set} unit={unit} />
  return (
    <Layout
      form={<>
        <Tex block expr={String.raw`P\,V = n\,R\,T`} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Calcular</span>
          <Select value={unknown} onChange={(e) => setUnknown(e.target.value as GasVar)}>
            <option value="P">Presión P</option>
            <option value="V">Volumen V</option>
            <option value="n">Cantidad n</option>
            <option value="T">Temperatura T</option>
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {field('P', 'Presión P', P, setP, 'Pa')}
          {field('V', 'Volumen V', V, setV, 'm³')}
          {field('n', 'Cantidad n', n, setN, 'mol')}
          {field('T', 'Temperatura T', T, setT, <TempUnitSelect value={tu} onChange={setTu} />)}
        </div>
        <p className="text-xs text-muted">1 atm = 101 325 Pa · 1 L = 10⁻³ m³ · R = 8.314462618 J/(mol·K).</p>
      </>}
      out={error ? <ErrorText>{error}</ErrorText> : r && <Results kind="física" input={`PV=nRT, incógnita ${unknown}`} rows={[
        ['P', `${fmt(r.P)} Pa = ${fmt(r.P / 101325)} atm`],
        ['V', `${fmt(r.V)} m³ = ${fmt(r.V * 1000)} L`],
        ['n', `${fmt(r.n)} mol`],
        ['T', `${fmt(r.T)} K = ${fmt(r.T - 273.15)} °C`],
      ]} />}
    />
  )
}

/* ───────── Átomo, partículas, modelos, constantes ───────── */

function Bohr() {
  const [lo, setLo] = useState('2')
  const [hi, setHi] = useState('3')
  const { r, error } = attempt(() => hydrogenTransition(parseNum(lo), parseNum(hi)))
  return (
    <Layout
      form={<>
        <Tex block expr={String.raw`E_n = -\frac{13.6\ \text{eV}}{n^2} \qquad \frac{1}{\lambda} = R_H\left(\frac{1}{n_1^2} - \frac{1}{n_2^2}\right)`} />
        <p className="text-sm text-muted">Transición del electrón del hidrógeno entre dos niveles (modelo de Bohr, con masa reducida).</p>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Nivel inferior n₁" value={lo} onChange={setLo} />
          <NumField label="Nivel superior n₂" value={hi} onChange={setHi} />
        </div>
        <ul className="font-mono text-xs text-muted">
          {[1, 2, 3, 4, 5].map((k) => <li key={k}>E{k} = {fmt(hydrogenLevel(k))} eV</li>)}
        </ul>
      </>}
      out={error ? <ErrorText>{error}</ErrorText> : r && <Results kind="física" input={`Hidrógeno n=${hi}→${lo}`} rows={[
        ['Serie', r.series],
        ['λ (vacío)', `${fmt(r.lambdaNm)} nm`],
        ['Región', r.region],
        ['Energía del fotón', `${fmt(r.energyEv)} eV`],
        ['Frecuencia', `${fmt(r.frequencyHz)} Hz`],
      ]} />}
    />
  )
}

function ModelCards({ items }: { items: PhysicsModel[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((m) => (
        <li key={m.name} className="rounded-md border border-line p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium">{m.name}</h3>
            <span className="font-mono text-xs text-muted">{m.year} · {m.authors}</span>
          </div>
          <p className="mt-1 text-sm">{m.idea}</p>
          <p className="mt-1 text-sm"><span className="text-muted">Explica:</span> {m.explains}</p>
          <p className="mt-1 text-sm"><span className="text-muted">Límites:</span> {m.limits}</p>
        </li>
      ))}
    </ol>
  )
}

function ParticleTable({ title, items }: { title: string; items: Particle[] }) {
  return (
    <div className="overflow-x-auto">
      <h3 className="mb-1.5 text-xs font-semibold text-muted uppercase">{title}</h3>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr><th className="py-1 pr-3">Partícula</th><th className="pr-3">Carga (e)</th><th className="pr-3">Masa</th><th className="pr-3">Espín</th><th className="pr-3">Gen.</th><th>Notas</th></tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.symbol} className="border-t border-line align-top">
              <td className="py-1.5 pr-3"><span className="font-mono">{p.symbol}</span> {p.name}</td>
              <td className="pr-3 font-mono">{p.charge}</td>
              <td className="pr-3 font-mono whitespace-nowrap">{p.mass}</td>
              <td className="pr-3 font-mono">{p.spin}</td>
              <td className="pr-3 font-mono">{p.generation ?? '—'}</td>
              <td className="text-muted">{p.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Particles() {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        Modelo estándar. Los quarks tienen carga de color y nunca se observan aislados (confinamiento): forman hadrones como el protón (uud, carga +1) y el neutrón (udd, carga 0). Masas: PDG 2024, aproximadas. Más teoría en <Link className="text-accent" to="/knowledge/c-particulas">Knowledge Lab</Link>.
      </p>
      <ParticleTable title="Quarks (fermiones)" items={QUARKS} />
      <ParticleTable title="Leptones (fermiones)" items={LEPTONS} />
      <ParticleTable title="Bosones" items={BOSONS} />
    </div>
  )
}

function Constants() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted"><tr><th className="py-1 pr-3">Constante</th><th className="pr-3">Símbolo</th><th className="pr-3">Valor</th><th>Unidad</th></tr></thead>
        <tbody>
          {CONSTANTS.map((c) => (
            <tr key={c.symbol} className="border-t border-line">
              <td className="py-1.5 pr-3">{c.name}</td>
              <td className="pr-3 font-mono">{c.symbol}</td>
              <td className="pr-3 font-mono whitespace-nowrap">{c.value}{c.exact && <span className="ml-1.5 text-xs text-accent">exacta</span>}</td>
              <td className="font-mono text-muted">{c.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">CODATA 2022. «Exacta»: fijada por definición del SI (2019) o derivada solo de constantes exactas.</p>
    </div>
  )
}

/* ───────── Página ───────── */

const SECTIONS = [
  { id: 'entropy', label: 'Entropía' },
  { id: 'kinematics', label: 'Cinemática' },
  { id: 'dynamics', label: 'Dinámica' },
  { id: 'energy', label: 'Energía y choques' },
  { id: 'circuits', label: 'Circuitos' },
  { id: 'gases', label: 'Gases ideales' },
  { id: 'atom', label: 'Átomo' },
  { id: 'particles', label: 'Partículas' },
  { id: 'models', label: 'Modelos y teorías' },
  { id: 'constants', label: 'Constantes' },
] as const
type Section = (typeof SECTIONS)[number]['id']

function Pair({ a, b, la, lb }: { a: ReactNode; b: ReactNode; la: string; lb: string }) {
  const [v, setV] = useState<'a' | 'b'>('a')
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={v} onChange={setV} items={[{ id: 'a', label: la }, { id: 'b', label: lb }]} />
      {v === 'a' ? a : b}
    </div>
  )
}

export default function PhysicsLab() {
  const [params, setParams] = useSearchParams()
  const t = params.get('t')
  const section: Section = SECTIONS.some((s) => s.id === t) ? (t as Section) : 'entropy'
  const title = SECTIONS.find((s) => s.id === section)!.label
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={section} onChange={(id) => setParams({ t: id }, { replace: true })} items={[...SECTIONS]} />
      <Panel title={title}>
        {section === 'entropy' && <EntropyTool />}
        {section === 'kinematics' && <Pair la="MRU / MRUV" lb="Tiro oblicuo" a={<Mruv />} b={<Projectile />} />}
        {section === 'dynamics' && <Incline />}
        {section === 'energy' && <Pair la="Conservación de la energía" lb="Choques 1D" a={<Energy />} b={<Collision />} />}
        {section === 'circuits' && <Pair la="Ley de Ohm" lb="Resistencias equivalentes" a={<Ohm />} b={<Resistors />} />}
        {section === 'gases' && <Gases />}
        {section === 'atom' && <Pair la="Hidrógeno (Bohr)" lb="Modelos atómicos" a={<Bohr />} b={<ModelCards items={ATOMIC_MODELS} />} />}
        {section === 'particles' && <Particles />}
        {section === 'models' && <ModelCards items={PHYSICS_THEORIES} />}
        {section === 'constants' && <Constants />}
      </Panel>
    </div>
  )
}
