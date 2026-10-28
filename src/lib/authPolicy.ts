const FAIL_KEY = 'exodia.auth.fails'
const LOCK_KEY = 'exodia.auth.lockUntil'
const OAUTH_RETURN_KEY = 'exodia.oauth.return'
const MAX_FAILS = 5
const LOCK_MS = 60_000

const mem = new Map<string, string>()

function memory(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage
  } catch {
    /* sesión privada que bloquea el almacenamiento */
  }
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => { mem.set(k, v) },
    removeItem: (k) => { mem.delete(k) },
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Registro: más largo que el mínimo de Supabase y con letras y números. El login no lo exige, para no bloquear cuentas ya creadas. */
export function signupPasswordIssue(password: string): string | null {
  if (password.length < 10) return 'Usá al menos 10 caracteres.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Combiná letras y números.'
  return null
}

export function authLockRemaining(now = Date.now()): number {
  const until = Number(memory()?.getItem(LOCK_KEY) || 0)
  return Math.max(0, until - now)
}

export function noteAuthFailure(now = Date.now()): void {
  const box = memory()
  const n = Number(box.getItem(FAIL_KEY) || 0) + 1
  if (n >= MAX_FAILS) {
    box.setItem(LOCK_KEY, String(now + LOCK_MS))
    box.setItem(FAIL_KEY, '0')
    return
  }
  box.setItem(FAIL_KEY, String(n))
}

export function rememberOAuthReturn(path: string): void {
  memory().setItem(OAUTH_RETURN_KEY, path)
}

export function readOAuthReturn(): string | null {
  const box = memory()
  const value = box.getItem(OAUTH_RETURN_KEY)
  if (value) box.removeItem(OAUTH_RETURN_KEY)
  return value
}

export function clearAuthFailures(): void {
  const box = memory()
  box.removeItem(FAIL_KEY)
  box.removeItem(LOCK_KEY)
}

/** No reenvía el texto de Supabase: evita filtrar si el correo existe o detalles internos. */
export function authErrorMessage(raw: string, mode: 'login' | 'register'): string {
  const m = raw.toLowerCase()
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Email o contraseña incorrectos.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'No se pudo crear la cuenta. Si ya la tenías, entrá.'
  if (m.includes('email not confirmed') || m.includes('not confirmed')) return 'Falta confirmar el correo. Revisá la bandeja.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Esperá un momento y reintentá.'
  if (m.includes('provider') || m.includes('oauth')) return 'Google o GitHub todavía no están habilitados en el servidor.'
  if (m.includes('redirect')) return 'El retorno de acceso no está permitido en el servidor.'
  if (m.includes('password') && mode === 'register') return 'La contraseña no cumple el mínimo del servidor.'
  return 'No se pudo completar. Revisá los datos e intentá de nuevo.'
}
