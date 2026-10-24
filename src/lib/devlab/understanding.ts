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

export type StatsOp = 'suma' | 'promedio' | 'maximo' | 'minimo' | 'rango' | 'mediana' | 'moda' | 'varianza' | 'desvio' | 'percentil' | 'conteo' | 'producto'
export type OpId = StatsOp | 'buscar' | 'maxsub'

export type LengthBound =
  | { mode: 'any' }
  | { mode: 'exact'; k: number | null }
  | { mode: 'range'; l: number | null; r: number | null }

export type SearchMode = 'first' | 'last' | 'all' | 'exists'
export type ForbidId = 'sort' | 'builtin-stats' | 'mutate'

export interface Operation {
  id: OpId
  kind: 'stats' | 'search' | 'subarray'
  /** Fragmento del enunciado (ya normalizado) que la evidencia. */
  evidence: string
}

export interface NumberRead {
  value: number
  /** Posición en el texto normalizado. */
  at: number
  role: 'dato' | 'objetivo' | 'contexto' | 'excluido' | 'parametro' | 'otro'
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
  candidate: 'stats' | 'search' | 'subarray' | null
  evidence: string[]
  ambiguities: string[]
  clarifications: Clarification[]
  /** El enunciado niega la operación («no calcules…»): no se resuelve en silencio. */
  negated: boolean
  /** Enunciado equivalente en la forma que entienden los constructores existentes. */
  canonical: string | null
  length: LengthBound
  searchMode: SearchMode | null
  forbid: ForbidId[]
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
  { id: 'mediana', re: /\bmediana\b/ },
  { id: 'moda', re: /\bmoda\b/ },
  { id: 'varianza', re: /\bvarianza\b/ },
  { id: 'desvio', re: /\bdesvio(?: estandar)?\b|\bdesviacion(?: estandar)?\b/ },
  { id: 'percentil', re: /\bpercentil\b/ },
  { id: 'conteo', re: /\bconteo\b|\bcantidad de (?:elementos|valores|numeros)\b/ },
  { id: 'producto', re: /\bproducto\b|\bmultiplicar(?:los)?\b/ },
  { id: 'promedio', re: /\bpromedi(?:o|ar)\b|\bmedia aritmetica\b|\bvalor medio\b|\bmedia\b/ },
  { id: 'maximo', re: /\bmaximo\b|\bmayor\b|\bmas grande\b/ },
  { id: 'minimo', re: /\bminimo\b|\bmenor\b|\bmas (?:chico|pequeno)\b/ },
  { id: 'rango', re: /\brango\b|\bamplitud\b/ },
  { id: 'suma', re: /\bsuma\b(?! maxima)|\bsumar\b|(?<!en )\btotal\b/ },
]
const NUM = '(-?\\d+(?:\\.\\d+)?)'
const SEARCH = new RegExp(
  `\\b(?:buscar|busca|encontrar|encuentra|ubicar|localizar)\\s+(?:el |la )?(?:numero |valor |elemento )?${NUM}|\\b(?:en que (?:posicion|indice|lugar)|donde) esta (?:el |la )?(?:numero |valor )?${NUM}|\\b(?:posicion|indice) del? ${NUM}|\\bultima (?:aparicion|ocurrencia) del? ${NUM}|\\bultimo (?:indice|elemento) (?:de |del )?${NUM}`,
)
const SUBARRAY_INTENT = /\bsubarreglo\b|\bkadane\b|\bsuma maxima\b|\bmaxima suma\b|\bmaximo subarreglo\b/
const SORT_DIR = /\bde (?:mayor a menor|menor a mayor)\b|\bdescendente|\bascendente/
const UNIT_NOT_COUNT = new Set(['minutos', 'horas', 'segundos', 'dias', 'semanas', 'meses', 'anos', 'metros', 'km', 'kg', 'gramos'])

export function lengthBoundOf(n: string): LengthBound {
  const named = new Map(
    [...n.matchAll(/\b([a-z])\s*=\s*(-?\d+(?:\.\d+)?)(?!\s*,\s*-?\d)/g)].map((m) => [m[1]!, Number(m[2])]),
  )
  const rangeN = n.match(/longitud\b[^.]{0,48}entre (-?\d+) y (-?\d+)/)
  if (rangeN) return { mode: 'range', l: Number(rangeN[1]), r: Number(rangeN[2]) }
  const rangeP = n.match(/longitud\b[^.]{0,48}entre ([a-z]) y ([a-z])/)
  if (rangeP) {
    const l = named.get(rangeP[1]!)
    const r = named.get(rangeP[2]!)
    return { mode: 'range', l: l ?? null, r: r ?? null }
  }
  const exactN = n.match(/longitud(?: exacta(?:mente)?)?(?: de| igual a)? (-?\d+)/)
  if (exactN) return { mode: 'exact', k: Number(exactN[1]) }
  const exactP = n.match(/longitud(?: exacta(?:mente)?)?(?: de| igual a)? ([kr])\b/)
  if (exactP) {
    const k = named.get(exactP[1]!)
    return { mode: 'exact', k: k ?? null }
  }
  return { mode: 'any' }
}

function searchModeOf(n: string, hasSearch: boolean): SearchMode | null {
  if (/todas las (?:apariciones|ocurrencias|posiciones)/.test(n)) return 'all'
  if (/\b(?:existe|existencia)\b/.test(n) && !/\b(?:posicion|indice|donde)\b/.test(n)) return 'exists'
  if (!hasSearch) return null
  return /ultima|ultimo/.test(n) ? 'last' : 'first'
}

function forbidOf(n: string): { ids: ForbidId[]; constraints: string[] } {
  const ids: ForbidId[] = []
  const constraints: string[] = []
  if (/\bsin ordenar\b|\bno (?:se )?(?:debe|puede|hace falta) ordenar/.test(n)) {
    ids.push('sort')
    constraints.push('No ordenar la entrada.')
  }
  if (/\bsin (?:usar )?(?:funciones|agregados) estad/.test(n)) {
    ids.push('builtin-stats')
    constraints.push('No usar funciones estadísticas predefinidas.')
  }
  if (/\bsin modificar|no se (?:debe |puede )?modificar|conservar la entrada/.test(n)) {
    ids.push('mutate')
    constraints.push('La entrada no se modifica.')
  }
  if (/\bo\s*\(\s*n\s*\)|tiempo lineal|una sola pasada/.test(n)) constraints.push('Complejidad temporal lineal.')
  return { ids, constraints }
}

function unsupportedOf(n: string): { reason: string; evidence: string } | null {
  if (/\bsub(?:secuencia|conjunto)s?\b/.test(n) && !/\bsubarreglo\b/.test(n)) {
    const m = n.match(/\bsub(?:secuencia|conjunto)s?\b/)!
    return { reason: 'Los problemas de subsecuencias o subconjuntos todavía no están soportados.', evidence: m[0] }
  }
  if (/\bsubcadena/.test(n)) {
    return { reason: 'Los problemas de subcadenas todavía no están soportados.', evidence: 'subcadena' }
  }
  if (/todas las (?:apariciones|ocurrencias|posiciones)/.test(n)) {
    return { reason: 'Esta versión solo busca la primera o la última aparición, no la lista de todos los índices.', evidence: 'todas las ocurrencias' }
  }
  if (/\b(?:existe|existencia)\b/.test(n) && !/\b(?:posicion|indice|donde|buscar|encontrar)\b/.test(n)) {
    return { reason: 'Esta versión devuelve un índice, no un booleano de existencia.', evidence: 'existencia' }
  }
  return null
}
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
const OP_TEXT: Record<StatsOp, string> = {
  suma: 'Suma',
  promedio: 'Promedio',
  maximo: 'Máximo',
  minimo: 'Mínimo',
  rango: 'Rango',
  mediana: 'Mediana',
  moda: 'Moda',
  varianza: 'Varianza',
  desvio: 'Desvío',
  percentil: 'Percentil',
  conteo: 'Conteo',
  producto: 'Producto',
}

function statsCanonical(ops: Operation[], data: number[]): string {
  const labels = [...new Set(ops.filter((o) => o.kind === 'stats').map((o) => OP_TEXT[o.id as StatsOp]))]
  if (!labels.length || !data.length) return ''
  if (labels.length === 1) return `${labels[0]} de ${fmtList(data)}`
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]} de ${fmtList(data)}`
}

function fillNumbers(reading: Reading, n: string, toks: Tok[], targetTok?: Tok) {
  const excl = n.match(EXCLUSION)
  const exclAt = excl ? (excl.index ?? 0) : Infinity
  const bound = reading.length
  const paramVals = new Set<number>()
  if (bound.mode === 'exact' && bound.k !== null) paramVals.add(bound.k)
  if (bound.mode === 'range') {
    if (bound.l !== null) paramVals.add(bound.l)
    if (bound.r !== null) paramVals.add(bound.r)
  }
  const runs = runsOf(
    n,
    toks.filter((t) => t !== targetTok && t.at < exclAt),
  )
  const dataRuns = runs.filter((r) => r.length >= 2 || (r.length === 1 && runs.length === 1 && !paramVals.has(r[0]!.value)))
  const best = dataRuns.reduce<Tok[] | null>((a, r) => (!a || r.length >= a.length ? r : a), null) ?? []
  const listRun = best.length >= 2 ? best : runs.length === 1 && !paramVals.size ? best : []

  for (const t of toks) {
    const word = n.slice(t.end).match(/^\s+([a-zñ]{3,})/)?.[1]
    let role: NumberRead['role'] = 'otro'
    let why = 'no forma parte de la lista de datos'
    if (t === targetTok) [role, why] = ['objetivo', 'sigue al verbo de búsqueda']
    else if (t.at > exclAt) [role, why] = ['excluido', `aparece después de «${excl![0]}»`]
    else if (listRun.includes(t)) [role, why] = ['dato', 'forma parte de la lista']
    else if (paramVals.has(t.value) && !listRun.includes(t)) [role, why] = ['parametro', bound.mode === 'exact' ? 'cota de longitud exacta' : 'cota de longitud']
    else if (word && !STOP.has(word)) [role, why] = ['contexto', `indica una cantidad («${formatNumber(t.value)} ${word}»)`]
    reading.numbers.push({ value: t.value, at: t.at, role, why })
  }
  reading.data = listRun.map((t) => t.value)
  const context = reading.numbers.filter((x) => x.role === 'contexto')
  const matchingCount = context.some((c) => Number.isInteger(c.value) && c.value === reading.data.length)
  for (const c of context) {
    const matches = Number.isInteger(c.value) && c.value === reading.data.length
    const unit = c.why.match(/«-?\d+(?:\.\d+)? ([a-zñ]+)»/)?.[1]
    reading.evidence.push(`El ${formatNumber(c.value)} ${c.why}${matches ? ', y coincide con la cantidad de datos' : ''}: no es un dato`)
    if (matches || (unit && UNIT_NOT_COUNT.has(unit)) || (matchingCount && !matches)) continue
    if (reading.data.length > 1) reading.ambiguities.push(`El enunciado menciona ${formatNumber(c.value)}, pero la lista tiene ${reading.data.length} valores.`)
  }
  if (reading.numbers.some((x) => x.role === 'otro') && reading.data.length) reading.ambiguities.push('Hay números fuera de la lista cuyo papel no está claro.')
}

export function analyzeStatement(text: string): Reading {
  const n = normalizeStatement(text)
  const forbid = forbidOf(n)
  const reading: Reading = {
    normalized: n,
    operations: [],
    competing: competingIntents(text, n),
    unsupported: null,
    numbers: [],
    data: [],
    target: null,
    constraints: [...forbid.constraints],
    output: null,
    candidate: null,
    evidence: [],
    ambiguities: [],
    clarifications: [],
    negated: NEGATION.test(n),
    canonical: null,
    length: lengthBoundOf(n),
    searchMode: null,
    forbid: forbid.ids,
  }
  if (reading.negated) reading.ambiguities.push('El enunciado niega una operación; no se interpreta en silencio.')
  if (reading.length.mode === 'exact') reading.constraints.push(reading.length.k === null ? 'Longitud exacta K.' : `Longitud exacta ${reading.length.k}.`)
  if (reading.length.mode === 'range') {
    const { l, r } = reading.length
    reading.constraints.push(l === null || r === null ? 'Longitud entre L y R.' : `Longitud entre ${l} y ${r}.`)
  }

  const blocked = unsupportedOf(n)
  if (blocked) {
    reading.unsupported = blocked
    reading.evidence.push(`«${blocked.evidence}» indica un tipo de problema sin soporte`)
    return reading
  }

  const toks: Tok[] = [...n.matchAll(new RegExp(NUM, 'g'))].map((m) => ({ value: Number(m[1]), at: m.index, end: m.index + m[0].length }))
  const search = n.match(SEARCH)
  const subarray = SUBARRAY_INTENT.test(n)
  if (subarray) reading.operations.push({ id: 'maxsub', kind: 'subarray', evidence: n.match(SUBARRAY_INTENT)?.[0] ?? 'subarreglo' })
  if (!subarray && !SORT_DIR.test(n)) {
    for (const o of STATS_OPS) {
      const m = n.match(o.re)
      if (m) reading.operations.push({ id: o.id, kind: 'stats', evidence: m[0] })
    }
  }
  if (search) reading.operations.push({ id: 'buscar', kind: 'search', evidence: search[0] })
  reading.searchMode = searchModeOf(n, !!search)

  let targetTok: Tok | undefined
  if (search) {
    const value = Number(search.slice(1).find((g) => g !== undefined))
    const at = (search.index ?? 0) + search[0].lastIndexOf(search.slice(1).find((g) => g !== undefined)!)
    targetTok = toks.find((t) => t.at === at && t.value === value)
    if (targetTok) {
      reading.target = value
      reading.evidence.push(`El valor buscado es ${formatNumber(value)}`)
    }
  }

  fillNumbers(reading, n, toks, targetTok)

  if (!reading.operations.length) return reading
  const kinds = new Set(reading.operations.map((o) => o.kind))
  if (kinds.size > 1) {
    reading.evidence.push(`Varias operaciones posibles: ${reading.operations.map((o) => `«${o.evidence}»`).join(', ')}`)
    return reading
  }
  const kind = reading.operations[0]!.kind
  reading.candidate = kind
  reading.evidence.push(reading.operations.length === 1 ? `La operación principal es «${reading.operations[0]!.evidence}»` : `Se piden varias medidas: ${reading.operations.map((o) => `«${o.evidence}»`).join(', ')}`)

  if (kind === 'stats') {
    const id = reading.operations[0]!.id as StatsOp
    reading.output = reading.operations.length === 1 ? `${OP_TEXT[id].toLowerCase()} de la lista` : 'medidas de la lista'
    const excl = n.match(EXCLUSION)
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
      reading.clarifications.push({ label: `Usar los ${reading.data.length} valores de la lista`, text: statsCanonical(reading.operations, reading.data) || `${OP_TEXT[id]} de ${fmtList(reading.data)}` })
    }
    if (reading.data.length) reading.canonical = statsCanonical(reading.operations, reading.data)
  } else if (kind === 'search') {
    reading.output = 'posición del valor buscado'
    if (reading.target !== null && reading.data.length)
      reading.canonical = /ultima|ultimo/.test(n)
        ? `Última aparición del ${formatNumber(reading.target)} en ${fmtList(reading.data)}`
        : `Buscar ${formatNumber(reading.target)} en la lista ${fmtList(reading.data)}${/binari|ordenad/.test(n) ? ' con búsqueda binaria' : ''}`
  } else {
    reading.output = 'suma máxima de un subarreglo contiguo'
  }
  return reading
}

export type Plan =
  | { type: 'legacy' }
  | { type: 'unsupported'; reason: string; evidence: string }
  | { type: 'clarify'; kind: 'stats' | 'search' | 'subarray'; reading: Reading }
  | { type: 'rewrite'; kind: 'stats' | 'search' | 'subarray'; text: string; notes: string[] }

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
  if (k === 'subarray') return { type: 'legacy' }
  if (r.negated) return { type: 'clarify', kind: k, reading: r }
  if (r.ambiguities.length) return r.clarifications.length ? { type: 'clarify', kind: k, reading: r } : { type: 'legacy' }
  if (!r.canonical) return { type: 'legacy' }
  const hasContext = r.numbers.some((x) => x.role === 'contexto' || x.role === 'parametro')
  if (legacy === k && !hasContext) return { type: 'legacy' }
  return { type: 'rewrite', kind: k, text: r.canonical, notes: r.evidence }
}
