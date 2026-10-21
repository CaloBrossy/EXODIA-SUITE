import { useEffect, useState } from 'react'
import { useFeedback } from '@/components/feedback'
import { Button } from '@/components/ui'

/** Registra el service worker (solo en build de producción) y avisa de actualizaciones. */
export function PwaStatus() {
  const [update, setUpdate] = useState<null | ((reload?: boolean) => Promise<void>)>(null)
  const { notify } = useFeedback()

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let cancelled = false
    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return
      const updateSW = registerSW({
        onNeedRefresh: () => setUpdate(() => updateSW),
        onOfflineReady: () => notify('EXODIA quedó guardado en caché: ya podés usarlo sin conexión.', 'ok'),
        onRegisterError: () => notify('No se pudo registrar el modo sin conexión.', 'error'),
      })
    })
    return () => {
      cancelled = true
    }
  }, [notify])

  if (!update) return null
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line bg-accent/10 px-4 py-2 text-sm">
      <span>Hay una nueva versión de EXODIA disponible.</span>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setUpdate(null)}>Más tarde</Button>
        <Button size="sm" variant="primary" onClick={() => void update(true)}>Actualizar</Button>
      </div>
    </div>
  )
}
