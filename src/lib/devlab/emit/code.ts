import { assignedVars, elemOf, elseIfOf, entryFn, le, ref, usesVar, isList, type BinOp, type Expr, type Fn, type ListType, type MathFn, type Program, type Scalar, type Stmt, type Type, type Value } from '../ir'
import { formatNumber } from '../interpreter'
import type { TestCase } from '../types'

export const CODE_LANGS = ['python', 'javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php'] as const
export type CodeLang = (typeof CODE_LANGS)[number]

export interface GeneratedCode {
  code: string
  fileName: string
}

type Code = { s: string; p: number }
const ATOM = 9
const atom = (s: string): Code => ({ s, p: ATOM })

const words = (n: string) => n.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(' ')
export const snake = (n: string) => words(n).join('_')
export const pascal = (n: string) => words(n).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')

const PREC: Record<Exclude<BinOp, '//'>, number> = { or: 1, and: 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 }
const isCmp = (op: BinOp) => ['==', '!=', '<', '<=', '>', '>='].includes(op)

/** Etiqueta neutral de una llamada de prueba, idéntica en todos los lenguajes. */
export function testLabel(fnName: string, args: Value[], types: Type[]): string {
  const a = args.map((v, i) => (Array.isArray(v) ? `[${v.map((x) => formatNumber(x, types[i] === 'int[]' ? 'int' : 'float')).join(', ')}]` : typeof v === 'number' ? formatNumber(v, types[i]) : String(v)))
  return `${fnName}(${a.join(', ')})`
}

abstract class Emitter {
  protected out: string[] = []
  protected depth = 0
  protected uses = new Set<string>()
  protected fn!: Fn
  protected mutable = new Set<string>()
  abstract readonly indentUnit: string
  protected semi = ';'
  protected allmanCtrl = false
  protected elseIf = 'else if'

  constructor(
    protected p: Program,
    protected tests: TestCase[],
  ) {}

  protected line(s = '') {
    this.out.push(s ? this.indentUnit.repeat(this.depth) + s : '')
  }

  // ---- nombres ----
  protected varName(n: string) {
    return n
  }
  protected fnName(n: string) {
    return n
  }

  // ---- literales ----
  protected intLit(v: number) {
    return String(v)
  }
  protected floatLit(v: number) {
    const s = String(v)
    return Number.isInteger(v) && !/e/i.test(s) ? `${s}.0` : s
  }
  protected strLit(s: string) {
    return JSON.stringify(s)
  }
  protected boolLit(b: boolean): string {
    return b ? 'true' : 'false'
  }
  protected op(op: BinOp): string {
    return op === 'and' ? '&&' : op === 'or' ? '||' : op
  }

  // ---- expresiones ----
  protected paren(c: Code, min: number, right = false, cmp = false): string {
    const need = c.p < min || (right && c.p === min) || (cmp && c.p >= 3 && c.p <= 4) || (right && c.s.startsWith('-'))
    return need ? `(${c.s})` : c.s
  }
  protected wrap(e: Expr, min: number) {
    return this.paren(this.expr(e), min)
  }

  expr(e: Expr): Code {
    switch (e.k) {
      case 'int':
        return { s: this.intLit(e.v), p: e.v < 0 ? 7 : ATOM }
      case 'float':
        return { s: this.floatLit(e.v), p: e.v < 0 ? 7 : ATOM }
      case 'bool':
        return atom(this.boolLit(e.v))
      case 'str':
        return atom(this.strLit(e.v))
      case 'var':
        return atom(this.varName(e.name))
      case 'neg':
        return { s: `-${this.wrap(e.e, 8)}`, p: 7 }
      case 'not':
        return { s: `!${this.wrap(e.e, 8)}`, p: 7 }
      case 'pow':
        return this.powExpr(e.base, e.exp)
      case 'math':
        return this.mathExpr(e.fn, e.arg)
      case 'const':
        return atom(this.constant(e.name))
      case 'toFloat':
        return this.toFloat(e.e)
      case 'len':
        return this.lenExpr(e.list)
      case 'at':
        return this.atExpr(e.list, e.index)
      case 'call':
        return atom(`${this.fnName(e.fn)}(${e.args.map((a) => this.expr(a).s).join(', ')})`)
      case 'bin': {
        if (e.op === '//') return this.idivExpr(e.l, e.r)
        const p = PREC[e.op]
        const cmp = isCmp(e.op)
        return { s: `${this.paren(this.expr(e.l), p, false, cmp)} ${this.op(e.op)} ${this.paren(this.expr(e.r), p, true, cmp)}`, p }
      }
    }
  }

  protected idivExpr(l: Expr, r: Expr): Code {
    return { s: `${this.wrap(l, 6)} / ${this.paren(this.expr(r), 6, true)}`, p: 6 }
  }
  protected abstract powExpr(b: Expr, x: Expr): Code
  protected abstract mathExpr(fn: MathFn, arg: Expr): Code
  protected abstract constant(name: 'pi' | 'e'): string
  protected abstract toFloat(e: Expr): Code
  protected abstract lenExpr(list: string): Code
  protected atExpr(list: string, index: Expr): Code {
    return atom(`${this.varName(list)}[${this.expr(index).s}]`)
  }

  // ---- bloques ----
  protected open(header: string, allman = this.allmanCtrl) {
    if (allman) {
      this.line(header)
      this.line('{')
    } else this.line(`${header} {`)
    this.depth++
  }
  protected mid(header: string) {
    this.depth--
    if (this.allmanCtrl) {
      this.line('}')
      this.line(header)
      this.line('{')
    } else this.line(`} ${header} {`)
    this.depth++
  }
  protected close() {
    this.depth--
    this.line('}')
  }
  protected comment(text: string) {
    this.line(`// ${text}`)
  }

  protected cond(c: Expr) {
    return `(${this.expr(c).s})`
  }
  protected abstract declare(name: string, type: Scalar, value: string): string
  protected abstract forHead(name: string, from: string, to: string, used: boolean, loop: Extract<Stmt, { k: 'for' }>): string
  protected abstract eachHead(name: string, list: string, elem: 'int' | 'float'): { head: string; prelude?: string }
  protected whileHead(c: Expr) {
    return `while ${this.cond(c)}`
  }
  protected abstract returnStmt(value: string, tail: boolean): string[]
  protected abstract failStmt(message: string, tail: boolean): string[]

  protected body(stmts: Stmt[], top = false) {
    stmts.forEach((s, i) => this.stmt(s, top && i === stmts.length - 1))
  }

  protected stmt(s: Stmt, tail: boolean) {
    if (s.note) this.comment(s.note)
    switch (s.k) {
      case 'let':
        this.line(this.declare(s.name, s.type, this.expr(s.value).s))
        break
      case 'set':
        this.line(`${this.varName(s.name)} = ${this.expr(s.value).s}${this.semi}`)
        break
      case 'if': {
        this.open(`if ${this.cond(s.cond)}`)
        this.body(s.then)
        let els = s.else
        for (let e = elseIfOf(els); e; e = elseIfOf(els)) {
          this.mid(`${this.elseIf} ${this.cond(e.cond)}`)
          this.body(e.then)
          els = e.else
        }
        if (els) {
          this.mid('else')
          this.body(els)
        }
        this.close()
        break
      }
      case 'for':
        this.open(this.forHead(s.name, this.expr(s.from).s, this.expr(s.to).s, usesVar(s.body, s.name), s))
        this.body(s.body)
        this.close()
        break
      case 'each': {
        const t = this.listType(s.list)
        const { head, prelude } = this.eachHead(s.name, s.list, elemOf(t))
        this.open(head)
        if (prelude) this.line(prelude)
        this.body(s.body)
        this.close()
        break
      }
      case 'while':
        this.open(this.whileHead(s.cond))
        this.body(s.body)
        this.close()
        break
      case 'return':
        this.returnStmt(this.expr(s.value).s, tail).forEach((l) => this.line(l))
        break
      case 'fail':
        this.failStmt(s.message, tail).forEach((l) => this.line(l))
        break
    }
  }

  protected listType(name: string): ListType {
    const t = this.fn.params.find((x) => x.name === name)?.type
    if (!t || !isList(t)) throw new Error(`${name} no es una lista`)
    return t
  }

  // ---- programa ----
  protected abstract fnDecl(f: Fn): void
  protected abstract mainFn(): void
  protected abstract prelude(): string[]
  protected postlude(): string[] {
    return []
  }
  abstract fileName(): string

  protected emitFn(f: Fn) {
    this.fn = f
    this.mutable = assignedVars(f.body)
    this.fnDecl(f)
  }

  protected fnBody(f: Fn) {
    this.body(f.body, true)
  }

  /** Argumento literal en una llamada de prueba. */
  protected abstract arg(v: Value, t: Type): string
  protected callArgs(t: TestCase) {
    const fn = entryFn(this.p)
    return t.args.map((v, i) => this.arg(v, fn.params[i]!.type)).join(', ')
  }
  protected label(t: TestCase) {
    const fn = entryFn(this.p)
    return testLabel(this.fnName(fn.name), t.args, fn.params.map((x) => x.type))
  }
  protected numArg(v: number, t: Type) {
    const c = t === 'int' ? this.intLit(v) : this.floatLit(v)
    return c
  }

  generate(): GeneratedCode {
    this.p.fns.forEach((f, i) => {
      if (i > 0) this.line()
      this.emitFn(f)
    })
    this.line()
    this.mainFn()
    const pre = this.prelude()
    const code = [...pre, ...this.out, ...this.postlude()].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
    return { code, fileName: this.fileName() }
  }
}

// ======================= Python =======================

class PythonEmitter extends Emitter {
  indentUnit = '    '
  semi = ''
  elseIf = 'elif'
  protected varName(n: string) {
    return snake(n)
  }
  protected fnName(n: string) {
    return snake(n)
  }
  protected boolLit(b: boolean) {
    return b ? 'True' : 'False'
  }
  protected op(op: BinOp) {
    return op
  }
  protected open(header: string) {
    this.line(`${header}:`)
    this.depth++
  }
  protected mid(header: string) {
    this.depth--
    this.line(`${header}:`)
    this.depth++
  }
  protected close() {
    this.depth--
  }
  protected comment(text: string) {
    this.line(`# ${text}`)
  }
  protected cond(c: Expr) {
    return this.expr(c).s
  }
  expr(e: Expr): Code {
    if (e.k === 'not') return { s: `not ${this.wrap(e.e, 3)}`, p: 2.5 }
    return super.expr(e)
  }
  protected idivExpr(l: Expr, r: Expr): Code {
    return { s: `${this.wrap(l, 6)} // ${this.paren(this.expr(r), 6, true)}`, p: 6 }
  }
  protected powExpr(b: Expr, x: Expr): Code {
    return { s: `${this.wrap(b, ATOM)} ** ${this.wrap(x, ATOM)}`, p: 8 }
  }
  protected mathExpr(fn: MathFn, arg: Expr): Code {
    if (fn === 'abs') return atom(`abs(${this.expr(arg).s})`)
    this.uses.add('math')
    const name = { sqrt: 'sqrt', floor: 'floor', sin: 'sin', cos: 'cos', tan: 'tan', exp: 'exp', ln: 'log', log10: 'log10' }[fn]
    return atom(`math.${name}(${this.expr(arg).s})`)
  }
  protected constant(name: 'pi' | 'e') {
    this.uses.add('math')
    return `math.${name}`
  }
  protected toFloat(e: Expr) {
    return atom(`float(${this.expr(e).s})`)
  }
  protected lenExpr(list: string) {
    return atom(`len(${this.varName(list)})`)
  }
  protected declare(name: string, _t: Scalar, value: string) {
    return `${this.varName(name)} = ${value}`
  }
  protected forHead(name: string, from: string, to: string, used: boolean) {
    return `for ${used ? this.varName(name) : '_'} in range(${from}, ${/^\d+$/.test(to) ? Number(to) + 1 : `${to} + 1`})`
  }
  protected eachHead(name: string, list: string) {
    return { head: `for ${this.varName(name)} in ${this.varName(list)}` }
  }
  protected whileHead(c: Expr) {
    return `while ${this.expr(c).s}`
  }
  protected returnStmt(v: string) {
    return [`return ${v}`]
  }
  protected failStmt(m: string) {
    return [`raise ValueError(${this.strLit(m)})`]
  }
  private ty(t: Type) {
    return { int: 'int', float: 'float', bool: 'bool', str: 'str', 'int[]': 'list[int]', 'float[]': 'list[float]' }[t]
  }
  protected fnDecl(f: Fn) {
    const params = f.params.map((x) => `${this.varName(x.name)}: ${this.ty(x.type)}`).join(', ')
    this.line(`def ${this.fnName(f.name)}(${params}) -> ${this.ty(f.returns)}:`)
    this.depth++
    this.line(`"""${f.doc}`)
    this.line()
    if (f.params.length) {
      this.line('Args:')
      f.params.forEach((x) => this.line(`    ${this.varName(x.name)}: ${x.doc}`))
      this.line()
    }
    this.line('Returns:')
    this.line(`    ${f.returnsDoc}`)
    if (f.fallible) {
      this.line()
      this.line('Raises:')
      this.line(`    ValueError: ${f.failsDoc ?? 'si los datos no son válidos.'}`)
    }
    this.line('"""')
    this.fnBody(f)
    this.depth--
    this.line()
  }
  protected arg(v: Value, t: Type) {
    if (Array.isArray(v)) return `[${v.map((x) => this.numArg(x, elemOf(t as ListType))).join(', ')}]`
    if (typeof v === 'number') return this.numArg(v, t)
    if (typeof v === 'boolean') return this.boolLit(v)
    return this.strLit(v)
  }
  protected mainFn() {
    const fn = entryFn(this.p)
    this.line('def main() -> None:')
    this.depth++
    this.line('"""Ejecuta los casos de ejemplo."""')
    for (const t of this.tests) {
      const call = `${this.fnName(fn.name)}(${this.callArgs(t)})`
      const label = this.strLit(`${this.label(t)} =>`)
      if (fn.fallible) {
        this.line('try:')
        this.line(`    print(${label}, ${call})`)
        this.line('except ValueError as error:')
        this.line(`    print(${this.strLit(`${this.label(t)} => error:`)}, error)`)
      } else this.line(`print(${label}, ${call})`)
    }
    this.depth--
    this.line()
    this.line()
    this.line('if __name__ == "__main__":')
    this.line('    main()')
  }
  protected prelude() {
    const lines = [`"""${pascal(this.p.entry)}: generado por EXODIA Dev Lab."""`, '']
    if (this.uses.has('math')) lines.push('import math', '', '')
    else lines.push('')
    return lines
  }
  generate(): GeneratedCode {
    const g = super.generate()
    // PEP 8: dos líneas en blanco entre funciones de nivel superior.
    return { ...g, code: g.code.replace(/\n\n(def |if __name__)/g, '\n\n\n$1').replace(/\n{4,}/g, '\n\n\n') }
  }
  fileName() {
    return `${snake(this.p.entry)}.py`
  }
}

// ======================= JavaScript / TypeScript =======================

class JsEmitter extends Emitter {
  indentUnit = '  '
  constructor(
    p: Program,
    tests: TestCase[],
    private ts: boolean,
  ) {
    super(p, tests)
  }
  protected floatLit(v: number) {
    return String(v)
  }
  protected op(op: BinOp) {
    return op === '==' ? '===' : op === '!=' ? '!==' : super.op(op)
  }
  protected idivExpr(l: Expr, r: Expr): Code {
    return atom(`Math.trunc(${this.wrap(l, 6)} / ${this.paren(this.expr(r), 6, true)})`)
  }
  protected powExpr(b: Expr, x: Expr): Code {
    return { s: `${this.wrap(b, ATOM)} ** ${this.wrap(x, ATOM)}`, p: 8 }
  }
  protected mathExpr(fn: MathFn, arg: Expr) {
    const name = { sqrt: 'sqrt', abs: 'abs', floor: 'floor', sin: 'sin', cos: 'cos', tan: 'tan', exp: 'exp', ln: 'log', log10: 'log10' }[fn]
    return atom(`Math.${name}(${this.expr(arg).s})`)
  }
  protected constant(name: 'pi' | 'e') {
    return name === 'pi' ? 'Math.PI' : 'Math.E'
  }
  protected toFloat(e: Expr) {
    return this.expr(e)
  }
  protected lenExpr(list: string) {
    return atom(`${list}.length`)
  }
  protected declare(name: string, _t: Scalar, value: string) {
    return `${this.mutable.has(name) ? 'let' : 'const'} ${name} = ${value};`
  }
  protected forHead(name: string, from: string, to: string) {
    return `for (let ${name} = ${from}; ${name} <= ${to}; ${name}++)`
  }
  protected eachHead(name: string, list: string) {
    return { head: `for (const ${name} of ${list})` }
  }
  protected returnStmt(v: string) {
    return [`return ${v};`]
  }
  protected failStmt(m: string) {
    return [`throw new RangeError(${this.strLit(m)});`]
  }
  private ty(t: Type) {
    return { int: 'number', float: 'number', bool: 'boolean', str: 'string', 'int[]': 'number[]', 'float[]': 'number[]' }[t]
  }
  protected fnDecl(f: Fn) {
    this.line('/**')
    this.line(` * ${f.doc}`)
    for (const x of f.params) this.line(this.ts ? ` * @param ${x.name} - ${x.doc}` : ` * @param {${this.ty(x.type)}} ${x.name} ${x.doc}`)
    this.line(this.ts ? ` * @returns ${f.returnsDoc}` : ` * @returns {${this.ty(f.returns)}} ${f.returnsDoc}`)
    if (f.fallible) this.line(` * @throws {RangeError} ${f.failsDoc ?? 'Si los datos no son válidos.'}`)
    this.line(' */')
    const params = f.params.map((x) => (this.ts ? `${x.name}: ${this.ty(x.type)}` : x.name)).join(', ')
    this.open(`function ${f.name}(${params})${this.ts ? `: ${this.ty(f.returns)}` : ''}`)
    this.fnBody(f)
    this.close()
  }
  protected arg(v: Value) {
    if (Array.isArray(v)) return `[${v.join(', ')}]`
    if (typeof v === 'number') return String(v)
    if (typeof v === 'boolean') return this.boolLit(v)
    return this.strLit(v)
  }
  protected mainFn() {
    const fn = entryFn(this.p)
    this.open(`function main()${this.ts ? ': void' : ''}`)
    for (const t of this.tests) {
      const call = `${fn.name}(${this.callArgs(t)})`
      const label = this.strLit(`${this.label(t)} =>`)
      if (fn.fallible) {
        this.open('try')
        this.line(`console.log(${label}, ${call});`)
        this.mid('catch (error)')
        const msg = this.ts ? 'error instanceof Error ? error.message : error' : 'error.message'
        this.line(`console.log(${this.strLit(`${this.label(t)} => error:`)}, ${msg});`)
        this.close()
      } else this.line(`console.log(${label}, ${call});`)
    }
    this.close()
    this.line()
    this.line('main();')
  }
  protected prelude() {
    return [`// ${pascal(this.p.entry)}: generado por EXODIA Dev Lab.`, '']
  }
  fileName() {
    return `${this.p.entry}.${this.ts ? 'ts' : 'js'}`
  }
}

// ======================= Java =======================

class JavaEmitter extends Emitter {
  indentUnit = '    '
  protected intLit(v: number) {
    return Math.abs(v) > 2147483647 ? `${v}L` : String(v)
  }
  protected powExpr(b: Expr, x: Expr) {
    return atom(`Math.pow(${this.expr(b).s}, ${this.expr(x).s})`)
  }
  protected mathExpr(fn: MathFn, arg: Expr) {
    const name = { sqrt: 'sqrt', abs: 'abs', floor: 'floor', sin: 'sin', cos: 'cos', tan: 'tan', exp: 'exp', ln: 'log', log10: 'log10' }[fn]
    return atom(`Math.${name}(${this.expr(arg).s})`)
  }
  protected constant(name: 'pi' | 'e') {
    return name === 'pi' ? 'Math.PI' : 'Math.E'
  }
  protected toFloat(e: Expr) {
    return { s: `(double) ${this.wrap(e, 8)}`, p: 7 }
  }
  protected lenExpr(list: string) {
    return atom(`${list}.length`)
  }
  protected atExpr(list: string, index: Expr) {
    return atom(index.k === 'int' ? `${list}[${index.v}]` : `${list}[(int) ${this.wrap(index, 8)}]`)
  }
  ty(t: Type) {
    return { int: 'long', float: 'double', bool: 'boolean', str: 'String', 'int[]': 'long[]', 'float[]': 'double[]' }[t]
  }
  protected declare(name: string, t: Scalar, value: string) {
    return `${this.ty(t)} ${this.varName(name)} = ${value};`
  }
  protected forHead(name: string, from: string, to: string) {
    const n = this.varName(name)
    return `for (long ${n} = ${from}; ${n} <= ${to}; ${n}++)`
  }
  protected eachHead(name: string, list: string, elem: 'int' | 'float') {
    return { head: `for (${this.ty(elem)} ${name} : ${list})` }
  }
  protected returnStmt(v: string) {
    return [`return ${v};`]
  }
  protected failStmt(m: string) {
    return [`throw new IllegalArgumentException(${this.strLit(m)});`]
  }
  protected fnDecl(f: Fn) {
    this.line('/**')
    this.line(` * ${f.doc}`)
    this.line(' *')
    for (const x of f.params) this.line(` * @param ${x.name} ${x.doc}`)
    this.line(` * @return ${f.returnsDoc}`)
    if (f.fallible) this.line(` * @throws IllegalArgumentException ${f.failsDoc ?? 'si los datos no son válidos'}`)
    this.line(' */')
    const params = f.params.map((x) => `${this.ty(x.type)} ${x.name}`).join(', ')
    this.open(`${f.name === this.p.entry ? 'public ' : 'private '}static ${this.ty(f.returns)} ${f.name}(${params})`)
    this.fnBody(f)
    this.close()
  }
  protected arg(v: Value, t: Type) {
    if (Array.isArray(v)) return `new ${this.ty(t)}{${v.map((x) => this.numArg(x, elemOf(t as ListType))).join(', ')}}`
    if (typeof v === 'number') return this.numArg(v, t)
    if (typeof v === 'boolean') return this.boolLit(v)
    return this.strLit(v)
  }
  protected mainFn() {
    const fn = entryFn(this.p)
    this.open('public static void main(String[] args)')
    for (const t of this.tests) {
      const call = `${fn.name}(${this.callArgs(t)})`
      const label = this.strLit(`${this.label(t)} => `)
      if (fn.fallible) {
        this.open('try')
        this.line(`System.out.println(${label} + ${call});`)
        this.mid('catch (IllegalArgumentException e)')
        this.line(`System.out.println(${this.strLit(`${this.label(t)} => error: `)} + e.getMessage());`)
        this.close()
      } else this.line(`System.out.println(${label} + ${call});`)
    }
    this.close()
  }
  generate(): GeneratedCode {
    this.depth = 1
    const g = super.generate()
    const body = g.code.trimEnd()
    const code = [`/** ${pascal(this.p.entry)}: generado por EXODIA Dev Lab. */`, `public final class ${this.className()} {`, '', `    private ${this.className()}() {`, '        // Clase de utilidad: no se instancia.', '    }', '', body, '}', ''].join('\n')
    return { code, fileName: this.fileName() }
  }
  protected prelude() {
    return []
  }
  className() {
    return pascal(this.p.entry)
  }
  fileName() {
    return `${this.className()}.java`
  }
}

// ======================= C =======================

class CEmitter extends Emitter {
  indentUnit = '    '
  protected powExpr(b: Expr, x: Expr) {
    this.uses.add('math')
    return atom(`pow(${this.expr(b).s}, ${this.expr(x).s})`)
  }
  protected mathExpr(fn: MathFn, arg: Expr) {
    this.uses.add('math')
    const name = { sqrt: 'sqrt', abs: 'fabs', floor: 'floor', sin: 'sin', cos: 'cos', tan: 'tan', exp: 'exp', ln: 'log', log10: 'log10' }[fn]
    return atom(`${name}(${this.expr(arg).s})`)
  }
  protected constant(name: 'pi' | 'e') {
    this.uses.add('math')
    if (name === 'pi') this.uses.add('pi')
    return name === 'pi' ? 'M_PI' : 'exp(1.0)'
  }
  protected toFloat(e: Expr) {
    return { s: `(double) ${this.wrap(e, 8)}`, p: 7 }
  }
  protected lenExpr(list: string) {
    return { s: `(long long) ${snake(list)}_len`, p: 7 }
  }
  protected varName(n: string) {
    return snake(n)
  }
  protected fnName(n: string) {
    return snake(n)
  }
  ty(t: Scalar) {
    if (t === 'bool') this.uses.add('bool')
    return { int: 'long long', float: 'double', bool: 'bool', str: 'const char *' }[t]
  }
  protected declare(name: string, t: Scalar, value: string) {
    return `${this.ty(t)} ${this.varName(name)} = ${value};`
  }
  protected forHead(name: string, from: string, to: string) {
    const n = this.varName(name)
    return `for (long long ${n} = ${from}; ${n} <= ${to}; ${n}++)`
  }
  protected eachHead(name: string, list: string, elem: 'int' | 'float') {
    const l = this.varName(list)
    const i = `i_${this.varName(name)}`
    return { head: `for (size_t ${i} = 0; ${i} < ${l}_len; ${i}++)`, prelude: `${this.ty(elem)} ${this.varName(name)} = ${l}[${i}];` }
  }
  protected returnStmt(v: string) {
    return this.fn.fallible ? [`*out_valor = ${v};`, 'return true;'] : [`return ${v};`]
  }
  protected failStmt(m: string) {
    return [`*out_error = ${this.strLit(m)};`, 'return false;']
  }
  protected fnDecl(f: Fn) {
    this.line('/*')
    this.line(` * ${f.doc}`)
    for (const x of f.params) this.line(` * ${this.varName(x.name)}: ${x.doc}`)
    if (f.fallible) {
      this.uses.add('bool')
      this.line(` * Devuelve true y escribe el resultado en *out_valor (${f.returnsDoc.replace(/\.$/, '')}).`)
      this.line(` * Devuelve false y escribe el motivo en *out_error ${f.failsDoc ? `(${f.failsDoc.replace(/\.$/, '')})` : 'si los datos no son válidos'}.`)
    } else this.line(` * Devuelve: ${f.returnsDoc}`)
    this.line(' */')
    const params: string[] = []
    for (const x of f.params) {
      if (isList(x.type)) params.push(`const ${this.ty(elemOf(x.type))} *${this.varName(x.name)}`, `size_t ${this.varName(x.name)}_len`)
      else params.push(`${this.ty(x.type as Scalar)} ${this.varName(x.name)}`)
    }
    if (f.fallible) params.push(`${this.ty(f.returns)}${f.returns === 'str' ? '' : ' '}*out_valor`, 'const char **out_error')
    const ret = f.fallible ? 'bool' : this.ty(f.returns)
    const sep = ret.endsWith('*') ? '' : ' '
    this.open(`static ${ret}${sep}${this.fnName(f.name)}(${params.length ? params.join(', ') : 'void'})`)
    this.fnBody(f)
    this.close()
  }
  protected arg(v: Value, t: Type) {
    if (Array.isArray(v)) {
      const el = elemOf(t as ListType)
      return v.length ? `(const ${this.ty(el)}[]){${v.map((x) => this.numArg(x, el)).join(', ')}}, ${v.length}` : 'NULL, 0'
    }
    if (typeof v === 'number') return this.numArg(v, t)
    if (typeof v === 'boolean') return this.boolLit(v)
    return this.strLit(v)
  }
  private fmt(t: Scalar): [string, (x: string) => string] {
    if (t === 'int') return ['%lld', (x) => x]
    if (t === 'float') return ['%.15g', (x) => x]
    if (t === 'bool') return ['%s', (x) => `${x} ? "true" : "false"`]
    return ['%s', (x) => x]
  }
  protected mainFn() {
    const fn = entryFn(this.p)
    const [spec, conv] = this.fmt(fn.returns)
    const format = (label: string, tail: string) => this.strLit(`${label.replace(/%/g, '%%')}${tail}\n`)
    this.open('int main(void)')
    for (const t of this.tests) {
      const args = this.callArgs(t)
      const label = this.label(t)
      if (fn.fallible) {
        this.open('')
        this.line(`${this.ty(fn.returns)}${fn.returns === 'str' ? '' : ' '}valor;`)
        this.line('const char *error;')
        this.open(`if (${this.fnName(fn.name)}(${args}${args ? ', ' : ''}&valor, &error))`)
        this.line(`printf(${format(label, ` => ${spec}`)}, ${conv('valor')});`)
        this.mid('else')
        this.line(`printf(${format(label, ' => error: %s')}, error);`)
        this.close()
        this.close()
      } else this.line(`printf(${format(label, ` => ${spec}`)}, ${conv(`${this.fnName(fn.name)}(${args})`)});`)
    }
    this.line('return 0;')
    this.close()
  }
  protected open(header: string) {
    if (header === '') {
      this.line('{')
      this.depth++
      return
    }
    super.open(header)
  }
  protected prelude() {
    const lines = [`/* ${pascal(this.p.entry)}: generado por EXODIA Dev Lab. */`]
    if (this.uses.has('bool')) lines.push('#include <stdbool.h>')
    if (this.uses.has('math')) lines.push('#include <math.h>')
    lines.push('#include <stdio.h>', '')
    if (this.uses.has('pi')) lines.push('#ifndef M_PI', '#define M_PI 3.14159265358979323846', '#endif', '')
    return lines
  }
  fileName() {
    return `${snake(this.p.entry)}.c`
  }
}

// ======================= C++ =======================

class CppEmitter extends Emitter {
  indentUnit = '    '
  protected powExpr(b: Expr, x: Expr) {
    this.uses.add('cmath')
    return atom(`std::pow(${this.expr(b).s}, ${this.expr(x).s})`)
  }
  protected mathExpr(fn: MathFn, arg: Expr) {
    this.uses.add('cmath')
    const name = { sqrt: 'sqrt', abs: 'abs', floor: 'floor', sin: 'sin', cos: 'cos', tan: 'tan', exp: 'exp', ln: 'log', log10: 'log10' }[fn]
    return atom(`std::${name}(${this.expr(arg).s})`)
  }
  protected constant(name: 'pi' | 'e') {
    this.uses.add('cmath')
    if (name === 'pi') this.uses.add('pi')
    return name === 'pi' ? 'kPi' : 'std::exp(1.0)'
  }
  protected toFloat(e: Expr) {
    return atom(`static_cast<double>(${this.expr(e).s})`)
  }
  protected lenExpr(list: string) {
    return atom(`static_cast<long long>(${snake(list)}.size())`)
  }
  protected atExpr(list: string, index: Expr) {
    return atom(`${snake(list)}[static_cast<std::size_t>(${this.expr(index).s})]`)
  }
  protected varName(n: string) {
    return snake(n)
  }
  protected fnName(n: string) {
    return snake(n)
  }
  ty(t: Type, param = false) {
    if (t === 'str') this.uses.add('string')
    if (isList(t)) {
      this.uses.add('vector')
      const el = t === 'int[]' ? 'long long' : 'double'
      return param ? `const std::vector<${el}>&` : `std::vector<${el}>`
    }
    return { int: 'long long', float: 'double', bool: 'bool', str: 'std::string' }[t as Scalar]
  }
  protected declare(name: string, t: Scalar, value: string) {
    return `${this.mutable.has(name) ? '' : 'const '}${this.ty(t)} ${this.varName(name)} = ${value};`
  }
  protected forHead(name: string, from: string, to: string) {
    const n = this.varName(name)
    return `for (long long ${n} = ${from}; ${n} <= ${to}; ++${n})`
  }
  protected eachHead(name: string, list: string, elem: 'int' | 'float') {
    return { head: `for (const ${this.ty(elem)} ${this.varName(name)} : ${this.varName(list)})` }
  }
  protected returnStmt(v: string) {
    return [`return ${v};`]
  }
  protected failStmt(m: string) {
    this.uses.add('stdexcept')
    return [`throw std::invalid_argument(${this.strLit(m)});`]
  }
  protected fnDecl(f: Fn) {
    this.line(`// ${f.doc}`)
    for (const x of f.params) this.line(`// ${this.varName(x.name)}: ${x.doc}`)
    this.line(`// Devuelve: ${f.returnsDoc}`)
    if (f.fallible) this.line(`// Lanza std::invalid_argument ${f.failsDoc ? `(${f.failsDoc.replace(/\.$/, '')})` : 'si los datos no son válidos'}.`)
    const params = f.params.map((x) => `${this.ty(x.type, true)} ${this.varName(x.name)}`).join(', ')
    this.open(`${this.ty(f.returns)} ${this.fnName(f.name)}(${params})`)
    this.fnBody(f)
    this.close()
  }
  protected arg(v: Value, t: Type) {
    if (Array.isArray(v)) return `${this.ty(t)}{${v.map((x) => this.numArg(x, elemOf(t as ListType))).join(', ')}}`
    if (typeof v === 'number') return this.numArg(v, t)
    if (typeof v === 'boolean') return this.boolLit(v)
    return this.strLit(v)
  }
  protected mainFn() {
    const fn = entryFn(this.p)
    this.open('int main()')
    this.line('std::cout << std::setprecision(15) << std::boolalpha;')
    for (const t of this.tests) {
      const call = `${this.fnName(fn.name)}(${this.callArgs(t)})`
      const label = this.strLit(`${this.label(t)} => `)
      if (fn.fallible) {
        this.open('try')
        // Se calcula antes de escribir: si lanza, la etiqueta no queda impresa a medias.
        this.line(`const auto resultado = ${call};`)
        this.line(`std::cout << ${label} << resultado << '\\n';`)
        this.mid('catch (const std::invalid_argument& e)')
        this.line(`std::cout << ${this.strLit(`${this.label(t)} => error: `)} << e.what() << '\\n';`)
        this.close()
      } else this.line(`std::cout << ${label} << ${call} << '\\n';`)
    }
    this.line('return 0;')
    this.close()
  }
  protected prelude() {
    const inc = ['cmath', 'iomanip', 'iostream', 'stdexcept', 'string', 'vector'].filter((h) => h === 'iomanip' || h === 'iostream' || this.uses.has(h))
    const lines = [`// ${pascal(this.p.entry)}: generado por EXODIA Dev Lab.`, ...inc.map((h) => `#include <${h}>`), '']
    if (this.uses.has('pi')) lines.push('constexpr double kPi = 3.14159265358979323846;', '')
    return lines
  }
  fileName() {
    return `${snake(this.p.entry)}.cpp`
  }
}

// ======================= C# =======================

const CSHARP_KEYWORDS = new Set(['base', 'checked', 'decimal', 'event', 'fixed', 'object', 'operator', 'out', 'params', 'ref', 'string', 'lock', 'internal', 'implicit', 'explicit'])

class CSharpEmitter extends Emitter {
  indentUnit = '    '
  allmanCtrl = true
  protected varName(n: string) {
    return CSHARP_KEYWORDS.has(n) ? `@${n}` : n
  }
  protected fnName(n: string) {
    return pascal(n)
  }
  protected powExpr(b: Expr, x: Expr) {
    return atom(`Math.Pow(${this.expr(b).s}, ${this.expr(x).s})`)
  }
  protected mathExpr(fn: MathFn, arg: Expr) {
    const name = { sqrt: 'Sqrt', abs: 'Abs', floor: 'Floor', sin: 'Sin', cos: 'Cos', tan: 'Tan', exp: 'Exp', ln: 'Log', log10: 'Log10' }[fn]
    return atom(`Math.${name}(${this.expr(arg).s})`)
  }
  protected constant(name: 'pi' | 'e') {
    return name === 'pi' ? 'Math.PI' : 'Math.E'
  }
  protected toFloat(e: Expr) {
    return { s: `(double)${this.wrap(e, 8)}`, p: 7 }
  }
  protected lenExpr(list: string) {
    return atom(`${list}.Length`)
  }
  ty(t: Type) {
    return { int: 'long', float: 'double', bool: 'bool', str: 'string', 'int[]': 'long[]', 'float[]': 'double[]' }[t]
  }
  protected declare(name: string, t: Scalar, value: string) {
    return `${this.ty(t)} ${this.varName(name)} = ${value};`
  }
  protected forHead(name: string, from: string, to: string) {
    const n = this.varName(name)
    return `for (long ${n} = ${from}; ${n} <= ${to}; ${n}++)`
  }
  protected eachHead(name: string, list: string, elem: 'int' | 'float') {
    return { head: `foreach (${this.ty(elem)} ${this.varName(name)} in ${this.varName(list)})` }
  }
  protected returnStmt(v: string) {
    return [`return ${v};`]
  }
  protected failStmt(m: string) {
    return [`throw new ArgumentException(${this.strLit(m)});`]
  }
  protected fnDecl(f: Fn) {
    this.line(`/// <summary>${f.doc}</summary>`)
    for (const x of f.params) this.line(`/// <param name="${x.name}">${x.doc}</param>`)
    this.line(`/// <returns>${f.returnsDoc}</returns>`)
    if (f.fallible) this.line(`/// <exception cref="ArgumentException">${f.failsDoc ?? 'Si los datos no son válidos.'}</exception>`)
    const params = f.params.map((x) => `${this.ty(x.type)} ${this.varName(x.name)}`).join(', ')
    this.open(`${f.name === this.p.entry ? 'public' : 'private'} static ${this.ty(f.returns)} ${this.fnName(f.name)}(${params})`)
    this.fnBody(f)
    this.close()
  }
  protected arg(v: Value, t: Type) {
    if (Array.isArray(v)) return `new ${this.ty(t)} { ${v.map((x) => this.numArg(x, elemOf(t as ListType))).join(', ')} }`.replace('{  }', '{ }')
    if (typeof v === 'number') return this.numArg(v, t)
    if (typeof v === 'boolean') return this.boolLit(v)
    return this.strLit(v)
  }
  protected mainFn() {
    const fn = entryFn(this.p)
    this.open('public static void Main()')
    this.line('CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;')
    this.line('Console.OutputEncoding = Encoding.UTF8;')
    for (const t of this.tests) {
      const call = `${this.fnName(fn.name)}(${this.callArgs(t)})`
      const label = this.strLit(`${this.label(t)} => `)
      if (fn.fallible) {
        this.open('try')
        this.line(`Console.WriteLine(${label} + ${call});`)
        this.mid('catch (ArgumentException e)')
        this.line(`Console.WriteLine(${this.strLit(`${this.label(t)} => error: `)} + e.Message);`)
        this.close()
      } else this.line(`Console.WriteLine(${label} + ${call});`)
    }
    this.close()
  }
  generate(): GeneratedCode {
    this.depth = 1
    const g = super.generate()
    const code = [
      `// ${pascal(this.p.entry)}: generado por EXODIA Dev Lab.`,
      'using System;',
      'using System.Globalization;',
      'using System.Text;',
      '',
      `public static class ${this.className()}`,
      '{',
      g.code.trimEnd(),
      '}',
      '',
    ].join('\n')
    return { code, fileName: this.fileName() }
  }
  protected prelude() {
    return []
  }
  className() {
    return `${pascal(this.p.entry)}Program`
  }
  fileName() {
    return `${this.className()}.cs`
  }
}

// ======================= Go =======================

/*
 * gofmt decide los espacios alrededor de los operadores según la precedencia y la profundidad
 * de anidamiento (por ejemplo `n * f(n-1)`). Este es un port de la lógica de go/printer
 * (walkBinary, cutoff, diffPrec) para que el código generado ya esté en formato canónico.
 */
type G =
  | { t: 'bin'; op: string; x: G; y: G }
  | { t: 'un'; op: string; x: G }
  | { t: 'paren'; x: G }
  | { t: 'call'; fun: string; args: G[] }
  | { t: 'index'; x: G; i: G }
  | { t: 'lit'; s: string }
type GBin = Extract<G, { t: 'bin' }>
const GPREC: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3, '+': 4, '-': 4, '*': 5, '/': 5, '%': 5 }
const gp = (op: string) => GPREC[op] ?? 0

function walkBinary(e: GBin): [boolean, boolean, number] {
  const p = gp(e.op)
  let h4 = p === 4
  let h5 = p === 5
  let mp = 0
  if (e.x.t === 'bin' && gp(e.x.op) >= p) {
    const [a, b, c] = walkBinary(e.x)
    h4 ||= a
    h5 ||= b
    mp = Math.max(mp, c)
  }
  if (e.y.t === 'bin' && gp(e.y.op) > p) {
    const [a, b, c] = walkBinary(e.y)
    h4 ||= a
    h5 ||= b
    mp = Math.max(mp, c)
  } else if (e.y.t === 'un') {
    const combo = e.op + e.y.op
    if (combo === '++' || combo === '--') mp = Math.max(mp, 4)
  }
  return [h4, h5, mp]
}
function goCutoff(e: GBin, depth: number): number {
  const [h4, h5, mp] = walkBinary(e)
  if (mp > 0) return mp + 1
  if (h4 && h5) return depth === 1 ? 5 : 4
  return depth === 1 ? 6 : 4
}
function goPrint(x: G, depth: number): string {
  switch (x.t) {
    case 'lit':
      return x.s
    case 'un':
      return x.op + goPrint(x.x, depth)
    case 'paren':
      return `(${goPrint(x.x, Math.max(1, depth - 1))})`
    case 'call': {
      const d = x.args.length > 1 ? depth + 1 : depth
      return `${x.fun}(${x.args.map((a) => goPrint(a, d)).join(', ')})`
    }
    case 'index':
      return `${goPrint(x.x, 1)}[${goPrint(x.i, depth + 1)}]`
    case 'bin': {
      const prec = gp(x.op)
      const blank = prec < goCutoff(x, depth) ? ' ' : ''
      const diff = x.x.t === 'bin' && gp(x.x.op) === prec ? 0 : 1
      return `${goPrint(x.x, depth + diff)}${blank}${x.op}${blank}${goPrint(x.y, depth + 1)}`
    }
  }
}

class GoEmitter extends Emitter {
  indentUnit = '\t'
  semi = ''
  expr(e: Expr): Code {
    return atom(goPrint(this.toG(e), 1))
  }
  private operand(g: G): G {
    return g.t === 'bin' || g.t === 'un' ? { t: 'paren', x: g } : g
  }
  private toG(e: Expr): G {
    const lit = (s: string): G => ({ t: 'lit', s })
    const math = (fn: string, args: Expr[]): G => {
      this.uses.add('math')
      return { t: 'call', fun: `math.${fn}`, args: args.map((a) => this.toG(a)) }
    }
    switch (e.k) {
      case 'int':
        return e.v < 0 ? { t: 'un', op: '-', x: lit(String(-e.v)) } : lit(String(e.v))
      case 'float':
        return e.v < 0 ? { t: 'un', op: '-', x: lit(this.floatLit(-e.v)) } : lit(this.floatLit(e.v))
      case 'bool':
        return lit(this.boolLit(e.v))
      case 'str':
        return lit(this.strLit(e.v))
      case 'var':
        return lit(e.name)
      case 'neg':
        return { t: 'un', op: '-', x: this.operand(this.toG(e.e)) }
      case 'not':
        return { t: 'un', op: '!', x: this.operand(this.toG(e.e)) }
      case 'pow':
        return math('Pow', [e.base, e.exp])
      case 'math':
        return math({ sqrt: 'Sqrt', abs: 'Abs', floor: 'Floor', sin: 'Sin', cos: 'Cos', tan: 'Tan', exp: 'Exp', ln: 'Log', log10: 'Log10' }[e.fn], [e.arg])
      case 'const':
        this.uses.add('math')
        return lit(e.name === 'pi' ? 'math.Pi' : 'math.E')
      case 'toFloat':
        return { t: 'call', fun: 'float64', args: [this.toG(e.e)] }
      case 'len':
        return { t: 'call', fun: 'len', args: [lit(e.list)] }
      case 'at':
        return { t: 'index', x: lit(e.list), i: this.toG(e.index) }
      case 'call':
        return { t: 'call', fun: e.fn, args: e.args.map((a) => this.toG(a)) }
      case 'bin': {
        const op = e.op === 'and' ? '&&' : e.op === 'or' ? '||' : e.op === '//' ? '/' : e.op
        const p = gp(op)
        let x = this.toG(e.l)
        let y = this.toG(e.r)
        if (x.t === 'bin' && (gp(x.op) < p || (p === 3 && gp(x.op) === 3))) x = { t: 'paren', x }
        if (y.t === 'bin' && gp(y.op) <= p) y = { t: 'paren', x: y }
        return { t: 'bin', op, x, y }
      }
    }
  }
  protected cond(c: Expr) {
    return this.expr(c).s
  }
  protected whileHead(c: Expr) {
    return `for ${this.expr(c).s}`
  }
  protected powExpr(b: Expr, x: Expr) {
    return this.expr({ k: 'pow', base: b, exp: x })
  }
  protected mathExpr(fn: MathFn, arg: Expr) {
    return this.expr({ k: 'math', fn, arg })
  }
  protected constant(name: 'pi' | 'e') {
    return this.expr({ k: 'const', name }).s
  }
  protected toFloat(e: Expr) {
    return this.expr({ k: 'toFloat', e })
  }
  protected lenExpr(list: string) {
    return this.expr({ k: 'len', list })
  }
  ty(t: Type) {
    return { int: 'int', float: 'float64', bool: 'bool', str: 'string', 'int[]': '[]int', 'float[]': '[]float64' }[t]
  }
  private zero(t: Scalar) {
    return { int: '0', float: '0', bool: 'false', str: '""' }[t]
  }
  protected declare(name: string, _t: Scalar, value: string) {
    return `${name} := ${value}`
  }
  protected forHead(name: string, from: string, _to: string, _used: boolean, loop: Extract<Stmt, { k: 'for' }>) {
    return `for ${name} := ${from}; ${this.expr(le(ref(name), loop.to)).s}; ${name}++`
  }
  protected eachHead(name: string, list: string) {
    return { head: `for _, ${name} := range ${list}` }
  }
  protected returnStmt(v: string) {
    return [this.fn.fallible ? `return ${v}, nil` : `return ${v}`]
  }
  protected failStmt(m: string) {
    this.uses.add('errors')
    // Convención de Go: los mensajes de error empiezan en minúscula y sin punto final.
    const msg = m.charAt(0).toLowerCase() + m.slice(1)
    return [`return ${this.zero(this.fn.returns)}, errors.New(${this.strLit(msg)})`]
  }
  protected fnDecl(f: Fn) {
    this.line(`// ${f.name} ${f.doc.charAt(0).toLowerCase()}${f.doc.slice(1)}`)
    if (f.fallible) this.line(`// Devuelve un error ${f.failsDoc ? `(${f.failsDoc.replace(/\.$/, '').toLowerCase()})` : 'si los datos no son válidos'}.`)
    const params = f.params.map((x) => `${x.name} ${this.ty(x.type)}`).join(', ')
    const ret = f.fallible ? `(${this.ty(f.returns)}, error)` : this.ty(f.returns)
    this.open(`func ${f.name}(${params}) ${ret}`)
    this.fnBody(f)
    this.close()
  }
  protected arg(v: Value, t: Type) {
    if (Array.isArray(v)) return `${this.ty(t)}{${v.map((x) => this.numArg(x, elemOf(t as ListType))).join(', ')}}`
    if (typeof v === 'number') return this.numArg(v, t)
    if (typeof v === 'boolean') return this.boolLit(v)
    return this.strLit(v)
  }
  protected mainFn() {
    const fn = entryFn(this.p)
    this.open('func main()')
    for (const t of this.tests) {
      const call = `${fn.name}(${this.callArgs(t)})`
      if (fn.fallible) {
        this.open(`if resultado, err := ${call}; err != nil`)
        this.line(`fmt.Println(${this.strLit(`${this.label(t)} => error:`)}, err)`)
        this.mid('else')
        this.line(`fmt.Println(${this.strLit(`${this.label(t)} =>`)}, resultado)`)
        this.close()
      } else this.line(`fmt.Println(${this.strLit(`${this.label(t)} =>`)}, ${call})`)
    }
    this.close()
  }
  protected prelude() {
    const imports = ['errors', 'fmt', 'math'].filter((x) => x === 'fmt' || this.uses.has(x))
    return [`// Programa ${pascal(this.p.entry)}: generado por EXODIA Dev Lab.`, 'package main', '', 'import (', ...imports.map((x) => `\t"${x}"`), ')', '']
  }
  fileName() {
    return `${snake(this.p.entry)}.go`
  }
}

// ======================= Rust =======================

class RustEmitter extends Emitter {
  indentUnit = '    '
  protected varName(n: string) {
    return snake(n)
  }
  protected fnName(n: string) {
    return snake(n)
  }
  protected cond(c: Expr) {
    return this.expr(c).s
  }
  protected whileHead(c: Expr) {
    return `while ${this.expr(c).s}`
  }
  /** `a as T < b` se interpreta como argumentos genéricos: las conversiones se agrupan dentro de comparaciones. */
  protected paren(c: Code, min: number, right = false, cmp = false): string {
    if (cmp && / as \w+$/.test(c.s)) return `(${c.s})`
    return super.paren(c, min, right, cmp)
  }
  private receiver(e: Expr): string {
    if (e.k === 'float') return e.v < 0 ? `(${this.floatLit(e.v)}_f64)` : `${this.floatLit(e.v)}_f64`
    return this.wrap(e, ATOM)
  }
  protected powExpr(b: Expr, x: Expr) {
    return atom(`${this.receiver(b)}.powf(${this.expr(x).s})`)
  }
  protected mathExpr(fn: MathFn, arg: Expr) {
    return atom(`${this.receiver(arg)}.${fn === 'ln' ? 'ln' : fn}()`)
  }
  protected constant(name: 'pi' | 'e') {
    return name === 'pi' ? 'std::f64::consts::PI' : 'std::f64::consts::E'
  }
  protected toFloat(e: Expr) {
    return { s: `${this.wrap(e, 8)} as f64`, p: 8 }
  }
  protected lenExpr(list: string) {
    return { s: `${snake(list)}.len() as i64`, p: 8 }
  }
  protected atExpr(list: string, index: Expr) {
    return atom(`${snake(list)}[${this.wrap(index, 8)} as usize]`)
  }
  ty(t: Type) {
    return { int: 'i64', float: 'f64', bool: 'bool', str: '&\'static str', 'int[]': '&[i64]', 'float[]': '&[f64]' }[t]
  }
  protected declare(name: string, t: Scalar, value: string) {
    return `let ${this.mutable.has(name) ? 'mut ' : ''}${this.varName(name)}: ${t === 'str' ? '&str' : this.ty(t)} = ${value};`
  }
  protected forHead(name: string, from: string, to: string, used: boolean) {
    return `for ${used ? this.varName(name) : '_'} in ${from}..=${to}`
  }
  protected eachHead(name: string, list: string) {
    return { head: `for &${this.varName(name)} in ${this.varName(list)}` }
  }
  protected returnStmt(v: string, tail: boolean) {
    const val = this.fn.fallible ? `Ok(${v})` : v
    return [tail ? val : `return ${val};`]
  }
  protected failStmt(m: string, tail: boolean) {
    const val = `Err(String::from(${this.strLit(m)}))`
    return [tail ? val : `return ${val};`]
  }
  protected fnDecl(f: Fn) {
    this.line(`/// ${f.doc}`)
    if (f.params.length) {
      this.line('///')
      for (const x of f.params) this.line(`/// * \`${this.varName(x.name)}\` - ${x.doc}`)
    }
    if (f.fallible) {
      this.line('///')
      this.line('/// # Errors')
      this.line('///')
      this.line(`/// Devuelve \`Err\` ${f.failsDoc ? `${f.failsDoc.charAt(0).toLowerCase()}${f.failsDoc.slice(1)}` : 'si los datos no son válidos.'}`)
    }
    const params = f.params.map((x) => `${this.varName(x.name)}: ${this.ty(x.type)}`).join(', ')
    const ret = f.fallible ? `Result<${this.ty(f.returns)}, String>` : this.ty(f.returns)
    this.open(`fn ${this.fnName(f.name)}(${params}) -> ${ret}`)
    this.fnBody(f)
    this.close()
  }
  protected arg(v: Value, t: Type) {
    if (Array.isArray(v)) return `&[${v.map((x) => this.numArg(x, elemOf(t as ListType))).join(', ')}]`
    if (typeof v === 'number') return this.numArg(v, t)
    if (typeof v === 'boolean') return this.boolLit(v)
    return this.strLit(v)
  }
  protected mainFn() {
    const fn = entryFn(this.p)
    this.open('fn main()')
    for (const t of this.tests) {
      const call = `${this.fnName(fn.name)}(${this.callArgs(t)})`
      const label = this.strLit(this.label(t))
      if (fn.fallible) {
        this.open(`match ${call}`)
        this.line(`Ok(valor) => println!("{} => {}", ${label}, valor),`)
        this.line(`Err(error) => println!("{} => error: {}", ${label}, error),`)
        this.close()
      } else this.line(`println!("{} => {}", ${label}, ${call});`)
    }
    this.close()
  }
  protected prelude() {
    return [`//! ${pascal(this.p.entry)}: generado por EXODIA Dev Lab.`, '']
  }
  fileName() {
    return `${snake(this.p.entry)}.rs`
  }
}

// ======================= PHP =======================

class PhpEmitter extends Emitter {
  indentUnit = '    '
  protected varName(n: string) {
    return `$${n}`
  }
  protected strLit(s: string) {
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  }
  protected op(op: BinOp) {
    return op === '==' ? '===' : op === '!=' ? '!==' : super.op(op)
  }
  protected idivExpr(l: Expr, r: Expr) {
    return atom(`intdiv(${this.expr(l).s}, ${this.expr(r).s})`)
  }
  protected powExpr(b: Expr, x: Expr) {
    return { s: `${this.wrap(b, ATOM)} ** ${this.wrap(x, ATOM)}`, p: 8 }
  }
  protected mathExpr(fn: MathFn, arg: Expr) {
    const name = { sqrt: 'sqrt', abs: 'abs', floor: 'floor', sin: 'sin', cos: 'cos', tan: 'tan', exp: 'exp', ln: 'log', log10: 'log10' }[fn]
    return atom(`${name}(${this.expr(arg).s})`)
  }
  protected constant(name: 'pi' | 'e') {
    return name === 'pi' ? 'M_PI' : 'M_E'
  }
  protected toFloat(e: Expr) {
    return { s: `(float) ${this.wrap(e, 8)}`, p: 7 }
  }
  protected lenExpr(list: string) {
    return atom(`count($${list})`)
  }
  ty(t: Type) {
    return { int: 'int', float: 'float', bool: 'bool', str: 'string', 'int[]': 'array', 'float[]': 'array' }[t]
  }
  private docTy(t: Type) {
    return { int: 'int', float: 'float', bool: 'bool', str: 'string', 'int[]': 'int[]', 'float[]': 'float[]' }[t]
  }
  protected declare(name: string, _t: Scalar, value: string) {
    return `$${name} = ${value};`
  }
  protected forHead(name: string, from: string, to: string) {
    return `for ($${name} = ${from}; $${name} <= ${to}; $${name}++)`
  }
  protected eachHead(name: string, list: string) {
    return { head: `foreach ($${list} as $${name})` }
  }
  protected returnStmt(v: string) {
    return [`return ${v};`]
  }
  protected failStmt(m: string) {
    return [`throw new InvalidArgumentException(${this.strLit(m)});`]
  }
  protected fnDecl(f: Fn) {
    this.line('/**')
    this.line(` * ${f.doc}`)
    this.line(' *')
    for (const x of f.params) this.line(` * @param ${this.docTy(x.type)} $${x.name} ${x.doc}`)
    this.line(` * @return ${this.docTy(f.returns)} ${f.returnsDoc}`)
    if (f.fallible) this.line(` * @throws InvalidArgumentException ${f.failsDoc ?? 'Si los datos no son válidos.'}`)
    this.line(' */')
    const params = f.params.map((x) => `${this.ty(x.type)} $${x.name}`).join(', ')
    this.open(`function ${f.name}(${params}): ${this.ty(f.returns)}`, true)
    this.fnBody(f)
    this.close()
  }
  protected arg(v: Value, t: Type) {
    if (Array.isArray(v)) return `[${v.map((x) => this.numArg(x, elemOf(t as ListType))).join(', ')}]`
    if (typeof v === 'number') return this.numArg(v, t)
    if (typeof v === 'boolean') return this.boolLit(v)
    return this.strLit(v)
  }
  protected mainFn() {
    const fn = entryFn(this.p)
    const show = (x: string) => (fn.returns === 'bool' ? `(${x} ? 'true' : 'false')` : x)
    for (const t of this.tests) {
      const call = `${fn.name}(${this.callArgs(t)})`
      const label = this.strLit(`${this.label(t)} => `)
      if (fn.fallible) {
        this.open('try')
        this.line(`echo ${label} . ${show(call)} . PHP_EOL;`)
        this.mid('catch (InvalidArgumentException $e)')
        this.line(`echo ${this.strLit(`${this.label(t)} => error: `)} . $e->getMessage() . PHP_EOL;`)
        this.close()
      } else this.line(`echo ${label} . ${show(call)} . PHP_EOL;`)
    }
  }
  protected prelude() {
    return ['<?php', '', 'declare(strict_types=1);', '', `// ${pascal(this.p.entry)}: generado por EXODIA Dev Lab.`, '']
  }
  fileName() {
    return `${this.p.entry}.php`
  }
}

export function generateCode(lang: CodeLang, p: Program, tests: TestCase[]): GeneratedCode {
  switch (lang) {
    case 'python':
      return new PythonEmitter(p, tests).generate()
    case 'javascript':
      return new JsEmitter(p, tests, false).generate()
    case 'typescript':
      return new JsEmitter(p, tests, true).generate()
    case 'java':
      return new JavaEmitter(p, tests).generate()
    case 'c':
      return new CEmitter(p, tests).generate()
    case 'cpp':
      return new CppEmitter(p, tests).generate()
    case 'csharp':
      return new CSharpEmitter(p, tests).generate()
    case 'go':
      return new GoEmitter(p, tests).generate()
    case 'rust':
      return new RustEmitter(p, tests).generate()
    case 'php':
      return new PhpEmitter(p, tests).generate()
  }
}
