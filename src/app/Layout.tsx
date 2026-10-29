import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Moon, Search, Sun } from 'lucide-react'
import { useOnline, useHotkeys, useTheme, useTiltEffect } from '@/hooks/misc'
import { usePomodoro } from '@/hooks/usePomodoro'
import { formatClock, PhaseLabel, progress, remaining } from '@/lib/pomodoro'
import { createNote } from '@/services/notes'
import { useFeedback } from '@/components/feedback'
import { CosmicBackground } from '@/components/CosmicBackground'
import { ObservatoryCore } from '@/components/ObservatoryCore'
import { cx, Kbd, Loading } from '@/components/ui'
import { CommandPalette, OPEN_SEARCH_EVENT } from './CommandPalette'
import { PomodoroWatcher } from './PomodoroWatcher'
import { PwaStatus } from './PwaStatus'
import { AccountInvite } from './AccountInvite'
import { AccountChip } from './AccountChip'
import { NAV } from './nav'

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <ObservatoryCore size={30} />
      <div className="leading-none">
        <span className="block font-mono text-[14px] font-semibold tracking-[0.32em] text-fg">EXODIA</span>
        <span className="mt-1 block font-mono text-[9.5px] tracking-[0.18em] text-muted uppercase">Éxodo personal</span>
      </div>
    </div>
  )
}

function MiniTimer() {
  const { state, now } = usePomodoro()
  if (state.status === 'idle') return null
  const pct = Math.round(progress(state, now) * 100)
  return (
    <NavLink to="/focus" className="glass mx-3 mb-3 block rounded-xl px-3 py-2 text-xs transition-colors hover:border-accent/30">
      <div className="flex items-center justify-between">
        <span className="text-muted">{PhaseLabel[state.phase]}{state.status === 'paused' && ' · pausa'}</span>
        <span className="font-mono text-sm tabular">{formatClock(remaining(state, now))}</span>
      </div>
      <div className="mt-1.5 h-[3px] rounded-full bg-sunken">
        <div className="h-full rounded-full bg-accent transition-[width] duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </NavLink>
  )
}

export function Layout() {
  const { theme, toggle } = useTheme()
  const online = useOnline()
  const [menu, setMenu] = useState(false)
  const [palette, setPalette] = useState<{ open: boolean; query: string }>({ open: false, query: '' })
  const navigate = useNavigate()
  const location = useLocation()
  const { fail } = useFeedback()
  useTiltEffect()

  useEffect(() => setMenu(false), [location.pathname])
  useEffect(() => {
    const open = (e: Event) => setPalette({ open: true, query: (e as CustomEvent<string>).detail ?? '' })
    window.addEventListener(OPEN_SEARCH_EVENT, open)
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, open)
  }, [])
  const openPalette = () => setPalette({ open: true, query: '' })

  const newNote = async () => {
    try {
      const n = await createNote()
      navigate(`/notes/${n.id}`)
    } catch (e) {
      fail(e)
    }
  }

  useHotkeys([
    { combo: 'mod+k', handler: openPalette, allowInInputs: true },
    { combo: 'alt+n', handler: () => void newNote(), allowInInputs: true },
    { combo: 'alt+e', handler: () => navigate('/exercises/errores?nuevo=1') },
    ...NAV.map((n, i) => ({ combo: `alt+${i + 1}`, handler: () => navigate(n.to), allowInInputs: true })),
  ])

  const section = location.pathname.split('/')[1] ?? ''

  return (
    <div className="flex h-full">
      <CosmicBackground />
      <PomodoroWatcher />
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-overlay transition-transform duration-300 md:static md:translate-x-0 md:bg-panel',
          menu ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="px-4 pt-5 pb-4"><Brand /></div>
        <button
          onClick={openPalette}
          className="group mx-3 mb-5 flex items-center gap-2 rounded-lg border border-line bg-field px-3 py-2 text-sm text-muted transition-colors hover:border-accent/35 hover:text-fg"
        >
          <Search size={14} className="ico-pop" /> Buscar <span className="ml-auto"><Kbd>Ctrl K</Kbd></span>
        </button>
        <p className="eyebrow px-5 pb-2">Módulos</p>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {NAV.map((n, i) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/app'}
              title={`${n.hint} (Alt+${i + 1})`}
              className={({ isActive }) =>
                cx(
                  'group relative flex items-center gap-3 rounded-lg px-2.5 py-1.5 transition-colors duration-200',
                  isActive ? 'bg-[color-mix(in_srgb,var(--nx-accent)_7%,transparent)] text-fg' : 'text-muted hover:bg-sunken hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="active-rail" />}
                  <n.icon size={16} strokeWidth={1.75} className={cx(n.anim, 'shrink-0 transition-colors', isActive ? 'text-accent drop-shadow-[0_0_6px_var(--nx-glow)]' : '')} />
                  <span className="min-w-0">
                    <span className={cx('block truncate text-[13.5px]', isActive && 'font-medium')}>{n.label}</span>
                    <span className="block truncate text-[11px] text-muted">{n.tagline}</span>
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-muted/60 opacity-0 transition-opacity group-hover:opacity-100">{i + 1}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <MiniTimer />
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 font-mono text-[10.5px] tracking-wider text-muted uppercase">
          <span className="flex items-center gap-2" title={online ? 'Con conexión' : 'Sin conexión: los módulos locales siguen funcionando'}>
            <span className={cx('h-1.5 w-1.5 rounded-full', online ? 'bg-ok shadow-[0_0_6px_var(--nx-ok)]' : 'bg-danger')} />
            {online ? 'En línea' : 'Sin conexión'}
          </span>
          <button onClick={toggle} aria-label="Cambiar tema" className="group rounded-md p-1.5 transition-colors hover:bg-sunken hover:text-fg">
            {theme === 'dark' ? <Sun size={14} className="ico-spin" /> : <Moon size={14} className="ico-wiggle" />}
          </button>
        </div>
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMenu(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2 md:hidden">
          <button onClick={() => setMenu(true)} aria-label="Abrir menú" className="rounded-lg p-1.5 hover:bg-sunken">
            <Menu size={18} />
          </button>
          <Brand />
          <div className="ml-auto flex items-center gap-1">
            <button onClick={openPalette} aria-label="Buscar" className="rounded-lg p-1.5 hover:bg-sunken">
              <Search size={18} />
            </button>
            <AccountChip />
          </div>
        </header>
        <div className="hidden justify-end px-4 pt-2 md:flex">
          <AccountChip />
        </div>
        <PwaStatus />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Suspense fallback={<div className="p-6"><Loading /></div>}>
            <div key={section} className="page-in h-full">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
      <AccountInvite />
      <CommandPalette open={palette.open} initialQuery={palette.query} onClose={() => setPalette({ open: false, query: '' })} />
    </div>
  )
}
