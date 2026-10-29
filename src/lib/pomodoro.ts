/**
 * Temporizador Pomodoro puro. El tiempo restante se deriva de marcas de tiempo absolutas
 * (endsAt), por lo que no depende de que setInterval se ejecute puntualmente.
 */
export type Phase = 'work' | 'short' | 'long'
export type TimerStatus = 'idle' | 'running' | 'paused'

export interface PomodoroConfig {
  workMin: number
  shortMin: number
  longMin: number
  longEvery: number
  autoStartNext: boolean
}

export const DEFAULT_CONFIG: PomodoroConfig = { workMin: 25, shortMin: 5, longMin: 15, longEvery: 4, autoStartNext: false }

export interface TimerState {
  /** Identificador de la ejecución actual; permite registrar cada sesión exactamente una vez. */
  runId: string | null
  phase: Phase
  status: TimerStatus
  durationMs: number
  /** Marca absoluta de fin (solo en running). */
  endsAt: number | null
  /** Tiempo restante congelado (en paused/idle). */
  remainingMs: number
  /** Inicio de la ejecución (primer arranque). */
  startedAt: number | null
  completedWork: number
  taskId: string | null
  subjectId: string | null
}

export const PhaseLabel: Record<Phase, string> = { work: 'Concentración', short: 'Descanso corto', long: 'Descanso largo' }

export function phaseDuration(phase: Phase, cfg: PomodoroConfig): number {
  const min = phase === 'work' ? cfg.workMin : phase === 'short' ? cfg.shortMin : cfg.longMin
  return Math.round(min * 60_000)
}

export function initialState(cfg: PomodoroConfig = DEFAULT_CONFIG): TimerState {
  const d = phaseDuration('work', cfg)
  return {
    runId: null, phase: 'work', status: 'idle', durationMs: d, endsAt: null, remainingMs: d,
    startedAt: null, completedWork: 0, taskId: null, subjectId: null,
  }
}

export function remaining(s: TimerState, now: number): number {
  if (s.status === 'running' && s.endsAt !== null) return Math.max(0, s.endsAt - now)
  return s.remainingMs
}

export function progress(s: TimerState, now: number): number {
  if (s.durationMs <= 0) return 0
  return Math.min(1, Math.max(0, 1 - remaining(s, now) / s.durationMs))
}

export function isExpired(s: TimerState, now: number): boolean {
  return s.status === 'running' && s.endsAt !== null && now >= s.endsAt
}

const newRunId = (now: number) => `${now}-${Math.random().toString(36).slice(2, 8)}`

export function start(s: TimerState, now: number): TimerState {
  if (s.status === 'running') return s
  const rem = s.remainingMs > 0 ? s.remainingMs : s.durationMs
  return {
    ...s,
    status: 'running',
    endsAt: now + rem,
    remainingMs: rem,
    runId: s.runId ?? newRunId(now),
    startedAt: s.startedAt ?? now,
  }
}

export function pause(s: TimerState, now: number): TimerState {
  if (s.status !== 'running') return s
  return { ...s, status: 'paused', remainingMs: remaining(s, now), endsAt: null }
}

export function reset(s: TimerState, cfg: PomodoroConfig): TimerState {
  const d = phaseDuration(s.phase, cfg)
  return { ...s, status: 'idle', durationMs: d, remainingMs: d, endsAt: null, runId: null, startedAt: null }
}

/** Aplica la configuración al reloj en curso. Si está corriendo, el tiempo visible pasa a ser la nueva duración. */
export function applyConfig(s: TimerState, cfg: PomodoroConfig, now: number): TimerState {
  const d = phaseDuration(s.phase, cfg)
  if (s.status === 'running') {
    if (d === s.durationMs) return s
    return { ...s, durationMs: d, remainingMs: d, endsAt: now + d }
  }
  if (s.status === 'paused' && d === s.durationMs) return s
  return reset(s, cfg)
}

export function switchPhase(s: TimerState, phase: Phase, cfg: PomodoroConfig): TimerState {
  return reset({ ...s, phase }, cfg)
}

export function nextPhase(s: TimerState, cfg: PomodoroConfig): { phase: Phase; completedWork: number } {
  if (s.phase !== 'work') return { phase: 'work', completedWork: s.completedWork }
  const completedWork = s.completedWork + 1
  const phase: Phase = completedWork % Math.max(1, cfg.longEvery) === 0 ? 'long' : 'short'
  return { phase, completedWork }
}

export interface CompletedSession {
  phase: Phase
  startedAt: number
  endedAt: number
  durationMs: number
  taskId: string | null
  subjectId: string | null
}

/** Cierra la fase vencida y prepara la siguiente. */
export function complete(s: TimerState, cfg: PomodoroConfig, now: number): { state: TimerState; session: CompletedSession } {
  const endedAt = s.endsAt ?? now
  const session: CompletedSession = {
    phase: s.phase,
    startedAt: s.startedAt ?? endedAt - s.durationMs,
    endedAt,
    durationMs: s.durationMs,
    taskId: s.taskId,
    subjectId: s.subjectId,
  }
  const { phase, completedWork } = nextPhase(s, cfg)
  let next = reset({ ...s, phase, completedWork }, cfg)
  if (cfg.autoStartNext) next = start(next, now)
  return { state: next, session }
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
