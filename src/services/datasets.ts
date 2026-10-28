import { db } from '@/db/db'
import { DatasetSchema, type Dataset } from '@/db/models'
import { uid } from '@/lib/text'
import { guard } from './errors'

export type DatasetInput = Omit<Dataset, 'id' | 'createdAt' | 'updatedAt'>

export const emptyDataset = (): DatasetInput => ({
  name: '',
  subjectId: null,
  notes: '',
  rows: [],
  xAxis: { label: 'x', unit: '', log: false },
  yAxis: { label: 'y', unit: '', log: false },
  fit: 'linear',
  degree: 2,
})

export function listDatasets(): Promise<Dataset[]> {
  return guard('No se pudieron leer las series', () => db.datasets.orderBy('updatedAt').reverse().toArray())
}

export function saveDataset(input: DatasetInput, id?: string): Promise<Dataset> {
  return guard('No se pudo guardar la serie', async () => {
    const now = Date.now()
    const prev = id ? await db.datasets.get(id) : undefined
    const parsed = DatasetSchema.safeParse({
      ...input,
      name: input.name.trim(),
      id: prev?.id ?? uid(),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new Error(issue?.path[0] === 'name' ? 'Poné un nombre a la serie.' : `Datos inválidos en ${issue?.path.join('.')}: ${issue?.message}`)
    }
    await db.datasets.put(parsed.data)
    return parsed.data
  })
}

export function deleteDataset(id: string): Promise<void> {
  return guard('No se pudo eliminar la serie', () => db.datasets.delete(id))
}
