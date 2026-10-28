import { describe, expect, it } from 'vitest'
import { runNumeric } from './numeric'

describe('runNumeric', () => {
  it('deriva x^2 en 3', () => {
    expect(Number(runNumeric({ kind: 'derivative', expr: 'x^2', variable: 'x', order: 1 }, { at: '3' }).text)).toBeCloseTo(6, 6)
  })
  it('integra 1/(1+x^2) de 0 a 1', () => {
    const y = Number(runNumeric({ kind: 'integral', expr: '1/(1+x^2)', variable: 'x', lower: '0', upper: '1' }).text)
    expect(y).toBeCloseTo(Math.PI / 4, 6)
  })
  it('límite sin(x)/x', () => {
    expect(Number(runNumeric({ kind: 'limit', expr: 'sin(x)/x', variable: 'x', point: '0' }).text)).toBeCloseTo(1, 4)
  })
  it('raíces y sistema', () => {
    expect(runNumeric({ kind: 'roots', expr: 'x^2-5*x+6', variable: 'x' }).text).toMatch(/2/)
    expect(runNumeric({ kind: 'roots', expr: 'x^2-5*x+6', variable: 'x' }).text).toMatch(/3/)
    const s = runNumeric({ kind: 'system', exprs: ['2*x+y-5', 'x-y-1'], unknowns: ['x', 'y'] }).text
    expect(s).toMatch(/x ≈ 2/)
    expect(s).toMatch(/y ≈ 1/)
  })
  it('suma y EDO', () => {
    expect(Number(runNumeric({ kind: 'sum', expr: 'k', variable: 'k', lower: '1', upper: '10' }).text)).toBe(55)
    const y = runNumeric({ kind: 'ode', order: 1, rhs: '-y', variable: 'x', conditions: 'y(0)=2' }, { at: '1' }).text
    expect(y).toMatch(/0\.7357/)
  })
})
