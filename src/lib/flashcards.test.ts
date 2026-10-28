import { describe, expect, it } from 'vitest'
import type { Concept } from '@/db/models'
import { originStale, proposeFromConcept, proposeFromFormula, proposeFromQuestion, reviewStats, skipExisting } from './flashcards'

const now = new Date(2026, 9, 26, 14).getTime()

const concept = (partial: Partial<Concept> = {}): Concept => ({
  id: 'c1',
  title: 'Ohm',
  discipline: 'Física',
  tags: ['circuito'],
  summary: 'V = I R',
  explanation: '',
  formalism: 'V=IR',
  examples: 'Una pila de 1.5 V.',
  observations: '',
  relatedIds: [],
  favorite: false,
  createdAt: 1,
  updatedAt: 10,
  ...partial,
})

describe('propuestas de tarjetas', () => {
  it('arma frente/dorso desde concepto, fórmula y pregunta', () => {
    const fromC = proposeFromConcept(concept())
    expect(fromC.map((d) => d.front)).toEqual(['¿Qué es Ohm?', 'Formalización de Ohm', 'Ejemplo de Ohm'])
    const fromF = proposeFromFormula({
      id: 'f1', name: 'Ohm', latex: 'V = I R', description: 'Ley de Ohm', variables: [], resultUnit: 'V', example: '', discipline: '', tags: [], conceptIds: [], evalExpression: '', evalTarget: '', createdAt: 1, updatedAt: 8,
    })
    expect(fromF[0]?.back).toContain('V = I R')
    const fromQ = proposeFromQuestion({ id: 'q1', text: '¿Por qué?', resolved: false, answer: '', conceptId: 'c1', noteId: null, createdAt: 3 })
    expect(fromQ[0]?.back).toMatch(/sin respuesta/)
  })

  it('omite propuestas que ya existen y detecta origen viejo', () => {
    const drafts = proposeFromConcept(concept())
    const skip = skipExisting(drafts, [{
      id: 'x', front: '¿Qué es Ohm?', back: 'old', subjectId: null, tags: [], originKind: 'concept', originId: 'c1', originUpdatedAt: 1, intervalDays: 0, ease: 2.5, reps: 0, lapses: 0, dueAt: 1, lastReviewedAt: null, createdAt: 1, updatedAt: 1,
    }])
    expect(skip).toHaveLength(2)
    expect(originStale({ originKind: 'concept', originId: 'c1', originUpdatedAt: 5 } as never, 10)).toBe(true)
    expect(originStale({ originKind: 'manual', originId: null, originUpdatedAt: null } as never, 10)).toBe(false)
  })
})

describe('estadísticas de repaso', () => {
  it('cuenta racha y retención', () => {
    const start = new Date(2026, 9, 26).setHours(0, 0, 0, 0)
    const logs = [
      { id: '1', cardId: 'a', rating: 'good' as const, intervalDays: 1, ease: 2.5, at: start },
      { id: '2', cardId: 'b', rating: 'again' as const, intervalDays: 1, ease: 2.3, at: start },
      { id: '3', cardId: 'c', rating: 'good' as const, intervalDays: 1, ease: 2.5, at: start - 86_400_000 },
    ]
    const s = reviewStats(logs, now)
    expect(s.today).toBe(2)
    expect(s.streak).toBeGreaterThanOrEqual(1)
    expect(s.retention).toBeCloseTo(2 / 3)
  })
})
