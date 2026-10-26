import { db } from '@/db/db'
import { CalendarEventSchema, type CalendarEvent, type EventKind, type EventRepeat, type EventStatus } from '@/db/models'
import { uid } from '@/lib/text'
import { guard } from './errors'

export const LOAD_HOURS_KEY = 'calendar.loadHours'
export const SUBJECT_COLORS_KEY = 'calendar.subjectColors'
export const DEFAULT_LOAD_HOURS = 20
export const EXAM_KINDS: readonly EventKind[] = ['parcial', 'final', 'entrega']

export type EventInput = {
  title: string
  kind: EventKind
  subjectId?: string | null
  startAt: number
  endAt: number
  allDay: boolean
  repeat: EventRepeat
  repeatUntil?: number | null
  skipOn?: string[]
  location?: string
  notes?: string
  status?: EventStatus
  doneOn?: string[]
  originId?: string | null
  seriesId?: string | null
}

function normalize(input: EventInput, id: string, createdAt: number, updatedAt: number): CalendarEvent {
  const event: CalendarEvent = {
    id,
    title: input.title.trim(),
    kind: input.kind,
    subjectId: input.subjectId ?? null,
    startAt: input.startAt,
    endAt: input.endAt,
    allDay: input.allDay,
    repeat: input.repeat,
    repeatUntil: input.repeatUntil ?? null,
    skipOn: [...new Set(input.skipOn ?? [])].sort(),
    location: input.location?.trim() ?? '',
    notes: input.notes ?? '',
    status: input.status ?? 'pendiente',
    doneOn: [...new Set(input.doneOn ?? [])].sort(),
    originId: input.originId ?? null,
    seriesId: input.seriesId ?? null,
    createdAt,
    updatedAt,
  }
  const parsed = CalendarEventSchema.safeParse(event)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(issue ? `${issue.path.join('.')}: ${issue.message}` : 'Evento inválido')
  }
  if (parsed.data.endAt <= parsed.data.startAt) throw new Error('El fin tiene que ser posterior al inicio.')
  if (parsed.data.repeat === 'weekly' && parsed.data.repeatUntil != null && parsed.data.repeatUntil < parsed.data.startAt) {
    throw new Error('La repetición no puede terminar antes del primer día.')
  }
  return parsed.data
}

export function listEvents(): Promise<CalendarEvent[]> {
  return guard('No se pudieron leer los eventos', () => db.events.toArray())
}

export function listStudyBlocks(originId: string): Promise<CalendarEvent[]> {
  return guard('No se pudieron leer los bloques de estudio', () => db.events.where('originId').equals(originId).toArray())
}

export function saveEvent(input: EventInput, id?: string): Promise<CalendarEvent> {
  return guard('No se pudo guardar el evento', async () => {
    if (!input.title.trim()) throw new Error('El evento necesita un título')
    const now = Date.now()
    if (id) {
      const prev = await db.events.get(id)
      if (!prev) throw new Error('El evento ya no existe.')
      const next = normalize(input, id, prev.createdAt, now)
      await db.events.put(next)
      return next
    }
    const next = normalize(input, uid(), now, now)
    await db.events.add(next)
    return next
  })
}

export function deleteEvent(id: string, opts: { cascadeStudy?: boolean } = {}): Promise<void> {
  return guard('No se pudo eliminar el evento', () =>
    db.transaction('rw', db.events, async () => {
      if (opts.cascadeStudy) await db.events.where('originId').equals(id).delete()
      await db.events.delete(id)
    }),
  )
}

export function replaceStudyPlan(
  originId: string,
  slots: { startAt: number; endAt: number }[],
  meta: { title: string; subjectId: string | null },
): Promise<void> {
  return guard('No se pudo guardar el plan de estudio', () =>
    db.transaction('rw', db.events, async () => {
      await db.events.where('originId').equals(originId).delete()
      const now = Date.now()
      const title = `Estudio: ${meta.title}`.slice(0, 500)
      for (const slot of slots) {
        const next = normalize(
          {
            title,
            kind: 'estudio',
            subjectId: meta.subjectId,
            startAt: slot.startAt,
            endAt: slot.endAt,
            allDay: false,
            repeat: 'none',
            originId,
          },
          uid(),
          now,
          now,
        )
        await db.events.add(next)
      }
    }),
  )
}

export function saveNamedStudyPlan(
  originId: string,
  slots: { startAt: number; endAt: number; title: string; notes: string; status?: 'pendiente' | 'hecho' }[],
  subjectId: string | null,
): Promise<void> {
  return guard('No se pudo guardar el plan de estudio', () =>
    db.transaction('rw', db.events, async () => {
      await db.events.where('originId').equals(originId).delete()
      const now = Date.now()
      for (const slot of slots) {
        await db.events.add(normalize({
          title: slot.title.slice(0, 500),
          kind: 'estudio',
          subjectId,
          startAt: slot.startAt,
          endAt: slot.endAt,
          allDay: false,
          repeat: 'none',
          originId,
          notes: slot.notes,
          status: slot.status ?? 'pendiente',
        }, uid(), now, now))
      }
    }),
  )
}

export async function readLoadHours(): Promise<number> {
  const row = await db.kv.get(LOAD_HOURS_KEY)
  const n = typeof row?.value === 'number' ? row.value : DEFAULT_LOAD_HOURS
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LOAD_HOURS
}

export function writeLoadHours(hours: number): Promise<void> {
  return guard('No se pudo guardar el umbral de carga', async () => {
    if (!Number.isFinite(hours) || hours <= 0) throw new Error('El umbral tiene que ser un número positivo.')
    await db.kv.put({ key: LOAD_HOURS_KEY, value: hours })
  })
}

export async function readSubjectColors(): Promise<Record<string, string>> {
  const row = await db.kv.get(SUBJECT_COLORS_KEY)
  if (!row?.value || typeof row.value !== 'object' || Array.isArray(row.value)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(row.value as Record<string, unknown>)) {
    if (typeof v === 'string' && v) out[k] = v
  }
  return out
}

export function writeSubjectColor(subjectId: string, color: string): Promise<void> {
  return guard('No se pudo guardar el color de la materia', async () => {
    const current = await readSubjectColors()
    current[subjectId] = color
    await db.kv.put({ key: SUBJECT_COLORS_KEY, value: current })
  })
}
