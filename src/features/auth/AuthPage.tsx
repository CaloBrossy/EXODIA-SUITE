import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ObservatoryCore } from '@/components/ObservatoryCore'
import { Button, ErrorText, Input } from '@/components/ui'
import { safeReturn } from '@/app/gate'
import { authErrorMessage, readOAuthReturn } from '@/lib/authPolicy'
import { useAuth } from '@/hooks/useAuth'
import { StorageError } from '@/services/errors'
import { useFeedback } from '@/components/feedback'

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { configured, session, restoring, signIn, signUp } = useAuth()
  const { fail, notify } = useFeedback()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [back] = useState(() => safeReturn(params.get('returnTo') ?? readOAuthReturn()))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [caps, setCaps] = useState(false)
  const [passwordOn, setPasswordOn] = useState(false)

  useEffect(() => {
    const sync = (e: KeyboardEvent) => setCaps(e.getModifierState('CapsLock'))
    window.addEventListener('keydown', sync)
    window.addEventListener('keyup', sync)
    return () => {
      window.removeEventListener('keydown', sync)
      window.removeEventListener('keyup', sync)
    }
  }, [])

  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]')
    const prev = robots?.getAttribute('content') ?? 'index,follow'
    robots?.setAttribute('content', 'noindex,nofollow')
    return () => { robots?.setAttribute('content', prev) }
  }, [])

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const desc = params.get('error_description') || hash.get('error_description')
    if (desc) fail(new StorageError(authErrorMessage(desc, 'login')))
  }, [params, fail])

  if (!restoring && session) return <Navigate to={back} replace />

  const submit = async () => {
    setBusy(true)
    setInfo('')
    try {
      if (mode === 'login') {
        await signIn(email, password)
        navigate(back, { replace: true })
      } else {
        const { needsConfirm } = await signUp(email, password)
        if (needsConfirm) {
          setInfo('Cuenta creada. Revisá el correo y confirmá la dirección. El enlace te devuelve a esta pantalla para entrar.')
          notify('Falta confirmar el correo.', 'info')
        } else {
          navigate(back, { replace: true })
        }
      }
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-16">
      <Link to="/welcome" className="mb-4 font-mono text-[11px] tracking-[0.28em] text-muted">EXODIA</Link>
      <div className="glass rounded-2xl p-6">
        <ObservatoryCore size={36} />
        <h1 className="mt-4 text-2xl font-semibold">{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</h1>
        <p className="mt-2 text-sm text-muted">
          {mode === 'login'
            ? 'La sesión evita pedirte la contraseña otra vez. Tus notas siguen en este dispositivo.'
            : 'La cuenta sirve para respaldar y recuperar tus datos. EXODIA se puede usar sin ella.'}
        </p>
        {!configured && <ErrorText>Supabase no está configurado en este entorno. La landing y el laboratorio local siguen disponibles.</ErrorText>}
        <form className="mt-5 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <Input type="email" autoComplete="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Email" />
          <div>
            <Input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'login' ? 'contraseña' : 'contraseña (10+, letras y números)'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordOn(true)}
              onBlur={() => setPasswordOn(false)}
              onKeyDown={(e) => setCaps(e.getModifierState('CapsLock'))}
              minLength={mode === 'login' ? 6 : 10}
              required
              aria-label="Contraseña"
              aria-describedby={passwordOn && caps ? 'caps-lock' : undefined}
            />
            {passwordOn && caps && (
              <p id="caps-lock" role="status" className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
                <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                Mayúsculas activadas
              </p>
            )}
          </div>
          <Button type="submit" variant="primary" disabled={busy || !configured}>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</Button>
        </form>
        <div className="mt-4 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" /></div>
        <div className="mt-4 flex flex-col gap-2">
          <Button className="w-full justify-center" disabled title="En desarrollo">Continuar con Google · En desarrollo</Button>
          <Button className="w-full justify-center" disabled title="En desarrollo">Continuar con GitHub · En desarrollo</Button>
        </div>
        {info && <p className="mt-3 text-sm text-muted">{info}</p>}
        <p className="mt-4 text-sm text-muted">
          {mode === 'login' ? <Link to={`/register?returnTo=${encodeURIComponent(back)}`} className="text-accent">Crear una cuenta</Link> : <Link to={`/login?returnTo=${encodeURIComponent(back)}`} className="text-accent">Ya tengo cuenta</Link>}
        </p>
      </div>
    </main>
  )
}
