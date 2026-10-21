/**
 * Lectura de enunciados: determinista, local y sin efectos. No construye IR ni código; solo describe
 * qué se pide, qué números son datos y cuáles son contexto, y por qué. `problems/index.ts` la usa
 * únicamente en los casos de `planFromReading` y deja el resto al clasificador original.
 */
import { formatNumber } from './interpreter'
import { geometryKind } from './problems/geometry'
import { iterationKind } from './problems/iteration'
import { linearKind } from './problems/linear'
import { vectorsKind } from './problems/vectors'
import type { Clarification, KindId } from './types'

export type StatsOp = 'suma' | 'promedio' | 'maximo' | 'minimo' | 'rango'
export type OpId = StatsOp | 'buscar'

export interface Operation {
  id: OpId
  kind: 'stats' | 'search'
  /** Fragmento del enunciado (ya normalizado) que la evidencia. */
  evidence: string
}

export interface NumberRead {
  value: number
  /** Posición en el texto normalizado. */
  at: number
  role: 'dato' | 'objetivo' | 'contexto' | 'excluido' | 'otro'
  why: string
}

export interface Reading {
  /** Minúsculas, sin tildes y con el voseo llevado a infinitivo. */
  normalized: string
  operations: Operation[]
  /** Intenciones de otros tipos de problema que impiden decidir solo con esta lectura. */
  competing: { kind: KindId; evidence: string }[]
  unsupported: { reason: string; evidence: string } | null
  numbers: NumberRead[]
  data: number[]
  target: number | null
  constraints: string[]
  output: string | null
  candidate: 'stats' | 'search' | null
  evidence: string[]
  ambiguities: string[]
  clarifications: Clarification[]
  /** El enunciado niega la operación («no calcules…»): no se resuelve en silencio. */
  negated: boolean
  /** Enunciado equivalente en la forma que entienden los constructores existentes. */
  canonical: string | null
}

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/** Imperativos con pronombre enclítico frecuentes en enunciados ("decime", "fijate"). */
const CLITIC: Record<string, string> = { decime: 'decir', decinos: 'decir', fijate: 'fijarse', mostrame: 'mostrar', calculame: 'calcular', buscame: 'buscar', encontrame: 'encontrar', sumame: 'sumar', contame: 'contar' }
/** Palabras agudas terminadas en vocal que no son imperativos de voseo. */
const NOT_VOSEO = new Set(['esta', 'aca', 'alla', 'ahi', 'aqui', 'quiza', 'sera', 'dara', 'habra', 'tendra', 'podra', 'sofa', 'papa', 'mama', 'ademas', 'tambien', 'que', 'asi', 'alli', 'despues', 'cafe', 'bebe'])

/**
 * Normaliza y lleva el voseo imperativo al infinitivo: "calculá" → "calcular", "encontrá" → "encontrar".
 * Se aplica a palabras con la última vocal acentuada en el original, para no tocar "busca" o "suma".
 */
export function normalizeStatement(text: string): string {
  const words = text.toLowerCase().replace(/[¿¡]/g, ' ')
  const lemmatized = words.replace(/[a-záéíóúñü]+/g, (w) => {
    const plain = strip(w)
    if (CLITIC[plain]) return CLITIC[plain]
    const m = w.match(/^([a-zñ]{2,})([áéí])$/)
    if (m && !NOT_VOSEO.has(plain)) return `${strip(m[1]!)}${strip(m[2]!)}r`
    return plain
  })
  return lemmatized.replace(/\s+/g, ' ').trim()
}

const STATS_OPS: { id: StatsOp; re: RegExp }[] = [
  { id: 'promedio', re: /\bpromedi(?:o|ar)\b|\bmedia aritmetica\b|\bvalor medio\b|\bmedia\b/ },
  { id: 'maximo', re: /\bmaximo\b|\bmayor\b|\bmas grande\b/ },
  { id: 'minimo', re: /\bminimo\b|\bmenor\b|\bmas (?:chico|pequeno)\b/ },
  { id: 'rango', re: /\brango\b|\bamplitud\b/ },
  { id: 'suma', re: /\bsuma\b|\bsumar\b|\btotal\b/ },
]
const NUM = '(-?\\d+(?:\\.\\d+)?)'
const SEARCH = new RegExp(
  `\\b(?:buscar|busca|encontrar|encuentra|ubicar|localizar)\\s+(?:el |la )?(?:numero |valor |elemento )?${NUM}|\\b(?:en que (?:posicion|indice|lugar)|donde) esta (?:el |la )?(?:numero |valor )?${NUM}|\\b(?:posicion|indice) del? ${NUM}`,
)

const UNSUPPORTED: { re: RegExp; reason: string }[] = [
  { re: /\bsub(?:secuencia|arreglo|cadena|lista|conjunto)s?\b/, reason: 'Los problemas de subsecuencias o subarreglos todavía no están soportados.' },
  { re: /\b(?:cadenas?|strings?|palabras?|letras?|caracter(?:es)?|palindromos?|anagramas?|vocales?)\b/, reason: 'Los problemas sobre cadenas de texto todavía no están soportados.' },
  { re: /\bordenar(?:los|las)?\b|\bde (?:menor a mayor|mayor a menor)\b/, reason: 'Ordenar una lista todavía no está soportado.' },
  { re: /\b(?:mediana|moda|varianza|desvio|desviacion|percentil)\b/, reason: 'Esta versión calcula suma, promedio, máximo, mínimo y rango; esa medida estadística todavía no está soportada.' },
]
const EXCLUSION = /\b(?:sin contar|excepto|salvo|excluyendo|ignorando|sin incluir)\b/
/** Negación del verbo de la operación, no un «no» suelto en una restricción. */
const NEGATION = /\bno\s+(?:calcules|calcular|computes|hagas|hacer|busques|buscar|sumes|sumar|promedies|promediar)\b/

/** Señales fuertes de otros tipos: si aparecen, esta lectura no decide sola. */
function competingIntents(text: string, n: string): Reading['competing'] {
  const out: Reading['competing'] = []
  if (iterationKind.detect(text) > 0) out.push({ kind: 'iteration', evidence: 'secuencia, factorial, primos, MCD o rango 1..n' })
  if (geometryKind.detect(text) > 0) out.push({ kind: 'geometry', evidence: 'figura geométrica' })
  if (vectorsKind.detect(text) > 0) out.push({ kind: 'vectors', evidence: 'vectores' })
  if (linearKind.detect(text) > 0 || /[=^*/+]|\d\s*-\s*\d|\b[a-z]\s*\(/.test(n.replace(/\.\d/g, ''))) out.push({ kind: 'expression', evidence: 'operadores o ecuación' })
  if (/\baprob|\bapruebas?\b|\bclasific|\bumbral\b|\bimpar|\bparidad\b|\bpares?\b|\bpositiv|\bnegativ|\bsigno\b|equilatero|isosceles|escaleno/.test(n)) out.push({ kind: 'classify', evidence: 'criterio de clasificación' })
  return out
}

const STOP = new Set(['y', 'e', 'o', 'u', 'en', 'de', 'del', 'a', 'al', 'la', 'el', 'los', 'las', 'es', 'son', 'con', 'por', 'para', 'que', 'entre', 'como', 'mas', 'menos', 'hasta', 'sobre', 'veces'])

interface Tok { value: number; at: number; end: number }

/** Corridas de números separados solo por coma, punto y coma o "y": la forma típica de una lista de datos. */
function runsOf(n: string, toks: Tok[]): Tok[][] {
  const runs: Tok[][] = []
  for (const t of toks) {
    const last = runs.at(-1)
    const prev = last?.at(-1)
    if (last && prev && /^\s*(?:,|;|y|e)\s*$/.test(n.slice(prev.end, t.at))) last.push(t)
    else runs.push([t])
  }
  return runs
}

const fmtList = (xs: number[]) => xs.map((x) => formatNumber(x)).join(', ')
const OP_TEXT: Record<StatsOp, string> = { suma: 'Suma', promedio: 'Promedio', maximo: 'Máximo', minimo: 'Mínimo', rango: 'Rango' }

export function analyzeStatement(text: string): Reading {
  const n = normalizeStatement(text)
  const reading: Reading = { normalized: n, operations: [], competing: competingIntents(text, n), unsupported: null, numbers: [], data: [], target: null, constraints: [], output: null, candidate: null, evidence: [], ambiguities: [], clarifications: [], negated: NEGATION.test(n), canonical: null }
  if (reading.negated) reading.ambiguities.push('El enunciado niega una operación; no se interpreta en silencio.')

  for (const u of UNSUPPORTED) {
    const m = n.match(u.re)
    if (m) {
      reading.unsupported = { reason: u.reason, evidence: m[0] }
      reading.evidence.push(`«${m[0]}» indica un tipo de problema sin soporte`)
      return reading
    }
  }

  const toks: Tok[] = [...n.matchAll(new RegExp(NUM, 'g'))].map((m) => ({ value: Number(m[1]), at: m.index, end: m.index + m[0].length }))
  const search = n.match(SEARCH)
  for (const o of STATS_OPS) {
    const m = n.match(o.re)
    if (m) reading.operations.push({ id: o.id, kind: 'stats', evidence: m[0] })
  }
  if (search) reading.operations.push({ id: 'buscar', kind: 'search', evidence: search[0] })
  if (!reading.operations.length) return reading
  const kinds = new Set(reading.operations.map((o) => o.kind))
  if (kinds.size > 1 || reading.operations.length > 1) {
    reading.evidence.push(`Varias operaciones posibles: ${reading.operations.map((o) => `«${o.evidence}»`).join(', ')}`)
    return reading
  }
  const op = reading.operations[0]!
  reading.candidate = op.kind
  reading.evidence.push(`La operación principal es «${op.evidence}»`)

  let targetTok: Tok | undefined
  if (op.kind === 'search') {
    const value = Number(search!.slice(1).find((g) => g !== undefined))
    const at = (search!.index ?? 0) + search![0].lastIndexOf(search!.slice(1).find((g) => g !== undefined)!)
    targetTok = toks.find((t) => t.at === at && t.value === value)
    if (targetTok) {
      reading.target = value
      reading.evidence.push(`El valor buscado es ${formatNumber(value)}`)
    }
  }

  const excl = n.match(EXCLUSION)
  const exclAt = excl ? (excl.index ?? 0) : Infinity
  const pool = toks.filter((t) => t !== targetTok && t.at < exclAt)
  const runs = runsOf(n, pool)
  const best = runs.reduce<Tok[] | null>((a, r) => (!a || r.length >= a.length ? r : a), null) ?? []
  const listRun = best.length >= 2 ? best : runs.length === 1 ? best : []

  for (const t of toks) {
    const word = n.slice(t.end).match(/^\s+([a-zñ]{3,})/)?.[1]
    let role: NumberRead['role'] = 'otro'
    let why = 'no forma parte de la lista de datos'
    if (t === targetTok) [role, why] = ['objetivo', 'sigue al verbo de búsqueda']
    else if (t.at > exclAt) [role, why] = ['excluido', `aparece después de «${excl![0]}»`]
    else if (listRun.includes(t)) [role, why] = ['dato', 'forma parte de la lista']
    else if (word && !STOP.has(word)) [role, why] = ['contexto', `indica una cantidad («${formatNumber(t.value)} ${word}»)`]
    reading.numbers.push({ value: t.value, at: t.at, role, why })
  }
  reading.data = listRun.map((t) => t.value)
  const context = reading.numbers.filter((x) => x.role === 'contexto')
  for (const c of context) {
    const matches = Number.isInteger(c.value) && c.value === reading.data.length
    reading.evidence.push(`El ${formatNumber(c.value)} ${c.why}${matches ? ', y coincide con la cantidad de datos' : ''}: no es un dato`)
    if (!matches && reading.data.length > 1)
      reading.ambiguities.push(`El enunciado menciona ${formatNumber(c.value)}, pero la lista tiene ${reading.data.length} valores.`)
  }
  if (reading.numbers.some((x) => x.role === 'otro') && reading.data.length) reading.ambiguities.push('Hay números fuera de la lista cuyo papel no está claro.')

  if (op.kind === 'stats') {
    const id = op.id as StatsOp
    reading.output = `${OP_TEXT[id].toLowerCase()} de la lista`
    if (excl) {
      const removed = reading.numbers.filter((x) => x.role === 'excluido').map((x) => x.value)
      reading.constraints.push(`Excluir ${removed.length ? fmtList(removed) : 'algunos valores'} («${excl[0]}»)`)
      reading.ambiguities.push(`«${excl[0]}» cambia los datos: hay que decidir qué valores quedan.`)
      const kept = reading.data.filter((x) => !removed.includes(x))
      if (reading.data.length) {
        if (kept.length && removed.length) reading.clarifications.push({ label: `Sin ${fmtList(removed)}`, text: `${OP_TEXT[id]} de ${fmtList(kept)}` })
        reading.clarifications.push({ label: 'Con todos los valores', text: `${OP_TEXT[id]} de ${fmtList(reading.data)}` })
      }
    } else if (reading.ambiguities.length && reading.data.length) {
      reading.clarifications.push({ label: `Usar los ${reading.data.length} valores de la lista`, text: `${OP_TEXT[id]} de ${fmtList(reading.data)}` })
    }
    if (reading.data.length) reading.canonical = `${OP_TEXT[id]} de ${fmtList(reading.data)}`
  } else {
    reading.output = 'posición del valor buscado'
    if (reading.target !== null && reading.data.length) reading.canonical = `Buscar ${formatNumber(reading.target)} en la lista ${fmtList(reading.data)}${/binari|ordenad/.test(n) ? ' con búsqueda binaria' : ''}`
  }
  return reading
}

export type Plan =
  | { type: 'legacy' }
  | { type: 'unsupported'; reason: string; evidence: string }
  | { type: 'clarify'; kind: 'stats' | 'search'; reading: Reading }
  | { type: 'rewrite'; kind: 'stats' | 'search'; text: string; notes: string[] }

/**
 * Decide si la lectura puede actuar. Solo interviene en los casos verificados (estadística y búsqueda,
 * cadenas/subsecuencias/ordenamiento como no soportados) y cuando hay algo que el clasificador
 * original resolvería mal. En cualquier otro caso devuelve `legacy`.
 */
export function planFromReading(r: Reading, chosen: KindId | 'auto', legacy: KindId | null): Plan {
  if (/\d,\d/.test(r.normalized)) return { type: 'legacy' }
  if (r.unsupported) return chosen === 'auto' ? { type: 'unsupported', ...r.unsupported } : { type: 'legacy' }
  const k = r.candidate
  if (!k || r.competing.length || (chosen !== 'auto' && chosen !== k)) return { type: 'legacy' }
  if (r.negated) return { type: 'clarify', kind: k, reading: r }
  if (r.ambiguities.length) return r.clarifications.length ? { type: 'clarify', kind: k, reading: r } : { type: 'legacy' }
  if (!r.canonical) return { type: 'legacy' }
  const hasContext = r.numbers.some((x) => x.role === 'contexto')
  if (legacy === k && !hasContext) return { type: 'legacy' }
  return { type: 'rewrite', kind: k, text: r.canonical, notes: r.evidence }
}
