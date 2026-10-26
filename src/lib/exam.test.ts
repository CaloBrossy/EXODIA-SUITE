import { describe, expect, it } from 'vitest'
import type { Exercise } from '@/db/models'
import { examReport, filterExercises, pickExam } from './exam'

function ex(partial: Partial<Exercise> & Pick<Exercise, 'id' | 'prompt'>): Exercise {
  return {
    subjectId: 's-1',
    topic: 'límites',
    difficulty: 2,
    source: 'guía',
    solution: '',
    answer: '1',
    status: 'sin_intentar',
    attempts: 0,
    lastAttemptMs: 0,
    lastAttemptAt: null,
    tags: [],
    conceptIds: [],
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

describe('banco de ejercicios', () => {
  const pool = [
    ex({ id: '1', prompt: 'lim x', topic: 'límites', difficulty: 1 }),
    ex({ id: '2', prompt: 'derivada', topic: 'derivadas', difficulty: 3, status: 'resuelto' }),
    ex({ id: '3', prompt: 'otro límite', topic: 'límites', difficulty: 2 }),
  ]

  it('filtra y sortea un simulado', () => {
    expect(filterExercises(pool, { topic: 'límites' })).toHaveLength(2)
    expect(filterExercises(pool, { query: 'DERIV' })).toHaveLength(1)
    expect(pickExam(pool, { subjectId: 's-1', topics: ['límites'], n: 5 }).map((e) => e.id).sort()).toEqual(['1', '3'])
  })

  it('arma el reporte por tema', () => {
    const r = examReport(
      [
        { exerciseId: '1', result: 'bien', ms: 1000 },
        { exerciseId: '3', result: 'mal', ms: 2000 },
        { exerciseId: '2', result: 'ayuda', ms: 500 },
      ],
      pool,
    )
    expect(r.hits).toBe(1)
    expect(r.total).toBe(3)
    expect(r.ms).toBe(3500)
    expect(r.weak[0]?.topic).toBe('derivadas')
  })
})
