import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ObservatoryCore } from '@/components/ObservatoryCore'
import { Button, ErrorText, Input } from '@/components/ui'
import { safeReturn } from '@/app/gate'
import { useAuth } from '@/hooks/useAuth'
import { useFeedback } from '@/components/feedback'

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { configured, session, restoring, signIn, signUp } = useAuth()
  const { fail, notify } = useFeedback()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const back = safeReturn(params.get('returnTo'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')

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
          <Input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="contraseña (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required aria-label="Contraseña" />
          <Button type="submit" variant="primary" disabled={busy || !configured}>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</Button>
        </form>
        {info && <p className="mt-3 text-sm text-muted">{info}</p>}
        <p className="mt-4 text-sm text-muted">
          {mode === 'login' ? <Link to={`/register?returnTo=${encodeURIComponent(back)}`} className="text-accent">Crear una cuenta</Link> : <Link to={`/login?returnTo=${encodeURIComponent(back)}`} className="text-accent">Ya tengo cuenta</Link>}
        </p>
      </div>
    </main>
  )
}
