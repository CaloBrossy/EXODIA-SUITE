import { describe, expect, it } from 'vitest'
import type { SubjectPlan } from '@/db/models'
import { detectDelimiter, parseCsv, parseNum } from './csv'
import { eligibilityMap, emptyPlan, findCycle, groupByYear, parsePlanImport, planStats, type PlanSubject } from './plan'

function sub(id: string, plan: Partial<SubjectPlan>): PlanSubject {
  return { id, name: id.toUpperCase(), period: '', objectives: '', notes: '', archived: false, createdAt: 1, updatedAt: 1, plan: { ...emptyPlan(), status: 'pendiente', ...plan } }
}

describe('correlatividades', () => {
  const plan = [
    sub('am1', { year: 1, status: 'aprobada', grade: 8 }),
    sub('alg', { year: 1, status: 'regular' }),
    sub('am2', { year: 2, requiresCourse: ['am1', 'alg'], requiresExam: ['am1', 'alg'] }),
    sub('fis', { year: 2, requiresCourse: ['am2'] }),
  ]

  it('habilita cursar con regulares y rendir solo con aprobadas', () => {
    const e = eligibilityMap(plan)
    expect(e.get('am2')).toMatchObject({ canCourse: true, canExam: false })
    expect(e.get('fis')).toMatchObject({ canCourse: false, missingCourse: ['am2'] })
    expect(e.get('alg')).toMatchObject({ canCourse: false, canExam: true })
    expect(e.get('am1')?.canCourse).toBe(false)
  })

  it('al aprobar se habilita lo siguiente', () => {
    const next = plan.map((s) => (s.id === 'am2' ? { ...s, plan: { ...s.plan, status: 'aprobada' as const } } : s))
    expect(eligibilityMap(next).get('fis')?.canCourse).toBe(true)
  })

  it('una correlativa borrada no bloquea', () => {
    expect(eligibilityMap([sub('x', { requiresCourse: ['fantasma'] })]).get('x')?.canCourse).toBe(true)
  })

  it('detecta ciclos', () => {
    expect(findCycle(plan)).toBeNull()
    const loop = [sub('a', { requiresCourse: ['b'] }), sub('b', { requiresExam: ['c'] }), sub('c', { requiresCourse: ['a'] })]
    expect(findCycle(loop)).toEqual(['a', 'b', 'c', 'a'])
  })
})

describe('estadísticas', () => {
  const y = 365.25 * 86_400_000
  const now = 10 * y

  it('promedio con y sin aplazos, avance por cantidad', () => {
    const s = planStats([
      sub('a', { status: 'aprobada', grade: 8, failedGrades: [2] }),
      sub('b', { status: 'aprobada', grade: 6 }),
      sub('c', {}),
      sub('d', {}),
    ], now)
    expect(s.average).toBe(7)
    expect(s.averageWithFails).toBeCloseTo(16 / 3)
    expect(s.progress).toBe(0.5)
    expect(s.byHours).toBe(false)
  })

  it('avance por horas cuando todas tienen horas', () => {
    const s = planStats([sub('a', { status: 'aprobada', hours: 96 }), sub('b', { hours: 32 })], now)
    expect(s.byHours).toBe(true)
    expect(s.progress).toBe(0.75)
  })

  it('estima el fin según el ritmo', () => {
    const s = planStats([
      sub('a', { status: 'aprobada', approvedAt: now - 2 * y }),
      sub('b', { status: 'aprobada', approvedAt: now - y }),
      sub('c', {}),
      sub('d', {}),
    ], now)
    expect(s.perYear).toBeCloseTo(1)
    expect(s.estimatedEnd).toBeCloseTo(now + 2 * y, -3)
  })

  it('agrupa por año con los sin año al final', () => {
    const g = groupByYear([sub('x', {}), sub('b', { year: 2 }), sub('a', { year: 1 })])
    expect(g.map((x) => x.year)).toEqual([1, 2, null])
  })
})

describe('importación', () => {
  it('CSV con punto y coma, tildes y correlativas con |', () => {
    const rows = parsePlanImport('Código;Nombre;Año;Cuatrimestre;Horas;Correlativas cursar;Estado;Nota\n61.03;Análisis I;1;1C;128;;aprobada;7,5\n61.08;Análisis II;2;1C;128;61.03|62.01;;')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ code: '61.03', name: 'Análisis I', year: 1, hours: 128, status: 'aprobada', grade: 7.5 })
    expect(rows[1]).toMatchObject({ requiresCourse: ['61.03', '62.01'], status: 'pendiente' })
  })

  it('JSON con claves en inglés', () => {
    const rows = parsePlanImport('[{"code":"A","name":"Física I","year":1,"requiresExam":["B"],"status":"Regular"}]')
    expect(rows[0]).toMatchObject({ code: 'A', requiresExam: ['B'], status: 'regular' })
  })

  it('rechaza datos sin nombre', () => {
    expect(() => parsePlanImport('codigo;horas\nA;3')).toThrow(/nombre/)
    expect(() => parsePlanImport('{')).toThrow(/JSON/)
  })
})

describe('csv', () => {
  it('detecta separador y respeta comillas', () => {
    expect(detectDelimiter('a\tb\tc')).toBe('\t')
    expect(parseCsv('x,y\n"1,5","dice ""hola"""\n\n')).toEqual([['x', 'y'], ['1,5', 'dice "hola"']])
  })

  it('números con coma o punto decimal', () => {
    expect(parseNum('1,5')).toBe(1.5)
    expect(parseNum('1.234,5')).toBe(1234.5)
    expect(parseNum('1,234.5')).toBe(1234.5)
    expect(parseNum('-2e3')).toBe(-2000)
    expect(parseNum('')).toBeNull()
    expect(parseNum('abc')).toBeNull()
  })
})
