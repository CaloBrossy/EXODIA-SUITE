import { useEffect, useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ButtonLink } from '@/components/ui'

export function AccountChip() {
  const { session } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [fine, setFine] = useState(false)
  const titleId = useId()
  const back = encodeURIComponent(pathname)

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sync = () => setFine(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!open || fine) return
    const close = () => setOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open, fine])

  if (session) return null

  return (
    <div className="flex items-center gap-1">
      <ButtonLink to={`/login?returnTo=${back}`} size="sm" variant="outline">Entrar</ButtonLink>
      <div className="relative" onMouseEnter={() => fine && setOpen(true)} onMouseLeave={() => fine && setOpen(false)}>
        <button
          type="button"
          aria-label="Por qué conviene una cuenta"
          aria-expanded={open}
          aria-controls={titleId}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-field text-[13px] font-semibold text-accent hover:border-accent/40"
          onClick={(e) => {
            e.stopPropagation()
            if (!fine) setOpen((v) => !v)
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          !
        </button>
        {open && (
          <div className="absolute top-full right-0 z-50 pt-2" onPointerDown={(e) => e.stopPropagation()}>
            <div role="dialog" id={titleId} aria-label="Por qué conviene una cuenta" className="glass w-[min(16rem,calc(100vw-2rem))] rounded-xl p-3 text-left shadow-lg">
              <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">Por qué una cuenta</p>
              <p className="mt-2 text-[13px] leading-snug">Con una cuenta guardás una copia en la nube y la abrís en otro dispositivo. Lo de este navegador no se borra, y podés seguir sin cuenta.</p>
              <Link to={`/register?returnTo=${back}`} className="mt-2 inline-block text-[13px] text-accent">Crear cuenta</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
