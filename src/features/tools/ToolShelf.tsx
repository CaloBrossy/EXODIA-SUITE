import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '@/db/db'
import type { ToolLink } from '@/db/models'
import { deleteTool, moveTool, restoreDefaultTools, saveTool } from '@/services/tools'
import { useOnline } from '@/hooks/misc'
import { useFeedback } from '@/components/feedback'
import { Button, ButtonLink, Field, Input, Loading, PageHeader, Panel, Textarea } from '@/components/ui'

function ToolForm({ initial, onDone }: { initial?: ToolLink; onDone: () => void }) {
  const { fail, notify } = useFeedback()
  const [name, setName] = useState(initial?.name ?? '')
  const [url, setUrl] = useState(initial?.url ?? 'https://')
  const [description, setDescription] = useState(initial?.description ?? '')
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        try {
          await saveTool({ name, url, description }, initial?.id)
          notify('Acceso guardado.', 'ok')
          onDone()
        } catch (err) {
          fail(err)
        }
      }}
    >
      <div className="grid gap-2 md:grid-cols-2">
        <Field label="Nombre"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="URL (http/https)"><Input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
      </div>
      <Field label="Descripción"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary">Guardar</Button>
        <Button size="sm" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  )
}

export default function ToolShelf() {
  const tools = useLiveQuery(() => db.tools.orderBy('order').toArray(), [])
  const online = useOnline()
  const { fail, confirm } = useFeedback()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  if (!tools) return <div className="p-6"><Loading /></div>

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <PageHeader
        title="Tool Shelf"
        subtitle="Accesos a herramientas externas maduras. Se abren en una pestaña nueva y requieren conexión a Internet."
        actions={
          <>
            <ButtonLink size="sm" to="/library">Biblioteca</ButtonLink>
            <Button size="sm" onClick={() => restoreDefaultTools().catch(fail)}>Restaurar predeterminados</Button>
            <Button size="sm" variant="primary" onClick={() => setEditing('new')}><Plus size={14} /> Agregar</Button>
          </>
        }
      />
      {!online && <p className="mb-4 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">Sin conexión: estas herramientas no estarán disponibles hasta que vuelva Internet.</p>}
      {editing === 'new' && <Panel title="Nuevo acceso" className="mb-4"><ToolForm onDone={() => setEditing(null)} /></Panel>}
      <ul className="stagger flex flex-col gap-2">
        {tools.map((t, i) => (
          <li key={t.id} data-tilt={editing === t.id ? undefined : 3} className="group tilt-card rounded-xl px-4 py-3">
            {editing === t.id ? (
              <ToolForm initial={t} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:text-accent">
                    {t.name} <ExternalLink size={13} className="ico-bounce" />
                  </a>
                  <p className="text-sm text-muted">{t.description}</p>
                  <p className="truncate font-mono text-xs text-muted">{t.url}</p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button size="icon" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => moveTool(tools, t.id, -1).catch(fail)}><ArrowUp size={14} /></Button>
                  <Button size="icon" variant="ghost" aria-label="Bajar" disabled={i === tools.length - 1} onClick={() => moveTool(tools, t.id, 1).catch(fail)}><ArrowDown size={14} /></Button>
                  <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditing(t.id)}><Pencil size={14} /></Button>
                  <Button size="icon" variant="ghost" aria-label="Quitar" onClick={async () => { if (await confirm({ title: `¿Quitar «${t.name}»?`, confirmLabel: 'Quitar', danger: true })) deleteTool(t.id).catch(fail) }}><Trash2 size={14} /></Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {tools.length === 0 && <p className="text-sm text-muted">No hay accesos. Agregá uno o restaurá los predeterminados.</p>}
    </div>
  )
}
