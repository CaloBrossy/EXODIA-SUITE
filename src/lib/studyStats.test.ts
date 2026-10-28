import { describe, expect, it } from 'vitest'
import type { FocusSession, Task } from '@/db/models'
import { bestBand, hoursBySubject, pomodorosByWeek, studyStreak, tasksDone, weekCompare, yearHeat } from './studyStats'

const at = (y: number, m: number, d: number, h = 19) => new Date(y, m - 1, d, h).getTime()

const work = (started: number, minutes: number, subjectId: string | null): FocusSession => ({
  id: `${started}`,
  phase: 'work',
  startedAt: started,
  endedAt: started + minutes * 60_000,
  durationMs: minutes * 60_000,
  taskId: null,
  subjectId,
})

describe('estadísticas de estudio', () => {
  const now = at(2026, 10, 26, 21)
  const sessions = [
    work(at(2026, 10, 24, 9), 25, 'alg'),
    work(at(2026, 10, 25, 19), 50, 'ana'),
    work(at(2026, 10, 26, 19), 25, 'ana'),
    work(at(2026, 10, 26, 20), 25, 'ana'),
    work(at(2026, 10, 19, 18), 40, 'alg'),
    { ...work(at(2026, 10, 26, 21), 5, 'ana'), phase: 'short' as const },
  ]

  it('suma horas por materia y deja afuera los descansos', () => {
    const week = hoursBySubject(sessions, 'week', now)
    expect(week.find((r) => r.subjectId === 'ana')?.minutes).toBe(50)
    expect(week.find((r) => r.subjectId === 'alg')).toBeUndefined()
    expect(hoursBySubject(sessions, 'day', now).reduce((n, r) => n + r.count, 0)).toBe(2)
  })

  it('cuenta la racha y la conserva si hoy todavía no hubo sesión', () => {
    expect(studyStreak(sessions, now)).toBe(3)
    expect(studyStreak(sessions, at(2026, 10, 27, 8))).toBe(3)
    expect(studyStreak(sessions, at(2026, 10, 28, 8))).toBe(0)
  })

  it('agrupa Pomodoros, la mejor franja y la semana anterior', () => {
    expect(pomodorosByWeek(sessions, 8, now).at(-1)?.count).toBe(2)
    expect(bestBand(sessions)).toMatchObject({ from: 18 })
    const cmp = weekCompare(sessions, now)
    expect(cmp.thisMin).toBe(50)
    expect(cmp.prevMin).toBe(115)
    expect(cmp.delta).toBe(-65)
  })

  it('pinta el día en el mapa anual y cuenta tareas hechas', () => {
    expect(yearHeat(sessions, now).find((d) => d.day === new Date(2026, 9, 26).setHours(0, 0, 0, 0))?.minutes).toBe(50)
    const tasks: Task[] = [
      { id: 't1', title: 'A', details: '', priority: 'low', subjectId: null, project: '', done: true, dueDate: null, createdAt: 1, completedAt: at(2026, 10, 26, 12) },
      { id: 't2', title: 'B', details: '', priority: 'low', subjectId: null, project: '', done: true, dueDate: null, createdAt: 1, completedAt: at(2026, 9, 1, 12) },
    ]
    expect(tasksDone(tasks, 'week', now)).toBe(1)
  })
})
