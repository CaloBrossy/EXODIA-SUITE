import { db } from '@/db/db'
import { FormulaSchema, type Formula } from '@/db/models'
import { CalcError, evaluateExpression, formatValue, freeSymbols, isIdentifier } from '@/lib/math/calculator'
import { matchesQuery, uid } from '@/lib/text'
import { guard } from './errors'

export type FormulaInput = Omit<Formula, 'id' | 'createdAt' | 'updatedAt' | 'seed'>

export const emptyFormula = (): FormulaInput => ({
  name: '',
  latex: '',
  description: '',
  variables: [],
  resultUnit: '',
  example: '',
  discipline: '',
  tags: [],
  conceptIds: [],
  evalExpression: '',
  evalTarget: '',
})

/** Comprueba que la expresión evaluable solo use variables declaradas y la sintaxis admitida. */
export function validateEvalExpression(f: Pick<FormulaInput, 'evalExpression' | 'variables'>): string | null {
  const expr = f.evalExpression.trim()
  if (!expr) return null
  let symbols: string[]
  try {
    symbols = freeSymbols(expr)
  } catch (e) {
    return `Expresión inválida: ${(e as Error).message}`
  }
  const declared = new Set(f.variables.map((v) => v.symbol.trim()))
  const missing = symbols.filter((s) => !declared.has(s))
  if (missing.length) return `Variables no declaradas en la expresión: ${missing.join(', ')}`
  const bad = symbols.filter((s) => !isIdentifier(s))
  if (bad.length) return `Nombres de variable no válidos: ${bad.join(', ')}`
  try {
    evaluateExpression(expr, { variables: Object.fromEntries(symbols.map((s) => [s, 1.234])) })
  } catch (e) {
    if (e instanceof CalcError && /Sintaxis|admitid|desconocido/.test(e.message)) return e.message
  }
  return null
}

export function evaluableVariables(f: Formula): string[] {
  if (!f.evalExpression.trim()) return []
  try {
    return freeSymbols(f.evalExpression)
  } catch {
    return []
  }
}

export function evaluateFormula(f: Formula, values: Record<string, string>): string {
  const vars: Record<string, number> = {}
  for (const s of evaluableVariables(f)) {
    const raw = (values[s] ?? '').trim()
    if (!raw) throw new CalcError(`Falta el valor de ${s}`)
    const v = evaluateExpression(raw)
    if (typeof v !== 'number') throw new CalcError(`${s} debe ser un número real`)
    vars[s] = v
  }
  return formatValue(evaluateExpression(f.evalExpression, { variables: vars }))
}

export function saveFormula(input: FormulaInput, id?: string): Promise<string> {
  return guard('No se pudo guardar la fórmula', async () => {
    const err = validateEvalExpression(input)
    if (err) throw new Error(err)
    const now = Date.now()
    const existing = id ? await db.formulas.get(id) : undefined
    const formula = FormulaSchema.parse({
      ...input,
      name: input.name.trim(),
      variables: input.variables.filter((v) => v.symbol.trim()),
      id: existing?.id ?? uid(),
      seed: existing?.seed,
      toolPath: input.toolPath ?? existing?.toolPath,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    await db.formulas.put(formula)
    return formula.id
  })
}

export function deleteFormula(id: string): Promise<void> {
  return guard('No se pudo eliminar la fórmula', () =>
    db.transaction('rw', db.formulas, db.notes, async () => {
      const now = Date.now()
      await db.notes.toCollection().modify((n) => {
        if (!n.formulaIds.includes(id)) return
        n.formulaIds = n.formulaIds.filter((x) => x !== id)
        n.updatedAt = now
      })
      await db.formulas.delete(id)
    }),
  )
}

export function filterFormulas(list: Formula[], q: string, discipline: string | null): Formula[] {
  return list
    .filter(
      (f) =>
        (!discipline || f.discipline === discipline) &&
        matchesQuery(q, f.name, f.description, f.tags, f.latex, f.variables.map((v) => `${v.symbol} ${v.meaning}`)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
