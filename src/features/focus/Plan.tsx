import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { SUBJECT_STATUSES, SubjectStatusLabel, type SubjectPlan, type SubjectStatus } from '@/db/models'
import { eligibilityMap, emptyPlan, groupByYear, inPlan, parsePlanImport, planStats, type Eligibility, type PlanSubject } from '@/lib/plan'
import { parseNum } from '@/lib/csv'
import { createPlanSubject, importPlan, readAverageWithFails, removeFromPlan, savePlan, setPlanStatus, writeAverageWithFails } from '@/services/plan'
import { EntityPicker } from '@/components/EntityPicker'
import { useFeedback } from '@/components/feedback'
import { Button, cx, Empty, ErrorText, Field, Input, Loading, Panel, Select, Tabs, Textarea } from '@/components/ui'

const STATUS_COLOR: Record<SubjectStatus, string> = {
  pendiente: 'var(--nx-muted)',
  cursando: 'var(--nx-accent)',
  regular: 'var(--nx-accent-2)',
  aprobada: 'var(--nx-ok)',
  libre: 'var(--nx-danger)',
}

const EXAMPLE = `codigo;nombre;anio;cuatrimestre;horas;correlativas_cursar;correlativas_rendir;estado;nota
AM1;Análisis Matemático I;1;1C;128;;;aprobada;8
ALG;Álgebra I;1;1C;96;;;regular;
AM2;Análisis Matemático II;2;1C;128;AM1|ALG;AM1|ALG;;
FIS2;Física II;2;2C;128;AM2;AM1;;`

const pad = (n: number) => String(n).padStart(2, '0')
const toDateInput = (ms: number | null) => {
  if (ms == null) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const fromDateInput = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime() : null
}
const fmt = (n: number | null, digits = 2) => (n == null ? '—' : n.toLocaleString('es', { maximumFractionDigits: digits }))

function StatusDot({ status }: { status: SubjectStatus }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[status] }} />
}

function Badges({ e }: { e?: Eligibility }) {
  if (!e) return null
  return (
    <>
      {e.canCourse && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">Podés cursar</span>}
      {e.canExam && <span className="rounded-full bg-accent2/15 px-2 py-0.5 text-[11px] font-medium text-accent2">Podés rendir</span>}
    </>
  )
}

export function Plan() {
  const { fail, notify } = useFeedback()
  const data = useLiveQuery(async () => ({ subjects: await db.subjects.toArray(), withFails: await readAverageWithFails() }), [])
  const [view, setView] = useState<'lista' | 'grafo'>('lista')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [newName, setNewName] = useState('')
  const [addId, setAddId] = useState('')

  const planned = useMemo(() => (data?.subjects ?? []).filter(inPlan), [data?.subjects])
  const elig = useMemo(() => eligibilityMap(planned), [planned])
  const stats = useMemo(() => planStats(planned), [planned])
  const names = useMemo(() => new Map(planned.map((s) => [s.id, s.name])), [planned])
  if (!data) return <Loading />

  const outside = data.subjects.filter((s) => !s.plan).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const visible = onlyOpen ? planned.filter((s) => elig.get(s.id)?.canCourse || elig.get(s.id)?.canExam) : planned
  const current = planned.find((s) => s.id === selected)
  const avg = data.withFails ? stats.averageWithFails : stats.average

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Panel title="Avance">
          <p className="text-2xl font-semibold tabular">{Math.round(stats.progress * 100)}%</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken"><div className="h-full bg-accent" style={{ width: `${stats.progress * 100}%` }} /></div>
          <p className="mt-1 text-xs text-muted">{stats.approved}/{stats.total} aprobadas{stats.byHours ? ' · por horas' : ''}</p>
        </Panel>
        <Panel title="Promedio">
          <p className="text-2xl font-semibold tabular">{fmt(avg)}</p>
          <label className="mt-1 flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={data.withFails} onChange={(e) => writeAverageWithFails(e.target.checked).catch(fail)} /> Con aplazos
          </label>
        </Panel>
        <Panel title="Habilitadas ahora">
          <p className="text-2xl font-semibold tabular">{[...elig.values()].filter((e) => e.canCourse).length}</p>
          <p className="text-xs text-muted">para cursar · {[...elig.values()].filter((e) => e.canExam).length} para rendir</p>
        </Panel>
        <Panel title="Estimación">
          <p className="text-2xl font-semibold tabular">{stats.estimatedEnd ? new Date(stats.estimatedEnd).getFullYear() : '—'}</p>
          <p className="text-xs text-muted">{stats.perYear ? `${fmt(stats.perYear, 1)} materias por año` : 'Necesita 2 aprobadas con fecha'}</p>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={view} onChange={setView} items={[{ id: 'lista', label: 'Por año' }, { id: 'grafo', label: 'Correlatividades' }]} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> ¿Qué puedo cursar ahora?</label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <form className="flex gap-1" onSubmit={(e) => {
            e.preventDefault()
            createPlanSubject(newName).then((id) => { setNewName(''); setSelected(id) }).catch(fail)
          }}>
            <Input className="w-44" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nueva materia…" />
            <Button type="submit" disabled={!newName.trim()}>Agregar</Button>
          </form>
          {outside.length > 0 && (
            <div className="flex gap-1">
              <Select className="w-44" value={addId} onChange={(e) => setAddId(e.target.value)} aria-label="Materia de Focus">
                <option value="">Desde Focus…</option>
                {outside.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Button disabled={!addId} onClick={() => {
                const s = outside.find((x) => x.id === addId)
                if (s) savePlan(s.id, emptyPlan(s)).then(() => { setAddId(''); setSelected(s.id) }).catch(fail)
              }}>Sumar</Button>
            </div>
          )}
          <Button onClick={() => setImporting((v) => !v)}>Importar</Button>
        </div>
      </div>

      {importing && <ImportPanel onDone={(msg) => { notify(msg, 'ok'); setImporting(false) }} />}

      <div className={cx('grid gap-4', current && 'lg:grid-cols-[minmax(0,1fr)_380px]')}>
        <div className="min-w-0">
          {planned.length === 0 ? (
            <Empty title="Sin plan cargado" action={<Button size="sm" onClick={() => setImporting(true)}>Importar plan</Button>}>
              Agregá materias, sumá las de Focus o importá un CSV/JSON.
            </Empty>
          ) : view === 'lista' ? (
            <PlanList subjects={visible} elig={elig} names={names} selected={selected} onSelect={setSelected} />
          ) : (
            <PlanGraph subjects={planned} elig={elig} selected={selected} onSelect={setSelected} dim={onlyOpen} />
          )}
        </div>
        {current && <PlanEditor key={`${current.id}:${current.updatedAt}`} s={current} all={planned} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}

function PlanList({ subjects, elig, names, selected, onSelect }: {
  subjects: PlanSubject[]
  elig: Map<string, Eligibility>
  names: Map<string, string>
  selected: string | null
  onSelect: (id: string) => void
}) {
  const { fail } = useFeedback()
  if (!subjects.length) return <Empty title="Nada habilitado">Ninguna materia cumple las correlativas por ahora.</Empty>
  return (
    <div className="flex flex-col gap-4">
      {groupByYear(subjects).map((g) => (
        <Panel key={g.year ?? 'x'} title={g.year ? `${g.year}.º año` : 'Sin año'} bodyClass="p-1">
          <ul>
            {g.items.map((s) => {
              const e = elig.get(s.id)
              const missing = [...(e?.missingCourse ?? [])].map((id) => names.get(id)).filter(Boolean)
              return (
                <li key={s.id} className={cx('flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5', selected === s.id && 'bg-sunken', e?.canCourse && 'ring-1 ring-accent/40')}>
                  <StatusDot status={s.plan.status} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(s.id)}>
                    <span className="text-sm">{s.plan.code && <span className="mr-1.5 font-mono text-xs text-muted">{s.plan.code}</span>}{s.name}</span>
                    <span className="block text-xs text-muted">
                      {[s.plan.term, s.plan.hours != null && `${s.plan.hours} h`, s.plan.grade != null && `nota ${s.plan.grade}`, missing.length > 0 && `falta: ${missing.join(', ')}`].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </button>
                  <Badges e={e} />
                  <Select className="h-7 w-28 text-xs" value={s.plan.status} aria-label={`Estado de ${s.name}`} onChange={(ev) => {
                    const st = ev.target.value as SubjectStatus
                    setPlanStatus(s.id, st).then(() => { if (st === 'aprobada' && s.plan.grade == null) onSelect(s.id) }).catch(fail)
                  }}>
                    {SUBJECT_STATUSES.map((x) => <option key={x} value={x}>{SubjectStatusLabel[x]}</option>)}
                  </Select>
                </li>
              )
            })}
          </ul>
        </Panel>
      ))}
    </div>
  )
}

const NODE_W = 176
const NODE_H = 46
const COL_GAP = 64
const ROW_GAP = 14
const PAD = 16

function PlanGraph({ subjects, elig, selected, onSelect, dim }: {
  subjects: PlanSubject[]
  elig: Map<string, Eligibility>
  selected: string | null
  onSelect: (id: string) => void
  dim: boolean
}) {
  const groups = groupByYear(subjects)
  const pos = new Map<string, { x: number; y: number }>()
  groups.forEach((g, col) => g.items.forEach((s, row) => pos.set(s.id, { x: PAD + col * (NODE_W + COL_GAP), y: PAD + 22 + row * (NODE_H + ROW_GAP) })))
  const width = PAD * 2 + groups.length * NODE_W + (groups.length - 1) * COL_GAP
  const height = PAD * 2 + 22 + Math.max(...groups.map((g) => g.items.length)) * (NODE_H + ROW_GAP)
  const edges = subjects.flatMap((s) => [
    ...s.plan.requiresCourse.map((d) => ({ from: d, to: s.id, exam: false })),
    ...s.plan.requiresExam.filter((d) => !s.plan.requiresCourse.includes(d)).map((d) => ({ from: d, to: s.id, exam: true })),
  ]).filter((e) => pos.has(e.from))
  const linked = (e: { from: string; to: string }) => selected != null && (e.from === selected || e.to === selected)

  return (
    <Panel bodyClass="overflow-x-auto p-2">
      <svg width={width} height={height} role="img" aria-label="Grafo de correlatividades" className="text-fg">
        <defs>
          <marker id="plan-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--nx-muted)" />
          </marker>
        </defs>
        {groups.map((g, col) => (
          <text key={g.year ?? 'x'} x={PAD + col * (NODE_W + COL_GAP)} y={PAD + 8} fontSize="11" fill="var(--nx-muted)">{g.year ? `${g.year}.º año` : 'Sin año'}</text>
        ))}
        {edges.map((e, i) => {
          const a = pos.get(e.from)!
          const b = pos.get(e.to)!
          const x1 = a.x + NODE_W
          const y1 = a.y + NODE_H / 2
          const x2 = b.x
          const y2 = b.y + NODE_H / 2
          const dx = Math.max(30, Math.abs(x2 - x1) / 2)
          const on = linked(e)
          return (
            <path
              key={i}
              d={`M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`}
              fill="none"
              stroke={on ? 'var(--nx-accent)' : 'var(--nx-muted)'}
              strokeOpacity={selected && !on ? 0.2 : 0.6}
              strokeWidth={on ? 1.8 : 1}
              strokeDasharray={e.exam ? '4 3' : undefined}
              markerEnd="url(#plan-arrow)"
            />
          )
        })}
        {subjects.map((s) => {
          const p = pos.get(s.id)!
          const el = elig.get(s.id)
          const open = !!(el?.canCourse || el?.canExam)
          return (
            <g key={s.id} transform={`translate(${p.x},${p.y})`} onClick={() => onSelect(s.id)} className="cursor-pointer" opacity={dim && !open ? 0.35 : 1}>
              <title>{`${s.name} — ${SubjectStatusLabel[s.plan.status]}`}</title>
              <rect width={NODE_W} height={NODE_H} rx="10" fill="var(--nx-panel)" stroke={selected === s.id ? 'var(--nx-fg)' : open ? 'var(--nx-accent)' : 'var(--nx-line)'} strokeWidth={open || selected === s.id ? 2 : 1} />
              <rect width="4" height={NODE_H - 16} x="8" y="8" rx="2" fill={STATUS_COLOR[s.plan.status]} />
              <text x="20" y="19" fontSize="12" fill="currentColor">{s.name.length > 22 ? `${s.name.slice(0, 21)}…` : s.name}</text>
              <text x="20" y="35" fontSize="10.5" fill="var(--nx-muted)">
                {[s.plan.code, SubjectStatusLabel[s.plan.status], el?.canCourse ? 'cursable' : el?.canExam ? 'puede rendir' : ''].filter(Boolean).join(' · ')}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="px-2 pt-1 text-[11px] text-muted">Línea continua: para cursar · punteada: solo para rendir. Borde resaltado: habilitada ahora.</p>
    </Panel>
  )
}

function PlanEditor({ s, all, onClose }: { s: PlanSubject; all: PlanSubject[]; onClose: () => void }) {
  const { fail, notify, confirm } = useFeedback()
  const [name, setName] = useState(s.name)
  const [notes, setNotes] = useState(s.notes)
  const [p, setP] = useState<SubjectPlan>(s.plan)
  const [fails, setFails] = useState(s.plan.failedGrades.join(', '))
  const [error, setError] = useState('')
  const set = <K extends keyof SubjectPlan>(k: K, v: SubjectPlan[K]) => setP((x) => ({ ...x, [k]: v }))
  const others = all.filter((x) => x.id !== s.id).map((x) => ({ id: x.id, label: x.name, sub: [x.plan.code, x.plan.year && `${x.plan.year}.º año`].filter(Boolean).join(' · ') }))
  const toggle = (k: 'requiresCourse' | 'requiresExam') => (id: string) => set(k, p[k].includes(id) ? p[k].filter((x) => x !== id) : [...p[k], id])

  return (
    <aside className="glass flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">Materia del plan</h2>
        <Button size="sm" variant="ghost" onClick={onClose}>Cerrar</Button>
      </div>
      <form className="flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault()
        setError('')
        const failedGrades = fails.split(/[;,\s]+/).map((x) => parseNum(x)).filter((x): x is number => x != null)
        savePlan(s.id, { ...p, failedGrades }, { name, notes })
          .then(() => notify('Materia guardada.', 'ok'))
          .catch((x) => { setError(x instanceof Error ? x.message : String(x)); fail(x) })
      }}>
        <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Código"><Input value={p.code} onChange={(e) => set('code', e.target.value)} /></Field>
          <Field label="Año"><Input type="number" min={1} max={12} value={p.year ?? ''} onChange={(e) => set('year', e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Cuatrimestre"><Input value={p.term} onChange={(e) => set('term', e.target.value)} placeholder="1C, 2C, anual" /></Field>
          <Field label="Horas"><Input type="number" min={0} value={p.hours ?? ''} onChange={(e) => set('hours', e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Créditos"><Input type="number" min={0} value={p.credits ?? ''} onChange={(e) => set('credits', e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Estado">
            <Select value={p.status} onChange={(e) => set('status', e.target.value as SubjectStatus)}>
              {SUBJECT_STATUSES.map((x) => <option key={x} value={x}>{SubjectStatusLabel[x]}</option>)}
            </Select>
          </Field>
          <Field label="Nota final"><Input type="number" min={0} max={10} step={0.5} value={p.grade ?? ''} onChange={(e) => set('grade', e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Aprobada el"><Input type="date" value={toDateInput(p.approvedAt)} disabled={p.status !== 'aprobada'} onChange={(e) => set('approvedAt', fromDateInput(e.target.value))} /></Field>
        </div>
        <Field label="Aplazos" hint="Notas desaprobadas, separadas por coma"><Input value={fails} onChange={(e) => setFails(e.target.value)} placeholder="2, 3" /></Field>
        <Field label="Docente"><Input value={p.teacher} onChange={(e) => set('teacher', e.target.value)} /></Field>
        <Field label="Correlativas para cursar">
          <EntityPicker items={others} selected={p.requiresCourse} onToggle={toggle('requiresCourse')} emptyText="Ninguna." addLabel="Agregar" />
        </Field>
        <Field label="Correlativas para rendir">
          <EntityPicker items={others} selected={p.requiresExam} onToggle={toggle('requiresExam')} emptyText="Ninguna." addLabel="Agregar" />
        </Field>
        <Field label="Notas"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary">Guardar</Button>
          <Button variant="danger" onClick={async () => {
            if (!(await confirm({ title: `¿Quitar «${s.name}» del plan?`, body: 'Sigue existiendo en Focus con sus tareas, notas y sesiones.', confirmLabel: 'Quitar' }))) return
            removeFromPlan(s.id).then(onClose).catch(fail)
          }}>Quitar del plan</Button>
        </div>
      </form>
    </aside>
  )
}

function ImportPanel({ onDone }: { onDone: (msg: string) => void }) {
  const { fail } = useFeedback()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const run = async () => {
    setError('')
    try {
      const r = await importPlan(parsePlanImport(text))
      onDone(`${r.created} nuevas · ${r.updated} actualizadas${r.unresolved.length ? ` · sin resolver: ${r.unresolved.join(', ')}` : ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      fail(e)
    }
  }
  return (
    <Panel title="Importar plan" actions={<Button size="sm" variant="ghost" onClick={() => setText(EXAMPLE)}>Ejemplo</Button>}>
      <p className="mb-2 text-xs text-muted">
        CSV (coma, punto y coma o tab) o JSON. Columnas: codigo, nombre, anio, cuatrimestre, horas, creditos, correlativas_cursar, correlativas_rendir (códigos separados por |), estado, nota, docente.
        Si una materia ya existe con el mismo código o nombre, se completa sin duplicarla.
      </p>
      <Textarea rows={6} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="Pegá el CSV o JSON…" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input type="file" accept=".csv,.json,.txt,text/csv,application/json" className="text-xs" onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void f.text().then(setText)
        }} />
        <Button variant="primary" disabled={!text.trim()} onClick={() => void run()}>Importar</Button>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </Panel>
  )
}
