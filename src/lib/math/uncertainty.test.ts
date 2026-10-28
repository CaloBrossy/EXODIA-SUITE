import { describe, expect, it } from 'vitest'
import { propagate, roundUncertainty } from './uncertainty'

describe('propagación de errores', () => {
  it('coincide con el cálculo manual de tres variables', () => {
    const [m, r, h] = [100, 2, 5]
    const [dm, dr, dh] = [0.1, 0.01, 0.05]
    const rho = m / (Math.PI * r * r * h)
    const d = Math.hypot(
      dm / (Math.PI * r * r * h),
      (2 * rho / r) * dr,
      (rho / h) * dh,
    )
    const p = propagate('rho = m/(pi*r^2*h)', [
      { symbol: 'm', value: m, uncertainty: dm },
      { symbol: 'r', value: r, uncertainty: dr },
      { symbol: 'h', value: h, uncertainty: dh },
    ], 'g/cm³')
    expect(p.value).toBeCloseTo(rho, 10)
    expect(p.uncertainty).toBeCloseTo(d, 8)
    expect(p.steps.some((s) => s.includes('∂rho/∂r'))).toBe(true)
    const ru = roundUncertainty(d)
    expect(p.rounded.startsWith(`${(Math.round(rho * 10 ** ru.decimals) / 10 ** ru.decimals).toFixed(ru.decimals).replace('.', ',')} ±`)).toBe(true)
  })
})
