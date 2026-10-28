export const FIT_KINDS = ['linear', 'poly', 'exp', 'power', 'log'] as const
export type FitKind = (typeof FIT_KINDS)[number]
export const FitKindLabel: Record<FitKind, string> = {
  linear: 'Lineal',
  poly: 'Polinómico',
  exp: 'Exponencial',
  power: 'Potencial',
  log: 'Logarítmico',
}

export type DataPoint = { x: number; y: number; ex?: number | null; ey?: number | null }
export type FitParam = { name: string; value: number; se: number | null }
export type Fit = {
  kind: FitKind
  degree: number
  params: FitParam[]
  r2: number | null
  /** Puntos usados (los no válidos para el modelo, p. ej. y ≤ 0 en exponencial, se descartan). */
  n: number
  dropped: number
  predict: (x: number) => number
  residuals: { x: number; y: number; r: number }[]
  latex: string
  /** Expresión en sintaxis de la calculadora, función de x. */
  expression: string
  /** El ajuste se hizo linealizando: los errores estándar valen para el modelo linealizado. */
  linearized: boolean
}

export class FitError extends Error {}

type Poly = { coef: number[]; se: (number | null)[]; dof: number }

const binom = (n: number, k: number) => {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

/**
 * Mínimos cuadrados polinómicos con QR de Householder sobre x centrado y escalado,
 * estable hasta grado 5. Devuelve coeficientes ascendentes a₀…a_d y sus errores estándar.
 */
export function polyfit(xs: number[], ys: number[], degree: number): Poly {
  const n = xs.length
  const p = degree + 1
  if (n < p) throw new FitError(`Se necesitan al menos ${p} puntos para un ajuste de grado ${degree}.`)
  const mean = xs.reduce((a, x) => a + x, 0) / n
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / n) || 1
  const t = xs.map((x) => (x - mean) / sd)
  const A = t.map((ti) => Array.from({ length: p }, (_, k) => ti ** k))
  const b = [...ys]

  for (let k = 0; k < p; k++) {
    let norm = 0
    for (let i = k; i < n; i++) norm += A[i]![k]! ** 2
    norm = Math.sqrt(norm)
    if (norm === 0) continue
    const alpha = A[k]![k]! > 0 ? -norm : norm
    const v = Array.from({ length: n }, (_, i) => (i < k ? 0 : A[i]![k]!))
    v[k] = v[k]! - alpha
    const vv = v.reduce((a, x) => a + x * x, 0)
    if (vv === 0) continue
    for (let j = k; j < p; j++) {
      let dot = 0
      for (let i = k; i < n; i++) dot += v[i]! * A[i]![j]!
      const f = (2 * dot) / vv
      for (let i = k; i < n; i++) A[i]![j] = A[i]![j]! - f * v[i]!
    }
    let dot = 0
    for (let i = k; i < n; i++) dot += v[i]! * b[i]!
    const f = (2 * dot) / vv
    for (let i = k; i < n; i++) b[i] = b[i]! - f * v[i]!
  }

  const maxDiag = Math.max(...Array.from({ length: p }, (_, k) => Math.abs(A[k]![k]!)))
  for (let k = 0; k < p; k++) {
    if (Math.abs(A[k]![k]!) <= 1e-10 * maxDiag) throw new FitError('Los valores de x no alcanzan para este modelo (hay x repetidos o muy pocos distintos).')
  }
  const c = new Array<number>(p).fill(0)
  for (let k = p - 1; k >= 0; k--) {
    let s = b[k]!
    for (let j = k + 1; j < p; j++) s -= A[k]![j]! * c[j]!
    c[k] = s / A[k]![k]!
  }
  // R⁻¹ (triangular superior) para (AᵀA)⁻¹ = R⁻¹R⁻ᵀ.
  const Ri = Array.from({ length: p }, () => new Array<number>(p).fill(0))
  for (let j = 0; j < p; j++) {
    Ri[j]![j] = 1 / A[j]![j]!
    for (let i = j - 1; i >= 0; i--) {
      let s = 0
      for (let k = i + 1; k <= j; k++) s += A[i]![k]! * Ri[k]![j]!
      Ri[i]![j] = -s / A[i]![i]!
    }
  }
  const covT = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => {
    let s = 0
    for (let k = 0; k < p; k++) s += Ri[i]![k]! * Ri[j]![k]!
    return s
  }))

  // Vuelta a potencias de x: a_j = Σ_k c_k · sd⁻ᵏ · C(k, j) · (−mean)^(k−j).
  const T = Array.from({ length: p }, (_, j) => Array.from({ length: p }, (_, k) => (k < j ? 0 : sd ** -k * binom(k, j) * (-mean) ** (k - j))))
  const coef = T.map((row) => row.reduce((a, tjk, k) => a + tjk * c[k]!, 0))

  const sse = xs.reduce((a, x, i) => a + (ys[i]! - coef.reduce((s, ak, k) => s + ak * x ** k, 0)) ** 2, 0)
  const dof = n - p
  const s2 = dof > 0 ? sse / dof : null
  const se = coef.map((_, j) => {
    if (s2 == null) return null
    let v = 0
    for (let k = 0; k < p; k++) for (let l = 0; l < p; l++) v += T[j]![k]! * covT[k]![l]! * T[j]![l]!
    return Math.sqrt(Math.max(0, v * s2))
  })
  return { coef, se, dof }
}

// ---------- Formato ----------

/** Número para mostrar: 4 cifras significativas, notación científica fuera de [1e-3, 1e5). */
export function fmtSig(v: number, sig = 4): string {
  if (!Number.isFinite(v)) return String(v)
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e5 || a < 1e-3) {
    const [m, e] = v.toExponential(sig - 1).split('e')
    return `${Number(m)}e${Number(e)}`
  }
  return String(Number(v.toPrecision(sig)))
}

function texNum(v: number, sig = 4): string {
  const s = fmtSig(v, sig)
  const m = /^(-?[\d.]+)e(-?\d+)$/.exec(s)
  return m ? `${m[1]} \\times 10^{${m[2]}}` : s
}

/** Número exacto para la expresión evaluable (paréntesis si es negativo). */
const exprNum = (v: number) => {
  const s = String(Number(v.toPrecision(12)))
  return v < 0 ? `(${s})` : s
}

function texSum(terms: { coef: number; body: string }[]): string {
  const parts = terms.filter((t) => t.coef !== 0)
  if (!parts.length) return '0'
  return parts
    .map((t, i) => {
      const mag = texNum(Math.abs(t.coef))
      const term = t.body ? (mag === '1' ? t.body : `${mag}\\,${t.body}`) : mag
      if (i === 0) return t.coef < 0 ? `-${term}` : term
      return t.coef < 0 ? ` - ${term}` : ` + ${term}`
    })
    .join('')
}

const SUB = ['₀', '₁', '₂', '₃', '₄', '₅']

// ---------- Ajustes ----------

function rSquared(ys: number[], pred: number[]): number | null {
  const mean = ys.reduce((a, y) => a + y, 0) / ys.length
  const sst = ys.reduce((a, y) => a + (y - mean) ** 2, 0)
  if (sst === 0) return null
  const sse = ys.reduce((a, y, i) => a + (y - pred[i]!) ** 2, 0)
  return 1 - sse / sst
}

export function fitData(points: DataPoint[], kind: FitKind, degree = 2): Fit {
  const finite = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  const usable = finite.filter((p) => (kind === 'exp' ? p.y > 0 : kind === 'power' ? p.x > 0 && p.y > 0 : kind === 'log' ? p.x > 0 : true))
  const dropped = points.length - usable.length
  if (usable.length < 2) {
    const why = kind === 'exp' ? ' con y > 0' : kind === 'power' ? ' con x > 0 e y > 0' : kind === 'log' ? ' con x > 0' : ''
    throw new FitError(`Se necesitan al menos 2 puntos válidos${why}.`)
  }
  const xs = usable.map((p) => p.x)
  const ys = usable.map((p) => p.y)
  let params: FitParam[]
  let predict: (x: number) => number
  let latex: string
  let expression: string
  let deg = 1
  let linearized = false

  if (kind === 'linear' || kind === 'poly') {
    deg = kind === 'linear' ? 1 : Math.min(5, Math.max(2, Math.round(degree)))
    const { coef, se } = polyfit(xs, ys, deg)
    predict = (x) => coef.reduce((s, a, k) => s + a * x ** k, 0)
    if (kind === 'linear') {
      params = [{ name: 'm', value: coef[1]!, se: se[1]! }, { name: 'b', value: coef[0]!, se: se[0]! }]
    } else {
      params = coef.map((value, k) => ({ name: `a${SUB[k]}`, value, se: se[k]! })).reverse()
    }
    const desc = coef.map((c, k) => ({ coef: c, k })).reverse()
    latex = `y = ${texSum(desc.map(({ coef: c, k }) => ({ coef: c, body: k === 0 ? '' : k === 1 ? 'x' : `x^{${k}}` })))}`
    expression = desc.map(({ coef: c, k }) => (k === 0 ? exprNum(c) : `${exprNum(c)}*x${k > 1 ? `^${k}` : ''}`)).join(' + ')
  } else if (kind === 'exp') {
    linearized = true
    const { coef, se } = polyfit(xs, ys.map(Math.log), 1)
    const A = Math.exp(coef[0]!)
    const B = coef[1]!
    params = [{ name: 'A', value: A, se: se[0] == null ? null : A * se[0] }, { name: 'B', value: B, se: se[1]! }]
    predict = (x) => A * Math.exp(B * x)
    latex = `y = ${texNum(A)}\\,e^{${texNum(B)}\\,x}`
    expression = `${exprNum(A)}*exp(${exprNum(B)}*x)`
  } else if (kind === 'power') {
    linearized = true
    const { coef, se } = polyfit(xs.map(Math.log), ys.map(Math.log), 1)
    const A = Math.exp(coef[0]!)
    const B = coef[1]!
    params = [{ name: 'A', value: A, se: se[0] == null ? null : A * se[0] }, { name: 'B', value: B, se: se[1]! }]
    predict = (x) => A * x ** B
    latex = `y = ${texNum(A)}\\,x^{${texNum(B)}}`
    expression = `${exprNum(A)}*x^${exprNum(B)}`
  } else {
    const { coef, se } = polyfit(xs.map(Math.log), ys, 1)
    params = [{ name: 'a', value: coef[0]!, se: se[0]! }, { name: 'b', value: coef[1]!, se: se[1]! }]
    predict = (x) => coef[0]! + coef[1]! * Math.log(x)
    latex = `y = ${texSum([{ coef: coef[0]!, body: '' }, { coef: coef[1]!, body: '\\ln x' }])}`
    expression = `${exprNum(coef[0]!)} + ${exprNum(coef[1]!)}*ln(x)`
  }

  const pred = xs.map(predict)
  return {
    kind,
    degree: deg,
    params,
    r2: rSquared(ys, pred),
    n: usable.length,
    dropped,
    predict,
    residuals: usable.map((p, i) => ({ x: p.x, y: p.y, r: p.y - pred[i]! })),
    latex,
    expression,
    linearized,
  }
}

// ---------- Ejes ----------

/** Marcas «redondas» (1, 2, 5 × 10ⁿ) que cubren [min, max]. */
export function niceTicks(min: number, max: number, target = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) {
    const d = Math.abs(min) || 1
    min -= d / 2
    max += d / 2
  }
  const raw = (max - min) / Math.max(1, target)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const start = Math.ceil(min / step - 1e-9) * step
  const out: number[] = []
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)))
  return out
}

/** Potencias de 10 en [min, max] (ambos > 0); si el rango abarca menos de una década, marcas lineales. */
export function logTicks(min: number, max: number): number[] {
  if (!(min > 0) || !(max > 0)) return []
  const lo = Math.floor(Math.log10(min))
  const hi = Math.ceil(Math.log10(max))
  const out: number[] = []
  for (let e = lo; e <= hi; e++) {
    const v = 10 ** e
    if (v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9)) out.push(v)
  }
  return out.length >= 2 ? out : niceTicks(min, max, 4).filter((v) => v > 0)
}
