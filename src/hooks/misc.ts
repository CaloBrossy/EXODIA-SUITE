import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
const THEME_KEY = 'exodia.theme'

const themeListeners = new Set<() => void>()
const readTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

function setTheme(t: Theme): void {
  document.documentElement.classList.toggle('dark', t === 'dark')
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    /* almacenamiento no disponible: el tema solo dura la sesión */
  }
  themeListeners.forEach((l) => l())
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (l) => {
      themeListeners.add(l)
      return () => themeListeners.delete(l)
    },
    readTheme,
  )
  const toggle = useCallback(() => setTheme(readTheme() === 'dark' ? 'light' : 'dark'), [])
  return { theme, toggle }
}

export type Fx = 'full' | 'lite'
const FX_KEY = 'exodia.fx'
const fxListeners = new Set<() => void>()
const readFx = (): Fx => (document.documentElement.classList.contains('fx-lite') ? 'lite' : 'full')

export function useFx() {
  const fx = useSyncExternalStore(
    (l) => {
      fxListeners.add(l)
      return () => fxListeners.delete(l)
    },
    readFx,
  )
  const setFx = useCallback((v: Fx) => {
    document.documentElement.classList.toggle('fx-lite', v === 'lite')
    try {
      localStorage.setItem(FX_KEY, v)
    } catch {
      /* sin almacenamiento: vale solo para la sesión */
    }
    fxListeners.forEach((l) => l())
  }, [])
  return { fx, setFx }
}

/** Inclinación 3D con el mouse para cualquier elemento con `data-tilt` (valor opcional = grados máximos). */
export function useTiltEffect(): void {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let current: HTMLElement | null = null
    let frame = 0
    const reset = (el: HTMLElement) => {
      cancelAnimationFrame(frame)
      el.classList.remove('is-tilting')
      for (const p of ['--rx', '--ry', '--mx', '--my']) el.style.removeProperty(p)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || document.documentElement.classList.contains('fx-lite')) return
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-tilt]') : null
      if (el !== current) {
        if (current) reset(current)
        current = el
      }
      if (!el) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
        const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
        const max = Number(el.dataset.tilt) || 7
        el.style.setProperty('--ry', `${(px - 0.5) * 2 * max}deg`)
        el.style.setProperty('--rx', `${(0.5 - py) * 2 * max}deg`)
        el.style.setProperty('--mx', `${px * 100}%`)
        el.style.setProperty('--my', `${py * 100}%`)
        el.classList.add('is-tilting')
      })
    }
    const onLeave = () => {
      if (current) reset(current)
      current = null
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)
    return () => {
      onLeave()
      document.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
    }
  }, [])
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export interface HotkeyDef {
  /** p. ej. "mod+k", "alt+n", "alt+1" (mod = Ctrl o ⌘) */
  combo: string
  handler: (e: KeyboardEvent) => void
  /** Permitir aunque el foco esté en un campo de texto. */
  allowInInputs?: boolean
}

function matches(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+')
  const key = parts.pop()
  const mod = parts.includes('mod')
  if (mod !== (e.ctrlKey || e.metaKey)) return false
  if (parts.includes('alt') !== e.altKey) return false
  if (parts.includes('shift') !== e.shiftKey) return false
  const k = e.key.toLowerCase()
  return k === key || e.code.toLowerCase() === `key${key}` || e.code.toLowerCase() === `digit${key}`
}

export function useHotkeys(defs: HotkeyDef[]): void {
  const ref = useRef(defs)
  ref.current = defs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const inInput = !!t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))
      for (const d of ref.current) {
        if ((!inInput || d.allowInInputs) && matches(e, d.combo)) {
          e.preventDefault()
          d.handler(e)
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
