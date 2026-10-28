export const ENTERED_OPS_KEY = 'exodia.enteredOps'
export const INVITE_DISMISSED_KEY = 'exodia.invite.dismissed'
export const VISITED_MODULES_KEY = 'exodia.visitedModules'

export function enteredOps(): boolean {
  try {
    return localStorage.getItem(ENTERED_OPS_KEY) === '1'
  } catch {
    return false
  }
}

export function markEnteredOps(): void {
  try {
    localStorage.setItem(ENTERED_OPS_KEY, '1')
  } catch {
    /* el centro sigue accesible en esta visita */
  }
}

export function inviteDismissed(): boolean {
  try {
    return localStorage.getItem(INVITE_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissInvite(): void {
  try {
    localStorage.setItem(INVITE_DISMISSED_KEY, '1')
  } catch {
    /* si no se puede guardar, no se vuelve a mostrar en esta pestaña */
  }
}

/** `/` muestra la landing salvo sesión o visita previa al centro. */
export function rootDestination(opts: { session: boolean; entered: boolean }): '/app' | 'landing' {
  return opts.session || opts.entered ? '/app' : 'landing'
}

/** Solo rutas internas. Bloquea protocolos, otro origen y caracteres de control. */
export function safeReturn(raw: string | null, fallback = '/app'): string {
  if (!raw) return fallback
  let path = raw
  try {
    path = decodeURIComponent(raw)
  } catch {
    return fallback
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('://')) return fallback
  if (/[\u0000-\u001F\u007F]/.test(path)) return fallback
  return path
}
