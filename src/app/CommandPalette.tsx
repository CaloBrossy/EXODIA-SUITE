import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { matchesQuery } from '@/lib/text'
import { cx, Kbd } from '@/components/ui'
import { NAV } from './nav'

interface Item {
  id: string
  label: string
  kind: string
  to: string
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const navigate = useNavigate()

  const data = useLiveQuery(
    async () => (open ? { notes: await db.notes.toArray(), concepts: await db.concepts.toArray(), formulas: await db.formulas.toArray() } : null),
    [open],
  )

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setQ('')
      setSel(0)
      d.showModal()
      setTimeout(() => inputRef.current?.focus(), 0)
    } else if (!open && d.open) d.close()
  }, [open])

  const items = useMemo<Item[]>(() => {
    const out: Item[] = NAV.filter((n) => matchesQuery(q, n.label, n.hint)).map((n) => ({ id: n.to, label: n.label, kind: 'Ir a', to: n.to }))
    if (data && q.trim()) {
      for (const c of data.concepts) if (matchesQuery(q, c.title, c.tags, c.summary)) out.push({ id: c.id, label: c.title, kind: 'Concepto', to: `/knowledge/${c.id}` })
      for (const n of data.notes) if (matchesQuery(q, n.title, n.content, n.tags)) out.push({ id: n.id, label: n.title || 'Sin título', kind: 'Nota', to: `/notes/${n.id}` })
      for (const f of data.formulas) if (matchesQuery(q, f.name, f.tags)) out.push({ id: f.id, label: f.name, kind: 'Fórmula', to: `/workbench/formulas/${f.id}` })
    }
    return out.slice(0, 40)
  }, [q, data])

  const go = (it: Item | undefined) => {
    if (!it) return
    onClose()
    navigate(it.to)
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="mx-auto mt-[12vh] w-[min(94vw,560px)] rounded-2xl border border-line bg-overlay p-0 text-fg shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setSel(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSel((s) => Math.min(items.length - 1, s + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSel((s) => Math.max(0, s - 1))
          } else if (e.key === 'Enter') go(items[sel])
        }}
        placeholder="Buscar conceptos, notas, fórmulas o módulos…"
        className="w-full border-b border-line bg-transparent px-4 py-3 text-[15px] outline-none"
        aria-label="Buscar"
      />
      <ul className="max-h-[50vh] overflow-y-auto p-1">
        {items.length === 0 && <li className="px-3 py-3 text-sm text-muted">Sin resultados.</li>}
        {items.map((it, i) => (
          <li key={`${it.kind}-${it.id}`}>
            <button
              type="button"
              onMouseEnter={() => setSel(i)}
              onClick={() => go(it)}
              className={cx('flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm', i === sel && 'bg-sunken')}
            >
              <span className="w-16 shrink-0 text-xs text-muted">{it.kind}</span>
              <span className="truncate">{it.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="flex gap-3 border-t border-line px-4 py-2 text-xs text-muted">
        <span><Kbd>↑↓</Kbd> navegar</span>
        <span><Kbd>Enter</Kbd> abrir</span>
        <span><Kbd>Esc</Kbd> cerrar</span>
      </p>
    </dialog>
  )
}
