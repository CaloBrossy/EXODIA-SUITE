import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Moon, Search, Sun, Wifi, WifiOff } from 'lucide-react'
import { useOnline, useHotkeys, useTheme, useTiltEffect } from '@/hooks/misc'
import { usePomodoro } from '@/hooks/usePomodoro'
import { formatClock, PhaseLabel, progress, remaining } from '@/lib/pomodoro'
import { createNote } from '@/services/notes'
import { useFeedback } from '@/components/feedback'
import { cx, Kbd, Loading } from '@/components/ui'
import { CommandPalette } from './CommandPalette'
import { PomodoroWatcher } from './PomodoroWatcher'
import { PwaStatus } from './PwaStatus'
import { LabIcon, NAV } from './nav'

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="icon-chip ico-float h-8 w-8"><LabIcon size={17} /></span>
      <span className="text-gradient font-mono text-[15px] font-bold tracking-[0.28em]">EXODIA</span>
    </div>
  )
}

function MiniTimer() {
  const { state, now } = usePomodoro()
  if (state.status === 'idle') return null
  const pct = Math.round(progress(state, now) * 100)
  return (
    <NavLink to="/focus" className="glass mx-3 mb-3 block overflow-hidden rounded-xl px-3 py-2 text-xs transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-muted">{PhaseLabel[state.phase]}{state.status === 'paused' && ' · pausa'}</span>
        <span className="font-mono text-sm tabular">{formatClock(remaining(state, now))}</span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-sunken">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--nx-accent),var(--nx-accent-2))] transition-[width] duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </NavLink>
  )
}

export function Layout() {
  const { theme, toggle } = useTheme()
  const online = useOnline()
  const [menu, setMenu] = useState(false)
  const [palette, setPalette] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { fail } = useFeedback()
  useTiltEffect()

  useEffect(() => setMenu(false), [location.pathname])

  const newNote = async () => {
    try {
      const n = await createNote()
      navigate(`/notes/${n.id}`)
    } catch (e) {
      fail(e)
    }
  }

  useHotkeys([
    { combo: 'mod+k', handler: () => setPalette(true), allowInInputs: true },
    { combo: 'alt+n', handler: () => void newNote(), allowInInputs: true },
    ...NAV.map((n, i) => ({ combo: `alt+${i + 1}`, handler: () => navigate(n.to), allowInInputs: true })),
  ])

  const section = location.pathname.split('/')[1] ?? ''

  return (
    <div className="flex h-full">
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <PomodoroWatcher />
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-overlay transition-transform duration-300 md:static md:translate-x-0 md:bg-panel',
          menu ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="px-4 pt-5 pb-4"><Brand /></div>
        <button
          onClick={() => setPalette(true)}
          className="group mx-3 mb-4 flex items-center gap-2 rounded-xl border border-line bg-field px-3 py-2 text-sm text-muted transition-all hover:border-accent/40 hover:text-fg"
        >
          <Search size={14} className="ico-pop" /> Buscar <span className="ml-auto"><Kbd>Ctrl K</Kbd></span>
        </button>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {NAV.map((n, i) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              title={`${n.hint} (Alt+${i + 1})`}
              className={({ isActive }) =>
                cx(
                  'group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all duration-200',
                  isActive ? 'pill-active' : 'text-muted hover:translate-x-0.5 hover:bg-sunken hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-r-full bg-[linear-gradient(180deg,var(--nx-accent),var(--nx-accent-2))] shadow-[0_0_12px_var(--nx-accent)]" />}
                  <span className={cx('flex h-7 w-7 items-center justify-center rounded-lg transition-colors', isActive ? 'icon-chip' : 'bg-sunken')}>
                    <n.icon size={15} className={n.anim} />
                  </span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <MiniTimer />
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
          <span className="flex items-center gap-1.5" title={online ? 'Con conexión' : 'Sin conexión: los módulos locales siguen funcionando'}>
            <span className={cx('h-1.5 w-1.5 rounded-full', online ? 'bg-ok shadow-[0_0_8px_var(--nx-ok)]' : 'bg-danger')} />
            {online ? <Wifi size={13} /> : <WifiOff size={13} className="text-danger" />}
            {online ? 'En línea' : 'Sin conexión'}
          </span>
          <button onClick={toggle} aria-label="Cambiar tema" className="group rounded-lg p-1.5 transition-colors hover:bg-sunken hover:text-fg">
            {theme === 'dark' ? <Sun size={15} className="ico-spin" /> : <Moon size={15} className="ico-wiggle" />}
          </button>
        </div>
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setMenu(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2 md:hidden">
          <button onClick={() => setMenu(true)} aria-label="Abrir menú" className="rounded-lg p-1.5 hover:bg-sunken">
            <Menu size={18} />
          </button>
          <Brand />
          <button onClick={() => setPalette(true)} aria-label="Buscar" className="ml-auto rounded-lg p-1.5 hover:bg-sunken">
            <Search size={18} />
          </button>
        </header>
        <PwaStatus />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Suspense fallback={<div className="p-6"><Loading /></div>}>
            <div key={section} className="page-in h-full">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}
