import { numericPlanFor, type SymbolicRequest, type SymbolicResult } from './symbolicTypes'

type In = { id: number; req: SymbolicRequest }
type Out = { id: number; result: SymbolicResult }

let worker: Worker | null = null
let seq = 0

/** Motor simbólico en un worker, creado recién al primer cálculo. Si se cuelga, se reinicia. */
export function solveSymbolic(req: SymbolicRequest, timeoutMs = 12_000): Promise<SymbolicResult> {
  const id = ++seq
  const w = worker ?? (worker = new Worker(new URL('./symbolic.worker.ts', import.meta.url), { type: 'module' }))
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      cleanup()
      w.terminate()
      worker = null
      resolve({ ok: false, error: 'Se agotó el tiempo. No pude resolver esto simbólicamente.', numeric: numericPlanFor(req) })
    }, timeoutMs)
    const onMsg = (ev: MessageEvent<Out>) => {
      if (ev.data.id !== id) return
      cleanup()
      resolve(ev.data.result)
    }
    const onErr = () => {
      cleanup()
      w.terminate()
      worker = null
      resolve({ ok: false, error: 'No pude resolver esto simbólicamente.', numeric: numericPlanFor(req) })
    }
    const cleanup = () => {
      window.clearTimeout(timer)
      w.removeEventListener('message', onMsg)
      w.removeEventListener('error', onErr)
    }
    w.addEventListener('message', onMsg)
    w.addEventListener('error', onErr)
    w.postMessage({ id, req } satisfies In)
  })
}
