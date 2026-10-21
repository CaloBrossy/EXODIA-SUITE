import { describe, expect, it } from 'vitest'
import { CalcError, evaluateExpression as ev, formatValue, freeSymbols } from './calculator'

const num = (expr: string, opts = {}) => ev(expr, opts) as number

describe('calculadora científica', () => {
  it('aritmética y precedencia', () => {
    expect(num('2 + 3 * 4')).toBe(14)
    expect(num('(2 + 3) * 4')).toBe(20)
    expect(num('-2^2')).toBe(-4)
    expect(num('2^3^2')).toBe(512)
    expect(num('10 / 4')).toBe(2.5)
    expect(num('7 mod 3')).toBe(1)
    expect(num('5!')).toBe(120)
  })

  it('potencias, raíces y logaritmos', () => {
    expect(num('sqrt(16)')).toBe(4)
    expect(num('cbrt(27)')).toBeCloseTo(3, 12)
    expect(num('nthRoot(32, 5)')).toBeCloseTo(2, 12)
    expect(num('ln(e)')).toBeCloseTo(1, 15)
    expect(num('log(e^2)')).toBeCloseTo(2, 14)
    expect(num('log10(1000)')).toBeCloseTo(3, 14)
    expect(num('log2(8)')).toBe(3)
    expect(num('log(8, 2)')).toBeCloseTo(3, 14)
    expect(num('√(9)')).toBe(3)
  })

  it('trigonometría en radianes y grados', () => {
    expect(num('sin(pi/2)')).toBeCloseTo(1, 15)
    expect(num('cos(π)')).toBeCloseTo(-1, 15)
    expect(num('sin(30)', { angle: 'deg' })).toBeCloseTo(0.5, 14)
    expect(num('asin(1)', { angle: 'deg' })).toBeCloseTo(90, 12)
    expect(num('sin(asin(0.5))', { angle: 'deg' })).toBeCloseTo(0.5, 12)
    expect(num('cos(cos(0)*60)', { angle: 'deg' })).toBeCloseTo(0.5, 12)
  })

  it('constantes y notación científica', () => {
    expect(num('pi')).toBe(Math.PI)
    expect(num('tau')).toBeCloseTo(2 * Math.PI, 15)
    expect(num('6.02214076e23 * 2')).toBeCloseTo(1.204428152e24, -14)
    expect(num('1.6e-19 / 2')).toBeCloseTo(8e-20, 30)
    expect(num('2pi')).toBeCloseTo(2 * Math.PI, 15)
  })

  it('números complejos', () => {
    expect(ev('sqrt(-4)')).toEqual({ re: 0, im: 2 })
    expect(ev('(2+3i)*(1-i)')).toEqual({ re: 5, im: 1 })
    expect(formatValue(ev('3-4i'))).toBe('3 − 4i')
  })

  it('variables declaradas', () => {
    expect(num('m * a', { variables: { m: 2, a: 5 } })).toBe(10)
    expect(freeSymbols('0.5*m*v^2 + pi')).toEqual(['m', 'v'])
  })

  it('rechaza entradas inválidas o peligrosas', () => {
    const bad = [
      '',
      '2 +',
      '1/0',
      'x + 1',
      'import({}, {})',
      'evaluate("1+1")',
      'f(x) = x^2',
      'a = 3',
      '[1, 2]',
      '{a: 1}',
      '"hola"',
      'cos.constructor',
      '1 == 1',
      'sqrt',
      '5 cm',
      'parse("1")',
      'createUnit("foo")',
    ]
    for (const e of bad) expect(() => ev(e), e).toThrow(CalcError)
  })

  it('formatos de salida', () => {
    expect(formatValue(1234.5)).toBe('1234.5')
    expect(formatValue(1e-9)).toBe('1e-9')
    expect(formatValue(12345, 'scientific', 3)).toBe('1.23e4')
    expect(formatValue(0.00047, 'engineering', 3)).toBe('470e-6')
    expect(formatValue(0.1 + 0.2)).toBe('0.3')
  })
})
