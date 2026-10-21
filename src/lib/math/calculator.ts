import { all, create, type MathNode } from 'mathjs'

const math = create(all!, { number: 'number' })

export class CalcError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CalcError'
  }
}

export type AngleMode = 'rad' | 'deg'
export type NumberFormat = 'auto' | 'scientific' | 'engineering'

const FORWARD_TRIG = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot'])
const INVERSE_TRIG = new Set(['asin', 'acos', 'atan', 'atan2'])

export const ALLOWED_FUNCTIONS = new Set([
  'sqrt', 'cbrt', 'nthRoot', 'exp', 'log', 'ln', 'log10', 'log2', 'pow',
  ...FORWARD_TRIG, ...INVERSE_TRIG,
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'abs', 'round', 'floor', 'ceil', 'sign', 'factorial', 'min', 'max', 'mod', 'hypot',
  'combinations', 'permutations', 're', 'im', 'conj', 'arg',
])

export const CONSTANTS: Record<string, string> = {
  pi: 'π ≈ 3.14159',
  e: 'Número de Euler ≈ 2.71828',
  tau: 'τ = 2π',
  phi: 'Razón áurea ≈ 1.61803',
  i: 'Unidad imaginaria',
}

const ALLOWED_OPERATORS = new Set([
  'add', 'subtract', 'multiply', 'divide', 'pow', 'unaryMinus', 'unaryPlus', 'factorial', 'mod',
])

const MAX_LENGTH = 1000
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

export function isIdentifier(s: string): boolean {
  return IDENTIFIER.test(s) && !ALLOWED_FUNCTIONS.has(s) && !(s in CONSTANTS)
}

function normalize(expr: string): string {
  return expr
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .trim()
}

/** Valida el AST contra la lista blanca. Nunca se ejecuta código arbitrario. */
function validate(root: MathNode, allowedSymbols: Set<string>): void {
  root.traverse((node, path, parent) => {
    switch (node.type) {
      case 'ConstantNode': {
        const v = (node as unknown as { value: unknown }).value
        if (typeof v !== 'number') throw new CalcError('Solo se admiten constantes numéricas')
        return
      }
      case 'ParenthesisNode':
        return
      case 'OperatorNode': {
        const fn = (node as unknown as { fn: string; op: string }).fn
        if (!ALLOWED_OPERATORS.has(fn)) {
          throw new CalcError(`Operador no admitido: ${(node as unknown as { op: string }).op}`)
        }
        return
      }
      case 'FunctionNode': {
        const fnNode = (node as unknown as { fn: MathNode }).fn
        const name = fnNode.type === 'SymbolNode' ? (fnNode as unknown as { name: string }).name : ''
        if (!ALLOWED_FUNCTIONS.has(name)) throw new CalcError(`Función no admitida: ${name || '(expresión)'}`)
        return
      }
      case 'SymbolNode': {
        if (parent?.type === 'FunctionNode' && path === 'fn') return
        const name = (node as unknown as { name: string }).name
        if (name in CONSTANTS || allowedSymbols.has(name)) return
        if (ALLOWED_FUNCTIONS.has(name)) throw new CalcError(`Falta el argumento de ${name}(…)`)
        throw new CalcError(`Símbolo desconocido: ${name}`)
      }
      default:
        throw new CalcError('Construcción no admitida en la expresión')
    }
  })
}

/** Transforma de abajo hacia arriba para que las funciones anidadas también se ajusten. */
function applyAngleMode(root: MathNode, mode: AngleMode): MathNode {
  const visit = (node: MathNode): MathNode => rewrite(node.map((child) => visit(child)))
  const rewrite = (node: MathNode): MathNode => {
    if (node.type !== 'FunctionNode') return node
    const fn = node as unknown as { fn: { name?: string }; args: MathNode[] }
    const name = fn.fn.name ?? ''
    if (name === 'ln') return new math.FunctionNode(new math.SymbolNode('log'), fn.args)
    if (mode === 'rad') return node
    if (FORWARD_TRIG.has(name)) {
      const arg = fn.args[0]
      if (!arg) return node
      const scaled = new math.OperatorNode('*', 'multiply', [
        new math.ParenthesisNode(arg),
        new math.ConstantNode(Math.PI / 180),
      ])
      return new math.FunctionNode(new math.SymbolNode(name), [scaled])
    }
    if (INVERSE_TRIG.has(name)) {
      return new math.OperatorNode('*', 'multiply', [node, new math.ConstantNode(180 / Math.PI)])
    }
    return node
  }
  return visit(root)
}

export interface ComplexValue {
  re: number
  im: number
}
export type CalcValue = number | ComplexValue

export interface EvalOptions {
  angle?: AngleMode
  variables?: Record<string, number>
}

function toValue(raw: unknown): CalcValue {
  if (typeof raw === 'number') {
    if (Number.isNaN(raw)) throw new CalcError('Resultado indefinido (NaN)')
    if (!Number.isFinite(raw)) throw new CalcError('Resultado infinito o desbordamiento (p. ej., división por cero)')
    return raw
  }
  if (math.typeOf(raw) === 'Complex') {
    const c = raw as { re: number; im: number }
    if (!Number.isFinite(c.re) || !Number.isFinite(c.im)) throw new CalcError('Resultado complejo no finito')
    const scale = Math.max(Math.abs(c.re), 1)
    if (Math.abs(c.im) <= 1e-14 * scale) return c.re
    return { re: c.re, im: c.im }
  }
  if (typeof raw === 'boolean') throw new CalcError('La expresión no produce un número')
  throw new CalcError('La expresión debe producir un único número')
}

/** Evalúa una expresión matemática restringida. Lanza CalcError ante entradas inválidas. */
export function evaluateExpression(input: string, opts: EvalOptions = {}): CalcValue {
  const expr = normalize(input)
  if (!expr) throw new CalcError('La expresión está vacía')
  if (expr.length > MAX_LENGTH) throw new CalcError('La expresión es demasiado larga')
  const vars = opts.variables ?? {}
  let node: MathNode
  try {
    node = math.parse(expr)
  } catch (e) {
    throw new CalcError(`Sintaxis inválida: ${(e as Error).message}`)
  }
  validate(node, new Set(Object.keys(vars)))
  const prepared = applyAngleMode(node, opts.angle ?? 'rad')
  const scope = new Map<string, number>(Object.entries(vars))
  let raw: unknown
  try {
    raw = prepared.compile().evaluate(scope)
  } catch (e) {
    throw new CalcError(`Error de evaluación: ${(e as Error).message}`)
  }
  return toValue(raw)
}

/** Símbolos libres (no constantes ni funciones) que aparecen en la expresión. */
export function freeSymbols(input: string): string[] {
  const node = math.parse(normalize(input))
  const out = new Set<string>()
  node.traverse((n, path, parent) => {
    if (n.type !== 'SymbolNode') return
    if (parent?.type === 'FunctionNode' && path === 'fn') return
    const name = (n as unknown as { name: string }).name
    if (!(name in CONSTANTS)) out.add(name)
  })
  return [...out]
}

function formatReal(x: number, fmt: NumberFormat, precision: number): string {
  if (x === 0) return '0'
  if (fmt === 'scientific') return x.toExponential(precision - 1).replace(/e\+?/, 'e')
  if (fmt === 'engineering') {
    const exp = Math.floor(Math.log10(Math.abs(x)) / 3) * 3
    let mant = x / 10 ** exp
    let e = exp
    if (Math.abs(Number(mant.toPrecision(precision))) >= 1000) {
      mant /= 1000
      e += 3
    }
    const m = Number(mant.toPrecision(precision)).toString()
    return e === 0 ? m : `${m}e${e}`
  }
  const abs = Math.abs(x)
  if (abs >= 1e12 || abs < 1e-6) return x.toExponential(precision - 1).replace(/\.?0+e/, 'e').replace(/e\+?/, 'e')
  return Number(x.toPrecision(precision)).toString()
}

export function formatValue(v: CalcValue, fmt: NumberFormat = 'auto', precision = 12): string {
  if (typeof v === 'number') return formatReal(v, fmt, precision)
  const re = v.re === 0 ? '' : formatReal(v.re, fmt, precision)
  const imAbs = formatReal(Math.abs(v.im), fmt, precision)
  const imPart = `${imAbs === '1' ? '' : imAbs}i`
  if (!re) return v.im < 0 ? `-${imPart}` : imPart
  return `${re} ${v.im < 0 ? '−' : '+'} ${imPart}`
}
