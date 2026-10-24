import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { dismissInvite, inviteDismissed, VISITED_MODULES_KEY } from './gate'
import { useAuth } from '@/hooks/useAuth'

const TRACK = new Set(['notes', 'knowledge', 'workbench', 'focus', 'sketch', 'tools'])

export function AccountInvite() {
  const { session, configured } = useAuth()
  const { pathname } = useLocation()
  const [dismissed, setDismissed] = useState(inviteDismissed)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const seg = pathname.split('/')[1] ?? ''
    if (!TRACK.has(seg)) return
    let seen: string[] = []
    try {
      seen = (sessionStorage.getItem(VISITED_MODULES_KEY) ?? '').split(',').filter(Boolean)
    } catch {
      seen = []
    }
    if (!seen.includes(seg)) seen.push(seg)
    try {
      sessionStorage.setItem(VISITED_MODULES_KEY, seen.join(','))
    } catch {
      /* sin sessionStorage la invitación no cuenta visitas */
    }
    if (seen.length >= 2 && !session && !dismissed && configured) setOpen(true)
  }, [pathname, session, dismissed, configured])

  if (!open || session || dismissed || !configured) return null
  const back = encodeURIComponent(pathname)
  const close = () => {
    dismissInvite()
    setDismissed(true)
    setOpen(false)
  }

  return (
    <aside className="account-invite glass fixed right-4 bottom-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-4" aria-label="Crear cuenta">
      <p className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase">Archivo personal</p>
      <p className="mt-2 text-sm">Con una cuenta podés subir una copia a tu nube y bajarla en otro dispositivo. Lo que ya está en este navegador no se borra.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={`/register?returnTo=${back}`} className="btn-grad inline-flex h-8 items-center rounded-lg px-3 text-[13px]">Crear cuenta</Link>
        <button type="button" className="h-8 rounded-lg px-3 text-[13px] text-muted hover:text-fg" onClick={close}>Ahora no</button>
      </div>
    </aside>
  )
}
