import { db } from '@/db/db'
import { ToolLinkSchema, type ToolLink } from '@/db/models'
import { SEED_TOOLS } from '@/db/seed/others'
import { uid } from '@/lib/text'
import { guard } from './errors'

export function saveTool(input: Pick<ToolLink, 'name' | 'url' | 'description'>, id?: string): Promise<void> {
  return guard('No se pudo guardar el acceso', async () => {
    const existing = id ? await db.tools.get(id) : undefined
    const maxOrder = (await db.tools.orderBy('order').last())?.order ?? 0
    const parsed = ToolLinkSchema.safeParse({
      ...existing,
      ...input,
      name: input.name.trim(),
      url: input.url.trim(),
      id: existing?.id ?? uid(),
      order: existing?.order ?? maxOrder + 1,
      updatedAt: Date.now(),
    })
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Datos inválidos')
    await db.tools.put(parsed.data)
  })
}

export const deleteTool = (id: string) => guard('No se pudo eliminar el acceso', () => db.tools.delete(id))

/** Vuelve a agregar los accesos predeterminados que se hayan eliminado. */
export const restoreDefaultTools = () =>
  guard('No se pudieron restaurar los accesos', async () => {
    const existing = new Set(await db.tools.toCollection().primaryKeys())
    await db.tools.bulkAdd(SEED_TOOLS.filter((t) => !existing.has(t.id)))
  })

export function moveTool(list: ToolLink[], id: string, dir: -1 | 1): Promise<void> {
  return guard('No se pudo reordenar', async () => {
    const i = list.findIndex((t) => t.id === id)
    const j = i + dir
    const a = list[i]
    const b = list[j]
    if (!a || !b) return
    await db.transaction('rw', db.tools, async () => {
      const now = Date.now()
      await db.tools.update(a.id, { order: b.order, updatedAt: now })
      await db.tools.update(b.id, { order: a.order, updatedAt: now })
    })
  })
}
