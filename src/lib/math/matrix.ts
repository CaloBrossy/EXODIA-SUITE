export class MatrixError extends Error {}

export type Q = { n: bigint; d: bigint }
export type Matrix = Q[][]
export type Step = { text: string; latex: string }

const bi = (n: bigint | number) => BigInt(n)
const abs = (n: bigint) => (n < 0n ? -n : n)
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b))

export function q(n: bigint | number | string, d: bigint | number | string = 1): Q {
  let N = BigInt(n)
  let D = BigInt(d)
  if (D === 0n) throw new MatrixError('División por cero')
  if (D < 0n) { N = -N; D = -D }
  const g = gcd(abs(N), D)
  return { n: N / g, d: D / g }
}

export const qn = (a: Q, b: Q) => a.n === b.n && a.d === b.d
export const isZero = (a: Q) => a.n === 0n
export const isOne = (a: Q) => a.n === 1n && a.d === 1n
export const addQ = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d)
export const subQ = (a: Q, b: Q) => addQ(a, q(-b.n, b.d))
export const mulQ = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d)
export const divQ = (a: Q, b: Q) => {
  if (isZero(b)) throw new MatrixError('División por cero')
  return q(a.n * b.d, a.d * b.n)
}
export const negQ = (a: Q) => q(-a.n, a.d)

/** «3/4», «-1,5», «2». */
export function parseQ(raw: string): Q {
  const t = raw.trim().replace(',', '.')
  if (!t || t === '-') return q(0)
  const m = /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/.exec(t)
  if (m) return q(m[1]!, m[2]!)
  if (t.includes('.')) {
    const neg = t.startsWith('-')
    const [w, f = ''] = t.replace('-', '').split('.')
    if (!/^\d*$/.test(w!) || !/^\d+$/.test(f)) throw new MatrixError(`Fracción inválida: ${raw}`)
    return q((neg ? -1n : 1n) * BigInt((w || '0') + f), 10n ** bi(f.length))
  }
  if (!/^[+-]?\d+$/.test(t)) throw new MatrixError(`Fracción inválida: ${raw}`)
  return q(t)
}

export const texQ = (a: Q): string => {
  if (a.d === 1n) return a.n.toString()
  return `${a.n < 0n ? '-' : ''}\\dfrac{${abs(a.n)}}{${a.d}}`
}
export const texM = (A: Matrix): string => `\\begin{pmatrix} ${A.map((row) => row.map(texQ).join(' & ')).join(' \\\\ ')} \\end{pmatrix}`

const clone = (A: Matrix): Matrix => A.map((row) => row.map((c) => q(c.n, c.d)))
const sameShape = (A: Matrix, B: Matrix) => A.length === B.length && A.every((row, i) => row.length === B[i]!.length)
export const rowsOf = (A: Matrix) => A.length
export const colsOf = (A: Matrix) => A[0]?.length ?? 0

export function assertMatrix(cells: string[][]): Matrix {
  if (!cells.length || cells.some((r) => r.length !== cells[0]!.length) || cells.length > 6 || cells[0]!.length > 6) {
    throw new MatrixError('La matriz debe ser rectangular, de hasta 6×6')
  }
  return cells.map((row) => row.map(parseQ))
}

const dot = (a: Q[], b: Q[]) => a.reduce((s, x, i) => addQ(s, mulQ(x, b[i]!)), q(0))

function swap(M: Matrix, i: number, j: number) {
  ;[M[i], M[j]] = [M[j]!, M[i]!]
}
function scale(M: Matrix, i: number, f: Q) {
  M[i] = M[i]!.map((x) => mulQ(x, f))
}
function combine(M: Matrix, target: number, source: number, f: Q) {
  M[target] = M[target]!.map((x, j) => addQ(x, mulQ(f, M[source]![j]!)))
}

export type Elim = { M: Matrix; steps: Step[]; pivots: number[]; det: Q }

/** Escalonada (solo hacia abajo) o reducida (Gauss-Jordan). */
export function eliminate(input: Matrix, reduced: boolean): Elim {
  const M = clone(input)
  const steps: Step[] = [{ text: reduced ? 'Matriz inicial para Gauss-Jordan.' : 'Matriz inicial para el escalonamiento.', latex: texM(M) }]
  const pivots: number[] = []
  let det = q(1)
  let sign = q(1)
  const rows = rowsOf(M)
  const cols = colsOf(M)
  let r = 0
  for (let c = 0; c < cols && r < rows; c++) {
    let piv = -1
    for (let i = r; i < rows; i++) if (!isZero(M[i]![c]!)) { piv = i; break }
    if (piv < 0) {
      if (rows === cols) det = q(0)
      continue
    }
    if (piv !== r) {
      swap(M, r, piv)
      sign = negQ(sign)
      steps.push({ text: `Se intercambian F${r + 1} y F${piv + 1}.`, latex: texM(M) })
    }
    const pivot = M[r]![c]!
    det = mulQ(det, pivot)
    if (reduced && !isOne(pivot)) {
      const f = divQ(q(1), pivot)
      scale(M, r, f)
      steps.push({ text: `F${r + 1} ← ${texQ(f)}·F${r + 1}, para dejar el pivote en 1.`, latex: texM(M) })
    }
    const down = reduced ? M.map((_, i) => i).filter((i) => i !== r) : Array.from({ length: rows - r - 1 }, (_, k) => r + 1 + k)
    for (const i of down) {
      const coef = reduced ? M[i]![c]! : divQ(M[i]![c]!, M[r]![c]!)
      if (isZero(coef)) continue
      const f = negQ(coef)
      combine(M, i, r, f)
      steps.push({ text: `F${i + 1} ← F${i + 1} + (${texQ(f)})·F${r + 1}.`, latex: texM(M) })
    }
    pivots.push(c)
    r++
  }
  return { M, steps, pivots, det: mulQ(det, sign) }
}

function cofactorDet(A: Matrix, steps: Step[]): Q {
  const rec = (M: Matrix): Q => {
    const n = rowsOf(M)
    if (n === 1) return M[0]![0]!
    let s = q(0)
    for (let j = 0; j < n; j++) {
      const minor = M.slice(1).map((row) => row.filter((_, k) => k !== j))
      const sign = j % 2 === 0 ? q(1) : q(-1)
      s = addQ(s, mulQ(mulQ(sign, M[0]![j]!), rec(minor)))
    }
    return s
  }
  const d = rec(A)
  steps.push({ text: 'Por cofactores, desarrollando por la primera fila, se obtiene el mismo determinante.', latex: texQ(d) })
  return d
}

export function determinant(A: Matrix): { det: Q; steps: Step[] } {
  if (rowsOf(A) !== colsOf(A)) throw new MatrixError('El determinante pide una matriz cuadrada')
  const elim = eliminate(A, false)
  if (rowsOf(A) <= 3) {
    const byCof = cofactorDet(A, elim.steps)
    if (!qn(byCof, elim.det)) throw new MatrixError('El determinante por cofactores no coincide con la eliminación')
  }
  elim.steps.push({ text: 'Determinante = signo de los intercambios × producto de los pivotes.', latex: texQ(elim.det) })
  return { det: elim.det, steps: elim.steps }
}

export function inverse(A: Matrix): { inv: Matrix; steps: Step[] } {
  const n = rowsOf(A)
  if (n !== colsOf(A)) throw new MatrixError('Solo las matrices cuadradas tienen inversa')
  const aug = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? q(1) : q(0)))])
  const g = eliminate(aug, true)
  const left = g.M.map((row) => row.slice(0, n))
  const inv = g.M.map((row) => row.slice(n))
  const id = left.every((row, i) => row.every((v, j) => qn(v, i === j ? q(1) : q(0))))
  if (!id) throw new MatrixError('La matriz es singular: no tiene inversa')
  g.steps.push({ text: 'La mitad derecha de la forma reducida es la inversa.', latex: texM(inv) })
  return { inv, steps: g.steps }
}

export type Solution =
  | { kind: 'unique'; x: Q[]; steps: Step[] }
  | { kind: 'infinite'; particular: Q[]; directions: Q[][]; params: string[]; steps: Step[] }
  | { kind: 'none'; steps: Step[] }

export function solve(A: Matrix, b: Q[]): Solution {
  if (b.length !== rowsOf(A)) throw new MatrixError('El vector b debe tener una entrada por fila')
  const aug = A.map((row, i) => [...row, b[i]!])
  const g = eliminate(aug, true)
  const n = colsOf(A)
  const pivots: number[] = []
  for (let i = 0; i < rowsOf(g.M); i++) {
    const c = g.M[i]!.findIndex((v) => !isZero(v))
    if (c < 0) continue
    if (c === n) return { kind: 'none', steps: [...g.steps, { text: 'Aparece 0 = un número distinto de cero: el sistema es incompatible.', latex: texM(g.M) }] }
    pivots.push(c)
  }
  const free = Array.from({ length: n }, (_, c) => c).filter((c) => !pivots.includes(c))
  if (!free.length) {
    const x = Array.from({ length: n }, () => q(0))
    pivots.forEach((c, i) => { x[c] = g.M[i]![n]! })
    return { kind: 'unique', x, steps: [...g.steps, { text: 'Sistema compatible determinado.', latex: texVec(x) }] }
  }
  const particular = Array.from({ length: n }, () => q(0))
  pivots.forEach((c, i) => { particular[c] = g.M[i]![n]! })
  const names = 'stuvwx'
  const directions = free.map((col) => {
    const v = Array.from({ length: n }, (_, j) => (j === col ? q(1) : q(0)))
    pivots.forEach((c, i) => { v[c] = negQ(g.M[i]![col]!) })
    return v
  })
  const params = free.map((_, i) => names[i] ?? `t_{${i + 1}}`)
  const latex = `${texVec(particular)}${directions.map((v, i) => ` + ${params[i]}\\,${texVec(v)}`).join('')}`
  return { kind: 'infinite', particular, directions, params, steps: [...g.steps, { text: 'Sistema compatible indeterminado. Las columnas sin pivote son parámetros.', latex }] }
}

const texVec = (v: Q[]) => texM(v.map((x) => [x]))

type P = Q[]
const pTrim = (p: P): P => {
  const r = p.slice()
  while (r.length > 1 && isZero(r[r.length - 1]!)) r.pop()
  return r.length ? r : [q(0)]
}
const pAdd = (a: P, b: P): P => pTrim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => addQ(a[i] ?? q(0), b[i] ?? q(0))))
const pScale = (a: P, k: Q) => pTrim(a.map((c) => mulQ(c, k)))
const pMul = (a: P, b: P): P => {
  const r = Array.from({ length: a.length + b.length - 1 }, () => q(0))
  a.forEach((x, i) => b.forEach((y, j) => { r[i + j] = addQ(r[i + j]!, mulQ(x, y)) }))
  return pTrim(r)
}
function detP(M: P[][]): P {
  const n = M.length
  if (n === 1) return M[0]![0]!
  let acc: P = [q(0)]
  for (let j = 0; j < n; j++) {
    const minor = M.slice(1).map((row) => row.filter((_, k) => k !== j))
    acc = pAdd(acc, pMul(pScale(M[0]![j]!, j % 2 ? q(-1) : q(1)), detP(minor)))
  }
  return acc
}
const texP = (p: P) => p.map((c, i) => {
  if (isZero(c)) return ''
  const body = i === 0 ? texQ(c) : `${isOne(c) ? '' : isOne(negQ(c)) ? '-' : texQ(c)}${i === 1 ? '\\lambda' : `\\lambda^{${i}}`}`
  return body
}).filter(Boolean).join(' + ').replaceAll('+ -', '- ') || '0'

function rationalRoots(poly: P): Q[] {
  if (poly.length <= 1) return []
  const den = poly.reduce((d, c) => d * c.d / gcd(d, c.d), 1n)
  const coef = poly.map((c) => c.n * (den / c.d))
  const lead = coef[coef.length - 1]!
  const constant = coef[0]!
  if (constant === 0n) return [q(0), ...rationalRoots(pTrim(poly.slice(1)))]
  const divisors = (n: bigint) => {
    const a = abs(n)
    const out: bigint[] = []
    for (let i = 1n; i * i <= a; i++) if (a % i === 0n) out.push(i, a / i)
    return [...new Set(out)]
  }
  const found: Q[] = []
  for (const p of divisors(constant)) for (const d of divisors(lead)) for (const sign of [1n, -1n]) {
    const root = q(sign * p, d)
    if (found.some((r) => qn(r, root))) continue
    let acc = q(0)
    for (let i = coef.length - 1; i >= 0; i--) acc = addQ(mulQ(acc, root), q(coef[i]!))
    if (isZero(acc)) found.push(root)
  }
  return found
}

export function eigenvalues(A: Matrix): { values: Q[]; steps: Step[]; approx: string[] } {
  const n = rowsOf(A)
  if (n !== colsOf(A) || n > 4) throw new MatrixError('Los autovalores exactos están implementados hasta 4×4')
  const polyM = A.map((row, i) => row.map((a, j) => (i === j ? [a, q(-1)] : [a])))
  const poly = detP(polyM)
  const roots = rationalRoots(poly).filter((r, i, all) => all.findIndex((o) => qn(o, r)) === i)
  const steps: Step[] = [{ text: 'Polinomio característico det(A − λI).', latex: `${texP(poly)} = 0` }]
  if (roots.length) steps.push({ text: 'Raíces racionales (teorema de la raíz racional).', latex: roots.map((r) => `\\lambda = ${texQ(r)}`).join(', ') })
  const approx = numericRoots(poly).filter((z) => Math.abs(z.im) < 1e-8).map((z) => z.re.toPrecision(6))
  if (approx.length && roots.length < n) steps.push({ text: 'Aproximaciones numéricas de las raíces reales.', latex: approx.map((v) => `\\lambda \\approx ${v}`).join(', ') })
  return { values: roots, steps, approx }
}

function numericRoots(poly: P): { re: number; im: number }[] {
  const c = poly.map((a) => Number(a.n) / Number(a.d))
  const n = c.length - 1
  if (n <= 0) return []
  const lead = c[n] || 1
  const coef = c.map((x) => x / lead)
  const z = Array.from({ length: n }, (_, k) => ({ re: 0.4 * Math.cos(2 * Math.PI * k / n), im: 0.4 * Math.sin(2 * Math.PI * k / n) }))
  const evalAt = (re: number, im: number) => {
    let acc = { re: 0, im: 0 }
    for (let i = n; i >= 0; i--) acc = { re: acc.re * re - acc.im * im + coef[i]!, im: acc.re * im + acc.im * re }
    return acc
  }
  for (let iter = 0; iter < 40; iter++) {
    for (let k = 0; k < n; k++) {
      const f = evalAt(z[k]!.re, z[k]!.im)
      let den = { re: 1, im: 0 }
      for (let j = 0; j < n; j++) if (j !== k) {
        const d = { re: z[k]!.re - z[j]!.re, im: z[k]!.im - z[j]!.im }
        den = { re: den.re * d.re - den.im * d.im, im: den.re * d.im + den.im * d.re }
      }
      const m = den.re ** 2 + den.im ** 2 || 1
      z[k] = { re: z[k]!.re - (f.re * den.re + f.im * den.im) / m, im: z[k]!.im - (f.im * den.re - f.re * den.im) / m }
    }
  }
  return z
}

export function nullspace(A: Matrix): Q[][] {
  const sol = solve(A, A.map(() => q(0)))
  return sol.kind === 'infinite' ? sol.directions : []
}

export function eigenvectors(A: Matrix, lambda: Q): Q[][] {
  const shifted = A.map((row, i) => row.map((v, j) => (i === j ? subQ(v, lambda) : v)))
  return nullspace(shifted)
}

export function gramSchmidt(vectors: Matrix): { basis: Matrix; steps: Step[] } {
  const basis: Q[][] = []
  const steps: Step[] = []
  vectors.forEach((u, k) => {
    let v = u.map((x) => q(x.n, x.d))
    basis.forEach((b) => {
      const coef = divQ(dot(u, b), dot(b, b))
      v = v.map((x, i) => subQ(x, mulQ(coef, b[i]!)))
      steps.push({ text: `Al vector ${k + 1} se le resta su proyección.`, latex: `\\mathrm{proj} = ${texQ(coef)}` })
    })
    if (v.every(isZero)) steps.push({ text: `El vector ${k + 1} es combinación lineal de los anteriores.`, latex: '0' })
    else {
      basis.push(v)
      steps.push({ text: `Vector ortogonal ${basis.length}.`, latex: texVec(v) })
    }
  })
  return { basis, steps }
}

export function multiply(A: Matrix, B: Matrix): Matrix {
  if (colsOf(A) !== rowsOf(B)) throw new MatrixError('Las dimensiones no permiten el producto')
  return A.map((row) => B[0]!.map((_, j) => dot(row, B.map((r) => r[j]!))))
}
export function add(A: Matrix, B: Matrix): Matrix {
  if (!sameShape(A, B)) throw new MatrixError('La suma pide matrices del mismo tamaño')
  return A.map((row, i) => row.map((x, j) => addQ(x, B[i]![j]!)))
}
export const transpose = (A: Matrix): Matrix => A[0]!.map((_, j) => A.map((row) => row[j]!))

export type OpResult = { latex: string; steps: Step[] }

export function runMatrix(op: string, A: Matrix, B?: Matrix, vector?: Q[]): OpResult {
  if (op === 'add' && B) return { latex: `${texM(A)} + ${texM(B)} = ${texM(add(A, B))}`, steps: [{ text: 'Se suman las entradas homólogas.', latex: texM(add(A, B)) }] }
  if (op === 'mul' && B) return { latex: `${texM(A)}\\,${texM(B)} = ${texM(multiply(A, B))}`, steps: [{ text: 'Cada entrada es el producto fila por columna.', latex: texM(multiply(A, B)) }] }
  if (op === 'transpose') return { latex: `${texM(A)}^{T} = ${texM(transpose(A))}`, steps: [{ text: 'Se intercambian filas y columnas.', latex: texM(transpose(A)) }] }
  if (op === 'det') {
    const d = determinant(A)
    return { latex: `\\det ${texM(A)} = ${texQ(d.det)}`, steps: d.steps }
  }
  if (op === 'inverse') {
    const r = inverse(A)
    return { latex: `${texM(A)}^{-1} = ${texM(r.inv)}`, steps: r.steps }
  }
  if (op === 'rank' || op === 'ref' || op === 'rref') {
    const g = eliminate(A, op !== 'ref')
    const label = op === 'ref' ? 'Forma escalonada' : op === 'rref' ? 'Forma reducida' : `Rango ${g.pivots.length}`
    return { latex: `${label}: ${texM(g.M)}`, steps: [...g.steps, { text: `Hay ${g.pivots.length} pivote${g.pivots.length === 1 ? '' : 's'}.`, latex: texM(g.M) }] }
  }
  if (op === 'solve' && vector) {
    const s = solve(A, vector)
    return { latex: s.steps[s.steps.length - 1]!.latex, steps: s.steps }
  }
  if (op === 'eigen') {
    const e = eigenvalues(A)
    const vecs = e.values.flatMap((λ) => eigenvectors(A, λ).map((v) => ({ λ, v })))
    const extra = vecs.map(({ λ, v }) => `\\lambda = ${texQ(λ)},\\; v = ${texVec(v)}`)
    return { latex: extra.join(' \\\\ ') || e.steps[0]!.latex, steps: e.steps }
  }
  if (op === 'diag') {
    const e = eigenvalues(A)
    const pairs = e.values.flatMap((λ) => eigenvectors(A, λ).map((v) => ({ λ, v })))
    if (pairs.length !== rowsOf(A)) throw new MatrixError('No junta n autovectores independientes: no es diagonalizable sobre los racionales')
    const P = transpose(pairs.map((p) => p.v))
    const D = P.map((row, i) => row.map((_, j) => (i === j ? pairs[i]!.λ : q(0))))
    return { latex: `P = ${texM(P)},\\; D = ${texM(D)}`, steps: [...e.steps, { text: 'P tiene los autovectores en columnas y D los autovalores.', latex: `P^{-1}AP = D` }] }
  }
  if (op === 'kernel') {
    const basis = nullspace(A)
    return { latex: basis.length ? basis.map(texVec).join(', ') : '\\{0\\}', steps: [{ text: basis.length ? 'Base del núcleo, a partir de la forma reducida.' : 'El núcleo es trivial.', latex: basis.length ? basis.map(texVec).join(',\\ ') : '0' }] }
  }
  if (op === 'image') {
    const g = eliminate(A, true)
    const cols = g.pivots.map((c) => A.map((row) => row[c]!))
    return { latex: cols.length ? cols.map(texVec).join(', ') : '\\{0\\}', steps: [{ text: 'La imagen está generada por las columnas pivote de la matriz original.', latex: cols.map(texVec).join(',\\ ') || '0' }] }
  }
  if (op === 'independent') {
    const g = eliminate(transpose(A), true)
    const ok = g.pivots.length === rowsOf(A)
    return { latex: ok ? '\\text{independientes}' : '\\text{dependientes}', steps: [...g.steps, { text: ok ? 'El rango coincide con la cantidad de vectores.' : 'Hay menos pivotes que vectores: son linealmente dependientes.', latex: `\\mathrm{rango} = ${g.pivots.length}` }] }
  }
  if (op === 'gram') {
    const g = gramSchmidt(A)
    return { latex: g.basis.map(texVec).join(', ') || '0', steps: g.steps }
  }
  throw new MatrixError('Operación no reconocida')
}
