import { describe, expect, it } from 'vitest'
import { validateProgram } from './ir'
import { runProgram, sameValue } from './interpreter'
import { generateCode, CODE_LANGS } from './emit/code'
import { detectKind, solve } from './problems'

function ok(text: string, kind: string, value?: unknown) {
  const s = solve(text, 'auto')
  expect(s.status, text).toBe('ok')
  expect(s.kind).toBe(kind)
  if (s.program) {
    expect(() => validateProgram(s.program!)).not.toThrow()
    const r = runProgram(s.program, s.tests[0]!.args)
    if (value !== undefined) expect(r.ok && sameValue(r.value as never, value as never)).toBe(true)
    for (const lang of CODE_LANGS) expect(generateCode(lang, s.program, s.tests).code.length).toBeGreaterThan(20)
  }
  return s
}

describe('expansión: variantes sin IR nuevo', () => {
  it('MCM', () => ok('Mínimo común múltiplo de 12 y 18', 'iteration', 36))
  it('ceil y round medio lejos de cero', () => ok('ceil(1.2) + round(-1.5)', 'expression', 0))
  it('volumen esfera', () => {
    const s = ok('Volumen de una esfera de radio 3', 'geometry')
    const r = runProgram(s.program!, s.tests[0]!.args)
    expect(r.ok && typeof r.value === 'number' && Math.abs((r.value as number) - (4 / 3) * Math.PI * 27) < 1e-6).toBe(true)
  })
  it('distancia', () => ok('Distancia entre (0, 0) y (3, 4)', 'geometry', 5))
  it('última aparición', () => ok('Última aparición del 4 en 4, 9, 4, 1', 'search', 2))
  it('producto vectorial', () => ok('Producto vectorial de (1, 0, 0) y (0, 1, 0)', 'vectors', [0, 0, 1]))
})

describe('expansión: estadística', () => {
  it('mediana impar', () => ok('Mediana de 3, 1, 2', 'stats', 2))
  it('mediana par', () => ok('Mediana de 1, 2, 3, 4', 'stats', 2.5))
  it('moda única', () => ok('Moda de 1, 2, 2, 3', 'stats', 2))
  it('varias modas → aclarar', () => expect(solve('Moda de 1, 1, 2, 2', 'auto').status).toBe('clarify'))
  it('varianza sin calificar → aclarar', () => expect(solve('Varianza de 1, 2, 3', 'auto').status).toBe('clarify'))
  it('varianza poblacional', () => ok('Varianza poblacional de 1, 2, 3', 'stats', 2 / 3))
  it('conteo', () => ok('Cantidad de elementos de 4, 8, 15', 'stats', 3))
  it('producto', () => ok('Producto de 2, 3, 4', 'stats', 24))
})

describe('expansión: kadane, sort, strings, sql entrada', () => {
  it('kadane', () => ok('Subarreglo de suma máxima de 1, -2, 3, 4', 'subarray', 7))
  it('ordenar', () => ok('Ordená de menor a mayor 5, 3, 1', 'sort', [1, 3, 5]))
  it('palíndromo', () => ok('¿Es palíndromo "neuquen"?', 'strings', true))
  it('vocales', () => ok('Contá las vocales de la palabra casa', 'strings', 2))
  it('invertir', () => ok('Invertir la cadena hola', 'strings', 'aloh'))
  it('SQL de entrada no es sort', () => {
    const s = ok('Mostrar usuarios mayores de 18 ordenados por edad', 'query')
    expect(s.sql?.code).toMatch(/ORDER BY edad ASC/)
    expect(s.sql?.code).toMatch(/WHERE edad > 18/)
    expect(s.program).toBeUndefined()
  })
  it('ORDER BY inglés no dispara sort', () => expect(detectKind('SELECT nombre FROM usuarios ORDER BY edad')?.id).toBe('query'))
})

describe('expansión: falsos positivos', () => {
  it('palabra suelta no es strings', () => expect(detectKind('Promedio de 3, 4, 5')?.id).toBe('stats'))
  it('lista ordenada sigue siendo búsqueda', () => expect(detectKind('Buscar 31 en la lista ordenada 2, 5, 9, 14, 20, 31, 47 con búsqueda binaria')?.id).toBe('search'))
})
