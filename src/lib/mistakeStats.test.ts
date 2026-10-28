import { describe, expect, it } from 'vitest'
import { kindRanking, mistakeEvolution, topicRanking, topKindThisMonth } from './mistakeStats'

const at = (d: number) => new Date(2026, 9, d, 12).getTime()

describe('patrones de errores', () => {
  const rows = [
    ...Array.from({ length: 6 }, () => ({ kind: 'de signo', topic: 'Límites', at: at(10) })),
    ...Array.from({ length: 4 }, () => ({ kind: 'de concepto', topic: 'Derivadas', at: at(12) })),
    ...Array.from({ length: 3 }, () => ({ kind: 'de unidades', topic: 'Límites', at: at(20) })),
    ...Array.from({ length: 2 }, () => ({ kind: 'de tiempo', topic: 'Integrales', at: at(3) })),
  ]

  it('ordena 15 errores por tipo y por tema', () => {
    expect(rows).toHaveLength(15)
    expect(kindRanking(rows).map((r) => [r.kind, r.count])).toEqual([
      ['de signo', 6],
      ['de concepto', 4],
      ['de unidades', 3],
      ['de tiempo', 2],
    ])
    expect(topicRanking(rows)[0]).toEqual({ topic: 'Límites', count: 9 })
  })

  it('toma el tipo más repetido del mes y la semana correspondiente', () => {
    expect(topKindThisMonth(rows, at(26))?.kind).toBe('de signo')
    const weeks = mistakeEvolution(rows, 8, at(26))
    expect(weeks.reduce((n, w) => n + w.count, 0)).toBe(15)
  })
})
