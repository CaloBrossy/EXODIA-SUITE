import { describe, expect, it } from 'vitest'
import baseline from './__fixtures__/baseline.json'
import { validateProgram, type Value } from './ir'
import { runProgram, sameValue } from './interpreter'
import { allSamples, detectKind, solve } from './problems'
import { analyzeStatement, normalizeStatement, planFromReading } from './understanding'
import { CHANGED } from './__fixtures__/changed'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Resuelve, verifica el programa y devuelve el valor del primer caso (que usa los datos del enunciado). */
function firstValue(text: string, data: number[]) {
  const s = solve(text, 'auto')
  expect(s.status, text).toBe('ok')
  expect(() => validateProgram(s.program!)).not.toThrow()
  expect(JSON.stringify(s.tests[0]!.args)).toContain(JSON.stringify(data))
  for (const t of s.tests) {
    const r = runProgram(s.program!, t.args)
    if (!('error' in t.expect)) expect(r.ok && sameValue(r.value, t.expect.value as Value)).toBe(true)
  }
  const r = runProgram(s.program!, s.tests[0]!.args)
  return { s, value: r.ok ? r.value : null }
}

describe('normalización', () => {
  it.each([
    ['Calculá el promedio', 'calcular el promedio'],
    ['Sumá 3 y 4', 'sumar 3 y 4'],
    ['Encontrá el 7', 'encontrar el 7'],
    ['Decime cuál es', 'decir cual es'],
    ['¿En qué posición está?', 'en que posicion esta?'],
    ['Así también', 'asi tambien'],
  ])('%s', (a, b) => expect(normalizeStatement(a)).toBe(b))
})

describe('lectura: roles de los números', () => {
  it('número de contexto no es dato', () => {
    const r = analyzeStatement('Promedio de las notas de los 3 alumnos: 7, 8, 9')
    expect(r.data).toEqual([7, 8, 9])
    expect(r.numbers.find((n) => n.value === 3)?.role).toBe('contexto')
    expect(r.candidate).toBe('stats')
  })
  it('objetivo de búsqueda separado de la lista', () => {
    const r = analyzeStatement('Encontrá el 7 en 1, 7, 9')
    expect([r.candidate, r.target, r.data]).toEqual(['search', 7, [1, 7, 9]])
  })
  it('exclusión → aclaración, no un cálculo silencioso', () => {
    const r = analyzeStatement('Promedio de 0, 5, 10 sin contar el 0')
    expect(r.numbers.at(-1)?.role).toBe('excluido')
    expect(r.clarifications.map((c) => c.text)).toEqual(['Promedio de 5, 10', 'Promedio de 0, 5, 10'])
  })
  it('cantidad declarada que no coincide → ambigüedad', () => {
    const r = analyzeStatement('Promedio de las 4 notas: 7, 8, 9')
    expect(r.ambiguities.length).toBeGreaterThan(0)
    expect(planFromReading(r, 'auto', 'stats').type).toBe('clarify')
  })
  it('varias operaciones del mismo tipo conservan el candidato', () => expect(analyzeStatement('Máximo y mínimo de 3, 4').candidate).toBe('stats'))
  it('coma decimal → se deja al flujo existente', () => expect(planFromReading(analyzeStatement('Promedio de 1,5 y 2'), 'auto', 'stats').type).toBe('legacy'))
  it('intención de otro tipo compite (iteración)', () => expect(planFromReading(analyzeStatement('Suma de los primeros 100 números'), 'auto', 'iteration').type).toBe('legacy'))
})

describe('modo observación: la capa no actúa fuera de los casos cambiados', () => {
  const texts = [...new Set([...baseline.samples.map((s) => s.text), ...baseline.probes.map((p) => p.text), ...allSamples().map((s) => s.text)])]
  for (const t of texts.filter((x) => !CHANGED.has(x)))
    it(t, () => expect(planFromReading(analyzeStatement(t), 'auto', detectKind(t)?.id ?? null).type).toBe('legacy'))
})

describe('casos mejorados', () => {
  it.each([
    ['Promedio de las notas de los 3 alumnos: 7, 8, 9', [7, 8, 9], 8],
    ['Promedio de las 3 notas: 7, 8, 9', [7, 8, 9], 8],
    ['De los 4 alumnos, las notas son 6, 7, 8 y 9. Calculá el promedio.', [6, 7, 8, 9], 7.5],
    ['Valor medio de 4, 6', [4, 6], 5],
    ['Promediá 6, 7 y 10', [6, 7, 10], sum([6, 7, 10]) / 3],
    ['Sumá los 4 números: 3, 5, 7, 9', [3, 5, 7, 9], 24],
    ['Decime cuál es el más grande de 3, 17, 8', [3, 17, 8], 17],
    ['El número más chico entre 5, -2 y 9', [5, -2, 9], -2],
    ['¿Cuál es el mayor de los 3 valores 4, 9, 2?', [4, 9, 2], 9],
    ['Mostrame el mínimo de 8, 3 y 6', [8, 3, 6], 3],
  ] as const)('%s', (text, data, expected) => {
    const { s, value } = firstValue(text, [...data])
    expect(s.kind).toBe('stats')
    expect(sameValue(value as Value, expected)).toBe(true)
    if (CHANGED.has(text)) expect(s.analysis.assumptions[0]).toMatch(/^Se interpretó como/)
  })
  it('búsqueda con voseo', () => {
    const { s, value } = firstValue('Encontrá el 7 en 1, 7, 9', [1, 7, 9])
    expect([s.kind, value]).toEqual(['search', 1])
  })
  it('exclusión pide aclaración y cada opción resuelve', () => {
    const s = solve('Promedio de 0, 5, 10 sin contar el 0', 'auto')
    expect(s.status).toBe('clarify')
    expect(s.analysis.clarifications?.length).toBe(2)
    for (const c of s.analysis.clarifications ?? []) expect(solve(c.text, 'auto').status).toBe('ok')
  })
  it.each([
    ['Subarreglo de suma máxima de 1, -2, 3, 4', 'subarray'],
    ['Invertir la cadena hola', 'strings'],
    ['Ordená de menor a mayor 5, 3, 1', 'sort'],
    ['Mediana de 3, 1, 2', 'stats'],
    ['Contá las vocales de la palabra casa', 'strings'],
  ] as const)('ahora soportado: %s → %s', (t, kind) => {
    const s = solve(t, 'auto')
    expect(s.status).toBe('ok')
    expect(s.kind).toBe(kind)
  })
})

describe('adversarial: contexto, intenciones y compatibilidad', () => {
  it('fecha no entra como dato: aclara', () => {
    const s = solve('Promedio de las notas del 3 de marzo: 7, 8, 9', 'auto')
    expect(s.status).toBe('clarify')
    expect(s.program).toBeUndefined()
    expect(analyzeStatement('Promedio de las notas del 3 de marzo: 7, 8, 9').data).toEqual([7, 8, 9])
  })
  it('cantidad que no coincide con la lista: aclara', () => {
    const s = solve('Promedio de 7, 8, 9 (grupo de 12 alumnos)', 'auto')
    expect(s.status).toBe('clarify')
    expect(s.program).toBeUndefined()
  })
  it('negación más otra operación: no elige una en silencio', () => {
    const t = 'No calcules el promedio; encontrá el máximo de 3, 8, 5'
    const s = solve(t, 'auto')
    expect(s.status, t).not.toBe('ok')
    expect(s.program, t).toBeUndefined()
  })
  it('máximo y mínimo especificados se resuelven juntos', () => {
    const s = solve('Máximo y mínimo de 3, 4', 'auto')
    expect(s.status).toBe('ok')
    expect(s.program).toBeDefined()
  })
  it('negación de una sola operación: no calcula', () => {
    const t = 'No calcules el promedio de 3, 8, 5'
    expect(analyzeStatement(t).negated).toBe(true)
    const s = solve(t, 'auto')
    expect(s.status).toBe('clarify')
    expect(s.program).toBeUndefined()
  })
  it('casos que deben seguir en legacy', () => {
    for (const t of ['Calculá el promedio de 4, 8 y 15', 'La media aritmética de 2, 4, 9', 'La suma de los primeros 100 números', 'Promedio de 3,5 y 4', 'Clasificar la nota 7']) {
      expect(planFromReading(analyzeStatement(t), 'auto', detectKind(t)?.id ?? null).type, t).toBe('legacy')
    }
  })
  it('tipo manual no se sustituye', () => {
    expect(solve('Sumá los 4 números: 3, 5, 7, 9', 'classify').kind).toBe('classify')
    expect(solve('Encontrá el 7 en 1, 7, 9', 'iteration').kind).toBe('iteration')
    expect(solve('Promedio de las notas de los 3 alumnos: 7, 8, 9', 'geometry').kind).toBe('geometry')
  })
})

describe('entradas límite e inválidas', () => {
  it.each(['', '   ', 'Hacé algo con 3 y 4', 'Promedio', 'Promedio de', 'Buscá el 3', '7, 8, 9', '¿?¡!', 'sin contar el 0'])('sin ok espurio: «%s»', (t) => {
    const s = solve(t, 'auto')
    if (s.status === 'ok') expect(detectKind(t), `ok solo si el clasificador previo ya lo resolvía: ${t}`).not.toBeNull()
  })
  it('modo manual con otro tipo no se reinterpreta', () => {
    const t = 'Promedio de las notas de los 3 alumnos: 7, 8, 9'
    expect(solve(t, 'classify').kind).toBe('classify')
  })
  it('modo manual stats sí aprovecha la lectura', () => {
    const s = solve('Sumá los 4 números: 3, 5, 7, 9', 'stats')
    expect(JSON.stringify(s.tests[0]!.args)).toContain('[3,5,7,9]')
  })
})
