import { describe, expect, it } from 'vitest'
import { currentDivider, elementPower, seriesRlc, thevenin, transient, twoMesh, voltageDivider } from './circuits'

describe('circuitos', () => {
  it('dos mallas coinciden con el cálculo a mano', () => {
    const r = twoMesh(2, 6, 4, 10, -8)
    expect(Number(r.rows[0]!.value)).toBeCloseTo(17 / 11, 8)
    expect(Number(r.rows[1]!.value)).toBeCloseTo(-2 / 11, 8)
  })
  it('divisores, Thévenin, transitorio, RLC y potencia', () => {
    expect(Number(voltageDivider(12, 2, 4).rows.find((x) => x.label === 'V_2')!.value)).toBeCloseTo(8, 8)
    expect(Number(currentDivider(3, 2, 4).rows.find((x) => x.label === 'I_1')!.value)).toBeCloseTo(2, 8)
    const th = thevenin(10, 2, 5)
    expect(Number(th.rows.find((x) => x.label === 'R_th')!.value)).toBeCloseTo(5, 8)
    expect(Number(th.rows.find((x) => x.label === 'V_L')!.value)).toBeCloseTo(5, 8)
    const tr = transient('rc', 1000, 1e-3, 0, 5, 1)
    expect(Number(tr.rows[0]!.value)).toBeCloseTo(1, 8)
    expect(Number(tr.rows[1]!.value)).toBeCloseTo(5 * (1 - Math.exp(-1)), 6)
    expect(seriesRlc(1, 1, 1).rows.find((x) => x.label === 'amortiguamiento')!.value).toBe('subamortiguado')
    const p = elementPower([{ kind: 'R', value: 10, current: 2 }, { kind: 'L', value: 0.1, current: 2 }], 50)
    expect(Number(p.rows.find((x) => x.label === 'P_1')!.value)).toBeCloseTo(40, 6)
  })
})
