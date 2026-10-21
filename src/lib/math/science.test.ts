import { describe, expect, it } from 'vitest'
import {
  EntropyInputError,
  heatingEntropy,
  idealGasEntropy,
  isothermalReversible,
  parseProbabilities,
  R_GAS,
  shannonEntropy,
  toKelvin,
} from './entropy'
import { convert, QUANTITIES, UnitError } from './units'
import {
  angleBetween,
  cross,
  cross2,
  dot,
  magnitude,
  MathInputError,
  normalize,
  percentChange,
  percentOf,
  solveLinear1,
  solveSystem,
  toEngineering,
  toScientific,
  whatPercent,
} from './linear'

describe('entropía termodinámica', () => {
  it('ΔS = Q/T isotérmico reversible', () => {
    const r = isothermalReversible(334_000, 273.15)
    expect(r.value).toBeCloseTo(1222.77, 1)
    expect(r.unit).toBe('J/K')
    expect(isothermalReversible(-1000, 300).value).toBeCloseTo(-3.3333, 3)
  })
  it('valida temperaturas absolutas', () => {
    expect(() => isothermalReversible(100, 0)).toThrow(EntropyInputError)
    expect(() => isothermalReversible(100, -5)).toThrow(EntropyInputError)
    expect(() => isothermalReversible(NaN, 300)).toThrow(EntropyInputError)
    expect(toKelvin(0, 'C')).toBeCloseTo(273.15, 10)
    expect(toKelvin(32, 'F')).toBeCloseTo(273.15, 10)
  })
  it('gas ideal: expansión isotérmica que duplica el volumen', () => {
    const r = idealGasEntropy({ n: 1, cv: 1.5 * R_GAS, t1: 300, t2: 300, v1: 1, v2: 2 })
    expect(r.value).toBeCloseTo(R_GAS * Math.LN2, 10)
    expect(r.value).toBeCloseTo(5.763, 3)
  })
  it('gas ideal: calentamiento isocórico', () => {
    const r = idealGasEntropy({ n: 2, cv: 20.8, t1: 300, t2: 600, v1: 1, v2: 1 })
    expect(r.value).toBeCloseTo(2 * 20.8 * Math.LN2, 10)
  })
  it('gas ideal: entradas inválidas', () => {
    const base = { n: 1, cv: 12.47, t1: 300, t2: 300, v1: 1, v2: 2 }
    expect(() => idealGasEntropy({ ...base, n: 0 })).toThrow(EntropyInputError)
    expect(() => idealGasEntropy({ ...base, t1: 0 })).toThrow(EntropyInputError)
    expect(() => idealGasEntropy({ ...base, v2: -1 })).toThrow(EntropyInputError)
  })
  it('calentamiento con c constante', () => {
    expect(heatingEntropy(1, 4186, 293.15, 353.15).value).toBeCloseTo(4186 * Math.log(353.15 / 293.15), 8)
  })
})

describe('entropía de Shannon', () => {
  it('casos conocidos', () => {
    expect(shannonEntropy([0.5, 0.5]).bits).toBeCloseTo(1, 12)
    expect(shannonEntropy(Array(6).fill(1 / 6)).bits).toBeCloseTo(Math.log2(6), 12)
    expect(shannonEntropy([0.9, 0.1]).bits).toBeCloseTo(0.469, 3)
    expect(shannonEntropy([1, 0, 0]).bits).toBe(0)
    expect(shannonEntropy([0.25, 0.25, 0.25, 0.25]).efficiency).toBeCloseTo(1, 12)
  })
  it('valida rango y suma', () => {
    expect(() => shannonEntropy([])).toThrow(EntropyInputError)
    expect(() => shannonEntropy([0.5, 0.6])).toThrow(/sumar 1/)
    expect(() => shannonEntropy([1.2, -0.2])).toThrow(/entre 0 y 1/)
    expect(() => shannonEntropy([0.3333333, 0.3333333, 0.3333334])).not.toThrow()
  })
  it('parsea decimales y fracciones', () => {
    expect(parseProbabilities('1/2, 1/4; 0.25')).toEqual([0.5, 0.25, 0.25])
    expect(() => parseProbabilities('0.5 abc')).toThrow(EntropyInputError)
  })
})

describe('conversor de unidades', () => {
  it('conversiones lineales', () => {
    expect(convert(1, 'length', 'in', 'cm')).toBeCloseTo(2.54, 12)
    expect(convert(1, 'length', 'mi', 'km')).toBeCloseTo(1.609344, 12)
    expect(convert(100, 'speed', 'km/h', 'm/s')).toBeCloseTo(27.7778, 4)
    expect(convert(1, 'energy', 'kWh', 'J')).toBe(3.6e6)
    expect(convert(1, 'energy', 'eV', 'J')).toBe(1.602176634e-19)
    expect(convert(1, 'pressure', 'atm', 'Pa')).toBe(101325)
    expect(convert(760, 'pressure', 'Torr', 'atm')).toBeCloseTo(1, 12)
    expect(convert(2200, 'charge', 'mAh', 'C')).toBeCloseTo(7920, 9)
    expect(convert(4.7, 'resistance', 'kΩ', 'Ω')).toBeCloseTo(4700, 9)
    expect(convert(1, 'force', 'kgf', 'N')).toBe(9.80665)
  })
  it('temperatura con desplazamiento', () => {
    expect(convert(0, 'temperature', 'C', 'K')).toBeCloseTo(273.15, 10)
    expect(convert(100, 'temperature', 'C', 'F')).toBeCloseTo(212, 10)
    expect(convert(-40, 'temperature', 'C', 'F')).toBeCloseTo(-40, 10)
    expect(convert(0, 'temperature', 'K', 'R')).toBe(0)
    expect(convert(491.67, 'temperature', 'R', 'C')).toBeCloseTo(0, 10)
    expect(() => convert(-300, 'temperature', 'C', 'K')).toThrow(UnitError)
  })
  it('ida y vuelta en todas las unidades', () => {
    for (const q of QUANTITIES)
      for (const u of q.units)
        for (const w of q.units) {
          const x = q.id === 'temperature' ? 300 : 3.7
          const back = convert(convert(x, q.id, u.id, w.id), q.id, w.id, u.id)
          expect(back).toBeCloseTo(x, 6)
        }
  })
  it('entradas inválidas', () => {
    expect(() => convert(NaN, 'length', 'm', 'km')).toThrow(UnitError)
    expect(() => convert(1, 'length', 'm', 'kg')).toThrow(UnitError)
  })
})

describe('vectores y álgebra', () => {
  const a = [1, 2, 3]
  const b = [4, 5, 6]
  it('operaciones', () => {
    expect(dot(a, b)).toBe(32)
    expect(cross(a, b)).toEqual([-3, 6, -3])
    expect(magnitude(a)).toBeCloseTo(Math.sqrt(14), 14)
    expect(magnitude(normalize(b))).toBeCloseTo(1, 14)
    expect(cross2([1, 0], [0, 1])).toBe(1)
    expect(angleBetween([1, 0], [0, 1])).toBeCloseTo(Math.PI / 2, 14)
  })
  it('errores', () => {
    expect(() => normalize([0, 0, 0])).toThrow(MathInputError)
    expect(() => dot([1, 2], [1, 2, 3])).toThrow(MathInputError)
    expect(() => cross([1, 2], [3, 4])).toThrow(MathInputError)
  })
  it('ecuaciones lineales', () => {
    expect(solveLinear1(2, 3, 11)).toEqual({ kind: 'unique', x: 4 })
    expect(solveLinear1(0, 1, 1)).toEqual({ kind: 'infinite' })
    expect(solveLinear1(0, 1, 2)).toEqual({ kind: 'none' })
    const r = solveSystem([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]], [8, -11, -3])
    expect(r.kind).toBe('unique')
    if (r.kind === 'unique') r.x.forEach((v, i) => expect(v).toBeCloseTo([2, 3, -1][i]!, 12))
    expect(solveSystem([[1, 2], [2, 4]], [3, 6]).kind).toBe('singular')
  })
  it('porcentajes y notación', () => {
    expect(percentOf(15, 200)).toBe(30)
    expect(whatPercent(50, 200)).toBe(25)
    expect(percentChange(80, 100)).toBe(25)
    expect(() => whatPercent(1, 0)).toThrow(MathInputError)
    expect(toScientific(0.00047, 3)).toEqual({ mantissa: 4.7, exponent: -4 })
    expect(toScientific(299792458, 3)).toEqual({ mantissa: 3, exponent: 8 })
    expect(toEngineering(0.00047, 3)).toEqual({ mantissa: 470, exponent: -6, prefix: 'µ' })
    expect(toEngineering(4700, 3)).toEqual({ mantissa: 4.7, exponent: 3, prefix: 'k' })
  })
})
