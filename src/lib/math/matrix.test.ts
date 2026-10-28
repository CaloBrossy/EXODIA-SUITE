import { describe, expect, it } from 'vitest'
import { assertMatrix, inverse, multiply, q, qn, runMatrix, solve, texQ } from './matrix'

const eq = (A: ReturnType<typeof assertMatrix>, B: ReturnType<typeof assertMatrix>) =>
  A.every((row, i) => row.every((v, j) => qn(v, B[i]![j]!)))

describe('matrices exactas', () => {
  it('invierte una 3×3 con fracciones y muestra cada paso', () => {
    const A = assertMatrix([['1', '2', '0'], ['0', '1', '1'], ['1', '0', '1']])
    const r = inverse(A)
    expect(r.steps.length).toBeGreaterThan(3)
    expect(r.steps.some((s) => /F\d/.test(s.text))).toBe(true)
    expect(eq(multiply(A, r.inv), assertMatrix([['1', '0', '0'], ['0', '1', '0'], ['0', '0', '1']]))).toBe(true)
    expect(texQ(r.inv[0]![0]!)).toMatch(/dfrac|1/)
  })

  it('resuelve un sistema indeterminado con parámetros', () => {
    const A = assertMatrix([['1', '1', '1'], ['2', '2', '2']])
    const s = solve(A, [q(3), q(6)])
    expect(s.kind).toBe('infinite')
    if (s.kind !== 'infinite') return
    expect(s.params).toHaveLength(2)
    const at = (t: number, u: number) => s.particular.map((p, i) => Number(p.n) / Number(p.d) + t * Number(s.directions[0]![i]!.n) / Number(s.directions[0]![i]!.d) + u * Number(s.directions[1]![i]!.n) / Number(s.directions[1]![i]!.d))
    for (const [t, u] of [[0, 0], [2, -1]] as const) {
      const [x, y, z] = at(t, u)
      expect(x! + y! + z!).toBeCloseTo(3, 8)
    }
    expect(solve(A, [q(3), q(7)]).kind).toBe('none')
  })

  it('determinante, Gram-Schmidt y autovalores', () => {
    expect(runMatrix('det', assertMatrix([['1', '2'], ['3', '4']])).latex).toContain('-2')
    const g = runMatrix('gram', assertMatrix([['1', '1'], ['1', '0']]))
    expect(g.latex).toContain('dfrac')
    const e = runMatrix('eigen', assertMatrix([['2', '1'], ['1', '2']]))
    expect(e.latex).toMatch(/3/)
    expect(e.latex).toMatch(/1/)
  })
})
