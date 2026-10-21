export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Minúsculas y sin diacríticos, para búsquedas tolerantes. */
export const fold = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function matchesQuery(query: string, ...fields: (string | string[] | undefined | null)[]): boolean {
  const terms = fold(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const hay = fold(fields.flat().filter(Boolean).join(' \n '))
  return terms.every((t) => hay.includes(t))
}

export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  for (const raw of input.split(',')) {
    const t = raw.trim().replace(/^#/, '').slice(0, 80)
    if (t) seen.add(t.toLowerCase())
  }
  return [...seen]
}

export function snippet(md: string, max = 140): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' [fórmula] ')
    .replace(/[#>*_`~\-[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? `${plain.slice(0, max)}…` : plain
}

const dateFmt = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
const dayFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const formatDateTime = (ts: number) => dateFmt.format(ts)
export const formatLongDate = (ts: number) => dayFmt.format(ts)

export function relativeTime(ts: number, now = Date.now()): string {
  const diff = Math.round((ts - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(diff, 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  return formatDateTime(ts)
}

export const startOfDay = (ts: number): number => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
