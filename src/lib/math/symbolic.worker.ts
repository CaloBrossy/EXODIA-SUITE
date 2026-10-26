import { runSymbolic } from './symbolic'
import { numericPlanFor, type SymbolicRequest, type SymbolicResult } from './symbolicTypes'

type In = { id: number; req: SymbolicRequest }
type Out = { id: number; result: SymbolicResult }

const scope = globalThis as unknown as {
  onmessage: ((ev: MessageEvent<In>) => void) | null
  postMessage: (msg: Out) => void
}

scope.onmessage = (ev) => {
  const { id, req } = ev.data
  try {
    scope.postMessage({ id, result: runSymbolic(req) })
  } catch (e) {
    scope.postMessage({ id, result: { ok: false, error: (e as Error).message || 'No pude resolver esto simbólicamente.', numeric: numericPlanFor(req) } })
  }
}
