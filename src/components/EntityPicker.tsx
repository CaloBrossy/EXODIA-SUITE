import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { matchesQuery } from '@/lib/text'
import { Button, Input } from './ui'

export interface PickerItem {
  id: string
  label: string
  sub?: string
}

/** Lista de elementos vinculados con buscador para agregar o quitar. */
export function EntityPicker({
  items,
  selected,
  onToggle,
  renderLink,
  emptyText,
  addLabel = 'Vincular',
}: {
  items: PickerItem[]
  selected: string[]
  onToggle: (id: string) => void
  renderLink?: (item: PickerItem) => React.ReactNode
  emptyText: string
  addLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const chosen = selected.map((id) => items.find((i) => i.id === id)).filter((x): x is PickerItem => !!x)
  const candidates = items.filter((i) => !selected.includes(i.id) && matchesQuery(q, i.label, i.sub)).slice(0, 30)

  return (
    <div className="flex flex-col gap-2">
      {chosen.length === 0 && <p className="text-xs text-muted">{emptyText}</p>}
      <ul className="flex flex-col gap-1">
        {chosen.map((it) => (
          <li key={it.id} className="group flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{renderLink ? renderLink(it) : it.label}</span>
            <button aria-label={`Quitar ${it.label}`} onClick={() => onToggle(it.id)} className="text-muted opacity-60 group-hover:opacity-100 hover:text-danger">
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <div className="flex flex-col gap-1 rounded-md border border-line p-2">
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="h-8" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} />
          <ul className="max-h-48 overflow-y-auto">
            {candidates.length === 0 && <li className="px-1 py-1 text-xs text-muted">Sin coincidencias.</li>}
            {candidates.map((it) => (
              <li key={it.id}>
                <button onClick={() => onToggle(it.id)} className="w-full rounded px-1.5 py-1 text-left text-sm hover:bg-sunken">
                  {it.label}
                  {it.sub && <span className="ml-2 text-xs text-muted">{it.sub}</span>}
                </button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Listo</Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="self-start" onClick={() => setOpen(true)}>
          <Plus size={13} /> {addLabel}
        </Button>
      )}
    </div>
  )
}
