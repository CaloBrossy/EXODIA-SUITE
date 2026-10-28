export const SYMBOLIC_OPS = ['derive', 'integrate', 'limit', 'solve', 'simplify', 'expand', 'factor', 'taylor', 'sum', 'ode'] as const
export type SymbolicOp = (typeof SYMBOLIC_OPS)[number]

export const SymbolicOpLabel: Record<SymbolicOp, string> = {
  derive: 'Derivar',
  integrate: 'Integrar',
  limit: 'Límite',
  solve: 'Resolver ecuaciones',
  simplify: 'Simplificar',
  expand: 'Expandir',
  factor: 'Factorizar',
  taylor: 'Serie de Taylor',
  sum: 'Sumatoria',
  ode: 'Ecuación diferencial',
}

export type SymbolicRequest = {
  op: SymbolicOp
  /** Expresión; en «resolver», una ecuación por línea (o separadas por «;»); en EDO, la ecuación con y, y', y''. */
  expr: string
  /** Variable (x por defecto) o índice de la sumatoria (k). */
  variable?: string
  /** Orden de la derivada o de la serie. */
  order?: number
  /** Límites de la integral definida o de la sumatoria. */
  lower?: string
  upper?: string
  /** Punto del límite o centro de la serie. */
  point?: string
  /** EDO: condiciones iniciales, p. ej. «y(0)=1, y'(0)=0». */
  conditions?: string
  /** Resolver: incógnitas separadas por coma (opcional). */
  unknowns?: string
}

/** Qué cálculo numérico ofrecer como alternativa. Todo en sintaxis de la calculadora. */
export type NumericPlan =
  | { kind: 'derivative'; expr: string; variable: string; order: number }
  | { kind: 'integral'; expr: string; variable: string; lower?: string; upper?: string }
  | { kind: 'limit'; expr: string; variable: string; point: string }
  | { kind: 'roots'; expr: string; variable: string }
  | { kind: 'system'; exprs: string[]; unknowns: string[] }
  | { kind: 'sum'; expr: string; variable: string; lower: string; upper: string }
  /** y' = rhs(x, y) o y'' = rhs(x, y, yp). */
  | { kind: 'ode'; order: 1 | 2; rhs: string; variable: string; conditions: string }

export type SymbolicResult =
  | {
      ok: true
      /** Enunciado completo: «operación = resultado». */
      latex: string
      resultLatex: string
      /** Resultado en texto plano (sintaxis de la calculadora cuando es posible). */
      result: string
      approx: number | null
      /** Constante reconocida para el valor aproximado, p. ej. \frac{\pi}{4}. */
      recognized: string | null
      notes: string[]
      /** Para verificar numéricamente (integral definida) u ofrecer otra vía. */
      numeric?: NumericPlan
    }
  | { ok: false; error: string; numeric?: NumericPlan }

export const DEFAULT_VARIABLE: Partial<Record<SymbolicOp, string>> = { sum: 'k' }

/** Ecuación «a = b» → «(a)-(b)»; sin «=» se toma como «expr = 0». */
export function equationToZero(eq: string): string {
  const parts = eq.split('=')
  if (parts.length > 2) throw new Error(`Hay más de un «=» en «${eq}»`)
  return parts.length === 2 ? `(${parts[0]!.trim() || '0'})-(${parts[1]!.trim() || '0'})` : eq.trim()
}

export const splitEquations = (s: string) => s.split(/\n|;/).map((x) => x.trim()).filter(Boolean)
export const splitList = (s: string | undefined) => (s ?? '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)

/** Alternativa numérica que no necesita el motor simbólico (p. ej., si se agotó el tiempo). */
export function numericPlanFor(req: SymbolicRequest): NumericPlan | undefined {
  const variable = req.variable?.trim() || DEFAULT_VARIABLE[req.op] || 'x'
  try {
    switch (req.op) {
      case 'derive':
        return { kind: 'derivative', expr: req.expr, variable, order: req.order ?? 1 }
      case 'integrate':
        return { kind: 'integral', expr: req.expr, variable, lower: req.lower || undefined, upper: req.upper || undefined }
      case 'limit':
        return { kind: 'limit', expr: req.expr, variable, point: req.point || '0' }
      case 'solve': {
        const eqs = splitEquations(req.expr).map(equationToZero)
        const unknowns = splitList(req.unknowns)
        if (eqs.length === 1 && unknowns.length <= 1) return { kind: 'roots', expr: eqs[0]!, variable: unknowns[0] ?? variable }
        return { kind: 'system', exprs: eqs, unknowns }
      }
      case 'sum':
        return req.lower && req.upper ? { kind: 'sum', expr: req.expr, variable, lower: req.lower, upper: req.upper } : undefined
      default:
        return undefined
    }
  } catch {
    return undefined
  }
}

export type InitialCondition = { derivative: 0 | 1 | 2; at: string; value: string }

/** «y(0)=1, y'(0)=0» → condiciones. Lanza con un mensaje claro si alguna no se entiende. */
export function parseConditions(s: string | undefined): InitialCondition[] {
  return (s ?? '')
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((c) => {
      const m = /^y('{0,2})\s*\(([^)]+)\)\s*=\s*(.+)$/.exec(c.replace(/’/g, "'"))
      if (!m) throw new Error(`No entiendo la condición «${c}». Usá la forma y(0)=1 o y'(0)=0.`)
      return { derivative: m[1]!.length as 0 | 1 | 2, at: m[2]!.trim(), value: m[3]!.trim() }
    })
}
