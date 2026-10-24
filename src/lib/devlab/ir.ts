/**
 * Representación intermedia (IR) de los algoritmos de Dev Lab.
 *
 * Todas las etapas (pseudocódigo, código en cada lenguaje, pruebas) se derivan de un mismo
 * `Program`, de modo que no pueden describir algoritmos distintos. La IR es deliberadamente
 * pequeña y fuertemente tipada: cada conversión entre enteros y reales es explícita, porque
 * lenguajes como Rust o Go no las hacen de forma implícita.
 */

export type Scalar = 'int' | 'float' | 'bool' | 'str'
export type ListType = 'int[]' | 'float[]'
export type Type = Scalar | ListType

export const isList = (t: Type): t is ListType => t === 'int[]' || t === 'float[]'
export const elemOf = (t: ListType): 'int' | 'float' => (t === 'int[]' ? 'int' : 'float')

export type ArithOp = '+' | '-' | '*' | '/' | '//' | '%'
export type CmpOp = '==' | '!=' | '<' | '<=' | '>' | '>='
export type BinOp = ArithOp | CmpOp | 'and' | 'or'
export type MathFn = 'sqrt' | 'abs' | 'floor' | 'ceil' | 'round' | 'sin' | 'cos' | 'tan' | 'exp' | 'ln' | 'log10'

export type Expr =
  | { k: 'int'; v: number }
  | { k: 'float'; v: number }
  | { k: 'bool'; v: boolean }
  | { k: 'str'; v: string }
  | { k: 'var'; name: string }
  | { k: 'bin'; op: BinOp; l: Expr; r: Expr }
  | { k: 'neg'; e: Expr }
  | { k: 'not'; e: Expr }
  | { k: 'pow'; base: Expr; exp: Expr }
  | { k: 'math'; fn: MathFn; arg: Expr }
  | { k: 'const'; name: 'pi' | 'e' }
  | { k: 'toFloat'; e: Expr }
  | { k: 'len'; list: string }
  | { k: 'at'; list: string; index: Expr }
  | { k: 'concat'; l: Expr; r: Expr }
  | { k: 'slice'; str: string; from: Expr; to: Expr }
  | { k: 'call'; fn: string; args: Expr[] }

/** `step` vincula la instrucción con un paso de la estrategia; `note` se emite como comentario. */
export type Meta = { step?: number; note?: string }

export type Stmt = Meta &
  (
    | { k: 'let'; name: string; type: Scalar; value: Expr }
    | { k: 'set'; name: string; value: Expr }
    /** Copia una lista a una variable local (la entrada no se modifica). */
    | { k: 'copy'; name: string; type: ListType; from: string }
    /** Reserva una lista local de longitud `len`, rellena con `fill`. */
    | { k: 'alloc'; name: string; type: ListType; len: Expr; fill: Expr }
    | { k: 'setAt'; list: string; index: Expr; value: Expr }
    | { k: 'if'; cond: Expr; then: Stmt[]; else?: Stmt[] }
    /** Rango entero inclusivo: from, from+1, …, to. */
    | { k: 'for'; name: string; from: Expr; to: Expr; body: Stmt[] }
    | { k: 'each'; name: string; list: string; body: Stmt[] }
    | { k: 'while'; cond: Expr; body: Stmt[] }
    | { k: 'return'; value: Expr }
    | { k: 'fail'; message: string }
  )

export type IfStmt = Extract<Stmt, { k: 'if' }>

/** Una rama SI NO que contiene solo otro SI se presenta como "SI NO, SI" (else if / elif). */
export function elseIfOf(els?: Stmt[]): IfStmt | undefined {
  const first = els?.[0]
  return els?.length === 1 && first?.k === 'if' && !first.note ? first : undefined
}

export interface Param {
  name: string
  type: Type
  doc: string
}

export interface Fn {
  name: string
  params: Param[]
  returns: Type
  /** Puede terminar con un error de validación (`fail`). */
  fallible: boolean
  doc: string
  returnsDoc: string
  /** Motivo de error documentado (solo funciones falibles). */
  failsDoc?: string
  body: Stmt[]
}

export interface Program {
  /** Funciones en orden de dependencia: las auxiliares antes que quien las usa. */
  fns: Fn[]
  entry: string
}

export type Value = number | boolean | string | number[]

// ---------- Constructores ----------

export const int = (v: number): Expr => ({ k: 'int', v })
export const flt = (v: number): Expr => ({ k: 'float', v })
export const str = (v: string): Expr => ({ k: 'str', v })
export const bool = (v: boolean): Expr => ({ k: 'bool', v })
export const ref = (name: string): Expr => ({ k: 'var', name })
export const bin = (op: BinOp, l: Expr, r: Expr): Expr => ({ k: 'bin', op, l, r })
export const add = (l: Expr, r: Expr) => bin('+', l, r)
export const sub = (l: Expr, r: Expr) => bin('-', l, r)
export const mul = (l: Expr, r: Expr) => bin('*', l, r)
export const div = (l: Expr, r: Expr) => bin('/', l, r)
export const idiv = (l: Expr, r: Expr) => bin('//', l, r)
export const mod = (l: Expr, r: Expr) => bin('%', l, r)
export const eq = (l: Expr, r: Expr) => bin('==', l, r)
export const ne = (l: Expr, r: Expr) => bin('!=', l, r)
export const lt = (l: Expr, r: Expr) => bin('<', l, r)
export const le = (l: Expr, r: Expr) => bin('<=', l, r)
export const gt = (l: Expr, r: Expr) => bin('>', l, r)
export const ge = (l: Expr, r: Expr) => bin('>=', l, r)
export const and = (l: Expr, r: Expr) => bin('and', l, r)
export const or = (l: Expr, r: Expr) => bin('or', l, r)
export const neg = (e: Expr): Expr => ({ k: 'neg', e })
export const not = (e: Expr): Expr => ({ k: 'not', e })
export const pow = (base: Expr, exp: Expr): Expr => ({ k: 'pow', base, exp })
export const math = (fn: MathFn, arg: Expr): Expr => ({ k: 'math', fn, arg })
export const pi: Expr = { k: 'const', name: 'pi' }
export const euler: Expr = { k: 'const', name: 'e' }
export const toF = (e: Expr): Expr => ({ k: 'toFloat', e })
export const len = (list: string): Expr => ({ k: 'len', list })
export const at = (list: string, index: Expr): Expr => ({ k: 'at', list, index })
export const concat = (l: Expr, r: Expr): Expr => ({ k: 'concat', l, r })
export const slice = (str: string, from: Expr, to: Expr): Expr => ({ k: 'slice', str, from, to })
export const call = (fn: string, ...args: Expr[]): Expr => ({ k: 'call', fn, args })

export const let_ = (name: string, type: Scalar, value: Expr, meta: Meta = {}): Stmt => ({ k: 'let', name, type, value, ...meta })
export const set = (name: string, value: Expr, meta: Meta = {}): Stmt => ({ k: 'set', name, value, ...meta })
export const copy = (name: string, type: ListType, from: string, meta: Meta = {}): Stmt => ({ k: 'copy', name, type, from, ...meta })
export const alloc = (name: string, type: ListType, len: Expr, fill: Expr, meta: Meta = {}): Stmt => ({ k: 'alloc', name, type, len, fill, ...meta })
export const setAt = (list: string, index: Expr, value: Expr, meta: Meta = {}): Stmt => ({ k: 'setAt', list, index, value, ...meta })
export const if_ = (cond: Expr, then: Stmt[], els?: Stmt[], meta: Meta = {}): Stmt => ({ k: 'if', cond, then, else: els, ...meta })
export const for_ = (name: string, from: Expr, to: Expr, body: Stmt[], meta: Meta = {}): Stmt => ({ k: 'for', name, from, to, body, ...meta })
export const each = (name: string, list: string, body: Stmt[], meta: Meta = {}): Stmt => ({ k: 'each', name, list, body, ...meta })
export const while_ = (cond: Expr, body: Stmt[], meta: Meta = {}): Stmt => ({ k: 'while', cond, body, ...meta })
export const ret = (value: Expr, meta: Meta = {}): Stmt => ({ k: 'return', value, ...meta })
export const fail = (message: string, meta: Meta = {}): Stmt => ({ k: 'fail', message, ...meta })

// ---------- Validación de tipos ----------

export class IRError extends Error {}

type Env = Map<string, Type>

function fnOf(p: Program, name: string): Fn {
  const f = p.fns.find((x) => x.name === name)
  if (!f) throw new IRError(`Función desconocida: ${name}`)
  return f
}

export function typeOf(e: Expr, env: Env, p: Program): Type {
  switch (e.k) {
    case 'int':
      if (!Number.isSafeInteger(e.v)) throw new IRError(`Entero fuera de rango: ${e.v}`)
      return 'int'
    case 'float':
      if (!Number.isFinite(e.v)) throw new IRError('Literal real no finito')
      return 'float'
    case 'bool':
      return 'bool'
    case 'str':
      return 'str'
    case 'var': {
      const t = env.get(e.name)
      if (!t) throw new IRError(`Variable no declarada: ${e.name}`)
      return t
    }
    case 'neg': {
      const t = typeOf(e.e, env, p)
      if (t !== 'int' && t !== 'float') throw new IRError('El signo menos requiere un número')
      return t
    }
    case 'not':
      if (typeOf(e.e, env, p) !== 'bool') throw new IRError('NO requiere un booleano')
      return 'bool'
    case 'pow':
      if (typeOf(e.base, env, p) !== 'float' || typeOf(e.exp, env, p) !== 'float') throw new IRError('La potencia opera con reales')
      return 'float'
    case 'math':
      if (typeOf(e.arg, env, p) !== 'float') throw new IRError(`${e.fn} requiere un real`)
      return 'float'
    case 'const':
      return 'float'
    case 'toFloat':
      if (typeOf(e.e, env, p) !== 'int') throw new IRError('Solo se convierten enteros a real')
      return 'float'
    case 'len': {
      const t = env.get(e.list)
      if (t === 'str' || isList(t ?? 'int')) return 'int'
      throw new IRError(`${e.list} no es una lista ni un texto`)
    }
    case 'at': {
      const t = env.get(e.list)
      if (typeOf(e.index, env, p) !== 'int') throw new IRError('El índice debe ser entero')
      if (t === 'str') return 'str'
      if (!t || !isList(t)) throw new IRError(`${e.list} no es una lista ni un texto`)
      return elemOf(t)
    }
    case 'concat':
      if (typeOf(e.l, env, p) !== 'str' || typeOf(e.r, env, p) !== 'str') throw new IRError('La concatenación opera con textos')
      return 'str'
    case 'slice':
      if (env.get(e.str) !== 'str') throw new IRError(`${e.str} no es un texto`)
      if (typeOf(e.from, env, p) !== 'int' || typeOf(e.to, env, p) !== 'int') throw new IRError('El recorte usa índices enteros')
      return 'str'
    case 'call': {
      const f = fnOf(p, e.fn)
      if (f.fallible) throw new IRError(`No se admite llamar a la función falible ${f.name} dentro de una expresión`)
      if (f.params.length !== e.args.length) throw new IRError(`Cantidad de argumentos incorrecta para ${f.name}`)
      e.args.forEach((a, i) => {
        if (typeOf(a, env, p) !== f.params[i]?.type) throw new IRError(`Argumento ${i + 1} de ${f.name} con tipo incorrecto`)
      })
      return f.returns
    }
    case 'bin': {
      const l = typeOf(e.l, env, p)
      const r = typeOf(e.r, env, p)
      if (e.op === 'and' || e.op === 'or') {
        if (l !== 'bool' || r !== 'bool') throw new IRError(`${e.op} requiere booleanos`)
        return 'bool'
      }
      if (l !== r) throw new IRError(`Operandos de distinto tipo en ${e.op}: ${l} y ${r} (falta una conversión explícita)`)
      if (e.op === '==' || e.op === '!=') {
        if (isList(l)) throw new IRError('No se comparan listas')
        return 'bool'
      }
      if (l !== 'int' && l !== 'float') throw new IRError(`${e.op} requiere números`)
      if (e.op === '<' || e.op === '<=' || e.op === '>' || e.op === '>=') return 'bool'
      if (e.op === '/' && l !== 'float') throw new IRError('La división real requiere reales; usá // para la división entera')
      if ((e.op === '//' || e.op === '%') && l !== 'int') throw new IRError(`${e.op} requiere enteros`)
      return l
    }
  }
}

/** Una lista de instrucciones termina si su último paso devuelve, falla o es un SI con ambas ramas terminales. */
export function terminates(body: Stmt[]): boolean {
  const last = body[body.length - 1]
  if (!last) return false
  if (last.k === 'return' || last.k === 'fail') return true
  if (last.k === 'if') return !!last.else && terminates(last.then) && terminates(last.else)
  return false
}

export function assignedVars(body: Stmt[], out = new Set<string>()): Set<string> {
  for (const s of body) {
    if (s.k === 'set') out.add(s.name)
    if (s.k === 'setAt') out.add(s.list)
    if (s.k === 'if') {
      assignedVars(s.then, out)
      if (s.else) assignedVars(s.else, out)
    }
    if (s.k === 'for' || s.k === 'each' || s.k === 'while') assignedVars(s.body, out)
  }
  return out
}

function exprUses(e: Expr, name: string): boolean {
  switch (e.k) {
    case 'var':
      return e.name === name
    case 'len':
      return e.list === name
    case 'at':
      return e.list === name || exprUses(e.index, name)
    case 'concat':
      return exprUses(e.l, name) || exprUses(e.r, name)
    case 'slice':
      return e.str === name || exprUses(e.from, name) || exprUses(e.to, name)
    case 'bin':
      return exprUses(e.l, name) || exprUses(e.r, name)
    case 'neg':
    case 'not':
    case 'toFloat':
      return exprUses(e.e, name)
    case 'pow':
      return exprUses(e.base, name) || exprUses(e.exp, name)
    case 'math':
      return exprUses(e.arg, name)
    case 'call':
      return e.args.some((a) => exprUses(a, name))
    default:
      return false
  }
}

/** Si alguna instrucción lee la variable (para nombrar `_` a contadores que no se usan). */
export function usesVar(body: Stmt[], name: string): boolean {
  return body.some((s) => {
    switch (s.k) {
      case 'let':
      case 'set':
      case 'return':
        return exprUses(s.value, name)
      case 'if':
        return exprUses(s.cond, name) || usesVar(s.then, name) || (!!s.else && usesVar(s.else, name))
      case 'for':
        return exprUses(s.from, name) || exprUses(s.to, name) || usesVar(s.body, name)
      case 'each':
        return s.list === name || usesVar(s.body, name)
      case 'while':
        return exprUses(s.cond, name) || usesVar(s.body, name)
      case 'copy':
        return s.from === name
      case 'alloc':
        return exprUses(s.len, name) || exprUses(s.fill, name)
      case 'setAt':
        return s.list === name || exprUses(s.index, name) || exprUses(s.value, name)
      default:
        return false
    }
  })
}

const NAME = /^[a-z][a-zA-Z0-9]*$/

function checkBody(body: Stmt[], env: Env, fn: Fn, p: Program, params: Set<string>) {
  const scope = new Map(env)
  for (const s of body) {
    switch (s.k) {
      case 'let':
        if (!NAME.test(s.name)) throw new IRError(`Nombre inválido: ${s.name}`)
        if (scope.has(s.name)) throw new IRError(`Variable redeclarada: ${s.name}`)
        if (typeOf(s.value, scope, p) !== s.type) throw new IRError(`Tipo incorrecto al declarar ${s.name}`)
        scope.set(s.name, s.type)
        break
      case 'copy': {
        if (!NAME.test(s.name)) throw new IRError(`Nombre inválido: ${s.name}`)
        if (scope.has(s.name)) throw new IRError(`Variable redeclarada: ${s.name}`)
        if (params.has(s.from)) {
          /* se copia un parámetro: válido */
        }
        const src = scope.get(s.from)
        if (src !== s.type) throw new IRError(`No se puede copiar ${s.from} como ${s.type}`)
        scope.set(s.name, s.type)
        break
      }
      case 'alloc': {
        if (!NAME.test(s.name)) throw new IRError(`Nombre inválido: ${s.name}`)
        if (scope.has(s.name)) throw new IRError(`Variable redeclarada: ${s.name}`)
        if (typeOf(s.len, scope, p) !== 'int') throw new IRError('La longitud de alloc debe ser entera')
        if (typeOf(s.fill, scope, p) !== elemOf(s.type)) throw new IRError(`Tipo incorrecto al rellenar ${s.name}`)
        scope.set(s.name, s.type)
        break
      }
      case 'setAt': {
        if (params.has(s.list)) throw new IRError(`No se muta el parámetro ${s.list}; copiá la lista antes`)
        const t = scope.get(s.list)
        if (!t || !isList(t)) throw new IRError(`${s.list} no es una lista local`)
        if (typeOf(s.index, scope, p) !== 'int') throw new IRError('El índice de asignación debe ser entero')
        if (typeOf(s.value, scope, p) !== elemOf(t)) throw new IRError(`Tipo incorrecto al escribir ${s.list}[i]`)
        break
      }
      case 'set': {
        if (params.has(s.name)) throw new IRError(`No se reasignan parámetros (${s.name}); usá una variable local`)
        const t = scope.get(s.name)
        if (!t) throw new IRError(`Asignación a variable no declarada: ${s.name}`)
        if (typeOf(s.value, scope, p) !== t) throw new IRError(`Tipo incorrecto al asignar ${s.name}`)
        break
      }
      case 'if':
        if (typeOf(s.cond, scope, p) !== 'bool') throw new IRError('La condición debe ser booleana')
        checkBody(s.then, scope, fn, p, params)
        if (s.else) checkBody(s.else, scope, fn, p, params)
        break
      case 'for': {
        if (scope.has(s.name)) throw new IRError(`Variable redeclarada: ${s.name}`)
        if (typeOf(s.from, scope, p) !== 'int' || typeOf(s.to, scope, p) !== 'int') throw new IRError('Los límites del PARA deben ser enteros')
        const inner = new Map(scope).set(s.name, 'int')
        checkBody(s.body, inner, fn, p, new Set([...params, s.name]))
        break
      }
      case 'each': {
        const t = scope.get(s.list)
        if (t === 'str') {
          if (scope.has(s.name)) throw new IRError(`Variable redeclarada: ${s.name}`)
          const inner = new Map(scope).set(s.name, 'str' as const)
          checkBody(s.body, inner, fn, p, new Set([...params, s.name]))
          break
        }
        if (!t || !isList(t)) throw new IRError(`${s.list} no es una lista`)
        if (scope.has(s.name)) throw new IRError(`Variable redeclarada: ${s.name}`)
        const inner = new Map(scope).set(s.name, elemOf(t))
        checkBody(s.body, inner, fn, p, new Set([...params, s.name]))
        break
      }
      case 'while':
        if (typeOf(s.cond, scope, p) !== 'bool') throw new IRError('La condición debe ser booleana')
        checkBody(s.body, scope, fn, p, params)
        break
      case 'return':
        if (typeOf(s.value, scope, p) !== fn.returns) throw new IRError(`${fn.name} devuelve ${fn.returns}`)
        break
      case 'fail':
        if (!fn.fallible) throw new IRError(`${fn.name} no está marcada como falible`)
        break
    }
  }
}

export function validateProgram(p: Program): void {
  const seen = new Set<string>()
  for (const f of p.fns) {
    if (!NAME.test(f.name) || seen.has(f.name)) throw new IRError(`Nombre de función inválido o repetido: ${f.name}`)
    seen.add(f.name)
    const env: Env = new Map()
    for (const prm of f.params) {
      if (!NAME.test(prm.name) || env.has(prm.name)) throw new IRError(`Parámetro inválido: ${prm.name}`)
      env.set(prm.name, prm.type)
    }
    checkBody(f.body, env, f, p, new Set(env.keys()))
    if (!terminates(f.body)) throw new IRError(`${f.name} debe terminar con DEVOLVER o ERROR en todos los caminos`)
  }
  if (!seen.has(p.entry)) throw new IRError('Falta la función principal')
}

// ---------- Características usadas (para imports y explicaciones) ----------

export type Feature =
  | 'list'
  | 'math'
  | 'pow'
  | 'const'
  | 'fallible'
  | 'recursion'
  | 'str'
  | 'bool'
  | 'idiv'
  | 'mod'
  | 'toFloat'
  | 'for'
  | 'each'
  | 'while'
  | 'index'
  | 'floatDiv'
  | 'int'
  | 'float'
  | 'helper'
  | 'setAt'
  | 'listCopy'
  | 'listAlloc'
  | 'listRet'
  | 'concat'
  | 'slice'

export function features(p: Program): Set<Feature> {
  const f = new Set<Feature>()
  const ex = (e: Expr, self: string) => {
    switch (e.k) {
      case 'int':
        f.add('int')
        break
      case 'float':
        f.add('float')
        break
      case 'str':
        f.add('str')
        break
      case 'bool':
        f.add('bool')
        break
      case 'bin':
        if (e.op === '//') f.add('idiv')
        if (e.op === '%') f.add('mod')
        if (e.op === '/') f.add('floatDiv')
        ex(e.l, self)
        ex(e.r, self)
        break
      case 'neg':
      case 'not':
      case 'toFloat':
        if (e.k === 'toFloat') f.add('toFloat')
        ex(e.e, self)
        break
      case 'pow':
        f.add('pow').add('math')
        ex(e.base, self)
        ex(e.exp, self)
        break
      case 'math':
        f.add('math')
        ex(e.arg, self)
        break
      case 'const':
        f.add('const').add('math')
        break
      case 'at':
        f.add('index')
        ex(e.index, self)
        break
      case 'concat':
        f.add('concat').add('str')
        ex(e.l, self)
        ex(e.r, self)
        break
      case 'slice':
        f.add('slice').add('str')
        ex(e.from, self)
        ex(e.to, self)
        break
      case 'call':
        if (e.fn === self) f.add('recursion')
        e.args.forEach((a) => ex(a, self))
        break
    }
  }
  const st = (b: Stmt[], self: string) => {
    for (const s of b) {
      if (s.k === 'let' || s.k === 'set' || s.k === 'return') ex(s.value, self)
      if (s.k === 'let' && s.type === 'float') f.add('float')
      if (s.k === 'copy') f.add('listCopy').add('list')
      if (s.k === 'alloc') {
        f.add('listAlloc').add('list')
        ex(s.len, self)
        ex(s.fill, self)
      }
      if (s.k === 'setAt') {
        f.add('setAt')
        ex(s.index, self)
        ex(s.value, self)
      }
      if (s.k === 'if') {
        ex(s.cond, self)
        st(s.then, self)
        if (s.else) st(s.else, self)
      }
      if (s.k === 'for') {
        f.add('for')
        ex(s.from, self)
        ex(s.to, self)
        st(s.body, self)
      }
      if (s.k === 'each') {
        f.add('each')
        st(s.body, self)
      }
      if (s.k === 'while') {
        f.add('while')
        ex(s.cond, self)
        st(s.body, self)
      }
    }
  }
  for (const fn of p.fns) {
    if (fn.fallible) f.add('fallible')
    if (fn.returns === 'str') f.add('str')
    if (fn.returns === 'bool') f.add('bool')
    if (fn.params.some((x) => isList(x.type))) f.add('list')
    if (isList(fn.returns)) f.add('listRet').add('list')
    if (fn.name !== p.entry) f.add('helper')
    st(fn.body, fn.name)
  }
  return f
}

export const entryFn = (p: Program): Fn => fnOf(p, p.entry)
