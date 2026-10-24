import { isList, type Expr, type Fn, type Program, type Stmt, type Type, type Value } from './ir'

/**
 * Intérprete de la IR. Ejecuta únicamente programas construidos por Dev Lab (no evalúa texto
 * ni código del usuario), con un límite de pasos para cortar bucles demasiado largos.
 */

export class DevFail extends Error {}
class RuntimeFault extends Error {}
class Returned {
  constructor(public value: Value) {}
}

const STEP_LIMIT = 20_000_000
const DEPTH_LIMIT = 2_000
const ALLOC_MAX = 400_001

export type RunResult = { ok: true; value: Value; steps: number } | { ok: false; error: string; runtime: boolean; steps: number }

export function runProgram(p: Program, args: Value[]): RunResult {
  let steps = 0
  let depth = 0
  const tick = () => {
    if (++steps > STEP_LIMIT) throw new RuntimeFault('Se superó el límite de pasos de ejecución')
  }
  const fns = new Map(p.fns.map((f) => [f.name, f]))

  const ev = (e: Expr, env: Map<string, Value>): Value => {
    tick()
    switch (e.k) {
      case 'int':
      case 'float':
      case 'bool':
      case 'str':
        return e.v
      case 'var':
        return env.get(e.name) as Value
      case 'neg':
        return -(ev(e.e, env) as number)
      case 'not':
        return !ev(e.e, env)
      case 'const':
        return e.name === 'pi' ? Math.PI : Math.E
      case 'toFloat':
        return ev(e.e, env)
      case 'len': {
        const v = env.get(e.list)
        return typeof v === 'string' ? [...v].length : (v as number[]).length
      }
      case 'at': {
        const xs = env.get(e.list)
        const i = ev(e.index, env) as number
        if (typeof xs === 'string') {
          const chars = [...xs]
          if (i < 0 || i >= chars.length) throw new RuntimeFault(`Índice fuera de rango: ${i}`)
          return chars[i]!
        }
        const list = xs as number[]
        if (i < 0 || i >= list.length) throw new RuntimeFault(`Índice fuera de rango: ${i}`)
        return list[i]!
      }
      case 'concat':
        return `${ev(e.l, env) as string}${ev(e.r, env) as string}`
      case 'slice': {
        const chars = [...(env.get(e.str) as string)]
        const from = ev(e.from, env) as number
        const to = ev(e.to, env) as number
        if (from < 0 || to < from || to > chars.length) throw new RuntimeFault(`Recorte fuera de rango: ${from}..${to}`)
        return chars.slice(from, to).join('')
      }
      case 'pow':
        return Math.pow(ev(e.base, env) as number, ev(e.exp, env) as number)
      case 'math': {
        const x = ev(e.arg, env) as number
        if (e.fn === 'ceil') return Math.ceil(x)
        if (e.fn === 'round') return x >= 0 ? Math.floor(x + 0.5) : Math.ceil(x - 0.5)
        const m = { sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor, sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, ln: Math.log, log10: Math.log10 }
        return m[e.fn](x)
      }
      case 'call':
        return callFn(fns.get(e.fn)!, e.args.map((a) => ev(a, env)))
      case 'bin': {
        if (e.op === 'and') return (ev(e.l, env) as boolean) && (ev(e.r, env) as boolean)
        if (e.op === 'or') return (ev(e.l, env) as boolean) || (ev(e.r, env) as boolean)
        if (e.op === '==' || e.op === '!=') {
          const a = ev(e.l, env)
          const b = ev(e.r, env)
          return e.op === '==' ? a === b : a !== b
        }
        const l = ev(e.l, env) as number
        const r = ev(e.r, env) as number
        switch (e.op) {
          case '+':
            return l + r
          case '-':
            return l - r
          case '*':
            return l * r
          case '/':
            return l / r
          case '//':
            if (r === 0) throw new RuntimeFault('División entera por cero')
            return Math.trunc(l / r)
          case '%':
            if (r === 0) throw new RuntimeFault('Módulo por cero')
            return l % r
          case '<':
            return l < r
          case '<=':
            return l <= r
          case '>':
            return l > r
          case '>=':
            return l >= r
        }
      }
    }
  }

  const exec = (body: Stmt[], env: Map<string, Value>) => {
    const declared: string[] = []
    try {
      for (const s of body) {
        tick()
        switch (s.k) {
          case 'let':
            env.set(s.name, ev(s.value, env))
            declared.push(s.name)
            break
          case 'copy': {
            const src = env.get(s.from) as number[]
            env.set(s.name, src.slice())
            declared.push(s.name)
            break
          }
          case 'alloc': {
            const n = ev(s.len, env) as number
            if (!Number.isSafeInteger(n) || n < 0 || n > ALLOC_MAX) throw new RuntimeFault(`Longitud de reserva inválida: ${n}`)
            const fill = ev(s.fill, env) as number
            env.set(s.name, Array.from({ length: n }, () => fill))
            declared.push(s.name)
            break
          }
          case 'setAt': {
            const xs = env.get(s.list) as number[]
            const i = ev(s.index, env) as number
            if (i < 0 || i >= xs.length) throw new RuntimeFault(`Índice fuera de rango: ${i}`)
            xs[i] = ev(s.value, env) as number
            break
          }
          case 'set':
            env.set(s.name, ev(s.value, env))
            break
          case 'if':
            if (ev(s.cond, env)) exec(s.then, env)
            else if (s.else) exec(s.else, env)
            break
          case 'for': {
            const from = ev(s.from, env) as number
            const to = ev(s.to, env) as number
            for (let i = from; i <= to; i++) {
              env.set(s.name, i)
              exec(s.body, env)
            }
            env.delete(s.name)
            break
          }
          case 'each': {
            const src = env.get(s.list)
            const items = typeof src === 'string' ? [...src] : (src as number[])
            for (const x of items) {
              env.set(s.name, x)
              exec(s.body, env)
            }
            env.delete(s.name)
            break
          }
          case 'while':
            while (ev(s.cond, env)) exec(s.body, env)
            break
          case 'return':
            throw new Returned(ev(s.value, env))
          case 'fail':
            throw new DevFail(s.message)
        }
      }
    } finally {
      for (const d of declared) env.delete(d)
    }
  }

  const callFn = (f: Fn, values: Value[]): Value => {
    if (++depth > DEPTH_LIMIT) throw new RuntimeFault('Se superó la profundidad máxima de recursión')
    const env = new Map<string, Value>()
    f.params.forEach((prm, i) => env.set(prm.name, values[i]!))
    try {
      exec(f.body, env)
    } catch (r) {
      if (r instanceof Returned) return r.value
      throw r
    } finally {
      depth--
    }
    throw new RuntimeFault(`${f.name} terminó sin devolver un valor`)
  }

  try {
    const value = callFn(fns.get(p.entry)!, args)
    return { ok: true, value, steps }
  } catch (e) {
    if (e instanceof DevFail) return { ok: false, error: e.message, runtime: false, steps }
    if (e instanceof RuntimeFault) return { ok: false, error: e.message, runtime: true, steps }
    throw e
  }
}

// ---------- Utilidades de valores ----------

export function formatNumber(v: number, type: Type = 'float'): string {
  if (type === 'int') return String(v)
  if (Number.isNaN(v)) return 'NaN'
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '-∞'
  const r = Number(v.toPrecision(12))
  if (Object.is(r, -0)) return '0'
  return String(r)
}

export function formatValue(v: Value, type?: Type): string {
  if (Array.isArray(v)) return `[${v.map((x) => formatNumber(x, type === 'int[]' ? 'int' : 'float')).join(', ')}]`
  if (typeof v === 'number') return formatNumber(v, type)
  if (typeof v === 'string') return `"${v}"`
  return v ? 'verdadero' : 'falso'
}

export function sameValue(a: Value, b: Value): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isInteger(a) && Number.isInteger(b)) return a === b
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
  }
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameValue(x, b[i]!))
  return a === b
}

/** Convierte texto ingresado por el usuario al tipo de un parámetro. */
export function parseArg(text: string, type: Type): Value {
  const t = text.trim()
  const num = (s: string, asInt: boolean) => {
    const n = Number(s.trim())
    if (s.trim() === '' || !Number.isFinite(n)) throw new Error(`"${s.trim()}" no es un número`)
    if (asInt && !Number.isSafeInteger(n)) throw new Error(`"${s.trim()}" no es un entero`)
    return n
  }
  if (isList(type)) {
    const inner = t.replace(/^[[(]|[\])]$/g, '').trim()
    return inner ? inner.split(/[,;\s]+/).filter(Boolean).map((x) => num(x, type === 'int[]')) : []
  }
  if (type === 'int' || type === 'float') return num(t, type === 'int')
  if (type === 'bool') return /^(true|verdadero|1|si|sí)$/i.test(t)
  return t
}
