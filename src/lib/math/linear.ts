export class MathInputError extends Error {}

export type Vec = number[]

function check(a: Vec, b?: Vec): void {
  if (a.some((x) => !Number.isFinite(x)) || b?.some((x) => !Number.isFinite(x))) {
    throw new MathInputError('Todas las componentes deben ser números')
  }
  if (b && a.length !== b.length) throw new MathInputError('Los vectores deben tener la misma dimensión')
}

export const add = (a: Vec, b: Vec): Vec => (check(a, b), a.map((x, i) => x + b[i]!))
export const sub = (a: Vec, b: Vec): Vec => (check(a, b), a.map((x, i) => x - b[i]!))
export const scale = (a: Vec, k: number): Vec => (check(a), a.map((x) => x * k))
export const dot = (a: Vec, b: Vec): number => (check(a, b), a.reduce((s, x, i) => s + x * b[i]!, 0))
export const magnitude = (a: Vec): number => (check(a), Math.hypot(...a))

export function normalize(a: Vec): Vec {
  const m = magnitude(a)
  if (m === 0) throw new MathInputError('El vector nulo no se puede normalizar')
  return a.map((x) => x / m)
}

export function cross(a: Vec, b: Vec): Vec {
  check(a, b)
  if (a.length !== 3) throw new MathInputError('El producto vectorial está definido en 3D')
  const [a1, a2, a3] = a as [number, number, number]
  const [b1, b2, b3] = b as [number, number, number]
  return [a2 * b3 - a3 * b2, a3 * b1 - a1 * b3, a1 * b2 - a2 * b1]
}

/** Componente z de a × b para vectores en el plano (equivale a un determinante 2×2). */
export function cross2(a: Vec, b: Vec): number {
  check(a, b)
  if (a.length !== 2) throw new MathInputError('Se esperaban vectores 2D')
  return a[0]! * b[1]! - a[1]! * b[0]!
}

/** Ángulo entre vectores en radianes. */
export function angleBetween(a: Vec, b: Vec): number {
  const ma = magnitude(a)
  const mb = magnitude(b)
  if (ma === 0 || mb === 0) throw new MathInputError('El ángulo no está definido con un vector nulo')
  const c = Math.min(1, Math.max(-1, dot(a, b) / (ma * mb)))
  return Math.acos(c)
}

export const degToRad = (d: number) => (d * Math.PI) / 180
export const radToDeg = (r: number) => (r * 180) / Math.PI

/** Resuelve a·x + b = c. */
export function solveLinear1(a: number, b: number, c: number): { kind: 'unique'; x: number } | { kind: 'none' | 'infinite' } {
  if (![a, b, c].every(Number.isFinite)) throw new MathInputError('Los coeficientes deben ser números')
  if (a === 0) return { kind: b === c ? 'infinite' : 'none' }
  return { kind: 'unique', x: (c - b) / a }
}

export type SystemResult = { kind: 'unique'; x: number[] } | { kind: 'singular' }

/** Eliminación gaussiana con pivoteo parcial para A·x = b (n×n). */
export function solveSystem(A: number[][], b: number[]): SystemResult {
  const n = A.length
  if (n === 0 || b.length !== n || A.some((row) => row.length !== n)) {
    throw new MathInputError('La matriz debe ser cuadrada y coincidir con el vector de términos independientes')
  }
  if (A.flat().concat(b).some((v) => !Number.isFinite(v))) throw new MathInputError('Los coeficientes deben ser números')
  const M = A.map((row, i) => [...row, b[i]!])
  const scaleRef = Math.max(1, ...A.flat().map(Math.abs))
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[pivot]![col]!)) pivot = r
    if (Math.abs(M[pivot]![col]!) < 1e-12 * scaleRef) return { kind: 'singular' }
    ;[M[col], M[pivot]] = [M[pivot]!, M[col]!]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r]![col]! / M[col]![col]!
      for (let k = col; k <= n; k++) M[r]![k]! -= f * M[col]![k]!
    }
  }
  return { kind: 'unique', x: M.map((row, i) => row[n]! / row[i]!) }
}

export function percentOf(p: number, total: number): number {
  return (p / 100) * total
}
export function whatPercent(part: number, total: number): number {
  if (total === 0) throw new MathInputError('El total no puede ser 0')
  return (part / total) * 100
}
export function percentChange(from: number, to: number): number {
  if (from === 0) throw new MathInputError('El valor inicial no puede ser 0')
  return ((to - from) / Math.abs(from)) * 100
}

const PREFIXES: Record<number, string> = {
  [-15]: 'f', [-12]: 'p', [-9]: 'n', [-6]: 'µ', [-3]: 'm', 0: '', 3: 'k', 6: 'M', 9: 'G', 12: 'T', 15: 'P',
}

export interface SciParts {
  mantissa: number
  exponent: number
}

/** Descompone x = mantissa · 10^exponent con 1 ≤ |mantissa| < 10. */
export function toScientific(x: number, sigFigs = 6): SciParts {
  if (!Number.isFinite(x)) throw new MathInputError('Ingresá un número finito')
  if (x === 0) return { mantissa: 0, exponent: 0 }
  const [m, e] = x.toExponential(Math.max(0, sigFigs - 1)).split('e')
  return { mantissa: Number(m), exponent: Number(e) }
}

/** Notación de ingeniería: exponente múltiplo de 3 y prefijo SI cuando existe. */
export function toEngineering(x: number, sigFigs = 6): SciParts & { prefix: string | null } {
  const { mantissa, exponent } = toScientific(x, sigFigs)
  const e3 = Math.floor(exponent / 3) * 3
  const m = Number((mantissa * 10 ** (exponent - e3)).toPrecision(sigFigs))
  return { mantissa: m, exponent: e3, prefix: PREFIXES[e3] ?? null }
}
