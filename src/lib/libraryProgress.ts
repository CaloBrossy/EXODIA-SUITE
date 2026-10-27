import type { LibraryItem } from '@/db/models'

export function itemProgress(item: Pick<LibraryItem, 'chapters'>) {
  if (item.chapters.length === 0) return 0
  return item.chapters.filter((c) => c.status === 'leido').length / item.chapters.length
}

export function subjectProgress(items: Pick<LibraryItem, 'subjectId' | 'chapters'>[]) {
  const map = new Map<string | null, { done: number; total: number }>()
  for (const item of items) {
    const key = item.subjectId ?? null
    const row = map.get(key) ?? { done: 0, total: 0 }
    row.total += item.chapters.length
    row.done += item.chapters.filter((c) => c.status === 'leido').length
    map.set(key, row)
  }
  return [...map.entries()]
    .map(([subjectId, row]) => ({ subjectId, ...row, ratio: row.total ? row.done / row.total : 0 }))
    .sort((a, b) => b.total - a.total)
}

export function continueChapter(item: Pick<LibraryItem, 'chapters'>) {
  return item.chapters.find((c) => c.status === 'leyendo') ?? item.chapters.find((c) => c.status === 'pendiente') ?? null
}

export function continueReading<T extends Pick<LibraryItem, 'chapters' | 'updatedAt'>>(items: T[]): T | null {
  const open = items.filter((item) => item.chapters.some((c) => c.status !== 'leido'))
  return open.find((item) => item.chapters.some((c) => c.status === 'leyendo')) ?? open.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
}
