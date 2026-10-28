import { db } from '@/db/db'
import { SubjectPlanSchema, type Subject, type SubjectPlan, type SubjectStatus } from '@/db/models'
import { normKey } from '@/lib/csv'
import { emptyPlan, findCycle, inPlan, resolveRef, type PlanRow } from '@/lib/plan'
import { uid } from '@/lib/text'
import { guard } from './errors'

export const AVERAGE_FAILS_KEY = 'plan.averageWithFails'

function validate(plan: SubjectPlan, id: string, all: Subject[]): SubjectPlan {
  const parsed = SubjectPlanSchema.safeParse({
    ...plan,
    requiresCourse: [...new Set(plan.requiresCourse)].filter((x) => x !== id),
    requiresExam: [...new Set(plan.requiresExam)].filter((x) => x !== id),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(issue ? `${issue.path.join('.')}: ${issue.message}` : 'Datos del plan inválidos')
  }
  const next = parsed.data
  const planned = all.map((s) => (s.id === id ? { ...s, plan: next } : s)).filter(inPlan)
  const cycle = findCycle(planned)
  if (cycle) {
    const names = new Map(all.map((s) => [s.id, s.name]))
    throw new Error(`Las correlativas forman un ciclo: ${cycle.map((x) => names.get(x) ?? x).join(' → ')}`)
  }
  return next
}

/** Guarda los datos del plan de una materia existente (y opcionalmente su nombre y notas). */
export function savePlan(id: string, plan: SubjectPlan, base?: Partial<Pick<Subject, 'name' | 'notes'>>): Promise<void> {
  return guard('No se pudo guardar la materia del plan', () =>
    db.transaction('rw', db.subjects, async () => {
      const all = await db.subjects.toArray()
      const prev = all.find((s) => s.id === id)
      if (!prev) throw new Error('La materia ya no existe.')
      const name = (base?.name ?? prev.name).trim()
      if (!name) throw new Error('La materia necesita un nombre')
      const fixed = plan.status === 'aprobada' ? plan : { ...plan, approvedAt: null }
      const withDate = fixed.status === 'aprobada' && fixed.approvedAt == null ? { ...fixed, approvedAt: Date.now() } : fixed
      const next = validate(withDate, id, all)
      await db.subjects.update(id, { plan: next, name, notes: base?.notes ?? prev.notes, updatedAt: Date.now() })
    }),
  )
}

/** Crea una materia nueva ya incluida en el plan. */
export function createPlanSubject(name: string, plan: Partial<SubjectPlan> = {}): Promise<string> {
  return guard('No se pudo crear la materia', async () => {
    if (!name.trim()) throw new Error('La materia necesita un nombre')
    const now = Date.now()
    const id = uid()
    const full = { ...emptyPlan(), status: 'pendiente' as const, ...plan }
    const all = await db.subjects.toArray()
    const s: Subject = { id, name: name.trim(), period: '', objectives: '', notes: '', archived: false, plan: validate(full, id, all), createdAt: now, updatedAt: now }
    await db.subjects.add(s)
    return id
  })
}

export function setPlanStatus(id: string, status: SubjectStatus, gradeValue?: number | null): Promise<void> {
  return guard('No se pudo cambiar el estado', async () => {
    const s = await db.subjects.get(id)
    if (!s) throw new Error('La materia ya no existe.')
    const plan = { ...(s.plan ?? emptyPlan(s)), status }
    if (gradeValue !== undefined) plan.grade = gradeValue
    await savePlan(id, plan)
  })
}

/** Quita la materia del plan sin borrarla de Focus, y la saca de las correlativas de las demás. */
export function removeFromPlan(id: string): Promise<void> {
  return guard('No se pudo quitar del plan', () =>
    db.transaction('rw', db.subjects, async () => {
      await db.subjects.toCollection().modify((s) => {
        if (s.id === id) {
          delete s.plan
          s.updatedAt = Date.now()
        } else if (s.plan && (s.plan.requiresCourse.includes(id) || s.plan.requiresExam.includes(id))) {
          s.plan = { ...s.plan, requiresCourse: s.plan.requiresCourse.filter((x) => x !== id), requiresExam: s.plan.requiresExam.filter((x) => x !== id) }
          s.updatedAt = Date.now()
        }
      })
    }),
  )
}

export type ImportReport = { created: number; updated: number; unresolved: string[] }

/**
 * Importa filas del plan. Una materia que ya existe (mismo código o mismo nombre) se completa
 * en vez de duplicarse; conserva sus datos de Focus. Todo ocurre en una transacción.
 */
export function importPlan(rows: PlanRow[]): Promise<ImportReport> {
  return guard('No se pudo importar el plan', () =>
    db.transaction('rw', db.subjects, async () => {
      const all = await db.subjects.toArray()
      const now = Date.now()
      let created = 0
      let updated = 0
      const touched: Subject[] = []
      for (const r of rows) {
        const existing =
          (r.code && all.find((s) => s.plan?.code && normKey(s.plan.code) === normKey(r.code))) ||
          all.find((s) => normKey(s.name) === normKey(r.name))
        const base = existing ?? { id: uid(), name: r.name, period: '', objectives: '', notes: '', archived: false, createdAt: now, updatedAt: now }
        const prev = existing?.plan ?? emptyPlan()
        const plan: SubjectPlan = {
          ...prev,
          code: r.code || prev.code,
          year: r.year ?? prev.year,
          term: r.term || prev.term,
          hours: r.hours ?? prev.hours,
          credits: r.credits ?? prev.credits,
          status: existing?.plan ? (r.status !== 'pendiente' ? r.status : prev.status) : r.status,
          grade: r.grade ?? prev.grade,
          teacher: r.teacher || prev.teacher,
          approvedAt: r.status === 'aprobada' ? (prev.approvedAt ?? now) : prev.approvedAt,
        }
        const next: Subject = { ...base, plan, updatedAt: now }
        if (existing) {
          updated++
          touched.push(Object.assign(existing, next))
        } else {
          created++
          all.push(next)
          touched.push(next)
        }
      }
      const unresolved = new Set<string>()
      rows.forEach((r, i) => {
        const s = touched[i]!
        const resolve = (refs: string[]) =>
          refs.flatMap((ref) => {
            const id = resolveRef(ref, all)
            if (!id) unresolved.add(ref)
            return id && id !== s.id ? [id] : []
          })
        if (r.requiresCourse.length) s.plan!.requiresCourse = [...new Set(resolve(r.requiresCourse))]
        if (r.requiresExam.length) s.plan!.requiresExam = [...new Set(resolve(r.requiresExam))]
      })
      for (const s of touched) s.plan = SubjectPlanSchema.parse(s.plan)
      const cycle = findCycle(all.filter(inPlan))
      if (cycle) {
        const names = new Map(all.map((s) => [s.id, s.name]))
        throw new Error(`Las correlativas importadas forman un ciclo: ${cycle.map((x) => names.get(x) ?? x).join(' → ')}`)
      }
      await db.subjects.bulkPut(touched)
      return { created, updated, unresolved: [...unresolved] }
    }),
  )
}

export async function readAverageWithFails(): Promise<boolean> {
  return (await db.kv.get(AVERAGE_FAILS_KEY))?.value === true
}

export const writeAverageWithFails = (v: boolean) =>
  guard('No se pudo guardar la preferencia', () => db.kv.put({ key: AVERAGE_FAILS_KEY, value: v }))
