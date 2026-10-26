import type { DatasetAxis, DatasetRow } from '@/db/models'
import { detectDelimiter, normKey, parseCsv, parseNum, toCsv } from './csv'

/** Fila editable: texto tal como lo escribe el usuario. */
export type Cell = { x: string; y: string; ex: string; ey: string }
export const emptyCell = (): Cell => ({ x: '', y: '', ex: '', ey: '' })
const COLS = ['x', 'y', 'ex', 'ey'] as const

const ALIASES: Record<(typeof COLS)[number], string[]> = {
  x: ['x'],
  y: ['y'],
  ex: ['ex', 'errx', 'err x', 'error x', 'dx', 'sx', 'σx', 'sigma x', 'sigmax', 'ux'],
  ey: ['ey', 'erry', 'err y', 'error y', 'dy', 'sy', 'σy', 'sigma y', 'sigmay', 'uy'],
}

/** Normaliza encabezados como «Δx», «x (s)», «err_y». */
const headerKey = (h: string) => normKey(h).replace(/\(.*\)|\[.*\]/g, '').replace(/[_\-δΔ]/g, (c) => (c === '_' || c === '-' ? ' ' : 'd')).trim()

/**
 * Tabla pegada desde Excel/CSV/texto. Columnas por encabezado (x, y, errX, errY…) o, si no hay,
 * por posición. Acepta coma decimal; las filas sin ningún número se descartan.
 */
export function parseXYTable(text: string): { cells: Cell[]; header: string[] | null } {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const delim = detectDelimiter(text)
  const grid = first.includes(delim)
    ? parseCsv(text, delim)
    : text.split(/\r?\n/).map((l) => l.trim().split(/\s+/)).filter((r) => r.some((c) => c !== ''))
  if (!grid.length) return { cells: [], header: null }
  const head = grid[0]!
  const isHeader = head.some((c) => c !== '' && parseNum(c) == null)
  let index: Record<(typeof COLS)[number], number> = { x: 0, y: 1, ex: 2, ey: 3 }
  if (isHeader) {
    const keys = head.map(headerKey)
    const find = (col: (typeof COLS)[number]) => keys.findIndex((k) => ALIASES[col].includes(k) || ALIASES[col].includes(k.replace(/\s/g, '')))
    const found = { x: find('x'), y: find('y'), ex: find('ex'), ey: find('ey') }
    // Con un solo nombre reconocido («t», «x»), x e y van por posición: esa «x» es la magnitud medida.
    if (found.x < 0 || found.y < 0) found.x = found.y = -1
    // Las columnas no reconocidas se asignan en orden x, y, errX, errY.
    const free = head.map((_, i) => i).filter((i) => !Object.values(found).includes(i))
    for (const col of COLS) if (found[col] < 0) found[col] = free.shift() ?? -1
    index = found
  }
  const body = isHeader ? grid.slice(1) : grid
  const cells = body
    .map((r) => ({ x: r[index.x] ?? '', y: r[index.y] ?? '', ex: index.ex >= 0 ? r[index.ex] ?? '' : '', ey: index.ey >= 0 ? r[index.ey] ?? '' : '' }))
    .filter((c) => COLS.some((k) => parseNum(c[k]) != null))
  return { cells, header: isHeader ? head : null }
}

/** Filas válidas (x e y numéricos; errores ≥ 0 o vacíos) y cantidad de filas con datos incompletos. */
export function cellsToRows(cells: Cell[]): { rows: DatasetRow[]; invalid: number } {
  const rows: DatasetRow[] = []
  let invalid = 0
  for (const c of cells) {
    if (COLS.every((k) => c[k].trim() === '')) continue
    const x = parseNum(c.x)
    const y = parseNum(c.y)
    const ex = parseNum(c.ex)
    const ey = parseNum(c.ey)
    if (x == null || y == null || (c.ex.trim() && ex == null) || (c.ey.trim() && ey == null)) {
      invalid++
      continue
    }
    rows.push({ x, y, ex: ex == null ? null : Math.abs(ex), ey: ey == null ? null : Math.abs(ey) })
  }
  return { rows, invalid }
}

export const rowsToCells = (rows: DatasetRow[]): Cell[] =>
  rows.map((r) => ({ x: String(r.x), y: String(r.y), ex: r.ex == null ? '' : String(r.ex), ey: r.ey == null ? '' : String(r.ey) }))

export function rowsToCsv(rows: DatasetRow[], xAxis: DatasetAxis, yAxis: DatasetAxis): string {
  const name = (a: DatasetAxis, fallback: string) => (a.label || fallback) + (a.unit ? ` (${a.unit})` : '')
  const withErr = rows.some((r) => r.ex != null || r.ey != null)
  const head = withErr ? [name(xAxis, 'x'), name(yAxis, 'y'), 'errX', 'errY'] : [name(xAxis, 'x'), name(yAxis, 'y')]
  return toCsv([head, ...rows.map((r) => (withErr ? [r.x, r.y, r.ex, r.ey] : [r.x, r.y]))])
}
