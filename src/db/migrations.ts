import { SEED_CONCEPTS } from './seed/concepts'

const OLD_ENTROPY_PATH = '/workbench/entropy'
const OLD_SHANNON_OBSERVATION = 'Probá distribuciones en Workbench → Entropía → Shannon.'

/** v1 → v2: Entropía pasó a Workbench → Física y Shannon a Workbench → Matemática. */
export function migrateFormulaV2<T extends { id: string; toolPath?: string }>(f: T): T {
  if (f.toolPath !== OLD_ENTROPY_PATH) return f
  return { ...f, toolPath: f.id === 'f-shannon' ? '/workbench/math?t=shannon' : '/workbench/physics?t=entropy' }
}

/** Actualiza las observaciones de los conceptos iniciales solo si el usuario no las modificó. */
export function migrateConceptV2<T extends { id: string; seed?: boolean; observations?: string }>(c: T): T {
  if (!c.seed) return c
  const seed = SEED_CONCEPTS.find((s) => s.id === c.id)
  if (!seed?.observations || (c.observations !== '' && c.observations !== OLD_SHANNON_OBSERVATION)) return c
  return { ...c, observations: seed.observations }
}
