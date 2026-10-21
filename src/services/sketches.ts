import { db } from '@/db/db'
import type { Sketch, Stroke } from '@/db/models'
import { uid } from '@/lib/text'
import { guard } from './errors'

export function createSketch(title = 'Pizarra sin título'): Promise<Sketch> {
  return guard('No se pudo crear la pizarra', async () => {
    const now = Date.now()
    const s: Sketch = { id: uid(), title, strokes: [], background: '#ffffff', createdAt: now, updatedAt: now }
    await db.sketches.add(s)
    return s
  })
}

/** Redondea coordenadas a 1 decimal y presión a 2 para reducir el tamaño almacenado. */
export function compactStroke(s: Stroke): Stroke {
  const pts = s.points.map((v, i) => (i % 3 === 2 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10))
  return { ...s, points: pts }
}

export const saveSketch = (id: string, changes: Partial<Pick<Sketch, 'title' | 'strokes' | 'background'>>) =>
  guard('No se pudo guardar la pizarra', async () => {
    const n = await db.sketches.update(id, { ...changes, updatedAt: Date.now() })
    if (n === 0) throw new Error('La pizarra ya no existe')
  })

export const deleteSketch = (id: string) => guard('No se pudo eliminar la pizarra', () => db.sketches.delete(id))

/** Lista liviana (sin trazos) para no cargar dibujos grandes en memoria. */
export async function listSketchesMeta() {
  const out: { id: string; title: string; updatedAt: number; strokeCount: number }[] = []
  await db.sketches.orderBy('updatedAt').reverse().each((s) => {
    out.push({ id: s.id, title: s.title, updatedAt: s.updatedAt, strokeCount: s.strokes.length })
  })
  return out
}
