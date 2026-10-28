/** Detecta el separador más frecuente en la primera línea: tab (pegado desde Excel), `;` o `,`. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const count = (d: string) => first.split(d).length - 1
  const options = ['\t', ';', ',']
  return options.reduce((best, d) => (count(d) > count(best) ? d : best), ',')
}

/** CSV con comillas dobles (RFC 4180). Ignora filas vacías. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
      continue
    }
    if (ch === '"' && cell === '') quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell)
  rows.push(row)
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''))
}

export function toCsv(rows: (string | number | null | undefined)[][], delimiter = ','): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /["\n\r]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(esc).join(delimiter)).join('\n')
}

/** Clave de comparación: minúsculas, sin tildes ni espacios extra. */
export const normKey = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Número con coma o punto decimal; null si está vacío o no es número. */
export function parseNum(s: string | undefined): number | null {
  if (s == null || s.trim() === '') return null
  let t = s.trim().replace(/\s/g, '')
  const comma = t.lastIndexOf(',')
  const dot = t.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) t = comma > dot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  else if (comma >= 0) t = t.split(',').length === 2 ? t.replace(',', '.') : t.replace(/,/g, '')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
