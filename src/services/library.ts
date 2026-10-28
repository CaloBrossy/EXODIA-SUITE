import { db } from '@/db/db'
import { LibraryItemSchema, type LibraryItem } from '@/db/models'
import { uid } from '@/lib/text'
import { guard } from './errors'

export type LibraryInput = Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>

export function listLibrary(): Promise<LibraryItem[]> {
  return guard('No se pudo leer la biblioteca', () => db.libraryItems.orderBy('updatedAt').reverse().toArray())
}

export function saveLibraryItem(input: LibraryInput, id?: string): Promise<LibraryItem> {
  return guard('No se pudo guardar el ítem', async () => {
    if (!input.title.trim()) throw new Error('El ítem necesita un título.')
    const now = Date.now()
    const prev = id ? await db.libraryItems.get(id) : undefined
    if (id && !prev) throw new Error('El ítem ya no existe.')
    const parsed = LibraryItemSchema.safeParse({
      ...input,
      title: input.title.trim(),
      author: input.author.trim(),
      url: input.url.trim(),
      physical: input.physical.trim(),
      id: prev?.id ?? uid(),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new Error(issue ? `${issue.path.join('.')}: ${issue.message}` : 'Ítem inválido')
    }
    await db.libraryItems.put(parsed.data)
    return parsed.data
  })
}

export function deleteLibraryItem(id: string): Promise<void> {
  return guard('No se pudo borrar el ítem', () => db.libraryItems.delete(id))
}
