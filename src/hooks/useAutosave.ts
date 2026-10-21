import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSaveQueue } from '@/lib/saveQueue'

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

/**
 * Guarda `value` con debounce. Las escrituras se serializan (nunca gana una escritura vieja)
 * y los cambios pendientes se envían al desmontar, al ocultar la pestaña o con flush().
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<void>, delay = 600) {
  const saveRef = useRef(save)
  saveRef.current = save
  const queue = useMemo(() => createSaveQueue<T>((v) => saveRef.current(v)), [])
  const [status, setStatus] = useState<SaveStatus>('saved')
  const latest = useRef(value)
  const dirty = useRef(false)
  const first = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const version = useRef(0)

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (!dirty.current) return queue.flush()
    dirty.current = false
    const v = ++version.current
    setStatus('saving')
    try {
      await queue.push(latest.current)
      if (v === version.current && !dirty.current) setStatus('saved')
    } catch {
      dirty.current = true
      setStatus('error')
    }
  }, [queue])

  useEffect(() => {
    latest.current = value
    if (first.current) {
      first.current = false
      return
    }
    dirty.current = true
    setStatus('pending')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), delay)
  }, [value, delay, flush])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void flush()
    }
  }, [flush])

  return { status, flush, isDirty: () => dirty.current }
}
