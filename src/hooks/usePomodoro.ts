import { useCallback, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { DEFAULT_CONFIG, initialState, pause, reset, start, switchPhase, type Phase, type PomodoroConfig, type TimerState } from '@/lib/pomodoro'
import { updateTimer } from '@/services/focus'

export function useNow(active: boolean, every = 250): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setNow(Date.now())
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(t)
  }, [active, every])
  return now
}

export function requestNotificationPermission(): void {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission().catch(() => undefined)
  }
}

/** Estado compartido del Pomodoro (persistido en IndexedDB, sincronizado entre vistas y pestañas). */
export function usePomodoro() {
  const row = useLiveQuery(() => db.kv.bulkGet(['pomodoro.state', 'pomodoro.config']), [])
  const config: PomodoroConfig = { ...DEFAULT_CONFIG, ...((row?.[1]?.value as Partial<PomodoroConfig>) ?? {}) }
  const state: TimerState = (row?.[0]?.value as TimerState | undefined) ?? initialState(config)
  const now = useNow(state.status === 'running')

  const act = useCallback((fn: (s: TimerState, c: PomodoroConfig) => TimerState) => updateTimer(fn), [])

  return {
    loading: row === undefined,
    state,
    config,
    now,
    start: () => {
      requestNotificationPermission()
      return act((s) => start(s, Date.now()))
    },
    pause: () => act((s) => pause(s, Date.now())),
    reset: () => act((s, c) => reset(s, c)),
    switchPhase: (p: Phase) => act((s, c) => switchPhase(s, p, c)),
    link: (taskId: string | null, subjectId: string | null) => act((s) => ({ ...s, taskId, subjectId })),
  }
}
