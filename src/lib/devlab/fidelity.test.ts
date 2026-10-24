import { describe, expect, it } from 'vitest'
import { generateCode, CODE_LANGS } from './emit/code'
import { validateProgram } from './ir'
import { runProgram, sameValue } from './interpreter'
import { detectKind, solve } from './problems'
import { bruteWindow } from './problems/subarray'
import { analyzeStatement } from './understanding'

const NOTES = [8, 6, 10, 4, 7, 9, 6, 5, 10, 3, 8, 8]
const NOTES5 = [8, 6, 10, 4, 7]
const GRADES12 =
  'Una profesora registra las notas de 12 estudiantes: 8, 6, 10, 4, 7, 9, 6, 5, 10, 3, 8, 8. El curso tiene 28 estudiantes en total y el examen duró 120 minutos. Calcular suma, promedio, máximo, mínimo y rango de las notas.'
const GRADES5 =
  'Una profesora registra las notas de 5 estudiantes: 8, 6, 10, 4, 7. El curso tiene 40 estudiantes en total y el examen duró 90 minutos. Calcular el promedio de las notas.'

function runOk(text: string, args: unknown[], expected: unknown) {
  const s = solve(text, 'auto')
  expect(s.status, text).toBe('ok')
  expect(s.program).toBeDefined()
  expect(() => validateProgram(s.program!)).not.toThrow()
  const r = runProgram(s.program!, args as never)
  expect(r.ok, r.ok ? '' : r.error).toBe(true)
  if (r.ok) expect(sameValue(r.value as never, expected as never)).toBe(true)
  return s
}

describe('fidelidad: notas y números contextuales', () => {
  it('12 notas; 28 y 120 no son datos', () => {
    const r = analyzeStatement(GRADES12)
    expect(r.data).toEqual(NOTES)
    expect(r.numbers.filter((n) => n.role === 'contexto').map((n) => n.value).sort((a, b) => a - b)).toEqual([12, 28, 120])
    const s = solve(GRADES12, 'auto')
    expect(s.status).toBe('clarify')
    expect(s.kind).toBe('stats')
    const texts = (s.analysis.clarifications ?? []).map((c) => c.text)
    expect(texts.some((t) => t.includes('28') || t.includes('120'))).toBe(false)
    expect(texts.some((t) => /8, 6, 10, 4, 7, 9, 6, 5, 10, 3, 8, 8/.test(t))).toBe(true)
    for (const c of s.analysis.clarifications ?? []) {
      const one = solve(c.text, 'auto')
      expect(one.status, c.text).toBe('ok')
      expect(JSON.stringify(one.tests[0]!.args)).toContain(JSON.stringify(NOTES))
    }
  })
  it('mismas restricciones con otras cantidades', () => {
    const r = analyzeStatement(GRADES5)
    expect(r.data).toEqual(NOTES5)
    expect(r.numbers.filter((n) => n.value === 40 || n.value === 90).every((n) => n.role === 'contexto')).toBe(true)
    const s = runOk(GRADES5, [NOTES5], NOTES5.reduce((a, b) => a + b, 0) / NOTES5.length)
    expect(s.kind).toBe('stats')
    expect(JSON.stringify(s.tests[0]!.args)).not.toContain('40')
    expect(JSON.stringify(s.tests[0]!.args)).not.toContain('90')
  })
  it('promedio de una lista simple', () => {
    runOk('Promedio de 7.5, 9, 6, 8.25 y 10', [[7.5, 9, 6, 8.25, 10]], 8.15)
  })
})

describe('fidelidad: inserción', () => {
  it('duplicados, negativos, vacío y un elemento', () => {
    const s = solve('Ordená de menor a mayor 5, 3, 1, 4, 4, -2', 'auto')
    expect(s.status).toBe('ok')
    expect(s.kind).toBe('sort')
    expect(s.strategy).toBe('insercion')
    expect(() => validateProgram(s.program!)).not.toThrow()
    for (const [data, expected] of [
      [[5, 3, 1, 4, 4, -2], [-2, 1, 3, 4, 4, 5]],
      [[-2, 0, -5], [-5, -2, 0]],
      [[1, 2, 2, 1], [1, 1, 2, 2]],
      [[7], [7]],
      [[], []],
    ] as const) {
      const r = runProgram(s.program!, [data as unknown as number[]])
      expect(r.ok && sameValue(r.value as never, expected as never), JSON.stringify(data)).toBe(true)
    }
  })
})

describe('fidelidad: máximo subarreglo', () => {
  const xs = [1, -2, 3, 4, -1, 2]
  it('sin cota de longitud usa Kadane', () => {
    const s = runOk('Subarreglo de suma máxima de 1, -2, 3, 4', [[1, -2, 3, 4]], 7)
    expect(s.strategy).toBe('kadane')
    expect(s.analysis.constraints.some((c) => /longitud/.test(c))).toBe(false)
  })
  it('longitud exacta K ≠ Kadane', () => {
    const k = 2
    const expected = bruteWindow(xs, k, k)
    expect(expected).toBe(7)
    expect(bruteWindow(xs, 1, xs.length)).toBe(8)
    const s = runOk('Máxima suma de un subarreglo de longitud 2 de 1, -2, 3, 4, -1, 2', [xs, k], expected)
    expect(s.strategy).toBe('ventana')
    expect(s.analysis.constraints.some((c) => /exacta 2/.test(c))).toBe(true)
    const first = s.tests[0]!.args[0] as number[]
    expect(first).toEqual(xs)
    expect(first[0]).not.toBe(2)
  })
  it('longitud entre L y R ≠ Kadane', () => {
    const data = [5, -3, 4]
    expect(bruteWindow(data, 2, 2)).toBe(2)
    expect(bruteWindow(data, 1, data.length)).toBe(6)
    const s = runOk(
      'Dado un arreglo A de n enteros y dos enteros L y R, calcular la máxima suma de un subarreglo contiguo cuya longitud esté entre L y R. A = 5, -3, 4, L = 2, R = 2',
      [data, 2, 2],
      2,
    )
    expect(s.strategy).toBe('ventanas')
    expect(s.analysis.constraints.some((c) => /entre 2 y 2/.test(c))).toBe(true)
    expect(s.tests[0]!.args[0]).toEqual(data)
  })
  it('L..R con valores del enunciado canónico', () => {
    const expected = bruteWindow(xs, 2, 4)
    const s = runOk('Máxima suma de un subarreglo de longitud entre 2 y 4 de 1, -2, 3, 4, -1, 2', [xs, 2, 4], expected)
    expect(s.strategy).toBe('ventanas')
    for (const t of s.tests) {
      const r = runProgram(s.program!, t.args)
      if ('error' in t.expect) expect(r.ok ? null : r.error).toBe(t.expect.error)
      else expect(r.ok && sameValue(r.value, t.expect.value)).toBe(true)
    }
  })
  it('todos negativos: Kadane y ventana coinciden con el oráculo', () => {
    runOk('Suma máxima de subarreglo de -3, -1, -2', [[-3, -1, -2]], -1)
    runOk('Máxima suma de un subarreglo de longitud 2 de -3, -1, -2', [[-3, -1, -2], 2], bruteWindow([-3, -1, -2], 2, 2))
  })
})

describe('fidelidad: enteros fuera de 32 bits y restricciones', () => {
  it('suma de valores > 2^31 − 1', () => {
    runOk('Suma de 2147483648, 2147483648', [[2147483648, 2147483648]], 4294967296)
  })
  it('promedio en O(n) sin ordenar no elige inserción', () => {
    const s = runOk('Calcular el promedio de 3, 4, 5 en O(n) sin ordenar y sin funciones estadísticas', [[3, 4, 5]], 4)
    expect(s.kind).toBe('stats')
    expect(s.strategy).not.toBe('insercion')
    expect(s.analysis.constraints.some((c) => /No ordenar/.test(c))).toBe(true)
    expect(s.analysis.constraints.some((c) => /lineal/.test(c))).toBe(true)
  })
  it('mención contextual de ordenar no cambia el promedio', () => {
    const s = runOk('Después de ordenar los papeles, calcular el promedio de 3, 4, 5', [[3, 4, 5]], 4)
    expect(s.kind).toBe('stats')
  })
})

describe('fidelidad: variantes no implementadas', () => {
  it('todas las ocurrencias se rechazan', () => {
    const s = solve('Todas las ocurrencias de 4 en 4, 9, 4, 1', 'auto')
    expect(s.status).toBe('unsupported')
    expect(s.program).toBeUndefined()
    expect(s.limitation).toMatch(/primera o la última/)
  })
  it('subsecuencia se rechaza', () => {
    const s = solve('Suma máxima de una subsecuencia de 1, 2, 3', 'auto')
    expect(s.status).toBe('unsupported')
    expect(s.program).toBeUndefined()
  })
  it('detectar no implica soportar', () => {
    expect(detectKind('Todas las ocurrencias de 4 en 4, 9, 4, 1')?.id).toBe('search')
    expect(solve('Todas las ocurrencias de 4 en 4, 9, 4, 1', 'auto').status).toBe('unsupported')
  })
})

describe('fidelidad: código y oráculo en casos chicos', () => {
  it('K y L-R generan código y coinciden con fuerza bruta', () => {
    for (const text of ['Máxima suma de un subarreglo de longitud 3 de 1, -2, 3, 4, -1, 2', 'Máxima suma de un subarreglo de longitud entre 2 y 4 de 1, -2, 3, 4, -1, 2']) {
      const s = solve(text, 'auto')
      expect(s.status).toBe('ok')
      expect(() => validateProgram(s.program!)).not.toThrow()
      for (const lang of CODE_LANGS) expect(generateCode(lang, s.program!, s.tests).code.length).toBeGreaterThan(20)
    }
  })
})
