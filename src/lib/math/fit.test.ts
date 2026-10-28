import { describe, expect, it } from 'vitest'
import { evaluateExpression } from './calculator'
import { fitData, FitError, fmtSig, logTicks, niceTicks, polyfit } from './fit'

const pts = (xs: number[], f: (x: number) => number) => xs.map((x) => ({ x, y: f(x) }))

describe('ajuste lineal — caso calculado a mano (8 puntos)', () => {
  // x = 1…8, y = 2 4 5 4 5 7 8 9
  // x̄ = 4,5  ȳ = 5,5  Sxx = 42  Sxy = 38  Syy = 38
  // m = 38/42 = 19/21   b = 5,5 − (19/21)·4,5 = 10/7   R² = 38²/(42·38) = 19/21
  // SSE = 38 − (19/21)·38 = 76/21   s² = SSE/6
  // SE(m) = √(s²/Sxx)   SE(b) = √(s²·(1/8 + x̄²/Sxx))
  const data = [2, 4, 5, 4, 5, 7, 8, 9].map((y, i) => ({ x: i + 1, y }))
  const fit = fitData(data, 'linear')
  const s2 = 76 / 21 / 6

  it('pendiente, ordenada y R²', () => {
    expect(fit.params[0]!.value).toBeCloseTo(19 / 21, 12)
    expect(fit.params[1]!.value).toBeCloseTo(10 / 7, 12)
    expect(fit.r2).toBeCloseTo(19 / 21, 12)
    expect(fit.n).toBe(8)
  })

  it('errores estándar', () => {
    expect(fit.params[0]!.se).toBeCloseTo(Math.sqrt(s2 / 42), 12)
    expect(fit.params[1]!.se).toBeCloseTo(Math.sqrt(s2 * (1 / 8 + 4.5 ** 2 / 42)), 12)
  })

  it('residuos, predicción, LaTeX y expresión evaluable', () => {
    expect(fit.residuals.reduce((a, r) => a + r.r, 0)).toBeCloseTo(0, 12)
    expect(fit.predict(10)).toBeCloseTo((19 / 21) * 10 + 10 / 7, 12)
    expect(fit.latex).toBe('y = 0.9048\\,x + 1.429')
    const v = evaluateExpression(fit.expression, { variables: { x: 10 } })
    expect(v as number).toBeCloseTo(fit.predict(10), 9)
  })
})

describe('otros modelos sobre datos exactos', () => {
  const xs = [1, 2, 3, 4, 5, 6]

  it('cuadrático', () => {
    const f = fitData(pts(xs, (x) => 2 * x * x - 3 * x + 1), 'poly', 2)
    expect(f.params.map((p) => p.value)).toEqual([expect.closeTo(2, 9), expect.closeTo(-3, 9), expect.closeTo(1, 9)])
    expect(f.r2).toBeCloseTo(1, 12)
    expect(f.latex).toBe('y = 2\\,x^{2} - 3\\,x + 1')
  })

  it('grado 5 con x grandes sigue estable', () => {
    const big = [100, 110, 120, 130, 140, 150, 160, 170]
    const g = (x: number) => 1e-8 * x ** 5 - 2e-5 * x ** 3 + x - 7
    const f = fitData(pts(big, g), 'poly', 5)
    expect(f.predict(135) / g(135)).toBeCloseTo(1, 6)
    expect(f.r2).toBeCloseTo(1, 9)
  })

  it('exponencial, potencial y logarítmico', () => {
    const e = fitData(pts(xs, (x) => 3 * Math.exp(0.5 * x)), 'exp')
    expect(e.params[0]!.value).toBeCloseTo(3, 9)
    expect(e.params[1]!.value).toBeCloseTo(0.5, 9)
    expect(e.linearized).toBe(true)
    const p = fitData(pts(xs, (x) => 2 * x ** 1.5), 'power')
    expect(p.params.map((q) => q.value)).toEqual([expect.closeTo(2, 9), expect.closeTo(1.5, 9)])
    const l = fitData(pts(xs, (x) => 1 + 2 * Math.log(x)), 'log')
    expect(l.params.map((q) => q.value)).toEqual([expect.closeTo(1, 9), expect.closeTo(2, 9)])
    for (const f of [e, p, l]) expect(evaluateExpression(f.expression, { variables: { x: 2.5 } }) as number).toBeCloseTo(f.predict(2.5), 8)
  })

  it('descarta puntos fuera del dominio del modelo', () => {
    const f = fitData([{ x: 0, y: -1 }, ...pts(xs, (x) => Math.exp(x))], 'exp')
    expect(f.dropped).toBe(1)
    expect(f.n).toBe(6)
  })

  it('sin grados de libertad no hay error estándar', () => {
    const f = fitData([{ x: 0, y: 1 }, { x: 1, y: 3 }], 'linear')
    expect(f.params[0]!.se).toBeNull()
    expect(f.params[0]!.value).toBeCloseTo(2, 12)
  })

  it('errores claros', () => {
    expect(() => fitData([{ x: 1, y: 1 }], 'linear')).toThrow(FitError)
    expect(() => polyfit([1, 2, 3], [1, 2, 3], 3)).toThrow(/al menos 4/)
    expect(() => fitData(pts([2, 2, 2, 3], (x) => x), 'poly', 2)).toThrow(/x repetidos/)
    expect(() => fitData([{ x: 1, y: -1 }, { x: 2, y: -2 }], 'exp')).toThrow(/y > 0/)
  })
})

describe('ejes y formato', () => {
  it('niceTicks', () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10])
    expect(niceTicks(0.13, 0.87, 4)).toEqual([0.2, 0.4, 0.6, 0.8])
    expect(niceTicks(-1, 1, 4)).toEqual([-1, -0.5, 0, 0.5, 1])
  })

  it('logTicks', () => {
    expect(logTicks(0.5, 2000)).toEqual([1, 10, 100, 1000])
    expect(logTicks(2, 8).length).toBeGreaterThan(1)
    expect(logTicks(-1, 10)).toEqual([])
  })

  it('fmtSig', () => {
    expect(fmtSig(0.904761)).toBe('0.9048')
    expect(fmtSig(123456)).toBe('1.235e5')
    expect(fmtSig(-0.00012)).toBe('-1.2e-4')
  })
})
