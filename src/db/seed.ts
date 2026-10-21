import type { Transaction } from 'dexie'
import { SEED_CONCEPTS } from './seed/concepts'
import { SEED_FORMULAS, SEED_TOOLS, seedSubjects } from './seed/others'

/** Carga los datos iniciales. Se ejecuta una sola vez, cuando se crea la base. */
export async function seedDatabase(tx: Transaction): Promise<void> {
  const now = Date.now()
  await tx.table('concepts').bulkAdd(
    SEED_CONCEPTS.map((c) => ({ ...c, favorite: false, seed: true, createdAt: now, updatedAt: now, lastViewedAt: null })),
  )
  await tx.table('formulas').bulkAdd(SEED_FORMULAS.map((f) => ({ ...f, seed: true, createdAt: now, updatedAt: now })))
  await tx.table('subjects').bulkAdd(seedSubjects(now))
  await tx.table('tools').bulkAdd(SEED_TOOLS)
}
