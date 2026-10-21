import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { describeStorageError } from '@/services/errors'
import { Button, cx } from './ui'

type ToastKind = 'info' | 'error' | 'ok'
interface Toast {
  id: number
  kind: ToastKind
  text: string
}
interface ConfirmOptions {
  title: string
  body?: ReactNode
  confirmLabel?: string
  danger?: boolean
}

interface FeedbackApi {
  notify: (text: string, kind?: ToastKind) => void
  /** Notifica un error (de almacenamiento u otro) con mensaje legible. */
  fail: (e: unknown) => void
  confirm: (o: ConfirmOptions) => Promise<boolean>
}

const Ctx = createContext<FeedbackApi | null>(null)

export function useFeedback(): FeedbackApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('FeedbackProvider ausente')
  return v
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const seq = useRef(0)

  const notify = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-3), { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500)
  }, [])

  const fail = useCallback((e: unknown) => notify(describeStorageError(e), 'error'), [notify])

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })),
    [],
  )

  useEffect(() => {
    const d = dialogRef.current
    if (pending && d && !d.open) d.showModal()
  }, [pending])

  const close = (v: boolean) => {
    pending?.resolve(v)
    setPending(null)
    dialogRef.current?.close()
  }

  return (
    <Ctx.Provider value={{ notify, fail, confirm }}>
      {children}
      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          e.preventDefault()
          close(false)
        }}
        className="m-auto w-[min(92vw,420px)] rounded-2xl border border-line bg-overlay p-0 text-fg shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      >
        {pending && (
          <div className="flex flex-col gap-3 p-5">
            <h2 className="font-semibold">{pending.title}</h2>
            {pending.body && <div className="text-sm text-muted">{pending.body}</div>}
            <div className="mt-2 flex justify-end gap-2">
              <Button onClick={() => close(false)}>Cancelar</Button>
              <Button autoFocus variant={pending.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
                {pending.confirmLabel ?? 'Confirmar'}
              </Button>
            </div>
          </div>
        )}
      </dialog>
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex items-start gap-2 rounded-xl border bg-overlay px-3 py-2 text-sm shadow-lg',
              t.kind === 'error' ? 'border-danger/50 text-danger' : t.kind === 'ok' ? 'border-ok/50' : 'border-line',
            )}
          >
            <span className="flex-1">{t.text}</span>
            <button aria-label="Cerrar" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-muted hover:text-fg">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
