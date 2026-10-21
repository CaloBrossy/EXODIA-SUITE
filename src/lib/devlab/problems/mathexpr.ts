import { all, create, type MathNode } from 'mathjs'
import { RefError } from './testing'

/** Instancia propia de mathjs: solo se usa `parse` (árbol sintáctico), nunca `evaluate` sobre texto del usuario. */
export const mathjs = create(all!, { number: 'number' })

export const MSG = {
  div0: 'División por cero',
  sqrtNeg: 'Raíz cuadrada de un número negativo',
  logNonPos: 'Logaritmo de un número no positivo',
  powNeg: 'Potencia de base negativa con exponente no entero',
  pow0: 'Potencia de base cero con exponente negativo',
} as const

export const FUNCS: Record<string, 'sqrt' | 'abs' | 'floor' | 'sin' | 'cos' | 'tan' | 'exp' | 'ln' | 'log10'> = {
  sqrt: 'sqrt',
  abs: 'abs',
  floor: 'floor',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  exp: 'exp',
  log: 'ln',
  ln: 'ln',
  log10: 'log10',
}

/** Palabras reservadas o confusas en alguno de los lenguajes de destino (o usadas por el propio generador). */
export const RESERVED = new Set(
  'in is or and not if do as fn go let var int for new len abs max min def del try use mut ref pub mod loop type case func long char byte auto else enum goto null true false void echo list print range return break const float double string struct static class match where impl trait self super crate move dyn box async await yield with from import global lambda pass raise assert except finally while switch default package map chan select defer interface this throw throws final native short signed unsigned sizeof typedef union volatile extern register inline friend operator template typename virtual delete namespace using object sealed params out checked decimal sbyte uint ulong ushort event fixed lock base implicit explicit array clone declare empty eval exit isset unset function math resultado divisor radicando argumento exponente valor error main'.split(
    ' ',
  ),
)

type Node = MathNode & { type: string; [k: string]: unknown }

export const symbolsOf = (node: MathNode): string[] => {
  const out = new Set<string>()
  node.traverse((n, _path, parent) => {
    const x = n as Node
    if (x.type === 'SymbolNode') {
      const p = parent as Node | null
      const isFnName = p?.type === 'FunctionNode' && (p.fn as Node) === x
      if (!isFnName && x.name !== 'pi' && x.name !== 'e') out.add(x.name as string)
    }
  })
  return [...out]
}

export const isConstant = (node: MathNode) => symbolsOf(node).length === 0

/**
 * Evaluación de referencia, independiente del intérprete de la IR: recorre el árbol de mathjs
 * con las funciones de `Math` y aplica las mismas reglas de dominio que el algoritmo.
 */
export function refEval(node: MathNode, scope: Record<string, number>): number {
  const x = node as Node
  const args = (x.args as MathNode[] | undefined) ?? []
  switch (x.type) {
    case 'ConstantNode':
      return Number(x.value)
    case 'SymbolNode': {
      const name = x.name as string
      if (name === 'pi') return Math.PI
      if (name === 'e' && !(name in scope)) return Math.E
      const v = scope[name]
      if (v === undefined) throw new Error(`Falta el valor de ${name}`)
      return v
    }
    case 'ParenthesisNode':
      return refEval(x.content as MathNode, scope)
    case 'OperatorNode': {
      const fn = x.fn as string
      if (fn === 'unaryMinus') return -refEval(args[0]!, scope)
      if (fn === 'unaryPlus') return refEval(args[0]!, scope)
      const a = refEval(args[0]!, scope)
      if (fn === 'pow') {
        const b = refEval(args[1]!, scope)
        if (a < 0 && b !== Math.floor(b)) throw new RefError(MSG.powNeg)
        if (a === 0 && b < 0) throw new RefError(MSG.pow0)
        return Math.pow(a, b)
      }
      const b = refEval(args[1]!, scope)
      if (fn === 'add') return a + b
      if (fn === 'subtract') return a - b
      if (fn === 'multiply') return a * b
      if (fn === 'divide') {
        if (b === 0) throw new RefError(MSG.div0)
        return a / b
      }
      throw new Error(`Operador no admitido: ${x.op as string}`)
    }
    case 'FunctionNode': {
      const name = (x.fn as Node).name as string
      const a = refEval(args[0]!, scope)
      switch (FUNCS[name]) {
        case 'sqrt':
          if (a < 0) throw new RefError(MSG.sqrtNeg)
          return Math.sqrt(a)
        case 'ln':
          if (a <= 0) throw new RefError(MSG.logNonPos)
          return Math.log(a)
        case 'log10':
          if (a <= 0) throw new RefError(MSG.logNonPos)
          return Math.log10(a)
        case 'abs':
          return Math.abs(a)
        case 'floor':
          return Math.floor(a)
        case 'sin':
          return Math.sin(a)
        case 'cos':
          return Math.cos(a)
        case 'tan':
          return Math.tan(a)
        case 'exp':
          return Math.exp(a)
      }
      throw new Error(`Función no admitida: ${name}`)
    }
  }
  throw new Error(`Construcción no admitida: ${x.type}`)
}

/** Comprueba que el árbol use solo la sintaxis que el generador sabe traducir. */
export function checkSupported(node: MathNode): string | null {
  let problem: string | null = null
  node.traverse((n, _path, parent) => {
    if (problem) return
    const x = n as Node
    switch (x.type) {
      case 'ConstantNode':
        if (typeof x.value !== 'number') problem = 'Solo se admiten constantes numéricas.'
        break
      case 'SymbolNode': {
        const p = parent as Node | null
        if (p?.type === 'FunctionNode' && (p.fn as Node) === x) break
        break
      }
      case 'ParenthesisNode':
        break
      case 'OperatorNode': {
        const fn = x.fn as string
        if (!['add', 'subtract', 'multiply', 'divide', 'pow', 'unaryMinus', 'unaryPlus'].includes(fn)) problem = `El operador "${x.op as string}" no está admitido en esta versión (se admiten + − × ÷ y ^).`
        break
      }
      case 'FunctionNode': {
        const name = (x.fn as Node).name as string
        if (!FUNCS[name]) problem = `La función "${name}" no está admitida. Disponibles: ${Object.keys(FUNCS).join(', ')}.`
        else if ((x.args as unknown[]).length !== 1) problem = `La función "${name}" recibe un solo argumento.`
        break
      }
      default:
        problem = `La construcción "${x.type}" no está admitida.`
    }
  })
  return problem
}

export const toTex = (node: MathNode) => node.toTex({ parenthesis: 'keep', implicit: 'show' })

/** Reemplaza variables por valores para mostrar la sustitución. */
export function substituteTex(node: MathNode, scope: Record<string, number>): string {
  const replaced = node.transform((n) => {
    const x = n as Node
    if (x.type === 'SymbolNode' && (x.name as string) in scope) {
      const v = scope[x.name as string]!
      const c = new mathjs.ConstantNode(Math.abs(v))
      return v < 0 ? new mathjs.ParenthesisNode(new mathjs.OperatorNode('-', 'unaryMinus', [c])) : c
    }
    return n
  })
  return toTex(replaced)
}
