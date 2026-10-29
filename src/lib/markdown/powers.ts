const GUARD = /```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]*?\$\$|(?<!\\)\$[^$\n]+\$/g
const POWER = /(?<![\w\\/$])(\([^()\n]+\)|[A-Za-z][A-Za-z0-9]*|\d+)\^(\{[^{}\n]+\}|\d+|[A-Za-z])/g

function lift(text: string): string {
  return text.replace(POWER, (m) => `$${m}$`)
}

/** Vuelve visible `A^2` en la vista previa, sin tocar código ni fórmulas que ya tienen `$`. */
export function showPowers(source: string): string {
  let out = ''
  let last = 0
  for (const m of source.matchAll(GUARD)) {
    const i = m.index ?? 0
    out += lift(source.slice(last, i)) + m[0]
    last = i + m[0].length
  }
  return out + lift(source.slice(last))
}
