import { elseIfOf, type BinOp, type Expr, type Program, type Stmt, type Type } from '../ir'

export interface PseudoLine {
  indent: number
  text: string
  step?: number
  comment?: boolean
}

const TYPE: Record<Type, string> = { int: 'entero', float: 'real', bool: 'lógico', str: 'texto', 'int[]': 'lista de enteros', 'float[]': 'lista de reales' }
export const pseudoType = (t: Type) => TYPE[t]

const OPS: Record<BinOp, [string, number]> = {
  or: ['O', 1],
  and: ['Y', 2],
  '==': ['=', 3],
  '!=': ['≠', 3],
  '<': ['<', 3],
  '<=': ['≤', 3],
  '>': ['>', 3],
  '>=': ['≥', 3],
  '+': ['+', 4],
  '-': ['−', 4],
  '*': ['×', 5],
  '/': ['÷', 5],
  '//': ['DIV', 5],
  '%': ['MOD', 5],
}
const FN: Record<string, string> = { sqrt: 'RAÍZ', abs: 'ABS', floor: 'PISO', ceil: 'TECHO', round: 'REDONDEO', sin: 'SEN', cos: 'COS', tan: 'TAN', exp: 'EXP', ln: 'LN', log10: 'LOG10' }

function num(v: number, float: boolean): string {
  const s = String(v)
  return float && Number.isInteger(v) && !s.includes('e') ? `${s}.0` : s
}

function ex(e: Expr): [string, number] {
  switch (e.k) {
    case 'int':
      return [String(e.v), e.v < 0 ? 6 : 9]
    case 'float':
      return [num(e.v, true), e.v < 0 ? 6 : 9]
    case 'bool':
      return [e.v ? 'VERDADERO' : 'FALSO', 9]
    case 'str':
      return [`"${e.v}"`, 9]
    case 'var':
      return [e.name, 9]
    case 'const':
      return [e.name === 'pi' ? 'π' : 'e', 9]
    case 'neg':
      return [`−${wrap(e.e, 7)}`, 6]
    case 'not':
      return [`NO ${wrap(e.e, 7)}`, 6]
    case 'pow':
      return [`${wrap(e.base, 9)} ^ ${wrap(e.exp, 9)}`, 8]
    case 'math':
      return [`${FN[e.fn]}(${ex(e.arg)[0]})`, 9]
    case 'toFloat':
      return [`REAL(${ex(e.e)[0]})`, 9]
    case 'len':
      return [`LONGITUD(${e.list})`, 9]
    case 'at':
      return [`${e.list}[${ex(e.index)[0]}]`, 9]
    case 'concat':
      return [`${wrap(e.l, 4)} + ${wrap(e.r, 5)}`, 4]
    case 'slice':
      return [`${e.str}[${ex(e.from)[0]} … ${ex(e.to)[0]})`, 9]
    case 'call':
      return [`${e.fn}(${e.args.map((a) => ex(a)[0]).join(', ')})`, 9]
    case 'bin': {
      const [sym, p] = OPS[e.op]
      return [`${wrap(e.l, p)} ${sym} ${wrap(e.r, p + 1)}`, p]
    }
  }
}
function wrap(e: Expr, min: number): string {
  const [s, p] = ex(e)
  return p < min ? `(${s})` : s
}
export const pseudoExpr = (e: Expr) => ex(e)[0]

export function toPseudocode(p: Program): PseudoLine[] {
  const out: PseudoLine[] = []
  const push = (indent: number, text: string, step?: number, comment?: boolean) => out.push({ indent, text, step, comment })
  const body = (stmts: Stmt[], d: number) => {
    for (const s of stmts) {
      if (s.note) push(d, `// ${s.note}`, s.step, true)
      switch (s.k) {
        case 'let':
          push(d, `${s.name} ← ${pseudoExpr(s.value)}`, s.step)
          break
        case 'set':
          push(d, `${s.name} ← ${pseudoExpr(s.value)}`, s.step)
          break
        case 'copy':
          push(d, `${s.name} ← COPIA(${s.from})`, s.step)
          break
        case 'alloc':
          push(d, `${s.name} ← LISTA(${pseudoExpr(s.len)}, ${pseudoExpr(s.fill)})`, s.step)
          break
        case 'setAt':
          push(d, `${s.list}[${pseudoExpr(s.index)}] ← ${pseudoExpr(s.value)}`, s.step)
          break
        case 'if': {
          push(d, `SI ${pseudoExpr(s.cond)} ENTONCES`, s.step)
          body(s.then, d + 1)
          let els = s.else
          for (let elif = elseIfOf(els); elif; elif = elseIfOf(els)) {
            push(d, `SI NO, SI ${pseudoExpr(elif.cond)} ENTONCES`, elif.step ?? s.step)
            body(elif.then, d + 1)
            els = elif.else
          }
          if (els) {
            push(d, 'SI NO', s.step)
            body(els, d + 1)
          }
          push(d, 'FIN SI', s.step)
          break
        }
        case 'for':
          push(d, `PARA ${s.name} DESDE ${pseudoExpr(s.from)} HASTA ${pseudoExpr(s.to)} HACER`, s.step)
          body(s.body, d + 1)
          push(d, 'FIN PARA', s.step)
          break
        case 'each':
          push(d, `PARA CADA ${s.name} EN ${s.list} HACER`, s.step)
          body(s.body, d + 1)
          push(d, 'FIN PARA', s.step)
          break
        case 'while':
          push(d, `MIENTRAS ${pseudoExpr(s.cond)} HACER`, s.step)
          body(s.body, d + 1)
          push(d, 'FIN MIENTRAS', s.step)
          break
        case 'return':
          push(d, `DEVOLVER ${pseudoExpr(s.value)}`, s.step)
          break
        case 'fail':
          push(d, `ERROR "${s.message}"`, s.step)
          break
      }
    }
  }
  p.fns.forEach((f, i) => {
    if (i > 0) push(0, '')
    push(0, `// ${f.doc}`, undefined, true)
    const params = f.params.map((x) => `${x.name}: ${pseudoType(x.type)}`).join(', ')
    push(0, `FUNCIÓN ${f.name}(${params}) → ${pseudoType(f.returns)}`)
    body(f.body, 1)
    push(0, 'FIN FUNCIÓN')
  })
  return out
}

export const pseudocodeText = (p: Program) => toPseudocode(p).map((l) => '    '.repeat(l.indent) + l.text).join('\n')
