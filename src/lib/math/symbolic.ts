import nerdamer from 'nerdamer-prime'
import {
  DEFAULT_VARIABLE,
  equationToZero,
  numericPlanFor,
  parseConditions,
  splitEquations,
  splitList,
  type NumericPlan,
  type SymbolicRequest,
  type SymbolicResult,
} from './symbolicTypes'

const CANT = 'No pude resolver esto simbólicamente.'
const MAX_LENGTH = 1000
const IDENT = /^[A-Za-z][A-Za-z0-9_]*$/

class SymFail extends Error {
  constructor(message: string, readonly numeric?: NumericPlan) {
    super(message)
  }
}

type Subs = Record<string, string>

/** El integrador de nerdamer escribe en consola cuando se rinde; acá se trata como resultado sin resolver. */
function quiet<T>(fn: () => T): T {
  const log = console.log
  console.log = () => {}
  try {
    return fn()
  } finally {
    console.log = log
  }
}

const str = (s: string, subs?: Subs): string => quiet(() => (subs ? nerdamer(s, subs) : nerdamer(s)).toString())

/** Valor numérico real de una expresión sin variables libres (o con ellas sustituidas). */
export function num(s: string, subs?: Subs): number | null {
  try {
    const t = quiet(() => (subs ? nerdamer(s, subs) : nerdamer(s)).evaluate().text('decimals'))
    const v = Number(t)
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

function variables(s: string): string[] {
  try {
    return quiet(() => nerdamer(s).variables())
  } catch {
    return []
  }
}

const unresolved = (s: string, fn: string) => new RegExp(`\\b${fn}\\(`).test(s)
const hasSymbol = (s: string, v: string) => new RegExp(`(^|[^A-Za-z0-9_])${v}(?![A-Za-z0-9_(])`).test(s)
/** «4y» no tiene límite de palabra entre el dígito y la letra. */
const asVar = (name: string) => new RegExp(`(?<![A-Za-z_])${name}(?![A-Za-z0-9_])`, 'g')

/** Normaliza la entrada a la sintaxis de nerdamer (ln → log, π → pi, ∞ → Infinity…). */
export function toNerdamer(s: string): string {
  return s
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/[’′]/g, "'")
    .replace(/\*\*/g, '^')
    .replace(/∞/g, 'Infinity')
    .replace(/\binf(inity)?\b/gi, 'Infinity')
    .replace(/\bln\s*\(/g, 'log(')
    .trim()
}

const FN_TEX: Record<string, string> = {
  log: '\\ln', sin: '\\sin', cos: '\\cos', tan: '\\tan', sec: '\\sec', csc: '\\csc', cot: '\\cot',
  sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', exp: '\\exp',
  asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan',
}

/** LaTeX de nerdamer → notación habitual (\sin, \ln, \arctan) y sin «·» entre coeficiente y símbolo. */
export function cleanTex(t: string): string {
  return t
    .replace(/\\mathrm\{(\w+)\}/g, (_, f: string) => FN_TEX[f] ?? `\\operatorname{${f}}`)
    .replace(/(\d)\s*\\cdot\s*(?=[A-Za-z]|\\(?!cdot|left\[))/g, '$1\\,')
    .replace(/\bInfinity\b/g, '\\infty')
}

/** toTeX sobre la expresión ya parseada: convertToLaTeX falla con multiplicación implícita («2x»). */
const texOf = (s: string) => cleanTex(quiet(() => nerdamer(s).toTeX()))
const inTex = texOf
const outTex = texOf
const boundTex = (b: string) => (/^-?\s*Infinity$/.test(b) ? (b.trim().startsWith('-') ? '-\\infty' : '\\infty') : inTex(b))

/* ───────────── Reconocer constantes ───────────── */

const BASES: [string, number][] = [
  ['', 1], ['\\pi', Math.PI], ['\\sqrt{2}', Math.SQRT2], ['\\sqrt{3}', Math.sqrt(3)], ['e', Math.E],
  ['\\ln 2', Math.LN2], ['\\pi^{2}', Math.PI ** 2], ['\\sqrt{\\pi}', Math.sqrt(Math.PI)],
]
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a))

/** 0,785398… → \frac{\pi}{4}. Racionales p/q (q ≤ 12) por π, √2, √3, e, ln 2, π², √π. */
export function recognize(v: number): string | null {
  if (!Number.isFinite(v)) return null
  if (v === 0) return '0'
  for (let q = 1; q <= 12; q++) {
    for (const [tex, base] of BASES) {
      const p = Math.round((v * q) / base)
      if (p === 0 || Math.abs(p) > 200) continue
      if (Math.abs((p / q) * base - v) > 1e-11 * Math.max(1, Math.abs(v))) continue
      const g = gcd(p, q)
      const [P, Q] = [Math.abs(p / g), q / g]
      const sign = p < 0 ? '-' : ''
      const numer = tex ? (P === 1 ? tex : `${P}${tex}`) : String(P)
      return Q === 1 ? `${sign}${numer}` : `${sign}\\frac{${numer}}{${Q}}`
    }
  }
  return null
}

function ok(latex: string, result: string, notes: string[] = [], numeric?: NumericPlan, resultLatex = outTex(result)): SymbolicResult {
  const approx = variables(result).length === 0 ? num(result) : null
  const rec = approx != null && !/^-?\d+(\/\d+)?$/.test(result) ? recognize(approx) : null
  return { ok: true, latex, resultLatex, result, approx, recognized: rec, notes, numeric }
}

/** f y g coinciden numéricamente en varios puntos (null si no hay puntos comparables). */
function sameFunction(f: string, g: string, v: string, extra: Subs = {}): boolean | null {
  let compared = 0
  for (const p of ['0.31', '0.77', '1.43', '2.19', '-0.63']) {
    const a = num(f, { ...extra, [v]: p })
    const b = num(g, { ...extra, [v]: p })
    if (a == null || b == null) continue
    compared++
    if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))) return false
  }
  return compared >= 2 ? true : null
}

const splitTop = (s: string): string[] => {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++
    if (')]}'.includes(ch)) depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

const isZero = (s: string) => {
  const n = num(s)
  return n != null ? Math.abs(n) < 1e-9 : s.replace(/\s/g, '') === '0'
}

/**
 * Eliminación gaussiana exacta. null si no es lineal, no es cuadrado o es singular.
 * solveEquations de nerdamer falla desde 3×3 y también con una sola ecuación.
 */
function linearSolve(zeroExprs: string[], unknowns: string[]): [string, string][] | null {
  const n = unknowns.length
  if (!n || zeroExprs.length !== n) return null
  const M: string[][] = []
  for (const e of zeroExprs) {
    const row: string[] = []
    for (const u of unknowns) {
      const c = str(`expand(diff(${e}, ${u}))`)
      if (unknowns.some((w) => hasSymbol(c, w))) return null
      row.push(c)
    }
    const cst = str(e, Object.fromEntries(unknowns.map((u) => [u, '0'])))
    if (unknowns.some((w) => hasSymbol(cst, w))) return null
    row.push(str(`expand(-(${cst}))`))
    M.push(row)
  }
  for (let col = 0; col < n; col++) {
    let piv = col
    while (piv < n && isZero(M[piv]![col]!)) piv++
    if (piv === n) return null
    if (piv !== col) [M[col], M[piv]] = [M[piv]!, M[col]!]
    const pivVal = M[col]![col]!
    for (let r = col + 1; r < n; r++) {
      if (isZero(M[r]![col]!)) continue
      const f = `(${M[r]![col]})/(${pivVal})`
      for (let j = col; j <= n; j++) M[r]![j] = str(`expand((${M[r]![j]})-(${f})*(${M[col]![j]}))`)
    }
  }
  const sol = Array<string>(n).fill('0')
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i]![n]!
    for (let j = i + 1; j < n; j++) s = `(${s})-(${M[i]![j]})*(${sol[j]})`
    sol[i] = str(`expand((${s})/(${M[i]![i]}))`)
  }
  return unknowns.map((u, i) => [u, sol[i]!])
}

function solveSystem(eqs: string[], unknowns: string[]): [string, string][] {
  const zeros = eqs.map((q) => equationToZero(q))
  const lin = linearSolve(zeros, unknowns)
  if (lin) return lin
  if (zeros.length === 1 && unknowns.length === 1) {
    const raw = str(`solve(${zeros[0]}, ${unknowns[0]})`).replace(/^\[|\]$/g, '')
    const sols = splitTop(raw).filter((s) => s && !/Infinity|NaN/i.test(s))
    return sols.length === 1 ? [[unknowns[0]!, sols[0]!]] : []
  }
  return pairs(quiet(() => nerdamer.solveEquations(eqs, unknowns.length ? unknowns : undefined)))
}

function pairs(sol: unknown): [string, string][] {
  if (!Array.isArray(sol)) return []
  if (sol.every(Array.isArray)) return sol.map((p) => [String(p[0]), String(p[1])])
  const out: [string, string][] = []
  for (let i = 0; i + 1 < sol.length; i += 2) out.push([String(sol[i]), String(sol[i + 1])])
  return out
}

/** Racional con denominador enorme: nerdamer aproximó un valor irracional. */
const looksApprox = (s: string) => /^-?\d+\/\d{6,}$/.test(s)
const decimal = (s: string) => {
  const v = num(s)
  return v == null ? s : String(Number(v.toPrecision(10)))
}

/* ───────────── Operaciones ───────────── */

function derive(e: string, v: string, n: number): SymbolicResult {
  const r = str(`diff(${e}, ${v}, ${n})`)
  if (unresolved(r, 'diff')) throw new SymFail(CANT, { kind: 'derivative', expr: e, variable: v, order: n })
  const d = n > 1 ? `^{${n}}` : ''
  return ok(`\\frac{d${d}}{d${v}${d}}\\left[${inTex(e)}\\right] = ${outTex(r)}`, r)
}

function antiderivative(e: string, v: string, plan: NumericPlan): { F: string; notes: string[] } {
  const F = str(`integrate(${e}, ${v})`)
  if (unresolved(F, 'integrate')) throw new SymFail(`${CANT} No encontré una primitiva en términos elementales.`, plan)
  const check = sameFunction(str(`diff(${F}, ${v})`), e, v)
  if (check === false) throw new SymFail(`${CANT} La primitiva obtenida no verifica F' = f.`, plan)
  return { F, notes: check ? ['Verificado: la derivada de la primitiva coincide con el integrando.'] : [] }
}

function boundValue(F: string, v: string, b: string, plan: NumericPlan): string {
  if (/Infinity/.test(b)) {
    const r = str(`limit(${F}, ${v}, ${b})`)
    if (unresolved(r, 'limit')) throw new SymFail(`${CANT} No pude evaluar la primitiva en ${b}.`, plan)
    return r
  }
  return str(F, { [v]: b })
}

function integrate(e: string, v: string, lower?: string, upper?: string): SymbolicResult {
  const definite = !!(lower?.trim() && upper?.trim())
  const plan: NumericPlan = { kind: 'integral', expr: e, variable: v, lower: definite ? lower : undefined, upper: definite ? upper : undefined }
  const { F, notes } = antiderivative(e, v, plan)
  if (!definite) return ok(`\\int ${inTex(e)}\\,d${v} = ${outTex(F)} + C`, F, notes, undefined)
  const a = toNerdamer(lower!)
  const b = toNerdamer(upper!)
  const value = str(`(${boundValue(F, v, b, plan)})-(${boundValue(F, v, a, plan)})`)
  if (/NaN|undefined/i.test(value)) throw new SymFail(`${CANT} La primitiva no está definida en los límites.`, plan)
  return ok(`\\int_{${boundTex(a)}}^{${boundTex(b)}} ${inTex(e)}\\,d${v} = ${outTex(value)}`, value, [`Primitiva: F(${v}) = ${F}`, ...notes], plan)
}

function limit(e: string, v: string, point: string): SymbolicResult {
  const p = toNerdamer(point || '0')
  const plan: NumericPlan = { kind: 'limit', expr: e, variable: v, point: p }
  let r = str(`limit(${e}, ${v}, ${p})`)
  if (unresolved(r, 'limit')) {
    try {
      const expo = str(`limit(log(${e}), ${v}, ${p})`)
      if (!unresolved(expo, 'limit') && !/NaN|undefined/i.test(expo)) r = str(`e^(${expo})`)
    } catch {
      /* el límite del log tampoco existe */
    }
  }
  if (unresolved(r, 'limit') || /NaN|undefined/i.test(r)) throw new SymFail(CANT, plan)
  return ok(`\\lim_{${v} \\to ${boundTex(p)}} ${inTex(e)} = ${outTex(r)}`, r, ['Límite bilateral: verificá los laterales si la función cambia de rama.'])
}

function solve(input: string, unknownsIn: string[]): SymbolicResult {
  const eqs = splitEquations(input).map(equationToZero)
  if (!eqs.length) throw new SymFail('Escribí al menos una ecuación.')
  const found = [...new Set(eqs.flatMap(variables))]
  let unknowns = unknownsIn.length ? unknownsIn : found
  if (eqs.length === 1 && unknowns.length > 1) unknowns = [unknowns.includes('x') ? 'x' : unknowns[0]!]
  for (const u of unknowns) if (!IDENT.test(u)) throw new SymFail(`Incógnita inválida: ${u}`)
  const eqTex = splitEquations(input).map((q) => q.split('=').map((side) => inTex(toNerdamer(side))).join(' = '))

  if (eqs.length === 1) {
    const u = unknowns[0] ?? 'x'
    const plan: NumericPlan = { kind: 'roots', expr: eqs[0]!, variable: u }
    const raw = str(`solve(${eqs[0]}, ${u})`).replace(/^\[|\]$/g, '')
    const sols = splitTop(raw).filter(Boolean)
    if (!sols.length) throw new SymFail(`${CANT} No encontré soluciones exactas.`, plan)
    const approx = sols.some(looksApprox)
    const valid = sols.filter((s) => {
      const r = num(eqs[0]!, { [u]: s })
      return r == null || Math.abs(r) < 1e-6 * Math.max(1, Math.abs(num(s) ?? 1))
    })
    if (!valid.length) throw new SymFail(`${CANT} Las soluciones obtenidas no verifican la ecuación.`, plan)
    const shown = approx ? valid.map(decimal) : valid
    const tex = shown.map((s, i) => `${u}${shown.length > 1 ? `_{${i + 1}}` : ''} = ${approx ? s : outTex(s)}`).join(',\\quad ')
    const notes = approx ? ['nerdamer resolvió numéricamente: son valores aproximados en un rango acotado.'] : []
    if (valid.some((s) => num(s) == null && variables(s).length === 0)) notes.push('Incluye soluciones complejas.')
    return ok(`${eqTex[0]} \\;\\Rightarrow\\; ${tex}`, shown.map((s) => `${u} = ${s}`).join('; '), notes, undefined, tex)
  }

  const plan: NumericPlan = { kind: 'system', exprs: eqs, unknowns }
  let sol: [string, string][]
  try {
    sol = solveSystem(eqs.map((q) => `${q}=0`), unknowns)
  } catch (err) {
    throw new SymFail(`${CANT} El sistema no tiene solución única o no es resoluble en forma cerrada.`, plan)
  }
  if (!sol.length) throw new SymFail(`${CANT} El sistema no tiene solución única o no es resoluble en forma cerrada.`, plan)
  const subs = Object.fromEntries(sol)
  const residual = eqs.map((q) => num(q, subs))
  if (residual.some((r) => r != null && Math.abs(r) > 1e-6)) throw new SymFail(`${CANT} La solución obtenida no verifica el sistema.`, plan)
  const notes: string[] = []
  const linear = eqs.every((q) => unknowns.every((u) => {
    const d = str(`diff(${q}, ${u})`)
    return unknowns.every((w) => !hasSymbol(d, w))
  }))
  if (!linear) notes.push('Sistema no lineal: puede haber otras soluciones además de la mostrada.')
  const tex = sol.map(([k, val]) => `${k} = ${looksApprox(val) ? decimal(val) : outTex(val)}`).join(',\\quad ')
  return ok(`\\begin{cases} ${eqTex.join(' \\\\ ')} \\end{cases} \\;\\Rightarrow\\; ${tex}`, sol.map(([k, val]) => `${k} = ${val}`).join('; '), notes, undefined, tex)
}

function transform(op: 'simplify' | 'expand' | 'factor', e: string): SymbolicResult {
  const r = str(`${op}(${e})`)
  if (unresolved(r, op)) throw new SymFail(CANT)
  const notes = r.replace(/\s/g, '') === e.replace(/\s/g, '') ? ['La expresión ya está en su forma más simple para esta operación.'] : []
  return ok(`${inTex(e)} = ${outTex(r)}`, r, notes)
}

function taylor(e: string, v: string, point: string, n: number): SymbolicResult {
  const a = toNerdamer(point || '0')
  if (/Infinity/.test(a)) throw new SymFail('El centro de la serie debe ser un número finito.')
  const shift = a === '0' ? v : `(${v}-(${a}))`
  const terms: string[] = []
  let d = e
  let fact = 1
  for (let k = 0; k <= n; k++) {
    if (k > 0) {
      fact *= k
      d = str(`diff(${d}, ${v})`)
    }
    const c = str(d, { [v]: a })
    if (/Infinity|NaN|undefined/i.test(c) || (variables(c).length === 0 && num(c) == null && !/i/.test(c))) {
      throw new SymFail(`${CANT} La función o su derivada de orden ${k} no está definida en ${v} = ${a}.`)
    }
    if (c === '0') continue
    terms.push(k === 0 ? `(${c})` : `(${c})/${fact}*${shift}${k > 1 ? `^${k}` : ''}`)
  }
  const poly = terms.length ? str(terms.join('+')) : '0'
  const o = a === '0' ? `${v}^{${n + 1}}` : `\\left(${v}-${inTex(a)}\\right)^{${n + 1}}`
  return ok(`${inTex(e)} = ${outTex(poly)} + O\\!\\left(${o}\\right)`, poly, [`Desarrollo de orden ${n} alrededor de ${v} = ${a}.`], undefined)
}

function sum(e: string, k: string, lower: string, upper: string): SymbolicResult {
  const a = toNerdamer(lower)
  const b = toNerdamer(upper)
  if (!a || !b) throw new SymFail('Completá los límites de la sumatoria.')
  const plan: NumericPlan | undefined = variables(b).length === 0 && variables(a).length === 0 ? { kind: 'sum', expr: e, variable: k, lower: a, upper: b } : undefined
  const head = `\\sum_{${k}=${inTex(a)}}^{${boundTex(b)}} ${inTex(e)}`
  const direct = str(`sum(${e}, ${k}, ${a}, ${b})`)
  if (!unresolved(direct, 'sum') && !/Infinity/.test(b)) return ok(`${head} = ${outTex(direct)}`, direct)

  const a0 = num(a)
  if (a0 == null || !Number.isInteger(a0) || /Infinity/.test(b)) throw new SymFail(`${CANT} Probá con límites finitos.`, plan)
  const at = (j: number) => str(e, { [k]: String(j) })
  const partial = (m: number) => str(`sum(${e}, ${k}, ${a0}, ${m})`)

  // Polinomio en k de grado d → la suma es un polinomio de grado d + 1 en el límite superior.
  for (let d = 0; d <= 8; d++) {
    if (str(`diff(${e}, ${k}, ${d + 1})`) !== '0') continue
    const ms = Array.from({ length: d + 2 }, (_, i) => a0 + i)
    const N = 'n__'
    const lagrange = ms.map((mi, i) => {
      const basis = ms.filter((_, j) => j !== i).map((mj) => `(${N}-${mj})/(${mi - mj})`).join('*')
      return `(${partial(mi)})${basis ? `*${basis}` : ''}`
    }).join('+')
    const closed = str(`factor(expand(${lagrange}))`).replace(/n__/g, `(${b})`)
    const pretty = str(closed)
    const check = num(pretty, Object.fromEntries(variables(b).map((x) => [x, String(a0 + d + 3)])))
    const expected = num(partial(a0 + d + 3))
    if (variables(b).length === 1 && check != null && expected != null && Math.abs(check - expected) > 1e-9 * Math.max(1, Math.abs(expected))) break
    return ok(`${head} = ${outTex(pretty)}`, pretty, ['Fórmula cerrada por interpolación (sumando polinómico), verificada con un caso concreto.'])
  }
  // Geométrica: término general c·rᵏ.
  const t0 = num(at(a0))
  const t1 = num(at(a0 + 1))
  const t2 = num(at(a0 + 2))
  if (t0 && t1 != null && t2 != null && Math.abs(t1 / t0 - t2 / t1) < 1e-12 * Math.max(1, Math.abs(t1 / t0)) && Math.abs(t1 / t0 - 1) > 1e-12) {
    const r = str(`(${at(a0 + 1)})/(${at(a0)})`)
    const closed = str(`(${at(a0)})*((${r})^((${b})-(${a0})+1)-1)/((${r})-1)`)
    return ok(`${head} = ${outTex(closed)}`, closed, ['Serie geométrica de razón ' + r + '.'])
  }
  throw new SymFail(`${CANT} Solo encuentro fórmulas cerradas para sumandos polinómicos o geométricos.`, plan)
}

/* ───────────── Ecuaciones diferenciales ───────────── */

function ode(input: string, v: string, conditions: string): SymbolicResult {
  if (v === 'y') throw new SymFail('La variable independiente no puede ser y.')
  const src = toNerdamer(input).replace(new RegExp(`y\\s*\\(\\s*${v}\\s*\\)`, 'g'), 'y')
  if ([...src.matchAll(asVar('ypp')), ...src.matchAll(asVar('yp')), ...src.matchAll(asVar('yy'))].length) {
    throw new SymFail('Los nombres ypp, yp e yy están reservados.')
  }
  const coded = src.replace(/y''/g, 'ypp').replace(/y'/g, 'yp').replace(asVar('y'), 'yy')
  if (!/=/.test(coded)) throw new SymFail('Escribí la ecuación con «=», p. ej. y\'\' + y = 0.')
  const E = str(equationToZero(coded))
  const order: 1 | 2 | 0 = hasSymbol(E, 'ypp') ? 2 : hasSymbol(E, 'yp') ? 1 : 0
  if (!order) throw new SymFail("No aparece ninguna derivada: usá y' o y''.")
  const conds = parseConditions(conditions)
  const top = order === 2 ? 'ypp' : 'yp'
  const lead = str(`diff(${E}, ${top})`)
  const statement = splitEquations(input)[0]!.split('=').map((s) => inTex(toNerdamer(s).replace(/y''/g, 'ypp').replace(/y'/g, 'yp').replace(asVar('y'), 'yy')).replace(asVar('ypp'), "y''").replace(asVar('yp'), "y'").replace(asVar('yy'), 'y')).join(' = ')

  // Forma explícita para la alternativa numérica (RK4): y^(order) = rhs(x, y, yp).
  const explicit = !/\b(ypp|yp|yy)\b/.test(lead) || (order === 2 && !hasSymbol(lead, 'ypp'))
  const rhsCode = explicit ? str(`-(${str(E, { [top]: '0' })})/(${lead})`) : null
  const plan: NumericPlan | undefined = rhsCode ? { kind: 'ode', order, rhs: rhsCode.replace(asVar('yy'), 'y'), variable: v, conditions } : undefined

  const coef = (s: string) => str(`diff(${E}, ${s})`)
  const a2 = order === 2 ? coef('ypp') : '0'
  const a1 = coef('yp')
  const a0 = coef('yy')
  const g = str(E, { ypp: '0', yp: '0', yy: '0' })
  if ([a2, a1, a0].some((c) => /\b(ypp|yp|yy)\b/.test(c))) {
    throw new SymFail(`${CANT} Solo resuelvo EDO lineales (1.er orden, o 2.º orden con coeficientes constantes).`, plan)
  }
  const f = str(`-(${g})`)
  let general: string
  const consts = order === 2 ? ['C1', 'C2'] : ['C1']
  const notes: string[] = []

  if (order === 2) {
    if ([a2, a1, a0].some((c) => hasSymbol(c, v))) throw new SymFail(`${CANT} Para 2.º orden solo resuelvo coeficientes constantes.`, plan)
    const D = str(`(${a1})^2-4*(${a2})*(${a0})`)
    const Dn = num(D)
    if (Dn == null) throw new SymFail(`${CANT} Los coeficientes deben ser numéricos.`, plan)
    let y1: string
    let y2: string
    if (Math.abs(Dn) < 1e-14) {
      const r = str(`-(${a1})/(2*(${a2}))`)
      y1 = `e^((${r})*${v})`
      y2 = `${v}*e^((${r})*${v})`
      notes.push(`Raíz doble r = ${r}.`)
    } else if (Dn > 0) {
      const r1 = str(`(-(${a1})+sqrt(${D}))/(2*(${a2}))`)
      const r2 = str(`(-(${a1})-sqrt(${D}))/(2*(${a2}))`)
      y1 = `e^((${r1})*${v})`
      y2 = `e^((${r2})*${v})`
      notes.push(`Raíces reales r₁ = ${r1}, r₂ = ${r2}.`)
    } else {
      const al = str(`-(${a1})/(2*(${a2}))`)
      const be = str(`sqrt(-(${D}))/(2*(${a2}))`)
      const ex = al === '0' ? '' : `e^((${al})*${v})*`
      y1 = `${ex}cos((${be})*${v})`
      y2 = `${ex}sin((${be})*${v})`
      notes.push(`Raíces complejas r = ${al} ± ${be}i.`)
    }
    let particular = '0'
    if (f !== '0') {
      let W = str(`simplify((${y1})*diff(${y2}, ${v})-diff(${y1}, ${v})*(${y2}))`)
      const wSample = variables(W).length === 0 ? num(W) : num(W, { [v]: '0.4' })
      if (wSample != null && (variables(W).length === 0 || sameFunction(W, String(wSample), v) === true)) {
        const rounded = Math.round(wSample)
        W = Math.abs(wSample - rounded) < 1e-9 ? String(rounded) : String(Number(wSample.toPrecision(12)))
      }
      const I1 = str(`integrate(simplify((${y2})*(${f})/((${a2})*(${W}))), ${v})`)
      const I2 = str(`integrate(simplify((${y1})*(${f})/((${a2})*(${W}))), ${v})`)
      if (unresolved(I1, 'integrate') || unresolved(I2, 'integrate')) throw new SymFail(`${CANT} No encontré la solución particular (variación de parámetros).`, plan)
      particular = str(`-(${y1})*(${I1})+(${y2})*(${I2})`)
      notes.push('Solución particular por variación de parámetros.')
    }
    general = str(`C1*(${y1})+C2*(${y2})+(${particular})`)
  } else {
    if (a1 === '0') throw new SymFail(CANT, plan)
    const p = str(`(${a0})/(${a1})`)
    const q = str(`(${f})/(${a1})`)
    const P = p === '0' ? '0' : str(`integrate(${p}, ${v})`)
    if (unresolved(P, 'integrate')) throw new SymFail(`${CANT} No pude integrar p(${v}) para el factor integrante.`, plan)
    const mu = `e^(${P})`
    const I = q === '0' ? '0' : str(`integrate((${mu})*(${q}), ${v})`)
    if (unresolved(I, 'integrate')) throw new SymFail(`${CANT} No pude integrar μ·q para la solución.`, plan)
    general = str(`((${I})+C1)/(${mu})`)
    notes.push(`Lineal de 1.er orden: factor integrante μ = e^(${P}).`)
  }

  // Verificación: la solución general cumple la EDO (con constantes arbitrarias).
  const sample: Subs = { C1: '0.7', C2: '-1.3' }
  const residual = str(E, { ypp: `diff(${general}, ${v}, 2)`, yp: `diff(${general}, ${v})`, yy: `(${general})` })
  const holds = sameFunction(residual, '0', v, sample)
  if (holds === false) throw new SymFail(`${CANT} La solución obtenida no verifica la ecuación.`, plan)

  let solution = general
  if (conds.length) {
    if (conds.some((c) => c.derivative >= order)) throw new SymFail('Hay más derivadas en las condiciones que el orden de la ecuación.')
    const eqs = conds.map((c) => {
      const expr = c.derivative === 0 ? general : str(`diff(${general}, ${v}, ${c.derivative})`)
      return `${str(expr, { [v]: toNerdamer(c.at) })}=${toNerdamer(c.value)}`
    })
    const unknown = consts.slice(0, Math.min(consts.length, conds.length))
    let fixed: [string, string][] = []
    try {
      fixed = solveSystem(eqs, unknown)
    } catch {
      fixed = []
    }
    if (!fixed.length) throw new SymFail('Las condiciones iniciales no determinan las constantes (¿son incompatibles?).', plan)
    solution = str(general, Object.fromEntries(fixed))
    notes.push(`Constantes: ${fixed.map(([k, val]) => `${k} = ${val}`).join(', ')}.`)
  }
  return ok(`${statement} \\;\\Rightarrow\\; y(${v}) = ${outTex(solution)}`, solution, notes, plan, `y(${v}) = ${outTex(solution)}`)
}

/* ───────────── Entrada ───────────── */

export function runSymbolic(req: SymbolicRequest): SymbolicResult {
  const plan = numericPlanFor(req)
  let result: SymbolicResult
  try {
    const e = toNerdamer(req.expr)
    if (!e) throw new SymFail('Escribí una expresión.')
    if (e.length > MAX_LENGTH) throw new SymFail('La expresión es demasiado larga.')
    const v = (req.variable?.trim() || DEFAULT_VARIABLE[req.op] || 'x')
    if (!IDENT.test(v)) throw new SymFail(`Variable inválida: ${v}`)
    const order = Math.max(1, Math.min(req.op === 'taylor' ? 12 : 10, Math.round(req.order ?? (req.op === 'taylor' ? 5 : 1))))
    switch (req.op) {
      case 'derive': result = derive(e, v, order); break
      case 'integrate': result = integrate(e, v, req.lower, req.upper); break
      case 'limit': result = limit(e, v, req.point ?? '0'); break
      case 'solve': result = solve(e, splitList(req.unknowns)); break
      case 'simplify':
      case 'expand':
      case 'factor': result = transform(req.op, e); break
      case 'taylor': result = taylor(e, v, req.point ?? '0', order); break
      case 'sum': result = sum(e, v, req.lower ?? '', req.upper ?? ''); break
      case 'ode': result = ode(req.expr, v, req.conditions ?? ''); break
      default: throw new SymFail('Operación desconocida')
    }
  } catch (err) {
    if (err instanceof SymFail) result = { ok: false, error: err.message, numeric: err.numeric }
    else {
      const msg = (err as Error).message ?? String(err)
      result = /expected|unexpected|invalid|not a valid|syntax|missing/i.test(msg)
        ? { ok: false, error: `Sintaxis inválida: ${msg}` }
        : { ok: false, error: `${CANT} (${msg})`, numeric: plan }
    }
  } finally {
    try {
      nerdamer.flush()
    } catch {
      /* sin historial que limpiar */
    }
  }
  return result
}
