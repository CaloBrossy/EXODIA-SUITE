import { R_GAS } from './entropy'

export class PhysicsInputError extends Error {}

/** Aceleración de la gravedad estándar, m/s² (valor convencional exacto). */
export const G_STANDARD = 9.80665
const DEG = Math.PI / 180

function finite(name: string, v: number): void {
  if (!Number.isFinite(v)) throw new PhysicsInputError(`${name}: ingresá un número válido`)
}
function positive(name: string, v: number): void {
  finite(name, v)
  if (v <= 0) throw new PhysicsInputError(`${name} debe ser mayor que 0`)
}
function nonNegative(name: string, v: number): void {
  finite(name, v)
  if (v < 0) throw new PhysicsInputError(`${name} no puede ser negativo`)
}

/* ───────────── Cinemática ───────────── */

/** Movimiento rectilíneo uniformemente variado (MRU si a = 0). */
export function mruv(x0: number, v0: number, a: number, t: number) {
  finite('x₀', x0)
  finite('v₀', v0)
  finite('a', a)
  nonNegative('t', t)
  return { x: x0 + v0 * t + 0.5 * a * t * t, v: v0 + a * t }
}

/** Tiro oblicuo sin rozamiento desde una altura h₀ ≥ 0 hasta volver a y = 0. */
export function projectile(v0: number, angleDeg: number, h0: number, g = G_STANDARD) {
  nonNegative('v₀', v0)
  finite('θ', angleDeg)
  if (angleDeg < -90 || angleDeg > 90) throw new PhysicsInputError('θ debe estar entre −90° y 90°')
  nonNegative('h₀', h0)
  positive('g', g)
  const vx = v0 * Math.cos(angleDeg * DEG)
  const vy = v0 * Math.sin(angleDeg * DEG)
  const tFlight = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g
  const tApex = vy > 0 ? vy / g : 0
  return {
    vx,
    vy,
    tFlight,
    range: vx * tFlight,
    tApex,
    hMax: h0 + (vy > 0 ? (vy * vy) / (2 * g) : 0),
    impactSpeed: Math.hypot(vx, vy - g * tFlight),
  }
}

/* ───────────── Dinámica ───────────── */

/** Bloque sobre plano inclinado con rozamiento, partiendo del reposo. */
export function inclinedPlane(m: number, angleDeg: number, muS: number, muK: number, g = G_STANDARD) {
  positive('m', m)
  finite('θ', angleDeg)
  if (angleDeg < 0 || angleDeg > 90) throw new PhysicsInputError('θ debe estar entre 0° y 90°')
  nonNegative('μs', muS)
  nonNegative('μk', muK)
  if (muK > muS) throw new PhysicsInputError('μk no puede superar a μs')
  positive('g', g)
  const weight = m * g
  const normal = weight * Math.cos(angleDeg * DEG)
  const parallel = weight * Math.sin(angleDeg * DEG)
  const maxStatic = muS * normal
  if (parallel <= maxStatic) return { weight, normal, parallel, moves: false, friction: parallel, a: 0 }
  const friction = muK * normal
  return { weight, normal, parallel, moves: true, friction, a: (parallel - friction) / m }
}

/* ───────────── Energía y choques ───────────── */

/** Conservación de la energía mecánica sin rozamiento: velocidad al pasar de h₁ a h₂. */
export function energyConservation(m: number, v1: number, h1: number, h2: number, g = G_STANDARD) {
  positive('m', m)
  nonNegative('v₁', v1)
  finite('h₁', h1)
  finite('h₂', h2)
  positive('g', g)
  const k1 = 0.5 * m * v1 * v1
  const u1 = m * g * h1
  const u2 = m * g * h2
  const k2 = k1 + u1 - u2
  if (k2 < 0) {
    throw new PhysicsInputError(`No alcanza h₂: con esa energía la altura máxima es ${(h1 + (v1 * v1) / (2 * g)).toPrecision(5)} m`)
  }
  return { k1, u1, u2, k2, total: k1 + u1, v2: Math.sqrt((2 * k2) / m) }
}

/** Choque unidimensional con coeficiente de restitución e (1 elástico, 0 perfectamente inelástico). */
export function collision1D(m1: number, v1: number, m2: number, v2: number, e: number) {
  positive('m₁', m1)
  positive('m₂', m2)
  finite('v₁', v1)
  finite('v₂', v2)
  finite('e', e)
  if (e < 0 || e > 1) throw new PhysicsInputError('e debe estar entre 0 y 1')
  const M = m1 + m2
  const p = m1 * v1 + m2 * v2
  const u1 = (p - m2 * e * (v1 - v2)) / M
  const u2 = (p + m1 * e * (v1 - v2)) / M
  const kBefore = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2
  const kAfter = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2
  return { u1, u2, p, kBefore, kAfter, kLost: kBefore - kAfter }
}

/* ───────────── Circuitos ───────────── */

export function equivalentResistance(values: number[], mode: 'series' | 'parallel'): number {
  if (values.length === 0) throw new PhysicsInputError('Ingresá al menos una resistencia')
  values.forEach((r, i) => positive(`R${i + 1}`, r))
  return mode === 'series' ? values.reduce((s, r) => s + r, 0) : 1 / values.reduce((s, r) => s + 1 / r, 0)
}

/** Ley de Ohm: dados dos de V, I, R (el tercero NaN), devuelve los tres y la potencia. */
export function ohm(V: number, I: number, R: number) {
  const known = [V, I, R].filter(Number.isFinite).length
  if (known !== 2) throw new PhysicsInputError('Completá exactamente dos de los tres valores (V, I, R)')
  if (Number.isFinite(R)) positive('R', R)
  let v = V
  let i = I
  let r = R
  if (!Number.isFinite(v)) v = i * r
  else if (!Number.isFinite(i)) i = v / r
  else {
    if (i === 0) throw new PhysicsInputError('Con I = 0 la resistencia queda indeterminada')
    r = v / i
    if (r <= 0) throw new PhysicsInputError('V e I deben tener el mismo signo (R > 0)')
  }
  return { V: v, I: i, R: r, P: v * i }
}

/* ───────────── Gases ideales ───────────── */

export type GasVar = 'P' | 'V' | 'n' | 'T'

/** PV = nRT en SI (Pa, m³, mol, K). Despeja la variable `unknown`. */
export function idealGasLaw(values: Record<GasVar, number>, unknown: GasVar) {
  const names: Record<GasVar, string> = { P: 'P', V: 'V', n: 'n', T: 'T' }
  for (const k of Object.keys(values) as GasVar[]) if (k !== unknown) positive(names[k], values[k])
  const { P, V, n, T } = values
  const solved: Record<GasVar, number> = {
    P: unknown === 'P' ? (n * R_GAS * T) / V : P,
    V: unknown === 'V' ? (n * R_GAS * T) / P : V,
    n: unknown === 'n' ? (P * V) / (R_GAS * T) : n,
    T: unknown === 'T' ? (P * V) / (n * R_GAS) : T,
  }
  return solved
}

/* ───────────── Átomo de hidrógeno (Bohr) ───────────── */

/** Constante de Rydberg corregida por masa reducida del hidrógeno, m⁻¹. */
export const RYDBERG_H = 10967758.34
/** Energía de ionización del hidrógeno en el modelo de Bohr con masa reducida, eV. */
export const HYDROGEN_GROUND_EV = 13.59829

const SERIES = ['Lyman', 'Balmer', 'Paschen', 'Brackett', 'Pfund', 'Humphreys']

export function hydrogenLevel(n: number): number {
  if (!Number.isInteger(n) || n < 1) throw new PhysicsInputError('n debe ser un entero ≥ 1')
  return -HYDROGEN_GROUND_EV / (n * n)
}

/** Transición n_alto → n_bajo del hidrógeno (fórmula de Rydberg, longitudes en el vacío). */
export function hydrogenTransition(nLow: number, nHigh: number) {
  hydrogenLevel(nLow)
  hydrogenLevel(nHigh)
  if (nHigh <= nLow) throw new PhysicsInputError('El nivel superior debe ser mayor que el inferior')
  const invLambda = RYDBERG_H * (1 / (nLow * nLow) - 1 / (nHigh * nHigh))
  const lambdaNm = 1e9 / invLambda
  const region = lambdaNm < 380 ? 'ultravioleta' : lambdaNm <= 750 ? 'visible' : 'infrarrojo'
  return {
    lambdaNm,
    energyEv: hydrogenLevel(nHigh) - hydrogenLevel(nLow),
    frequencyHz: 299792458 * invLambda,
    series: SERIES[nLow - 1] ?? `n = ${nLow}`,
    region,
  }
}
