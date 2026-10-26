import { compileExpression, formatValue } from './calculator'
import { parseConditions, type NumericPlan } from './symbolicTypes'
import { solveSystem } from './linear'

export type NumericValue = { text: string; note: string }

const fmt = (x: number) => formatValue(x, 'auto', 8)

function fn(expr: string, vars: string[]): (scope: Record<string, number>) => number {
  return compileExpression(expr, vars)
}

function scalar(expr: string): number {
  const v = fn(expr, [])({})
  if (!Number.isFinite(v)) throw new Error(`No pude interpretar «${expr}» como número`)
  return v
}

function bound(expr: string): number {
  const t = expr.trim()
  if (/^(∞|inf(inity)?)$/i.test(t)) return Infinity
  if (/^(-∞|-inf(inity)?)$/i.test(t)) return -Infinity
  return scalar(t)
}

function d1(f: (x: number) => number, x: number): number {
  let h = 1e-2
  let prev = (f(x + h) - f(x - h)) / (2 * h)
  for (let k = 0; k < 8; k++) {
    h /= 2
    const cur = (f(x + h) - f(x - h)) / (2 * h)
    const ext = (4 * cur - prev) / 3
    if (Number.isFinite(ext) && Math.abs(ext - cur) <= 1e-10 * Math.max(1, Math.abs(ext))) return ext
    prev = Number.isFinite(ext) ? ext : cur
  }
  if (!Number.isFinite(prev)) throw new Error('La derivada numérica no está definida en ese punto')
  return prev
}

function quad(f: (x: number) => number, a: number, b: number): number {
  const rec = (lo: number, hi: number, fa: number, fm: number, fb: number, s: number, depth: number): number => {
    const mid = (lo + hi) / 2
    const h = (hi - lo) / 2
    const fl = f((lo + mid) / 2)
    const fr = f((mid + hi) / 2)
    const sl = (h / 6) * (fa + 4 * fl + fm)
    const sr = (h / 6) * (fm + 4 * fr + fb)
    const both = sl + sr
    if (depth >= 16 || Math.abs(both - s) <= 1e-9 * Math.max(1, Math.abs(both))) return both + (both - s) / 15
    return rec(lo, mid, fa, fl, fm, sl, depth + 1) + rec(mid, hi, fm, fr, fb, sr, depth + 1)
  }
  const fa = f(a)
  const fb = f(b)
  const mid = (a + b) / 2
  const fm = f(mid)
  if (![fa, fb, fm].every(Number.isFinite)) throw new Error('El integrando no está definido en el intervalo')
  return rec(a, b, fa, fm, fb, ((b - a) / 6) * (fa + 4 * fm + fb), 0)
}

function integrate(f: (x: number) => number, a: number, b: number): number {
  if (a === b) return 0
  const sign = b < a ? -1 : 1
  const [lo, hi] = b < a ? [b, a] : [a, b]
  const finite = (x0: number, x1: number) => quad(f, x0, x1)
  if (Number.isFinite(lo) && Number.isFinite(hi)) return sign * finite(lo, hi)
  const tail = (from: number, dir: 1 | -1) => quad((t) => {
    const x = from + dir * (t / (1 - t))
    const y = f(x)
    return Number.isFinite(y) ? y / (1 - t) ** 2 : 0
  }, 0, 1 - 1e-8)
  if (Number.isFinite(lo) && hi === Infinity) return sign * tail(lo, 1)
  if (lo === -Infinity && Number.isFinite(hi)) return sign * tail(hi, -1)
  throw new Error('Para una integral en toda la recta usá un intervalo finito o semi-infinito')
}

/** Alternativa numérica cuando el motor simbólico no llega. */
export function runNumeric(plan: NumericPlan, opt: { at?: string } = {}): NumericValue {
  if (plan.kind === 'derivative') {
    const f = fn(plan.expr, [plan.variable])
    const x = opt.at?.trim() ? scalar(opt.at) : 0
    let d = (z: number) => f({ [plan.variable]: z })
    for (let k = 0; k < plan.order; k++) {
      const g = d
      d = (z) => d1(g, z)
    }
    const y = d(x)
    if (!Number.isFinite(y)) throw new Error('La derivada numérica no está definida en ese punto')
    return { text: fmt(y), note: `Derivada numérica de orden ${plan.order} en ${plan.variable} = ${fmt(x)} (diferencias centrales).` }
  }
  if (plan.kind === 'integral') {
    const f = fn(plan.expr, [plan.variable])
    if (!plan.lower || !plan.upper) throw new Error('La integral indefinida no tiene alternativa numérica: indicá los límites.')
    const y = integrate((x) => f({ [plan.variable]: x }), bound(plan.lower), bound(plan.upper))
    return { text: fmt(y), note: 'Integral numérica (Simpson adaptativo).' }
  }
  if (plan.kind === 'limit') {
    const f = fn(plan.expr, [plan.variable])
    const p = bound(plan.point)
    if (!Number.isFinite(p)) {
      const ys = [2, 3, 4, 5, 6].map((k) => f({ [plan.variable]: Math.sign(p) * 10 ** k })).filter(Number.isFinite)
      if (ys.length < 2) throw new Error('El límite numérico no parece finito')
      return { text: fmt(ys[ys.length - 1]!), note: `Estimación con ${plan.variable} → ${p < 0 ? '−' : '+'}∞.` }
    }
    const seq = (sign: number) => [1e-2, 1e-3, 1e-4, 1e-5, 1e-6].map((h) => f({ [plan.variable]: p + sign * h }))
    const settle = (ys: number[]) => {
      const ok = ys.filter(Number.isFinite)
      if (ok.length < 3) return null
      const a = ok[ok.length - 1]!
      const b = ok[ok.length - 2]!
      return Math.abs(a - b) <= 1e-4 * Math.max(1, Math.abs(a)) ? a : null
    }
    const right = settle(seq(1))
    const left = settle(seq(-1))
    if (right != null && left != null && Math.abs(right - left) <= 1e-3 * Math.max(1, Math.abs(right), Math.abs(left))) {
      return { text: fmt((right + left) / 2), note: 'Límite numérico bilateral.' }
    }
    if (right != null) return { text: fmt(right), note: 'Solo el lateral derecho es finito.' }
    if (left != null) return { text: fmt(left), note: 'Solo el lateral izquierdo es finito.' }
    throw new Error('El límite numérico no parece finito')
  }
  if (plan.kind === 'roots') {
    const f = fn(plan.expr, [plan.variable])
    const g = (x: number) => f({ [plan.variable]: x })
    const roots: number[] = []
    let prev = -20
    let fp = g(prev)
    for (let x = -19.75; x <= 20; x += 0.25) {
      const fx = g(x)
      if (Number.isFinite(fp) && Number.isFinite(fx) && fp === 0) roots.push(prev)
      if (Number.isFinite(fp) && Number.isFinite(fx) && fp * fx < 0) {
        let a = prev
        let b = x
        let fa = fp
        for (let k = 0; k < 60; k++) {
          const m = (a + b) / 2
          const fm = g(m)
          if (!Number.isFinite(fm) || Math.abs(fm) < 1e-12 || b - a < 1e-10) { roots.push(m); break }
          if (fa * fm <= 0) { b = m } else { a = m; fa = fm }
        }
      }
      prev = x
      fp = fx
    }
    const uniq = roots.filter((r, i) => roots.every((o, j) => j >= i || Math.abs(o - r) > 1e-4))
    if (!uniq.length) throw new Error('No encontré raíces reales en [−20, 20]')
    return { text: uniq.map((r) => `${plan.variable} ≈ ${fmt(r)}`).join('; '), note: 'Raíces reales por barrido y bisección en [−20, 20]. Puede haber otras fuera del rango.' }
  }
  if (plan.kind === 'system') {
    if (!plan.unknowns.length || plan.unknowns.length !== plan.exprs.length) throw new Error('El sistema numérico necesita tantas ecuaciones como incógnitas')
    const fs = plan.exprs.map((e) => fn(e, plan.unknowns))
    const n = plan.unknowns.length
    const starts = [0, 1, -1, 0.5].map((v) => Array<number>(n).fill(v))
    for (const x0 of starts) {
      const x = x0.slice()
      for (let k = 0; k < 30; k++) {
        const F = fs.map((f) => f(Object.fromEntries(plan.unknowns.map((u, i) => [u, x[i]!])) ))
        if (F.every((v) => Number.isFinite(v) && Math.abs(v) < 1e-8)) {
          return { text: plan.unknowns.map((u, i) => `${u} ≈ ${fmt(x[i]!)}`).join('; '), note: 'Newton multivariable. En sistemas no lineales puede haber otras soluciones.' }
        }
        const J = F.map((_, i) => plan.unknowns.map((_, j) => {
          const h = 1e-6 * Math.max(1, Math.abs(x[j]!))
          const xp = x.slice()
          xp[j] = x[j]! + h
          const scope = Object.fromEntries(plan.unknowns.map((u, t) => [u, xp[t]!]))
          return (fs[i]!(scope) - F[i]!) / h
        }))
        const step = solveSystem(J, F.map((v) => -v))
        if (step.kind !== 'unique') break
        for (let i = 0; i < n; i++) x[i] = x[i]! + step.x[i]!
      }
    }
    throw new Error('El método de Newton no convergió desde los puntos de partida probados')
  }
  if (plan.kind === 'sum') {
    const f = fn(plan.expr, [plan.variable])
    const a = Math.round(bound(plan.lower))
    const b = Math.round(bound(plan.upper))
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('La suma numérica necesita límites finitos')
    if (b < a || b - a > 100_000) throw new Error('El rango de la suma es demasiado grande para sumar término a término')
    let s = 0
    for (let k = a; k <= b; k++) {
      const y = f({ [plan.variable]: k })
      if (!Number.isFinite(y)) throw new Error(`El término ${plan.variable} = ${k} no está definido`)
      s += y
    }
    return { text: fmt(s), note: `Suma directa de ${b - a + 1} términos.` }
  }
  const f = fn(plan.rhs, plan.order === 2 ? [plan.variable, 'y', 'yp'] : [plan.variable, 'y'])
  const conds = parseConditions(plan.conditions)
  const t0 = conds[0] ? scalar(conds[0].at) : 0
  const y0 = Number(conds.find((c) => c.derivative === 0) ? scalar(conds.find((c) => c.derivative === 0)!.value) : 0)
  const yp0 = plan.order === 2 ? Number(conds.find((c) => c.derivative === 1) ? scalar(conds.find((c) => c.derivative === 1)!.value) : 0) : 0
  const t1 = opt.at?.trim() ? scalar(opt.at) : t0 + 1
  const steps = Math.max(20, Math.ceil(Math.abs(t1 - t0) * 200))
  const h = (t1 - t0) / steps
  let t = t0
  let y = y0
  let yp = yp0
  const rhs = (tt: number, yy: number, ypp: number) => f({ [plan.variable]: tt, y: yy, yp: ypp })
  for (let k = 0; k < steps; k++) {
    if (plan.order === 1) {
      const k1 = rhs(t, y, 0)
      const k2 = rhs(t + h / 2, y + h * k1 / 2, 0)
      const k3 = rhs(t + h / 2, y + h * k2 / 2, 0)
      const k4 = rhs(t + h, y + h * k3, 0)
      y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4)
    } else {
      const acc = (tt: number, yy: number, vv: number) => rhs(tt, yy, vv)
      const k1y = yp
      const k1v = acc(t, y, yp)
      const k2y = yp + h * k1v / 2
      const k2v = acc(t + h / 2, y + h * k1y / 2, k2y)
      const k3y = yp + h * k2v / 2
      const k3v = acc(t + h / 2, y + h * k2y / 2, k3y)
      const k4y = yp + h * k3v
      const k4v = acc(t + h, y + h * k3y, k4y)
      y += (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y)
      yp += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)
    }
    t += h
  }
  if (!Number.isFinite(y)) throw new Error('La integración numérica de la EDO divergió')
  return { text: `y(${fmt(t1)}) ≈ ${fmt(y)}`, note: 'Runge–Kutta de orden 4 sobre la forma explícita.' }
}
