import type { MathNode } from 'mathjs'
import { add, and, div, eq, euler, flt, if_, let_, lt, le, math, mul, ne, neg, pi, pow, ref, ret, sub, fail, type Expr, type Stmt } from '../ir'
import { emptyAnalysis, type KindDef, type MathStep, type Solution, type TestCase } from '../types'
import { checkSupported, FUNCS, isConstant, mathjs, MSG, refEval, RESERVED, substituteTex, symbolsOf, toTex } from './mathexpr'
import { fmt, norm, texNum, unsupported } from './shared'
import { RefError, tc, uniqueTests } from './testing'

const KIND = 'expression' as const

type Node = MathNode & { type: string; [k: string]: unknown }

interface Parsed {
  fname: string
  params: string[]
  node: MathNode
  given: Record<string, number>
  header: boolean
}

const VERB = /^\s*(?:¿\s*)?(?:calcular|calcula|calcul[aá]|evaluar|evalua|evalu[aá]|cu[aá]nto es|cu[aá]nto vale|hallar el valor de|resultado de)\s*:?\s*/i

function parseText(text: string): Parsed | string {
  let t = text.replace(VERB, '').replace(/[?¿]/g, '').trim()
  const given: Record<string, number> = {}
  // "… para x = 3, y = 2" / "… en x = 3"
  const split = t.split(/\s+(?:para|en|con|cuando|si)\s+(?=[a-z]\w*\s*=)/i)
  if (split.length > 1) {
    t = split[0]!.trim()
    for (const m of split.slice(1).join(' ').matchAll(/([a-z]\w*)\s*=\s*(-?\d+(?:\.\d+)?)/gi)) given[m[1]!] = Number(m[2])
  }
  let fname = 'evaluar'
  let params: string[] | null = null
  const head = t.match(/^([a-zA-Z]\w*)\s*\(\s*([a-zA-Z]\w*(?:\s*,\s*[a-zA-Z]\w*)*)?\s*\)\s*=\s*(.+)$/)
  if (head) {
    fname = head[1]!
    params = head[2] ? head[2].split(',').map((s) => s.trim()) : []
    t = head[3]!
  }
  if (t.includes('=')) return 'La expresión contiene "=": parece una ecuación. Elegí el tipo "Ecuación lineal".'
  let node: MathNode
  try {
    node = mathjs.parse(t.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'sqrt'))
  } catch (e) {
    return `No pude interpretar la expresión: ${(e as Error).message}`
  }
  const problem = checkSupported(node)
  if (problem) return problem
  const symbols = symbolsOf(node)
  if (params) {
    const missing = symbols.filter((s) => !params!.includes(s))
    if (missing.length) return `La expresión usa variables no declaradas en ${fname}(…): ${missing.join(', ')}.`
  } else params = [...symbols].sort()
  for (const n of [fname, ...params]) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(n)) return `"${n}" no es un nombre válido: usá letras minúsculas sin tildes (por ejemplo x, y, t).`
    if (RESERVED.has(n) || FUNCS[n]) return `"${n}" es una palabra reservada en alguno de los lenguajes de destino; usá otro nombre.`
  }
  if (new Set(params).size !== params.length) return 'Hay parámetros repetidos.'
  if (params.includes(fname)) return 'La función y una variable tienen el mismo nombre.'
  return { fname, params, node, given, header: !!head }
}

interface Check {
  tex: string
  text: string
}

/** Traduce el árbol a la IR separando en variables las subexpresiones que tienen restricciones de dominio. */
function compile(node: MathNode) {
  const pre: Stmt[] = []
  const checks: Check[] = []
  const counters: Record<string, number> = {}
  const fresh = (base: string) => {
    counters[base] = (counters[base] ?? 0) + 1
    return counters[base] === 1 ? base : `${base}${counters[base]}`
  }
  const hoist = (base: string, value: Expr, source: MathNode, note: string) => {
    const name = fresh(base)
    pre.push(let_(name, 'float', value, { step: 2, note: `${note}: ${source.toString()}` }))
    return name
  }
  const constVal = (n: MathNode) => {
    try {
      return refEval(n, {})
    } catch (e) {
      if (e instanceof RefError) throw new RefError(`${e.message} en ${n.toString()}`)
      throw e
    }
  }
  const conv = (n: MathNode): Expr => {
    const x = n as Node
    const args = (x.args as MathNode[] | undefined) ?? []
    switch (x.type) {
      case 'ConstantNode':
        return flt(Number(x.value))
      case 'SymbolNode':
        return x.name === 'pi' ? pi : x.name === 'e' ? euler : ref(x.name as string)
      case 'ParenthesisNode':
        return conv(x.content as MathNode)
      case 'OperatorNode': {
        const fn = x.fn as string
        if (fn === 'unaryMinus') return neg(conv(args[0]!))
        if (fn === 'unaryPlus') return conv(args[0]!)
        const [a, b] = [args[0]!, args[1]!]
        if (fn === 'add') return add(conv(a), conv(b))
        if (fn === 'subtract') return sub(conv(a), conv(b))
        if (fn === 'multiply') return mul(conv(a), conv(b))
        if (fn === 'divide') {
          const l = conv(a)
          if (isConstant(b)) {
            if (constVal(b) === 0) throw new RefError(`${MSG.div0}: el denominador ${b.toString()} vale 0`)
            return div(l, conv(b))
          }
          const d = hoist('divisor', conv(b), b, 'Denominador')
          pre.push(if_(eq(ref(d), flt(0)), [fail(MSG.div0)], undefined, { step: 2 }))
          checks.push({ tex: `${toTex(b)} \\neq 0`, text: `${b.toString()} ≠ 0` })
          return div(l, ref(d))
        }
        if (fn === 'pow') {
          const constExp = isConstant(b) ? constVal(b) : null
          const constBase = isConstant(a) ? constVal(a) : null
          if (constExp !== null && Number.isInteger(constExp) && constExp >= 0) return pow(conv(a), conv(b))
          if (constBase !== null && constExp !== null) {
            constVal(n)
            return pow(conv(a), conv(b))
          }
          const baseName = constBase !== null ? null : hoist('base', conv(a), a, 'Base de la potencia')
          const baseExpr = baseName ? ref(baseName) : conv(a)
          if (constExp !== null) {
            if (!Number.isInteger(constExp) && baseName) {
              pre.push(if_(lt(ref(baseName), flt(0)), [fail(MSG.powNeg)], undefined, { step: 2 }))
              checks.push({ tex: `${toTex(a)} \\geq 0`, text: `${a.toString()} ≥ 0` })
            }
            if (constExp < 0 && baseName) {
              pre.push(if_(eq(ref(baseName), flt(0)), [fail(MSG.pow0)], undefined, { step: 2 }))
              checks.push({ tex: `${toTex(a)} \\neq 0`, text: `${a.toString()} ≠ 0` })
            }
            return pow(baseExpr, conv(b))
          }
          const e = hoist('exponente', conv(b), b, 'Exponente')
          pre.push(if_(and(lt(baseExpr, flt(0)), ne(ref(e), math('floor', ref(e)))), [fail(MSG.powNeg)], undefined, { step: 2 }))
          pre.push(if_(and(eq(baseExpr, flt(0)), lt(ref(e), flt(0))), [fail(MSG.pow0)], undefined, { step: 2 }))
          checks.push({ tex: `${toTex(a)} \\geq 0 \\ \\text{o}\\ ${toTex(b)} \\in \\mathbb{Z}`, text: `${a.toString()} ≥ 0 o ${b.toString()} entero` })
          return pow(baseExpr, ref(e))
        }
        throw new Error(`Operador no admitido: ${fn}`)
      }
      case 'FunctionNode': {
        const fn = FUNCS[(x.fn as Node).name as string]!
        const a = args[0]!
        if (fn === 'sqrt' || fn === 'ln' || fn === 'log10') {
          if (isConstant(a)) {
            constVal(n)
            return math(fn, conv(a))
          }
          const name = hoist(fn === 'sqrt' ? 'radicando' : 'argumento', conv(a), a, fn === 'sqrt' ? 'Radicando' : 'Argumento del logaritmo')
          if (fn === 'sqrt') {
            pre.push(if_(lt(ref(name), flt(0)), [fail(MSG.sqrtNeg)], undefined, { step: 2 }))
            checks.push({ tex: `${toTex(a)} \\geq 0`, text: `${a.toString()} ≥ 0` })
          } else {
            pre.push(if_(le(ref(name), flt(0)), [fail(MSG.logNonPos)], undefined, { step: 2 }))
            checks.push({ tex: `${toTex(a)} > 0`, text: `${a.toString()} > 0` })
          }
          return math(fn, ref(name))
        }
        return math(fn, conv(a))
      }
    }
    throw new Error(`Construcción no admitida: ${x.type}`)
  }
  const value = conv(node)
  return { pre, checks, value }
}

function build(text: string): Solution {
  const parsed = parseText(text)
  if (typeof parsed === 'string') return unsupported(KIND, 'Expresión', parsed)
  const { fname, params, node, given } = parsed
  let compiled: ReturnType<typeof compile>
  try {
    compiled = compile(node)
  } catch (e) {
    if (e instanceof RefError) return unsupported(KIND, 'Expresión', `La expresión no tiene un valor real: ${e.message}.`)
    return unsupported(KIND, 'Expresión', (e as Error).message)
  }
  const { pre, checks, value } = compiled
  const fallible = pre.some((s) => s.k === 'if')
  const reference = (args: number[]) => {
    const scope = Object.fromEntries(params.map((p, i) => [p, args[i]!]))
    const v = refEval(node, scope)
    return v
  }

  // Casos de prueba: valores del enunciado, valores típicos y candidatos que anulan denominadores.
  const consts = new Set<number>()
  node.traverse((n) => {
    const x = n as Node
    if (x.type === 'ConstantNode') consts.add(Number(x.value))
  })
  const pool = [...new Set([1, 2, 0, -1, 3, 0.5, -2, 4, 10, ...[...consts].flatMap((c) => [c, -c]), ...[...consts].flatMap((c) => [...consts].filter((d) => d !== 0).map((d) => c / d))])].filter((v) => Number.isFinite(v) && Math.abs(v) < 1e6)
  const tests: TestCase[] = []
  const hasGiven = params.length > 0 && params.every((p) => p in given)
  const givenArgs = params.map((p) => given[p]!)
  if (hasGiven) tests.push(tc(givenArgs, () => reference(givenArgs), 'normal', 'Los valores del enunciado.'))
  if (!params.length) tests.push(tc([], () => reference([]), 'normal', 'La expresión no tiene variables: un único resultado.'))
  else {
    let normal = 0
    let errors = 0
    for (let k = 0; k < pool.length * 2 && (normal < 4 || errors < 2); k++) {
      const args = params.map((_, j) => pool[(k + 3 * j) % pool.length]!)
      let outcome: TestCase
      try {
        outcome = tc(args, () => reference(args), 'normal', '')
      } catch {
        continue
      }
      if ('error' in outcome.expect) {
        if (errors >= 2) continue
        errors++
        tests.push({ ...outcome, category: 'inválido', why: `Fuera del dominio: ${outcome.expect.error.toLowerCase()}.` })
      } else {
        if (normal >= 4 || !Number.isFinite(outcome.expect.value as number)) continue
        normal++
        tests.push({ ...outcome, category: Object.is(args[0], 0) ? 'límite' : 'normal', why: args.some((a) => a === 0) ? 'Incluye el valor 0.' : args.some((a) => a < 0) ? 'Valores negativos.' : 'Valores típicos.' })
      }
    }
  }
  const unique = uniqueTests(tests)
  const example = unique.find((t) => 'value' in t.expect)
  const exampleScope = example ? Object.fromEntries(params.map((p, i) => [p, example.args[i] as number])) : null
  let simplified: string | null = null
  try {
    const s = mathjs.simplify(node)
    if (s.toString() !== node.toString()) simplified = toTex(s)
  } catch {
    simplified = null
  }
  const lhs = params.length ? `${fname}(${params.join(', ')})` : fname
  const steps: MathStep[] = [{ text: 'Expresión a evaluar.', tex: `${lhs} = ${toTex(node)}` }]
  if (checks.length) steps.push({ text: 'Condiciones de dominio: cada operación con restricciones exige', tex: checks.map((c) => c.tex).join(',\\quad ') })
  if (simplified)
    steps.push({
      text: checks.some((c) => c.text.includes('≠ 0')) ? 'Forma algebraica simplificada (atención: simplificar puede ocultar valores excluidos del dominio).' : 'Forma algebraica equivalente.',
      tex: simplified,
    })
  if (exampleScope && params.length) steps.push({ text: 'Sustitución del ejemplo.', tex: `${lhs.replace(/\(.*\)/, `(${params.map((p) => fmt(exampleScope[p]!)).join(', ')})`)} = ${substituteTex(node, exampleScope)}` })
  const ex = example && 'value' in example.expect ? (example.expect.value as number) : null
  const program = {
    entry: fname,
    fns: [
      {
        name: fname,
        params: params.map((p) => ({ name: p, type: 'float' as const, doc: `valor de ${p}.` })),
        returns: 'float' as const,
        fallible,
        doc: `Evalúa ${lhs} = ${node.toString()}.`,
        returnsDoc: 'El valor de la expresión.',
        failsDoc: fallible ? 'Si los valores quedan fuera del dominio de la expresión.' : undefined,
        body: [...pre, let_('resultado', 'float', value, { step: 3, note: 'Evaluar la expresión completa' }), ret(ref('resultado'), { step: 4 })],
      },
    ],
  }
  return {
    kind: KIND,
    title: `${lhs} = ${node.toString()}`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: params.length ? `Evaluar ${node.toString()} para cualquier valor de ${params.join(', ')} y detectar los valores en los que no está definida.` : `Calcular el valor de ${node.toString()}.`,
      goal: params.length ? `Una función que reciba ${params.join(', ')} y devuelva el valor de la expresión.` : 'El valor numérico de la expresión.',
      known: [`Expresión: ${node.toString()}`, ...Object.entries(given).map(([k, v]) => `${k} = ${fmt(v)}`)],
      unknown: [params.length ? `${lhs}` : 'El resultado'],
      constraints: checks.length ? checks.map((c) => c.text) : ['Ninguna restricción de dominio: la expresión está definida para todos los reales.'],
      conditions: ['Se trabaja con números reales de 64 bits (punto flotante): los resultados pueden tener errores de redondeo en el último dígito.'],
      edgeCases: [...checks.map((c) => `Valores que no cumplen ${c.text}.`), 'Valores muy grandes pueden producir desbordamiento (infinito).', ...(node.toString().includes('tan') ? ['tan no está definida en π/2 + kπ; en punto flotante da un número enorme en lugar de un error.'] : [])],
      assumptions: !parsed.header && params.length > 1 ? [`El orden de los parámetros es alfabético: (${params.join(', ')}). Para elegir otro, escribí ${fname === 'evaluar' ? 'f' : fname}(${[...params].reverse().join(', ')}) = …`] : [],
    }),
    math: {
      steps,
      validity: checks.length ? checks.map((c) => `Válido solo si ${c.text}.`) : ['Válido para todos los reales.'],
      result: ex !== null && exampleScope ? { text: params.length ? 'Valor en el ejemplo.' : 'Resultado.', tex: `${params.length ? lhs.replace(/\(.*\)/, `(${params.map((p) => fmt(exampleScope[p]!)).join(', ')})`) : lhs} \\approx ${texNum(ex)}` } : undefined,
      symbolicVsProgram: 'La expresión matemática describe una relación exacta; el programa la evalúa numéricamente, entrada por entrada, y debe comprobar el dominio antes de operar porque cada lenguaje reacciona distinto (Python lanza una excepción, C devuelve NaN o infinito).',
    },
    strategies: [{ id: 'directa', label: 'Evaluación directa', summary: 'Validar el dominio y evaluar la expresión una vez.' }],
    strategy: 'directa',
    design: {
      inputs: params.length ? params.map((p) => `${p}: real`) : ['Ninguna'],
      outputs: ['resultado: real'],
      variables: [...pre.filter((s) => s.k === 'let').map((s) => (s.k === 'let' ? `${s.name}: subexpresión con restricción` : '')), 'resultado'],
      steps: ['Recibir los valores de las variables.', checks.length ? 'Calcular las subexpresiones con restricciones y validar el dominio.' : 'No hay restricciones de dominio que validar.', 'Evaluar la expresión completa.', 'Devolver el resultado.'],
      conditions: checks.length ? checks.map((c) => `Si no se cumple ${c.text} → error.`) : ['Ninguna.'],
      loops: ['Ninguno: es una evaluación directa.'],
      special: checks.length ? ['Se valida antes de operar para dar un error claro en lugar de NaN o infinito.'] : [],
      complexity: { time: 'O(1)', space: 'O(1)', why: 'Una cantidad fija de operaciones.' },
    },
    program,
    tests: unique,
    sqlNote: 'SQL no aplica: no hay datos tabulares que consultar.',
    questions: [
      { stage: 'math', question: '¿Para qué valores no está definida la expresión?', answer: checks.length ? `Cuando no se cumple: ${checks.map((c) => c.text).join('; ')}.` : 'Está definida para todos los reales.' },
      { stage: 'algorithm', question: '¿Necesitamos una condición o una iteración?', answer: checks.length ? 'Condiciones, para validar el dominio. No hay nada que repetir.' : 'Ninguna de las dos: es una evaluación directa.' },
    ],
  }
}

export const expressionKind: KindDef = {
  id: KIND,
  label: 'Expresión o función',
  description: 'Operaciones aritméticas y funciones matemáticas elementales: f(x) = …, con validación de dominio.',
  examples: [
    { title: 'Aritmética', text: 'Calcular (3 + 4) * 2^3 - 10 / 4' },
    { title: 'Función con dominio', text: 'f(x) = (x^2 - 4) / (x - 2)' },
    { title: 'Raíz y logaritmo', text: 'g(t) = sqrt(t - 1) + log(t)' },
    { title: 'Dos variables', text: 'h(x, y) = sqrt(x^2 + y^2) para x = 3, y = 4' },
    { title: 'Techo y redondeo', text: 'ceil(1.2) + round(-1.5)' },
  ],
  detect(text) {
    const t = norm(text)
    if (/[a-z]\w*\s*\([^)]*\)\s*=/.test(t)) return 0.8
    const p = parseText(text)
    if (typeof p === 'string') return 0
    return /[a-z]/.test(t.replace(VERB, '')) ? 0.5 : 0.6
  },
  build,
}
