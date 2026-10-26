import { compileExpression } from './calculator'
import { runSymbolic } from './symbolic'

export type UncVar = { symbol: string; value: number; uncertainty: number }
export type Propagation = {
  symbol: string
  value: number
  uncertainty: number
  rounded: string
  latex: string
  steps: string[]
}

const ident = /^[A-Za-z][A-Za-z0-9_]*$/

/** Incertidumbre a 1 cifra significativa, o 2 si el primer dígito es 1. */
export function roundUncertainty(u: number): { value: number; decimals: number } {
  if (!(u > 0) || !Number.isFinite(u)) return { value: 0, decimals: 0 }
  const exp = Math.floor(Math.log10(u))
  const figs = u / 10 ** exp < 2 ? 2 : 1
  const decimals = figs - 1 - exp
  const f = 10 ** decimals
  return { value: Math.round(u * f) / f, decimals }
}

const show = (n: number, decimals: number) => (decimals > 0 ? n.toFixed(decimals) : String(Math.round(n))).replace('.', ',')

/**
 * Propagación por derivadas parciales: δf = √ Σ (∂f/∂xᵢ · δxᵢ)².
 * La fórmula puede ser «g = 4*pi^2*L/T^2».
 */
export function propagate(formula: string, vars: UncVar[], unit = ''): Propagation {
  const parts = formula.split('=')
  if (parts.length > 2) throw new Error('La fórmula tiene más de un «=»')
  const symbol = parts.length === 2 ? parts[0]!.trim() : 'y'
  const expr = (parts.length === 2 ? parts[1]! : parts[0]!).trim()
  if (!expr) throw new Error('Escribí la fórmula')
  if (symbol && !ident.test(symbol)) throw new Error('El nombre del resultado no es válido')
  for (const v of vars) {
    if (!ident.test(v.symbol)) throw new Error(`Variable inválida: ${v.symbol}`)
    if (!Number.isFinite(v.value) || !(v.uncertainty >= 0)) throw new Error(`Revisá el valor y la incertidumbre de ${v.symbol}`)
  }
  const scope = Object.fromEntries(vars.map((v) => [v.symbol, v.value]))
  const f = compileExpression(expr, vars.map((v) => v.symbol))
  const value = f(scope)
  if (!Number.isFinite(value)) throw new Error('La fórmula no está definida con esos valores')
  const steps = [`\\(${symbol} = ${expr}\\)`, `Valor: ${symbol} = ${value}`]
  let sum = 0
  const terms: string[] = []
  for (const v of vars) {
    const d = runSymbolic({ op: 'derive', expr, variable: v.symbol })
    if (!d.ok) throw new Error(d.error)
    const partial = compileExpression(d.result, vars.map((x) => x.symbol))(scope)
    if (!Number.isFinite(partial)) throw new Error(`No pude evaluar ∂/∂${v.symbol}`)
    const contrib = partial * v.uncertainty
    sum += contrib ** 2
    terms.push(`\\left(${d.resultLatex} \\cdot ${v.uncertainty}\\right)^2`)
    steps.push(`∂${symbol}/∂${v.symbol} = ${d.result} → ${partial} · ${v.uncertainty} = ${contrib}`)
  }
  const uncertainty = Math.sqrt(sum)
  const ru = roundUncertainty(uncertainty)
  const rv = Math.round(value * 10 ** ru.decimals) / 10 ** ru.decimals
  const rounded = `${show(rv, ru.decimals)} ± ${show(ru.value, ru.decimals)}${unit ? ` ${unit}` : ''}`
  const latex = `\\delta ${symbol} = \\sqrt{${terms.join(' + ')}}`
  return { symbol, value, uncertainty, rounded, latex, steps }
}
