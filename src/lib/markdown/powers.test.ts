import { describe, expect, it } from 'vitest'
import { showPowers } from './powers'

describe('showPowers', () => {
  it('muestra A^2 como fórmula', () => {
    expect(showPowers('A^2')).toBe('$A^2$')
    expect(showPowers('queda (a+b)^2 listo')).toBe('queda $(a+b)^2$ listo')
    expect(showPowers('x^{n+1}')).toBe('$x^{n+1}$')
  })
  it('no toca código ni fórmulas ya marcadas', () => {
    expect(showPowers('$A^2$')).toBe('$A^2$')
    expect(showPowers('`A^2`')).toBe('`A^2`')
    expect(showPowers('```\nA^2\n```')).toBe('```\nA^2\n```')
  })
})
