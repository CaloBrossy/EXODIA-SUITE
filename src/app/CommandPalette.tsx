import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { formatDateTime, matchesQuery } from '@/lib/text'
import { nextOccurrence } from '@/lib/calendar'
import { EventKindLabel } from '@/db/models'
import { cx, Kbd } from '@/components/ui'
import { NAV } from './nav'

interface Item {
  id: string
  label: string
  kind: string
  to: string
  external?: boolean
}

const TOOLS: [string, string, string][] = [
  ['Calculadora científica', '/workbench/calculator', 'expresiones funciones trigonometría'],
  ['Entropía termodinámica', '/workbench/physics?t=entropy', 'calor temperatura gas'],
  ['Cinemática: MRUV y tiro oblicuo', '/workbench/physics?t=kinematics', 'velocidad aceleración proyectil'],
  ['Dinámica: plano inclinado', '/workbench/physics?t=dynamics', 'newton fuerza rozamiento'],
  ['Energía y choques', '/workbench/physics?t=energy', 'conservación momento colisión'],
  ['Circuitos: ley de Ohm y resistencias', '/workbench/physics?t=circuits', 'tensión corriente serie paralelo'],
  ['Gases ideales PV = nRT', '/workbench/physics?t=gases', 'presión volumen'],
  ['Átomo de hidrógeno y modelos atómicos', '/workbench/physics?t=atom', 'bohr espectro balmer'],
  ['Partículas: quarks, leptones y bosones', '/workbench/physics?t=particles', 'modelo estándar higgs'],
  ['Modelos y teorías de la física', '/workbench/physics?t=models', 'relatividad cuántica'],
  ['Constantes físicas', '/workbench/physics?t=constants', 'codata planck boltzmann'],
  ['Vectores 2D y 3D', '/workbench/math?t=vectors', 'producto escalar vectorial'],
  ['Ecuaciones y sistemas lineales', '/workbench/math?t=linear', 'gauss matriz'],
  ['Entropía de Shannon', '/workbench/math?t=shannon', 'información bits probabilidad'],
  ['Conversor de unidades', '/workbench/units', 'medidas temperatura longitud'],
  ['Explorador de fórmulas', '/workbench/formulas', 'latex ecuaciones'],
  ['Dev Lab: de problema a código', '/workbench/dev', 'programación algoritmo pseudocódigo python java'],
  ['Guía de estilo de lenguajes', '/workbench/dev?t=guia', 'convenciones nombres errores comunes'],
  ['Pomodoro', '/focus', 'temporizador concentración'],
  ['Tareas', '/focus/tasks', 'pendientes'],
  ['Gráficas y ajuste de datos', '/workbench/data', 'regresión lineal mínimos cuadrados dispersión errores'],
  ['Solver simbólico', '/workbench/symbolic', 'derivar integrar límites ecuaciones taylor'],
  ['Análisis de circuitos', '/workbench/circuits', 'mallas thévenin transitorios rlc divisor'],
  ['Plan de estudios', '/focus/plan', 'carrera correlativas materias aprobadas promedio'],
]

/** Evento global para abrir la búsqueda desde cualquier módulo; `detail` = texto inicial. */
export const OPEN_SEARCH_EVENT = 'exodia:search'
export const openSearch = (query = '') => window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT, { detail: query }))

export function CommandPalette({ open, initialQuery = '', onClose }: { open: boolean; initialQuery?: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const navigate = useNavigate()

  const data = useLiveQuery(
    async () => (open ? { notes: await db.notes.toArray(), concepts: await db.concepts.toArray(), formulas: await db.formulas.toArray(), tools: await db.tools.toArray(), events: await db.events.toArray(), cards: await db.cards.toArray(), exercises: await db.exercises.toArray(), datasets: await db.datasets.toArray() } : null),
    [open],
  )

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setQ(initialQuery)
      setSel(0)
      d.showModal()
      setTimeout(() => {
        const input = inputRef.current
        input?.focus()
        input?.setSelectionRange(input.value.length, input.value.length)
      }, 0)
    } else if (!open && d.open) d.close()
  }, [open, initialQuery])

  const items = useMemo<Item[]>(() => {
    const out: Item[] = NAV.filter((n) => matchesQuery(q, n.label, n.hint)).map((n) => ({ id: n.to, label: n.label, kind: 'Ir a', to: n.to }))
    if (q.trim()) for (const [label, to, words] of TOOLS) if (matchesQuery(q, label, words)) out.push({ id: to, label, kind: 'Herramienta', to })
    if (data && q.trim()) {
      for (const t of data.tools) if (matchesQuery(q, t.name, t.description)) out.push({ id: t.id, label: t.name, kind: 'Externa', to: t.url, external: true })
      for (const c of data.concepts) if (matchesQuery(q, c.title, c.tags, c.summary)) out.push({ id: c.id, label: c.title, kind: 'Concepto', to: `/knowledge/${c.id}` })
      for (const n of data.notes) if (matchesQuery(q, n.title, n.content, n.tags)) out.push({ id: n.id, label: n.title || 'Sin título', kind: 'Nota', to: `/notes/${n.id}` })
      for (const f of data.formulas) if (matchesQuery(q, f.name, f.tags)) out.push({ id: f.id, label: f.name, kind: 'Fórmula', to: `/workbench/formulas/${f.id}` })
      const now = Date.now()
      for (const e of data.events) {
        if (!matchesQuery(q, e.title, e.notes, e.location, EventKindLabel[e.kind])) continue
        const occ = nextOccurrence(e, now)
        if (!occ) continue
        out.push({
          id: `${e.id}-${occ.startAt}`,
          label: `${e.title} · ${e.allDay ? occ.dayKey : formatDateTime(occ.startAt)}`,
          kind: EventKindLabel[e.kind],
          to: `/calendar?day=${occ.dayKey}`,
        })
      }
      for (const c of data.cards) {
        if (!matchesQuery(q, c.front, c.back, c.tags)) continue
        out.push({ id: c.id, label: c.front.slice(0, 80), kind: 'Tarjeta', to: '/review?tab=tarjetas' })
      }
      for (const x of data.exercises) {
        if (!matchesQuery(q, x.prompt, x.topic, x.source, x.tags)) continue
        out.push({ id: x.id, label: x.prompt.slice(0, 80), kind: 'Ejercicio', to: '/exercises' })
      }
      for (const d of data.datasets) if (matchesQuery(q, d.name, d.notes)) out.push({ id: d.id, label: d.name, kind: 'Serie de datos', to: `/workbench/data/${d.id}` })
    }
    return out.slice(0, 40)
  }, [q, data])

  const go = (it: Item | undefined) => {
    if (!it) return
    onClose()
    if (it.external) window.open(it.to, '_blank', 'noopener,noreferrer')
    else navigate(it.to)
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
        placeholder="Buscar conceptos, notas, fórmulas o herramientas…"
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
              className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors', i === sel && 'bg-[color-mix(in_srgb,var(--nx-accent)_9%,transparent)] text-fg')}
            >
              <span className="w-20 shrink-0 font-mono text-[10.5px] tracking-wider text-muted uppercase">{it.kind}</span>
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
