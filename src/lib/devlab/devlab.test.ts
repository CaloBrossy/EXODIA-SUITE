import { describe, expect, it } from 'vitest'
import { validateProgram } from './ir'
import { runProgram, sameValue } from './interpreter'
import { toPseudocode } from './emit/pseudocode'
import { CODE_LANGS, generateCode } from './emit/code'
import { allSamples, detectKind, KINDS, solve } from './problems'

const samples = allSamples()

describe('devlab: ejemplos', () => {
  it('hay ejemplos de todos los tipos', () => {
    for (const k of KINDS) expect(samples.some((s) => s.kind === k.id), k.id).toBe(true)
  })

  for (const s of samples) {
    describe(`${s.kind} · ${s.text} · ${s.strategy}`, () => {
      const sol = s.solution
      if (s.kind === 'query') {
        it('genera SQL de entrada verificable', () => {
          expect(sol.status).toBe('ok')
          expect(sol.sql?.code).toMatch(/SELECT/i)
        })
        return
      }
      it('se resuelve sin aclaraciones y con pruebas de las tres categorías posibles', () => {
        expect(sol.status).toBe('ok')
        expect(sol.program).toBeDefined()
        expect(sol.tests.length).toBeGreaterThanOrEqual(sol.program!.fns[0]!.params.length ? 3 : 1)
        expect(sol.tests.some((t) => t.category === 'normal')).toBe(true)
      })
      it('la IR es válida', () => expect(() => validateProgram(sol.program!)).not.toThrow())
      it('el intérprete coincide con el resultado esperado calculado aparte', () => {
        for (const t of sol.tests) {
          const r = runProgram(sol.program!, t.args)
          if ('error' in t.expect) {
            expect(r.ok, JSON.stringify(t.args)).toBe(false)
            if (!r.ok) expect(r.error).toBe(t.expect.error)
          } else {
            expect(r.ok, `${JSON.stringify(t.args)} → ${r.ok ? '' : r.error}`).toBe(true)
            if (r.ok) expect(sameValue(r.value, t.expect.value), `${JSON.stringify(t.args)}: ${String(r.value)} ≠ ${String(t.expect.value)}`).toBe(true)
          }
        }
      })
      it('los pasos del pseudocódigo existen en el diseño', () => {
        const lines = toPseudocode(sol.program!)
        expect(lines.length).toBeGreaterThan(2)
        for (const l of lines) if (l.step !== undefined) expect(l.step, l.text).toBeLessThanOrEqual(sol.design!.steps.length)
      })
      it('genera código en todos los lenguajes', () => {
        for (const lang of CODE_LANGS) expect(generateCode(lang, sol.program!, sol.tests).code.length).toBeGreaterThan(50)
      })
    })
  }
})

describe('devlab: detección y ambigüedad', () => {
  it.each([
    ['Factorial de 5', 'iteration'],
    ['Resolver 2x + 3 = 11', 'linear'],
    ['Área de un círculo de radio 3', 'geometry'],
    ['Promedio de 3, 5 y 10', 'stats'],
    ['Clasificar el triángulo de lados 3, 3 y 3', 'classify'],
    ['Buscar 5 en 1, 5, 9', 'search'],
    ['Norma del vector (1, 2)', 'vectors'],
    ['(2 + 3) * 4', 'expression'],
  ])('%s → %s', (text, kind) => expect(detectKind(text)?.id).toBe(kind))

  it('la coma decimal pide aclaración', () => {
    const s = solve('Promedio de 3,5 y 4', 'auto')
    expect(s.status).toBe('clarify')
    expect(s.analysis.clarifications?.length).toBe(2)
  })
  it('una nota sin umbral pide aclaración', () => expect(solve('Clasificar la nota 7', 'classify').status).toBe('clarify'))
  it('la cuadrática se informa como no soportada', () => expect(solve('Resolver x^2 - 4 = 0', 'linear').status).toBe('unsupported'))
  it('un texto vacío no rompe', () => expect(solve('  ', 'auto').status).toBe('unsupported'))
  it('el resultado es determinista', () => expect(JSON.stringify(solve('Buscar 23 en 4, 8, 15, 16, 23, 42', 'auto'))).toBe(JSON.stringify(solve('Buscar 23 en 4, 8, 15, 16, 23, 42', 'auto'))))
})
