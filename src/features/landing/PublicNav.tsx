import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { ObservatoryCore } from '@/components/ObservatoryCore'
import { markEnteredOps } from '@/app/gate'
import { useAuth } from '@/hooks/useAuth'

export function PublicNav() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const enter = () => {
    markEnteredOps()
    navigate('/app')
  }
  const links = (
    <>
      <a href="#modulos" onClick={() => setOpen(false)}>Módulos</a>
      <a href="#orbita" onClick={() => setOpen(false)}>Órbita</a>
      <button type="button" onClick={enter}>Entrar</button>
      {session ? (
        <button type="button" onClick={() => void signOut().catch(() => undefined)}>Salir</button>
      ) : (
        <>
          <Link to="/login" onClick={() => setOpen(false)}>Sesión</Link>
          <Link to="/register" onClick={() => setOpen(false)}>Crear cuenta</Link>
        </>
      )}
    </>
  )
  return (
    <header className="public-nav sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link to="/welcome" className="flex items-center gap-2 font-mono text-[13px] tracking-[0.28em]">
          <ObservatoryCore size={22} />
          EXODIA
        </Link>
        <nav className="ml-auto hidden items-center gap-4 text-[13px] text-muted md:flex [&_a]:hover:text-fg [&_button]:hover:text-fg">{links}</nav>
        <button type="button" className="ml-auto rounded-lg p-2 md:hidden" aria-expanded={open} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen((v) => !v)}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open && <nav className="flex flex-col gap-3 border-t border-line px-4 py-3 text-sm md:hidden [&_a]:py-1 [&_button]:text-left">{links}</nav>}
    </header>
  )
}
