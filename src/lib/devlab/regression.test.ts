/**
 * Red de regresión de Dev Lab. `__fixtures__/baseline.json` se capturó con el código del commit b0a12f2,
 * antes de cualquier cambio en la comprensión de enunciados. No se regenera para hacer pasar cambios:
 * los únicos textos que pueden comportarse distinto están en CHANGED, con su nuevo comportamiento
 * verificado en understanding.test.ts.
 */
import { describe, expect, it } from 'vitest'
import baseline from './__fixtures__/baseline.json'
import { validateProgram, type Program, type Value } from './ir'
import { runProgram, sameValue } from './interpreter'
import { pseudocodeText } from './emit/pseudocode'
import { allSamples, detectKind, solve } from './problems'
import type { KindId, Solution, TestCase } from './types'

/** Frases de la línea base con comportamiento incorrecto o mejorable, que la nueva capa puede cambiar. */
export const CHANGED = new Set([
  'Promedio de las notas de los 3 alumnos: 7, 8, 9',
  'Valor medio de 4, 6',
  'Promediá 6, 7 y 10',
  'Encontrá el 7 en 1, 7, 9',
  'Sumá los 4 números: 3, 5, 7, 9',
  'Decime cuál es el más grande de 3, 17, 8',
  'El número más chico entre 5, -2 y 9',
  '¿Cuál es el mayor de los 3 valores 4, 9, 2?',
  'Promedio de las 3 notas: 7, 8, 9',
  'De los 4 alumnos, las notas son 6, 7, 8 y 9. Calculá el promedio.',
  'Promedio de 0, 5, 10 sin contar el 0',
  'Subarreglo de suma máxima de 1, -2, 3, 4',
  'Invertir la cadena hola',
  'Ordená de menor a mayor 5, 3, 1',
])

interface Snap {
  kind: string
  status: string
  title: string
  strategy: string
  strategies: string[]
  ambiguities: string[]
  clarifications: string[]
  limitation: string | null
  program: unknown
  pseudo: string | null
  tests: unknown
  runs: unknown
  sql: unknown
}

const runsOf = (s: Solution) =>
  s.program
    ? s.tests.map((t) => {
        const r = runProgram(s.program!, t.args)
        return r.ok ? { value: r.value } : { error: r.error }
      })
    : []

function expectSame(s: Solution, b: Snap) {
  expect(s.kind).toBe(b.kind)
  expect(s.status).toBe(b.status)
  expect(s.title).toBe(b.title)
  expect(s.strategy).toBe(b.strategy)
  expect(s.strategies.map((x) => x.id)).toEqual(b.strategies)
  expect(s.analysis.ambiguities).toEqual(b.ambiguities)
  expect(s.analysis.clarifications?.map((c) => c.text) ?? []).toEqual(b.clarifications)
  expect(s.limitation ?? null).toBe(b.limitation)
  // Estructura de la IR, pruebas, resultados del intérprete, pseudocódigo y SQL idénticos a la línea base.
  expect(JSON.parse(JSON.stringify(s.program ?? null))).toEqual(b.program)
  expect(JSON.parse(JSON.stringify(s.tests))).toEqual(b.tests)
  expect(runsOf(s)).toEqual(b.runs)
  expect(s.program ? pseudocodeText(s.program) : null).toBe(b.pseudo)
  expect(JSON.parse(JSON.stringify(s.sql ?? null))).toEqual(b.sql)
}

/** Aserciones semánticas, independientes del snapshot: IR válida y ejecución igual a lo esperado. */
function expectSound(p: Program, tests: TestCase[]) {
  expect(() => validateProgram(p)).not.toThrow()
  for (const t of tests) {
    const r = runProgram(p, t.args)
    if ('error' in t.expect) expect(r.ok ? null : r.error).toBe(t.expect.error)
    else expect(r.ok && sameValue(r.value, t.expect.value as Value), JSON.stringify(t.args)).toBe(true)
  }
}

describe('regresión: ejemplos y estrategias', () => {
  const now = allSamples()
  it('la cantidad de ejemplos no cambió', () => expect(now.length).toBe(baseline.samples.length))
  for (const b of baseline.samples) {
    it(`${b.kind} · ${b.text} · ${b.strategy}`, () => {
      const cur = now.find((x) => x.text === b.text && x.strategy === b.strategy && x.kind === b.kind)
      expect(cur, 'el ejemplo sigue existiendo').toBeDefined()
      expectSame(cur!.solution, b.solution as Snap)
      expectSound(cur!.solution.program!, cur!.solution.tests)
      // El texto del ejemplo, pasado por el flujo automático, sigue llegando al mismo tipo y resultado.
      const auto = solve(b.text, 'auto', b.strategy)
      expect(auto.kind).toBe(b.kind)
      expectSame(auto, b.solution as Snap)
    })
  }
})

describe('regresión: frases de prueba con detección automática', () => {
  for (const b of baseline.probes.filter((p) => !CHANGED.has(p.text))) {
    it(b.text, () => {
      expect(detectKind(b.text)?.id ?? null).toBe(b.detected)
      const s = solve(b.text, 'auto')
      expectSame(s, b.solution as Snap)
      if (s.status === 'ok') expectSound(s.program!, s.tests)
    })
  }
})

describe('regresión: frases de prueba con tipo elegido a mano', () => {
  for (const b of baseline.manual.filter((p) => !CHANGED.has(p.text))) {
    it(`${b.kind} · ${b.text}`, () => expectSame(solve(b.text, b.kind as KindId), b.solution as Snap))
  }
})

describe('regresión: detectKind conserva su contrato', () => {
  it('sigue clasificando igual todas las frases de la línea base', () => {
    for (const b of baseline.probes) expect(detectKind(b.text)?.id ?? null, b.text).toBe(b.detected)
  })
})
