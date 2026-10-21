/** Constante de los gases ideales, J/(mol·K) (CODATA, exacta como N_A·k_B). */
export const R_GAS = 8.314462618
/** Constante de Boltzmann, J/K (exacta en el SI desde 2019). */
export const K_B = 1.380649e-23

export class EntropyInputError extends Error {}

export interface Step {
  label: string
  value: string
}
export interface EntropyResult {
  value: number
  unit: string
  steps: Step[]
  assumptions: string[]
}

const fmt = (x: number) => (Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(4) : Number(x.toPrecision(6)).toString())

function requireFinite(name: string, v: number): void {
  if (!Number.isFinite(v)) throw new EntropyInputError(`${name}: ingresá un número válido`)
}
function requireAbsoluteTemp(name: string, kelvin: number): void {
  requireFinite(name, kelvin)
  if (kelvin <= 0) throw new EntropyInputError(`${name} debe ser una temperatura absoluta mayor que 0 K`)
}

export type TempUnit = 'K' | 'C' | 'F'
export function toKelvin(value: number, unit: TempUnit): number {
  if (unit === 'K') return value
  if (unit === 'C') return value + 273.15
  return (value - 32) * (5 / 9) + 273.15
}

/** ΔS = Q_rev / T, proceso isotérmico reversible. Q > 0: calor que entra al sistema. */
export function isothermalReversible(qJoule: number, tKelvin: number): EntropyResult {
  requireFinite('Q', qJoule)
  requireAbsoluteTemp('T', tKelvin)
  const value = qJoule / tKelvin
  return {
    value,
    unit: 'J/K',
    steps: [
      { label: 'Fórmula', value: 'ΔS = Q_rev / T' },
      { label: 'Sustitución', value: `ΔS = ${fmt(qJoule)} J / ${fmt(tKelvin)} K` },
      { label: 'Resultado', value: `ΔS = ${fmt(value)} J/K` },
    ],
    assumptions: [
      'El calor se intercambia de forma reversible.',
      'La temperatura del sistema es constante durante el proceso.',
      'Q > 0 indica calor recibido por el sistema; Q < 0, calor cedido.',
    ],
  }
}

export interface IdealGasInput {
  n: number
  /** Capacidad calorífica molar a volumen constante, J/(mol·K). */
  cv: number
  t1: number
  t2: number
  v1: number
  v2: number
}

/** ΔS = n Cv ln(T2/T1) + n R ln(V2/V1), gas ideal con Cv constante. */
export function idealGasEntropy({ n, cv, t1, t2, v1, v2 }: IdealGasInput): EntropyResult {
  requireFinite('n', n)
  if (n <= 0) throw new EntropyInputError('n debe ser mayor que 0 mol')
  requireFinite('C_V', cv)
  if (cv <= 0) throw new EntropyInputError('C_V debe ser positiva')
  requireAbsoluteTemp('T₁', t1)
  requireAbsoluteTemp('T₂', t2)
  requireFinite('V₁', v1)
  requireFinite('V₂', v2)
  if (v1 <= 0 || v2 <= 0) throw new EntropyInputError('Los volúmenes deben ser positivos')
  const thermal = n * cv * Math.log(t2 / t1)
  const volumetric = n * R_GAS * Math.log(v2 / v1)
  const value = thermal + volumetric
  return {
    value,
    unit: 'J/K',
    steps: [
      { label: 'Fórmula', value: 'ΔS = n·C_V·ln(T₂/T₁) + n·R·ln(V₂/V₁)' },
      { label: 'Término térmico', value: `${fmt(n)}·${fmt(cv)}·ln(${fmt(t2)}/${fmt(t1)}) = ${fmt(thermal)} J/K` },
      { label: 'Término de volumen', value: `${fmt(n)}·${R_GAS}·ln(${fmt(v2)}/${fmt(v1)}) = ${fmt(volumetric)} J/K` },
      { label: 'Resultado', value: `ΔS = ${fmt(value)} J/K` },
    ],
    assumptions: [
      'Gas ideal.',
      'C_V constante en el intervalo de temperaturas.',
      'Estados inicial y final de equilibrio; al ser S función de estado, el resultado no depende del camino (vale también para procesos irreversibles entre esos estados).',
      'V₁ y V₂ en la misma unidad (solo importa el cociente).',
    ],
  }
}

/** ΔS = m c ln(T2/T1): calentamiento sin cambio de fase con calor específico constante. */
export function heatingEntropy(massKg: number, cJkgK: number, t1: number, t2: number): EntropyResult {
  requireFinite('m', massKg)
  if (massKg <= 0) throw new EntropyInputError('m debe ser mayor que 0 kg')
  requireFinite('c', cJkgK)
  if (cJkgK <= 0) throw new EntropyInputError('c debe ser positivo')
  requireAbsoluteTemp('T₁', t1)
  requireAbsoluteTemp('T₂', t2)
  const value = massKg * cJkgK * Math.log(t2 / t1)
  return {
    value,
    unit: 'J/K',
    steps: [
      { label: 'Fórmula', value: 'ΔS = m·c·ln(T₂/T₁)' },
      { label: 'Sustitución', value: `ΔS = ${fmt(massKg)}·${fmt(cJkgK)}·ln(${fmt(t2)}/${fmt(t1)})` },
      { label: 'Resultado', value: `ΔS = ${fmt(value)} J/K` },
    ],
    assumptions: [
      'Calor específico c constante en el intervalo.',
      'Sin cambios de fase entre T₁ y T₂.',
      'Proceso a presión (o volumen) constante, con c correspondiente.',
    ],
  }
}

export const SHANNON_TOLERANCE = 1e-6

export interface ShannonResult {
  bits: number
  nats: number
  maxBits: number
  /** H / log2(n); 1 = distribución uniforme. */
  efficiency: number
  terms: { p: number; contribution: number }[]
  interpretation: string
}

export function parseProbabilities(text: string): number[] {
  const parts = text.split(/[\s,;]+/).filter(Boolean)
  return parts.map((s) => {
    const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/)
    const v = frac ? Number(frac[1]) / Number(frac[2]) : Number(s)
    if (!Number.isFinite(v)) throw new EntropyInputError(`Valor no numérico: "${s}"`)
    return v
  })
}

export function shannonEntropy(probs: number[], tolerance = SHANNON_TOLERANCE): ShannonResult {
  if (probs.length === 0) throw new EntropyInputError('Ingresá al menos una probabilidad')
  for (const p of probs) {
    if (!Number.isFinite(p)) throw new EntropyInputError('Todas las probabilidades deben ser números')
    if (p < 0 || p > 1) throw new EntropyInputError(`Cada probabilidad debe estar entre 0 y 1 (recibido ${p})`)
  }
  const sum = probs.reduce((a, b) => a + b, 0)
  if (Math.abs(sum - 1) > tolerance) {
    throw new EntropyInputError(`Las probabilidades deben sumar 1 (suman ${Number(sum.toPrecision(10))})`)
  }
  const terms = probs.map((p) => ({ p, contribution: p === 0 ? 0 : -p * Math.log2(p) }))
  const bits = Math.max(0, terms.reduce((a, t) => a + t.contribution, 0))
  const n = probs.length
  const maxBits = Math.log2(n)
  const efficiency = n > 1 ? bits / maxBits : 1
  let interpretation: string
  if (bits < 1e-12) interpretation = 'Entropía nula: uno de los resultados es seguro; observarlo no aporta información.'
  else if (Math.abs(efficiency - 1) < 1e-9)
    interpretation = `Distribución uniforme: máxima incertidumbre posible para ${n} resultados (log₂ ${n} bits).`
  else
    interpretation = `En promedio, conocer el resultado aporta ${bits.toFixed(4)} bits; es el ${(efficiency * 100).toFixed(1)} % del máximo posible con ${n} resultados. Ningún código sin pérdidas puede usar, en promedio, menos bits por símbolo.`
  return { bits, nats: bits * Math.LN2, maxBits, efficiency, terms, interpretation }
}
