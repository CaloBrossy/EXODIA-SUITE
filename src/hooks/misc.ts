import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
const THEME_KEY = 'nexus.theme'

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
