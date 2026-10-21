import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '@/db/db'
import type { Note } from '@/db/models'
import { EntityPicker } from '@/components/EntityPicker'
import { Tex } from '@/components/Markdown'
import { Panel } from '@/components/ui'
import { QuestionsPanel } from '@/features/knowledge/QuestionsPanel'
import { relativeTime } from '@/lib/text'

export function NoteLinks({ note, onChange, toggle }: { note: Note; onChange: (c: Partial<Note>) => void; toggle: (list: string[], id: string) => string[] }) {
  const data = useLiveQuery(async () => {
    const [concepts, formulas, recent] = await Promise.all([
      db.concepts.toArray(),
      db.formulas.toArray(),
      db.calculations.orderBy('createdAt').reverse().limit(100).toArray(),
    ])
    const linked = await db.calculations.bulkGet(note.calculationIds)
    const calcs = new Map([...recent, ...linked.filter((c) => !!c)].map((c) => [c!.id, c!]))
    return { concepts, formulas, calcs: [...calcs.values()] }
  }, [note.calculationIds.join()])

  if (!data) return null
  return (
    <>
      <Panel title="Conceptos" bodyClass="p-3">
        <EntityPicker
          items={data.concepts.map((c) => ({ id: c.id, label: c.title, sub: c.discipline }))}
          selected={note.conceptIds}
          onToggle={(id) => onChange({ conceptIds: toggle(note.conceptIds, id) })}
          renderLink={(it) => <Link className="text-accent hover:underline" to={`/knowledge/${it.id}`}>{it.label}</Link>}
          emptyText="Sin conceptos vinculados."
        />
      </Panel>
      <Panel title="Fórmulas" bodyClass="p-3">
        <EntityPicker
          items={data.formulas.map((f) => ({ id: f.id, label: f.name, sub: f.discipline }))}
          selected={note.formulaIds}
          onToggle={(id) => onChange({ formulaIds: toggle(note.formulaIds, id) })}
          renderLink={(it) => {
            const f = data.formulas.find((x) => x.id === it.id)
            return (
              <Link to={`/workbench/formulas/${it.id}`} className="block hover:underline" title={it.label}>
                {f?.latex ? <Tex expr={f.latex} /> : it.label}
              </Link>
            )
          }}
          emptyText="Sin fórmulas vinculadas."
        />
      </Panel>
      <Panel title="Cálculos" bodyClass="p-3">
        <EntityPicker
          items={data.calcs.map((c) => ({ id: c.id, label: `${c.input} = ${c.result}`, sub: relativeTime(c.createdAt) }))}
          selected={note.calculationIds}
          onToggle={(id) => onChange({ calculationIds: toggle(note.calculationIds, id) })}
          renderLink={(it) => <span className="font-mono text-xs" title={it.label}>{it.label}</span>}
          emptyText="Asociá resultados del historial del Workbench."
        />
      </Panel>
      <Panel title="Preguntas" bodyClass="p-3">
        <QuestionsPanel noteId={note.id} />
      </Panel>
    </>
  )
}
