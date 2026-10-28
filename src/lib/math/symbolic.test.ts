import { describe, expect, it } from 'vitest'
import { num, recognize, runSymbolic } from './symbolic'
import type { SymbolicRequest } from './symbolicTypes'
import { parseConditions } from './symbolicTypes'

const run = (req: SymbolicRequest) => {
  const r = runSymbolic(req)
  if (!r.ok) throw new Error(r.error)
  return r
}
/** f y g iguales numéricamente en algunos puntos. */
const same = (f: string, g: string, v = 'x') => {
  for (const p of ['0.3', '0.9', '1.7']) {
    const a = num(f, { [v]: p })
    if (a == null) throw new Error(`no numera «${f}»`)
    expect(a).toBeCloseTo(num(g, { [v]: p })!, 8)
  }
}

describe('runSymbolic — criterios de aceptación', () => {
  it('deriva x^2 sin(x)', () => {
    const r = run({ op: 'derive', expr: 'x^2 sin(x)' })
    same(r.result, '2*x*sin(x)+x^2*cos(x)')
    expect(r.resultLatex).toContain('\\sin')
  })
  it('integra 1/(1+x^2) entre 0 y 1 = π/4', () => {
    const r = run({ op: 'integrate', expr: '1/(1+x^2)', lower: '0', upper: '1' })
    expect(r.approx).toBeCloseTo(Math.PI / 4, 12)
    expect(r.recognized).toBe('\\frac{\\pi}{4}')
  })
  it('resuelve un sistema 2×2', () => {
    const r = run({ op: 'solve', expr: '2x + y = 5\nx - y = 1' })
    expect(r.result).toBe('x = 2; y = 1')
  })
})

describe('runSymbolic — resto de operaciones', () => {
  it('derivada de orden n', () => {
    same(run({ op: 'derive', expr: 'sin(x)', order: 3 }).result, '-cos(x)')
  })
  it('integral indefinida con ln', () => {
    const r = run({ op: 'integrate', expr: '1/x' })
    expect(r.latex).toContain('+ C')
    same(r.result, 'log(x)')
  })
  it('integral impropia hasta ∞', () => {
    expect(run({ op: 'integrate', expr: 'e^(-x)', lower: '0', upper: '∞' }).approx).toBeCloseTo(1, 12)
  })
  it('integral sin primitiva elemental → alternativa numérica', () => {
    const r = runSymbolic({ op: 'integrate', expr: 'e^(-x^2) * log(x+2)', lower: '0', upper: '1' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/No pude resolver/)
      expect(r.numeric?.kind).toBe('integral')
    }
  })
  it('límites', () => {
    expect(run({ op: 'limit', expr: 'sin(x)/x', point: '0' }).result).toBe('1')
    expect(run({ op: 'limit', expr: '(1+1/x)^x', point: 'inf' }).recognized).toBe('e')
  })
  it('ecuación cuadrática y verificación', () => {
    expect(run({ op: 'solve', expr: 'x^2 - 5x + 6 = 0' }).result).toBe('x = 2; x = 3')
  })
  it('sistema 3×3', () => {
    expect(run({ op: 'solve', expr: 'x+y+z=6; x-y+z=2; x+y-z=0' }).result.replace(/\s/g, '')).toBe('x=1;y=2;z=3')
  })
  it('simplificar, expandir, factorizar', () => {
    same(run({ op: 'expand', expr: '(x+1)^2' }).result, '(x+1)^2')
    same(run({ op: 'factor', expr: 'x^2-1' }).result, '(x-1)*(x+1)')
    same(run({ op: 'simplify', expr: 'sin(x)^2+cos(x)^2' }).result, '1')
  })
  it('Taylor de e^x y de sin(x)', () => {
    same(run({ op: 'taylor', expr: 'e^x', order: 3 }).result, '1+x+x^2/2+x^3/6')
    same(run({ op: 'taylor', expr: 'sin(x)', order: 5 }).result, 'x-x^3/6+x^5/120')
  })
  it('Taylor centrada en a', () => {
    same(run({ op: 'taylor', expr: 'log(x)', point: '1', order: 2 }).result, '(x-1)-(x-1)^2/2')
  })
  it('sumatorias cerradas', () => {
    same(run({ op: 'sum', expr: 'k', lower: '1', upper: 'n' }).result, 'n*(n+1)/2', 'n')
    same(run({ op: 'sum', expr: 'k^2', lower: '1', upper: 'n' }).result, 'n*(n+1)*(2n+1)/6', 'n')
    same(run({ op: 'sum', expr: '2^k', lower: '0', upper: 'n' }).result, '2^(n+1)-1', 'n')
    expect(run({ op: 'sum', expr: 'k^2', lower: '1', upper: '10' }).result).toBe('385')
  })
  it('EDO de 1.er orden lineal con condición', () => {
    const r = run({ op: 'ode', expr: "y' + y = 0", conditions: 'y(0)=2' })
    same(r.result, '2*e^(-x)')
  })
  it('EDO de 1.er orden no homogénea', () => {
    const r = run({ op: 'ode', expr: "y' = x - y", conditions: 'y(0)=1' })
    same(r.result, 'x-1+2*e^(-x)')
  })
  it('EDO de 2.º orden: oscilador armónico', () => {
    same(run({ op: 'ode', expr: "y'' + 4y = 0", conditions: "y(0)=1, y'(0)=0" }).result, 'cos(2x)')
  })
  it('EDO de 2.º orden: raíces reales, doble y forzada', () => {
    same(run({ op: 'ode', expr: "y'' - 3y' + 2y = 0", conditions: "y(0)=0, y'(0)=1" }).result, 'e^(2x)-e^x')
    same(run({ op: 'ode', expr: "y'' + 2y' + y = 0", conditions: "y(0)=1, y'(0)=0" }).result, '(1+x)*e^(-x)')
    same(run({ op: 'ode', expr: "y'' + y = 1", conditions: "y(0)=0, y'(0)=0" }).result, '1-cos(x)')
  })
  it('EDO no lineal → mensaje y alternativa numérica', () => {
    const r = runSymbolic({ op: 'ode', expr: "y' = y^2 + x", conditions: 'y(0)=0' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.numeric?.kind).toBe('ode')
  })
  it('errores claros', () => {
    expect(runSymbolic({ op: 'derive', expr: '' })).toMatchObject({ ok: false })
    expect(runSymbolic({ op: 'derive', expr: 'x^2 +* 3' })).toMatchObject({ ok: false })
    expect(() => parseConditions('z(0)=1')).toThrow(/No entiendo/)
  })
})

describe('recognize', () => {
  it('reconoce constantes', () => {
    expect(recognize(Math.PI / 4)).toBe('\\frac{\\pi}{4}')
    expect(recognize(-2 * Math.sqrt(3) / 3)).toBe('-\\frac{2\\sqrt{3}}{3}')
    expect(recognize(0.123456789)).toBeNull()
  })
})
