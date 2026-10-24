import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { markEnteredOps } from '@/app/gate'
import { useAuth } from '@/hooks/useAuth'
import { ClosingSection } from './design/ClosingSection'
import { ContextualAccountInvite } from './design/ContextualAccountInvite'
import { Footer } from './design/Footer'
import { Hero } from './design/Hero'
import { ModuleExplorer } from './design/ModuleExplorer'
import { Navigation } from './design/Navigation'
import { ScientificArchitecture } from './design/ScientificArchitecture'
import { SpaceCanvas } from './design/SpaceCanvas'
import './design/landing.css'

const MODULE_ROUTES: Record<string, string> = {
  workbench: '/workbench/calculator',
  knowledge: '/knowledge',
  notes: '/notes',
  focus: '/focus',
  sketchpad: '/sketch',
  tools: '/tools',
  settings: '/settings',
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('fx-lite'),
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(mq.matches || document.documentElement.classList.contains('fx-lite'))
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const enterOps = () => {
    markEnteredOps()
    navigate('/app')
  }

  const openModule = (id: string, path?: string) => {
    markEnteredOps()
    const fallback = MODULE_ROUTES[id] ?? '/app'
    const allowed = !!path && path.startsWith('/') && !path.startsWith('//') && ['/workbench', '/knowledge', '/notes', '/focus', '/sketch', '/tools', '/settings'].some((p) => path === p || path.startsWith(`${p}/`))
    navigate(allowed && path ? path : fallback)
  }

  return (
    <div className="exodia-landing relative min-h-screen bg-[#05070d] text-[#e6ecfa] selection:bg-[#5ee7f7]/25 selection:text-[#5ee7f7]">
      <SpaceCanvas reducedMotion={reducedMotion} />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Navigation onOpenOperations={enterOps} onOpenAccount={() => navigate(session ? '/settings' : '/login?returnTo=/app')} />
        <main className="flex-1">
          <Hero
            onOpenOperations={enterOps}
            onExploreModules={() => document.getElementById('modulos')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })}
          />
          <ModuleExplorer onSelectModule={openModule} />
          <ScientificArchitecture onOpenOperations={enterOps} />
          <ClosingSection onOpenOperations={enterOps} onSelectModule={openModule} />
        </main>
        <Footer />
      </div>
      {!session && <ContextualAccountInvite onOpenAccountModal={() => navigate('/register?returnTo=/settings')} />}
    </div>
  )
}
