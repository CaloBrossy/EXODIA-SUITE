import { db } from '@/db/db'
import type { Note } from '@/db/models'
import { matchesQuery, uid } from '@/lib/text'
import { guard } from './errors'

export type NoteDraft = Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>

export function createNote(init: NoteDraft = {}): Promise<Note> {
  return guard('No se pudo crear la nota', async () => {
    const now = Date.now()
    const note: Note = {
      id: uid(),
      title: '',
      content: '',
      tags: [],
      favorite: false,
      conceptIds: [],
      formulaIds: [],
      calculationIds: [],
      subjectId: null,
      ...init,
      createdAt: now,
      updatedAt: now,
    }
    await db.notes.add(note)
    return note
  })
}

export function updateNote(id: string, changes: NoteDraft): Promise<void> {
  return guard('No se pudo guardar la nota', async () => {
    const n = await db.notes.update(id, { ...changes, updatedAt: Date.now() })
    if (n === 0) throw new Error('La nota ya no existe')
  })
}

export const getNote = (id: string) => db.notes.get(id)

export function deleteNote(id: string): Promise<void> {
  return guard('No se pudo eliminar la nota', () =>
    db.transaction('rw', db.notes, db.questions, async () => {
      await db.questions.where('noteId').equals(id).modify({ noteId: null })
      await db.notes.delete(id)
    }),
  )
}

export async function listNotes(): Promise<Note[]> {
  return db.notes.orderBy('updatedAt').reverse().toArray()
}

export interface NoteFilter {
  query?: string
  tag?: string | null
  favorites?: boolean
  subjectId?: string | null
}

export function filterNotes(notes: Note[], f: NoteFilter): Note[] {
  return notes.filter(
    (n) =>
      (!f.favorites || n.favorite) &&
      (!f.tag || n.tags.includes(f.tag)) &&
      (!f.subjectId || n.subjectId === f.subjectId) &&
      matchesQuery(f.query ?? '', n.title, n.content, n.tags),
  )
}

export function toggleLink(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}
