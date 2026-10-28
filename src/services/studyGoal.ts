import { db } from '@/db/db'
import { guard } from './errors'

export const WEEK_GOAL_KEY = 'stats.weekHours'

export function readWeekGoal(): Promise<number> {
  return guard('No se pudo leer la meta', async () => {
    const n = Number((await db.kv.get(WEEK_GOAL_KEY))?.value)
    return Number.isFinite(n) && n >= 1 && n <= 80 ? n : 10
  })
}

export function writeWeekGoal(hours: number): Promise<void> {
  return guard('No se pudo guardar la meta', async () => {
    if (!Number.isFinite(hours) || hours < 1 || hours > 80) throw new Error('La meta tiene que estar entre 1 y 80 horas.')
    await db.kv.put({ key: WEEK_GOAL_KEY, value: hours })
  })
}
