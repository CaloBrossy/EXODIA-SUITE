export interface EditResult {
  value: string
  selStart: number
  selEnd: number
}

/** Envuelve la selección con marcadores (p. ej. **negrita**). */
export function wrap(value: string, start: number, end: number, before: string, after = before, placeholder = 'texto'): EditResult {
  const sel = value.slice(start, end) || placeholder
  const next = value.slice(0, start) + before + sel + after + value.slice(end)
  return { value: next, selStart: start + before.length, selEnd: start + before.length + sel.length }
}

/** Antepone un prefijo a cada línea seleccionada (listas, títulos, citas). */
export function prefixLines(value: string, start: number, end: number, prefix: string): EditResult {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const lineEndIdx = value.indexOf('\n', end)
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
  const block = value.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  const all = lines.every((l) => l.startsWith(prefix))
  const changed = lines.map((l) => (all ? l.slice(prefix.length) : prefix + l)).join('\n')
  const next = value.slice(0, lineStart) + changed + value.slice(lineEnd)
  return { value: next, selStart: lineStart, selEnd: lineStart + changed.length }
}

export function insertBlock(value: string, start: number, end: number, block: string, cursorOffset: number): EditResult {
  const needsNl = start > 0 && value[start - 1] !== '\n' ? '\n' : ''
  const ins = `${needsNl}${block}`
  const next = value.slice(0, start) + ins + value.slice(end)
  const pos = start + needsNl.length + cursorOffset
  return { value: next, selStart: pos, selEnd: pos }
}
