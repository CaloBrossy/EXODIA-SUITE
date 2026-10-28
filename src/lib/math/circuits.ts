import { solveSystem } from './linear'
import { equivalentResistance, ohm } from './physics'

export class CircuitError extends Error {}

export type CircuitRow = { label: string; value: string; unit: string }
export type CircuitCurve = { y: (t: number) => number; tMax: number; x: string; yLabel: string; xUnit: string; yUnit: string }
export type CircuitOut = { latex: string[]; steps: string[]; rows: CircuitRow[]; curve?: CircuitCurve }

const fmt = (x: number) => {
  if (!Number.isFinite(x)) return '—'
  const a = Math.abs(x)
  if (a !== 0 && (a >= 1e6 || a < 1e-4)) return x.toExponential(4)
  return String(Number(x.toPrecision(12)))
}
const pos = (name: string, x: number) => {
  if (!Number.isFinite(x) || x <= 0) throw new CircuitError(`${name} debe ser un número positivo`)
}
const num = (name: string, x: number) => {
  if (!Number.isFinite(x)) throw new CircuitError(`${name} debe ser un número`)
}

function solved(A: number[][], b: number[], names: string[], unit: string): CircuitOut {
  const sol = solveSystem(A, b)
  if (sol.kind !== 'unique') throw new CircuitError('El sistema es singular: revisá la matriz o el circuito')
  const eqs = A.map((row, i) => `${row.map((c, j) => `${fmt(c)}\\,${names[j]}`).join(' + ')} = ${fmt(b[i]!)}`)
  return {
    latex: ['A\\,x = b', ...eqs.map((e) => e.replaceAll(' + -', ' - '))],
    steps: [
      'Se arma el sistema lineal con las leyes de Kirchhoff.',
      'Se resuelve por eliminación gaussiana con pivoteo parcial.',
      ...sol.x.map((v, i) => `${names[i]} = ${fmt(v)} ${unit}`),
    ],
    rows: sol.x.map((v, i) => ({ label: names[i]!, value: fmt(v), unit })),
  }
}

/** Divisor de tensión: R1 del lado de la fuente, R2 a la salida. */
export function voltageDivider(vin: number, r1: number, r2: number): CircuitOut {
  num('Vin', vin)
  pos('R1', r1)
  pos('R2', r2)
  const req = equivalentResistance([r1, r2], 'series')
  const i = vin / req
  const v1 = i * r1
  const v2 = i * r2
  return {
    latex: ['R_{eq} = R_1 + R_2', 'I = \\dfrac{V_{in}}{R_{eq}}', 'V_2 = V_{in}\\,\\dfrac{R_2}{R_1+R_2}'],
    steps: [`R_eq = ${fmt(r1)} + ${fmt(r2)} = ${fmt(req)} Ω`, `I = ${fmt(vin)} / ${fmt(req)} = ${fmt(i)} A`, `V_2 = ${fmt(i)} · ${fmt(r2)} = ${fmt(v2)} V`],
    rows: [
      { label: 'R_eq', value: fmt(req), unit: 'Ω' },
      { label: 'I', value: fmt(i), unit: 'A' },
      { label: 'V_1', value: fmt(v1), unit: 'V' },
      { label: 'V_2', value: fmt(v2), unit: 'V' },
    ],
  }
}

/** Divisor de corriente: I1 circula por R1. */
export function currentDivider(iin: number, r1: number, r2: number): CircuitOut {
  num('Iin', iin)
  pos('R1', r1)
  pos('R2', r2)
  const req = equivalentResistance([r1, r2], 'parallel')
  const i1 = iin * (r2 / (r1 + r2))
  const i2 = iin * (r1 / (r1 + r2))
  return {
    latex: ['\\dfrac{1}{R_{eq}} = \\dfrac{1}{R_1}+\\dfrac{1}{R_2}', 'I_1 = I_{in}\\,\\dfrac{R_2}{R_1+R_2}'],
    steps: [`R_eq = ${fmt(req)} Ω`, `I_1 = ${fmt(iin)} · ${fmt(r2)} / ${fmt(r1 + r2)} = ${fmt(i1)} A`],
    rows: [
      { label: 'R_eq', value: fmt(req), unit: 'Ω' },
      { label: 'I_1', value: fmt(i1), unit: 'A' },
      { label: 'I_2', value: fmt(i2), unit: 'A' },
    ],
  }
}

export function resistorBank(values: number[], mode: 'series' | 'parallel'): CircuitOut {
  const req = equivalentResistance(values, mode)
  return {
    latex: [mode === 'series' ? 'R_{eq} = \\sum_k R_k' : '\\dfrac{1}{R_{eq}} = \\sum_k \\dfrac{1}{R_k}'],
    steps: values.map((r, i) => `R_${i + 1} = ${fmt(r)} Ω`),
    rows: [{ label: 'R_eq', value: fmt(req), unit: 'Ω' }],
  }
}

/** Mallas o nodos: A es la matriz de resistencias o conductancias y b las fuentes. */
export function network(kind: 'mesh' | 'nodal', A: number[][], b: number[]): CircuitOut {
  const names = A.map((_, i) => (kind === 'mesh' ? `I_${i + 1}` : `V_${i + 1}`))
  const out = solved(A, b, names, kind === 'mesh' ? 'A' : 'V')
  out.latex.unshift(kind === 'mesh' ? 'R\\,I = V' : 'G\\,V = I')
  return out
}

/** Dos mallas con R1, R2 propias y Rs compartida. V2 entra con su signo de circulación. */
export function twoMesh(r1: number, r2: number, rs: number, v1: number, v2: number): CircuitOut {
  pos('R1', r1)
  pos('R2', r2)
  pos('Rs', rs)
  num('V1', v1)
  num('V2', v2)
  const out = network('mesh', [[r1 + rs, -rs], [-rs, r2 + rs]], [v1, v2])
  out.steps.unshift(`Malla 1: (${fmt(r1)}+${fmt(rs)}) I_1 − ${fmt(rs)} I_2 = ${fmt(v1)}`, `Malla 2: −${fmt(rs)} I_1 + (${fmt(r2)}+${fmt(rs)}) I_2 = ${fmt(v2)}`)
  return out
}

export function thevenin(voc: number, isc: number, rl?: number): CircuitOut {
  num('Voc', voc)
  num('Isc', isc)
  if (isc === 0) throw new CircuitError('Con Isc = 0 no se puede obtener Rth')
  const rth = voc / isc
  if (rth <= 0) throw new CircuitError('Rth resultó no positiva: revisá los signos de Voc e Isc')
  const rows: CircuitRow[] = [
    { label: 'V_th', value: fmt(voc), unit: 'V' },
    { label: 'R_th', value: fmt(rth), unit: 'Ω' },
    { label: 'I_N', value: fmt(isc), unit: 'A' },
  ]
  const steps = [`R_th = V_oc / I_sc = ${fmt(voc)} / ${fmt(isc)} = ${fmt(rth)} Ω`, `Norton: I_N = I_sc = ${fmt(isc)} A`]
  if (rl != null && Number.isFinite(rl)) {
    pos('RL', rl)
    const v = ohm(voc, NaN, rth + rl)
    const il = v.I
    const vl = il * rl
    rows.push({ label: 'V_L', value: fmt(vl), unit: 'V' }, { label: 'I_L', value: fmt(il), unit: 'A' })
    steps.push(`Con R_L: I_L = V_th / (R_th + R_L) = ${fmt(il)} A`)
  }
  return { latex: ['V_{th} = V_{oc}', 'R_{th} = \\dfrac{V_{oc}}{I_{sc}}', 'I_N = \\dfrac{V_{th}}{R_{th}}'], steps, rows }
}

export function transient(kind: 'rc' | 'rl', R: number, storage: number, initial: number, final: number, t: number): CircuitOut {
  pos('R', R)
  pos(kind === 'rc' ? 'C' : 'L', storage)
  num('inicial', initial)
  num('final', final)
  num('t', t)
  if (t < 0) throw new CircuitError('t no puede ser negativo')
  const tau = kind === 'rc' ? R * storage : storage / R
  const y = final + (initial - final) * Math.exp(-t / tau)
  const label = kind === 'rc' ? 'v(t)' : 'i(t)'
  const unit = kind === 'rc' ? 'V' : 'A'
  const fn = (tt: number) => final + (initial - final) * Math.exp(-tt / tau)
  return {
    latex: [kind === 'rc' ? '\\tau = RC' : '\\tau = L/R', 'y(t) = y_\\infty + (y_0 - y_\\infty)\\,e^{-t/\\tau}'],
    steps: [`τ = ${fmt(tau)} s`, `${label}(${fmt(t)}) = ${fmt(y)} ${unit}`],
    rows: [
      { label: 'τ', value: fmt(tau), unit: 's' },
      { label, value: fmt(y), unit },
    ],
    curve: { y: fn, tMax: Math.max(5 * tau, t), x: 't', yLabel: label, xUnit: 's', yUnit: unit },
  }
}

export function seriesRlc(R: number, L: number, C: number): CircuitOut {
  pos('R', R)
  pos('L', L)
  pos('C', C)
  const w0 = 1 / Math.sqrt(L * C)
  const f0 = w0 / (2 * Math.PI)
  const alpha = R / (2 * L)
  const q = (w0 * L) / R
  const disc = w0 * w0 - alpha * alpha
  const kind = Math.abs(disc) <= 1e-9 * w0 * w0 ? 'crítico' : disc > 0 ? 'subamortiguado' : 'sobreamortiguado'
  const wd = disc > 0 ? Math.sqrt(disc) : 0
  const fn = (t: number) => {
    const e = Math.exp(-alpha * t)
    if (kind === 'subamortiguado') return e * Math.cos(wd * t)
    if (kind === 'crítico') return e * (1 + alpha * t)
    const s = Math.sqrt(-disc)
    return e * (Math.cosh(s * t) - (alpha / s) * Math.sinh(s * t))
  }
  return {
    latex: ['\\omega_0 = \\dfrac{1}{\\sqrt{LC}}', 'Q = \\dfrac{\\omega_0 L}{R}', '\\alpha = \\dfrac{R}{2L}'],
    steps: [`ω0 = ${fmt(w0)} rad/s`, `f0 = ${fmt(f0)} Hz`, `Q = ${fmt(q)}`, `α = ${fmt(alpha)} → ${kind}`],
    rows: [
      { label: 'f_0', value: fmt(f0), unit: 'Hz' },
      { label: 'ω_0', value: fmt(w0), unit: 'rad/s' },
      { label: 'Q', value: fmt(q), unit: '' },
      { label: 'α', value: fmt(alpha), unit: '1/s' },
      { label: 'amortiguamiento', value: kind, unit: '' },
    ],
    curve: { y: fn, tMax: Math.max(8 / alpha, 0.05), x: 't', yLabel: 'v_C(t)/v_C(0)', xUnit: 's', yUnit: '' },
  }
}

export type PowerElement = { kind: 'R' | 'L' | 'C'; value: number; current: number }

/** Potencia en cada elemento. En R reutiliza la ley de Ohm; L y C solo intercambian potencia reactiva. */
export function elementPower(els: PowerElement[], freqHz: number): CircuitOut {
  if (!els.length) throw new CircuitError('Agregá al menos un elemento')
  if (!Number.isFinite(freqHz) || freqHz < 0) throw new CircuitError('La frecuencia debe ser ≥ 0')
  const w = 2 * Math.PI * freqHz
  const rows: CircuitRow[] = []
  const steps: string[] = []
  let p = 0
  let q = 0
  els.forEach((el, i) => {
    pos(el.kind, el.value)
    num('I', el.current)
    const n = i + 1
    if (el.kind === 'R') {
      const o = ohm(NaN, el.current, el.value)
      p += o.P
      rows.push({ label: `P_${n}`, value: fmt(o.P), unit: 'W' })
      steps.push(`R${n}: P = I·V = ${fmt(o.P)} W (V = ${fmt(o.V)} V)`)
      return
    }
    if (freqHz === 0) throw new CircuitError('Para L o C indicá una frecuencia mayor que 0')
    const x = el.kind === 'L' ? w * el.value : 1 / (w * el.value)
    const qi = el.kind === 'L' ? el.current ** 2 * x : -(el.current ** 2 * x)
    q += qi
    rows.push({ label: `Q_${n}`, value: fmt(qi), unit: 'var' })
    steps.push(`${el.kind}${n}: P = 0, Q = ${fmt(qi)} var`)
  })
  rows.push({ label: 'P', value: fmt(p), unit: 'W' }, { label: 'Q', value: fmt(q), unit: 'var' })
  return { latex: ['P_R = I^{2} R', 'Q_L = I^{2}\\,\\omega L', 'Q_C = -\\dfrac{I^{2}}{\\omega C}'], steps, rows }
}

export function parseMatrix(text: string): number[][] {
  const rows = text.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[\s,;]+/).map(Number))
  if (!rows.length || rows.some((r) => r.length !== rows.length || r.some((v) => !Number.isFinite(v)))) {
    throw new CircuitError('La matriz debe ser cuadrada, con números separados por espacio')
  }
  return rows
}

export function parseVector(text: string, n: number): number[] {
  const v = text.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean).map(Number)
  if (v.length !== n || v.some((x) => !Number.isFinite(x))) throw new CircuitError(`El vector de fuentes debe tener ${n} números`)
  return v
}
