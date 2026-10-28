import { describe, expect, it } from 'vitest'
import type { LibraryItem } from '@/db/models'
import { continueReading, itemProgress, subjectProgress } from './libraryProgress'

const book = (partial: Partial<LibraryItem> & Pick<LibraryItem, 'id' | 'chapters'>): LibraryItem => ({
  title: 'Cálculo',
  author: 'Spivak',
  kind: 'libro',
  subjectId: 'ana',
  url: '',
  physical: '',
  notes: '',
  tags: [],
  favorite: false,
  createdAt: 1,
  updatedAt: 1,
  ...partial,
})

describe('progreso de biblioteca', () => {
  const chapters = Array.from({ length: 10 }, (_, i) => ({
    id: `c${i}`,
    title: `Capítulo ${i + 1}`,
    status: (i < 4 ? 'leido' : i === 4 ? 'leyendo' : 'pendiente') as 'leido' | 'leyendo' | 'pendiente',
    noteId: null,
    conceptId: null,
  }))
  const item = book({ id: 'b1', chapters, updatedAt: 5 })

  it('mide 4 de 10 y lo suma en la materia', () => {
    expect(itemProgress(item)).toBe(0.4)
    expect(subjectProgress([item])).toEqual([{ subjectId: 'ana', done: 4, total: 10, ratio: 0.4 }])
  })

  it('continúa en el capítulo que está leyendo', () => {
    expect(continueReading([item])?.id).toBe('b1')
    expect(continueReading([item])?.chapters.find((c) => c.status === 'leyendo')?.title).toBe('Capítulo 5')
  })
})
