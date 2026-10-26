import { SUBJECT_STATUSES, type Subject, type SubjectPlan, type SubjectStatus } from '@/db/models'
import { normKey, parseCsv, parseNum } from './csv'

export type PlanSubject = Subject & { plan: SubjectPlan }

export const emptyPlan = (s?: Pick<Subject, 'archived'>): SubjectPlan => ({
  code: '',
  year: null,
  term: '',
  hours: null,
  credits: null,
  requiresCourse: [],
  requiresExam: [],
  status: s?.archived ? 'pendiente' : 'cursando',
  grade: null,
  failedGrades: [],
  approvedAt: null,
  teacher: '',
})

export const inPlan = (s: Subject): s is PlanSubject => !!s.plan

/** Estados que cumplen una correlativa «para cursar». */
const COURSE_OK: SubjectStatus[] = ['regular', 'aprobada']

export type Eligibility = {
  /** Se puede inscribir a cursar ahora. */
  canCourse: boolean
  /** Regularizada y con las correlativas para rendir aprobadas. */
  canExam: boolean
  /** Correlativas que faltan para cursar. */
  missingCourse: string[]
  /** Correlativas que faltan para rendir. */
  missingExam: string[]
}

/**
 * Para cursar: las correlativas «para cursar» deben estar regulares o aprobadas.
 * Para rendir: la materia debe estar regular y las correlativas «para rendir», aprobadas.
 * Una correlativa que ya no existe en el plan no bloquea.
 */
export function eligibility(s: PlanSubject, byId: Map<string, PlanSubject>): Eligibility {
  const missing = (ids: string[], ok: SubjectStatus[]) =>
    ids.filter((id) => {
      const dep = byId.get(id)
      return dep ? !ok.includes(dep.plan.status) : false
    })
  const missingCourse = missing(s.plan.requiresCourse, COURSE_OK)
  const missingExam = missing(s.plan.requiresExam, ['aprobada'])
  const open = s.plan.status === 'pendiente' || s.plan.status === 'libre'
  return {
    canCourse: open && missingCourse.length === 0,
    canExam: s.plan.status === 'regular' && missingExam.length === 0,
    missingCourse,
    missingExam,
  }
}

export function eligibilityMap(subjects: PlanSubject[]): Map<string, Eligibility> {
  const byId = new Map(subjects.map((s) => [s.id, s]))
  return new Map(subjects.map((s) => [s.id, eligibility(s, byId)]))
}

/** Devuelve un ciclo de correlatividades (ids) si existe, o null. */
export function findCycle(subjects: PlanSubject[]): string[] | null {
  const edges = new Map(subjects.map((s) => [s.id, [...new Set([...s.plan.requiresCourse, ...s.plan.requiresExam])]]))
  const state = new Map<string, 1 | 2>()
  const stack: string[] = []
  const visit = (id: string): string[] | null => {
    state.set(id, 1)
    stack.push(id)
    for (const dep of edges.get(id) ?? []) {
      if (!edges.has(dep)) continue
      if (state.get(dep) === 1) return [...stack.slice(stack.indexOf(dep)), dep]
      if (!state.has(dep)) {
        const c = visit(dep)
        if (c) return c
      }
    }
    stack.pop()
    state.set(id, 2)
    return null
  }
  for (const id of edges.keys()) {
    if (!state.has(id)) {
      const c = visit(id)
      if (c) return c
    }
  }
  return null
}

export type PlanStats = {
  total: number
  approved: number
  /** 0–1. Por horas si todas las materias tienen horas cargadas; si no, por cantidad. */
  progress: number
  byHours: boolean
  average: number | null
  averageWithFails: number | null
  /** Fecha estimada de fin según el ritmo de aprobación, o null si no hay datos suficientes. */
  estimatedEnd: number | null
  perYear: number | null
}

const YEAR_MS = 365.25 * 86_400_000

export function planStats(subjects: PlanSubject[], now = Date.now()): PlanStats {
  const approved = subjects.filter((s) => s.plan.status === 'aprobada')
  const byHours = subjects.length > 0 && subjects.every((s) => (s.plan.hours ?? 0) > 0)
  const progress = !subjects.length
    ? 0
    : byHours
      ? approved.reduce((a, s) => a + (s.plan.hours ?? 0), 0) / subjects.reduce((a, s) => a + (s.plan.hours ?? 0), 0)
      : approved.length / subjects.length
  const grades = approved.map((s) => s.plan.grade).filter((g): g is number => g != null)
  const fails = subjects.flatMap((s) => s.plan.failedGrades)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null)

  const dates = approved.map((s) => s.plan.approvedAt).filter((d): d is number => d != null).sort((a, b) => a - b)
  let perYear: number | null = null
  let estimatedEnd: number | null = null
  if (dates.length >= 2) {
    const span = Math.max(0.5 * YEAR_MS, now - dates[0]!)
    perYear = dates.length / (span / YEAR_MS)
    const left = subjects.length - approved.length
    estimatedEnd = left === 0 ? now : now + (left / perYear) * YEAR_MS
  }
  return {
    total: subjects.length,
    approved: approved.length,
    progress,
    byHours,
    average: mean(grades),
    averageWithFails: mean([...grades, ...fails]),
    estimatedEnd,
    perYear,
  }
}

/** Agrupa por año del plan; las materias sin año van al final. */
export function groupByYear(subjects: PlanSubject[]): { year: number | null; items: PlanSubject[] }[] {
  const map = new Map<number | null, PlanSubject[]>()
  for (const s of subjects) map.set(s.plan.year, [...(map.get(s.plan.year) ?? []), s])
  return [...map.entries()]
    .sort(([a], [b]) => (a ?? 99) - (b ?? 99))
    .map(([year, items]) => ({
      year,
      items: items.sort((a, b) => a.plan.term.localeCompare(b.plan.term, 'es') || (a.plan.code || a.name).localeCompare(b.plan.code || b.name, 'es', { numeric: true })),
    }))
}

// ---------- Importación ----------

export type PlanRow = {
  code: string
  name: string
  year: number | null
  term: string
  hours: number | null
  credits: number | null
  /** Códigos (o nombres) de las correlativas. */
  requiresCourse: string[]
  requiresExam: string[]
  status: SubjectStatus
  grade: number | null
  teacher: string
}

const HEADERS: Record<string, keyof PlanRow> = {
  codigo: 'code', code: 'code', cod: 'code',
  nombre: 'name', materia: 'name', name: 'name', asignatura: 'name',
  ano: 'year', anio: 'year', year: 'year', nivel: 'year',
  cuatrimestre: 'term', periodo: 'term', term: 'term', semestre: 'term',
  horas: 'hours', hours: 'hours', carga: 'hours',
  creditos: 'credits', credits: 'credits',
  correlativas_cursar: 'requiresCourse', cursar: 'requiresCourse', correlativas: 'requiresCourse', requirescourse: 'requiresCourse',
  correlativas_rendir: 'requiresExam', rendir: 'requiresExam', requiresexam: 'requiresExam',
  estado: 'status', status: 'status',
  nota: 'grade', grade: 'grade', calificacion: 'grade',
  docente: 'teacher', profesor: 'teacher', teacher: 'teacher',
}

const splitList = (s: unknown): string[] =>
  Array.isArray(s) ? s.map(String).map((x) => x.trim()).filter(Boolean) : String(s ?? '').split(/[|/]+|\s*,\s*|\s+-\s+/).map((x) => x.trim()).filter(Boolean)

function toStatus(s: unknown): SubjectStatus {
  const k = normKey(String(s ?? ''))
  return (SUBJECT_STATUSES as readonly string[]).includes(k) ? (k as SubjectStatus) : 'pendiente'
}

function toRow(r: Partial<Record<keyof PlanRow, unknown>>): PlanRow {
  const num = (v: unknown) => (typeof v === 'number' ? v : parseNum(v == null ? undefined : String(v)))
  const year = num(r.year)
  const g = num(r.grade)
  return {
    code: String(r.code ?? '').trim().slice(0, 40),
    name: String(r.name ?? '').trim().slice(0, 200),
    year: year != null && Number.isInteger(year) && year >= 1 && year <= 12 ? year : null,
    term: String(r.term ?? '').trim().slice(0, 40),
    hours: num(r.hours),
    credits: num(r.credits),
    requiresCourse: splitList(r.requiresCourse),
    requiresExam: splitList(r.requiresExam),
    status: toStatus(r.status),
    grade: g != null && g >= 0 && g <= 10 ? g : null,
    teacher: String(r.teacher ?? '').trim().slice(0, 200),
  }
}

/** Acepta JSON (array de materias) o CSV con encabezados. Lanza si no reconoce el formato. */
export function parsePlanImport(text: string): PlanRow[] {
  const t = text.trim()
  if (!t) throw new Error('No hay datos para importar.')
  let rows: PlanRow[]
  if (t.startsWith('[') || t.startsWith('{')) {
    let raw: unknown
    try {
      raw = JSON.parse(t)
    } catch {
      throw new Error('El JSON no es válido.')
    }
    const list = Array.isArray(raw) ? raw : (raw as { subjects?: unknown }).subjects
    if (!Array.isArray(list)) throw new Error('El JSON debe ser una lista de materias.')
    rows = list.map((x) => {
      const o = (x ?? {}) as Record<string, unknown>
      const mapped: Partial<Record<keyof PlanRow, unknown>> = {}
      for (const [k, v] of Object.entries(o)) {
        const key = HEADERS[normKey(k).replace(/\s+/g, '_')]
        if (key) mapped[key] = v
      }
      return toRow(mapped)
    })
  } else {
    const [head, ...body] = parseCsv(t)
    if (!head) throw new Error('El CSV está vacío.')
    const cols = head.map((h) => HEADERS[normKey(h).replace(/\s+/g, '_')])
    if (!cols.includes('name')) throw new Error('El CSV necesita una columna «nombre».')
    rows = body.map((cells) => {
      const mapped: Partial<Record<keyof PlanRow, unknown>> = {}
      cols.forEach((c, i) => {
        if (c) mapped[c] = cells[i]
      })
      return toRow(mapped)
    })
  }
  const valid = rows.filter((r) => r.name)
  if (!valid.length) throw new Error('No se encontró ninguna materia con nombre.')
  return valid
}

/** Resuelve una referencia de correlativa (código o nombre) contra las materias conocidas. */
export function resolveRef(ref: string, subjects: Pick<Subject, 'id' | 'name' | 'plan'>[]): string | null {
  const k = normKey(ref)
  const hit = subjects.find((s) => s.plan?.code && normKey(s.plan.code) === k) ?? subjects.find((s) => normKey(s.name) === k)
  return hit?.id ?? null
}
