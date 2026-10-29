import { db } from '@/db/db'
import { ConceptSchema, type Concept } from '@/db/models'
import { matchesQuery, uid } from '@/lib/text'
import { guard } from './errors'

export type ConceptInput = Omit<Concept, 'id' | 'createdAt' | 'updatedAt' | 'lastViewedAt' | 'seed'>

export const emptyConcept = (): ConceptInput => ({
  title: '',
  discipline: '',
  tags: [],
  summary: '',
  explanation: '',
  formalism: '',
  examples: '',
  observations: '',
  relatedIds: [],
  favorite: false,
})

/** Mantiene las relaciones simétricas: si A se relaciona con B, B se relaciona con A. */
async function syncRelations(id: string, before: string[], after: string[]): Promise<void> {
  const added = after.filter((x) => !before.includes(x))
  const removed = before.filter((x) => !after.includes(x))
  const now = Date.now()
  for (const other of added) {
    await db.concepts.where('id').equals(other).modify((c) => {
      if (c.relatedIds.includes(id)) return
      c.relatedIds.push(id)
      c.updatedAt = now
    })
  }
  for (const other of removed) {
    await db.concepts.where('id').equals(other).modify((c) => {
      c.relatedIds = c.relatedIds.filter((x) => x !== id)
      c.updatedAt = now
    })
  }
}

export function saveConcept(input: ConceptInput, id?: string): Promise<string> {
  return guard('No se pudo guardar el concepto', () =>
    db.transaction('rw', db.concepts, async () => {
      const now = Date.now()
      const existing = id ? await db.concepts.get(id) : undefined
      const conceptId = existing?.id ?? uid()
      const relatedIds = [...new Set(input.relatedIds.filter((x) => x !== conceptId))]
      const concept: Concept = ConceptSchema.parse({
        ...input,
        title: input.title.trim(),
        relatedIds,
        id: conceptId,
        seed: existing?.seed,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastViewedAt: existing?.lastViewedAt ?? null,
      })
      await db.concepts.put(concept)
      await syncRelations(conceptId, existing?.relatedIds ?? [], relatedIds)
      return conceptId
    }),
  )
}

export function deleteConcept(id: string): Promise<void> {
  return guard('No se pudo eliminar el concepto', () =>
    db.transaction('rw', [db.concepts, db.notes, db.formulas, db.questions, db.exercises], async () => {
      const c = await db.concepts.get(id)
      if (!c) return
      await syncRelations(id, c.relatedIds, [])
      const now = Date.now()
      await db.notes.toCollection().modify((n) => {
        if (!n.conceptIds.includes(id)) return
        n.conceptIds = n.conceptIds.filter((x) => x !== id)
        n.updatedAt = now
      })
      await db.formulas.toCollection().modify((f) => {
        if (!f.conceptIds.includes(id)) return
        f.conceptIds = f.conceptIds.filter((x) => x !== id)
        f.updatedAt = now
      })
      await db.questions.where('conceptId').equals(id).modify({ conceptId: null, updatedAt: now })
      await db.exercises.toCollection().modify((e) => {
        if (!e.conceptIds.includes(id)) return
        e.conceptIds = e.conceptIds.filter((x) => x !== id)
        e.updatedAt = now
      })
      await db.concepts.delete(id)
    }),
  )
}

export const toggleConceptFavorite = (c: Concept) =>
  guard('No se pudo actualizar el favorito', () => db.concepts.update(c.id, { favorite: !c.favorite }))

export const markConceptViewed = (id: string) =>
  db.concepts.update(id, { lastViewedAt: Date.now() }).catch(() => undefined)

export interface ConceptFilter {
  query?: string
  discipline?: string | null
  tag?: string | null
  favorites?: boolean
}

export function filterConcepts(list: Concept[], f: ConceptFilter): Concept[] {
  return list
    .filter(
      (c) =>
        (!f.favorites || c.favorite) &&
        (!f.discipline || c.discipline === f.discipline) &&
        (!f.tag || c.tags.includes(f.tag)) &&
        matchesQuery(f.query ?? '', c.title, c.summary, c.explanation, c.tags, c.discipline),
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'es'))
}

export function collectFacets(list: { discipline?: string; tags: string[] }[]) {
  const disciplines = new Set<string>()
  const tags = new Set<string>()
  for (const c of list) {
    if (c.discipline) disciplines.add(c.discipline)
    c.tags.forEach((t) => tags.add(t))
  }
  const sort = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, 'es'))
  return { disciplines: sort(disciplines), tags: sort(tags) }
}
