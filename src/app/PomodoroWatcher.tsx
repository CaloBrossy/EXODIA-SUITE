import { useEffect, useRef } from 'react'
import { useFeedback } from '@/components/feedback'
import { usePomodoro } from '@/hooks/usePomodoro'
import { PhaseLabel } from '@/lib/pomodoro'
import { settleTimer } from '@/services/focus'

function beep(): void {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.65)
    o.onended = () => void ctx.close()
  } catch {
    /* audio no disponible */
  }
}

/**
 * Montado una sola vez en el layout: detecta el vencimiento de la fase aunque la vista
 * del temporizador no esté abierta. Revisa al vencer, al volver a la pestaña y al iniciar.
 */
export function PomodoroWatcher() {
  const { state } = usePomodoro()
  const { notify, fail } = useFeedback()
  const settling = useRef(false)

  useEffect(() => {
    const check = async () => {
      if (settling.current) return
      settling.current = true
      try {
        const session = await settleTimer()
        if (session) {
          const msg = `${PhaseLabel[session.phase]} terminada (${Math.round(session.durationMs / 60000)} min).`
          notify(msg, 'ok')
          beep()
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
            new Notification('EXODIA — Pomodoro', { body: msg, icon: '/icons/icon-192.png', tag: 'exodia-pomodoro' })
          }
        }
      } catch (e) {
        fail(e)
      } finally {
        settling.current = false
      }
    }
    void check()
    const onVis = () => void check()
    document.addEventListener('visibilitychange', onVis)
    let timeout: ReturnType<typeof setTimeout> | undefined
    let interval: ReturnType<typeof setInterval> | undefined
    if (state.status === 'running' && state.endsAt) {
      timeout = setTimeout(() => void check(), Math.max(0, state.endsAt - Date.now()) + 50)
      interval = setInterval(() => void check(), 5000)
    }
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [state.status, state.endsAt, state.runId, notify, fail])

  return null
}
