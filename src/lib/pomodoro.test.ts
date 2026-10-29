import { describe, expect, it } from 'vitest'
import { complete, DEFAULT_CONFIG, formatClock, initialState, isExpired, pause, progress, remaining, reset, start, applyConfig } from './pomodoro'
import { createSaveQueue } from './saveQueue'

const cfg = DEFAULT_CONFIG
const MIN = 60_000

describe('pomodoro', () => {
  it('calcula el restante por marcas de tiempo, no por ticks', () => {
    const s = start(initialState(cfg), 0)
    expect(remaining(s, 10 * MIN)).toBe(15 * MIN)
    expect(progress(s, 12.5 * MIN)).toBeCloseTo(0.5)
    expect(remaining(s, 99 * MIN)).toBe(0)
    expect(isExpired(s, 25 * MIN)).toBe(true)
  })

  it('pausa y reanuda conservando el tiempo', () => {
    let s = start(initialState(cfg), 0)
    s = pause(s, 10 * MIN)
    expect(s.status).toBe('paused')
    expect(remaining(s, 500 * MIN)).toBe(15 * MIN)
    s = start(s, 100 * MIN)
    expect(s.endsAt).toBe(115 * MIN)
    expect(s.startedAt).toBe(0)
  })

  it('reinicia', () => {
    const s = reset(pause(start(initialState(cfg), 0), MIN), cfg)
    expect(s.status).toBe('idle')
    expect(s.remainingMs).toBe(25 * MIN)
    expect(s.runId).toBeNull()
  })

  it('alterna fases y registra la sesión', () => {
    let s = initialState(cfg)
    const phases: string[] = []
    for (let i = 0; i < 8; i++) {
      s = start(s, 0)
      const r = complete(s, cfg, s.endsAt!)
      phases.push(r.session.phase)
      expect(r.session.durationMs).toBe(s.durationMs)
      s = r.state
    }
    expect(phases).toEqual(['work', 'short', 'work', 'short', 'work', 'short', 'work', 'long'])
    expect(s.completedWork).toBe(4)
  })

  it('al guardar, el reloj en reposo toma la nueva duración', () => {
    const s = initialState(cfg)
    const next = applyConfig(s, { ...cfg, workMin: 40 }, 0)
    expect(next.remainingMs).toBe(40 * MIN)
    expect(next.status).toBe('idle')
  })

  it('formatea el reloj', () => {
    expect(formatClock(25 * MIN)).toBe('25:00')
    expect(formatClock(59_001)).toBe('01:00')
    expect(formatClock(0)).toBe('00:00')
  })
})

describe('cola de guardado', () => {
  it('serializa escrituras y descarta intermedias', async () => {
    const written: number[] = []
    let inFlight = 0
    const q = createSaveQueue<number>(async (v) => {
      inFlight++
      expect(inFlight).toBe(1)
      await new Promise((r) => setTimeout(r, 5))
      written.push(v)
      inFlight--
    })
    void q.push(1)
    void q.push(2)
    void q.push(3)
    await q.flush()
    expect(written).toEqual([1, 3])
    expect(written.at(-1)).toBe(3)
  })
})
