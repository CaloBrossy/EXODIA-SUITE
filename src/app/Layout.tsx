import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Moon, Search, Sun, Wifi, WifiOff } from 'lucide-react'
import { useOnline, useHotkeys, useTheme } from '@/hooks/misc'
import { usePomodoro } from '@/hooks/usePomodoro'
import { formatClock, PhaseLabel, remaining } from '@/lib/pomodoro'
import { createNote } from '@/services/notes'
import { useFeedback } from '@/components/feedback'
import { cx, Kbd, Loading } from '@/components/ui'
import { CommandPalette } from './CommandPalette'
import { PomodoroWatcher } from './PomodoroWatcher'
import { PwaStatus } from './PwaStatus'
import { LabIcon, NAV } from './nav'

function MiniTimer() {
  const { state, now } = usePomodoro()
  if (state.status === 'idle') return null
  return (
    <NavLink to="/focus" className="mx-2 mb-2 flex items-center justify-between rounded-md border border-line px-3 py-2 text-xs hover:bg-sunken">
      <span className="text-muted">{PhaseLabel[state.phase]}{state.status === 'paused' && ' · pausa'}</span>
      <span className="font-mono text-sm tabular">{formatClock(remaining(state, now))}</span>
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

  return (
    <div className="flex h-full">
      <PomodoroWatcher />
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-line bg-panel transition-transform md:static md:translate-x-0',
          menu ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <LabIcon size={18} className="text-accent" />
          <span className="font-mono text-sm font-semibold tracking-[0.2em]">NEXUS</span>
        </div>
        <button
          onClick={() => setPalette(true)}
          className="mx-2 mb-3 flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-sm text-muted hover:bg-sunken"
        >
          <Search size={14} /> Buscar <span className="ml-auto"><Kbd>Ctrl K</Kbd></span>
        </button>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2">
          {NAV.map((n, i) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              title={`${n.hint} (Alt+${i + 1})`}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm',
                  isActive ? 'bg-sunken font-medium text-fg' : 'text-muted hover:bg-sunken hover:text-fg',
                )
              }
            >
              <n.icon size={16} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <MiniTimer />
        <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-muted">
          <span className="flex items-center gap-1.5" title={online ? 'Con conexión' : 'Sin conexión: los módulos locales siguen funcionando'}>
            {online ? <Wifi size={13} /> : <WifiOff size={13} className="text-accent" />}
            {online ? 'En línea' : 'Sin conexión'}
          </span>
          <button onClick={toggle} aria-label="Cambiar tema" className="rounded p-1 hover:bg-sunken hover:text-fg">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMenu(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2 md:hidden">
          <button onClick={() => setMenu(true)} aria-label="Abrir menú" className="rounded p-1.5 hover:bg-sunken">
            <Menu size={18} />
          </button>
          <span className="font-mono text-sm font-semibold tracking-[0.2em]">NEXUS</span>
          <button onClick={() => setPalette(true)} aria-label="Buscar" className="ml-auto rounded p-1.5 hover:bg-sunken">
            <Search size={18} />
          </button>
        </header>
        <PwaStatus />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Suspense fallback={<div className="p-6"><Loading /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}
