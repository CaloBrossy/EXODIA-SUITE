import type { MathNode } from 'mathjs'
import { div, eq, flt, if_, ref, ret, sub, fail } from '../ir'
import { emptyAnalysis, type KindDef, type Solution } from '../types'
import { checkSupported, mathjs, refEval, substituteTex, symbolsOf, toTex } from './mathexpr'
import { fmt, norm, texNum, unsupported } from './shared'
import { RefError, tc, uniqueTests } from './testing'

const KIND = 'linear' as const
const INFINITE = 'Infinitas soluciones: la ecuación es una identidad'
const NONE = 'Sin solución: la ecuación es contradictoria'

/** Redondea a 12 cifras para que 0.1 + 0.2 no aparezca como 0.30000000000000004. */
const clean = (x: number) => {
  const r = Number(x.toPrecision(12))
  return Object.is(r, -0) ? 0 : r
}

function refSolve(a: number, b: number, c: number): number {
  if (a === 0) throw new RefError(b === c ? INFINITE : NONE)
  return (c - b) / a
}

function extract(text: string): string | null {
  const parts = text.split(':')
  let t = parts[parts.length - 1]!.trim()
  if (!t.includes('=')) return null
  t = t
    .replace(/^(?:\s*(?:despejar|hallar|encontrar|calcular)\s+[a-z]\s+(?:en|de)\s+)/i, '')
    .replace(/^(?:[a-záéíóúñ]{2,}\s+)+/i, '')
    .replace(/[?¿.]$/g, '')
  return t.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
}

function build(text: string): Solution {
  const eqText = extract(text)
  if (!eqText) return unsupported(KIND, 'Ecuación', 'No encontré una ecuación (falta el signo "=").')
  const sides = eqText.split('=')
  if (sides.length !== 2) return unsupported(KIND, 'Ecuación', 'La ecuación debe tener exactamente un signo "=".')
  let L: MathNode
  let R: MathNode
  try {
    L = mathjs.parse(sides[0]!)
    R = mathjs.parse(sides[1]!)
  } catch (e) {
    return unsupported(KIND, 'Ecuación', `No pude interpretar la ecuación: ${(e as Error).message}`)
  }
  const problem = checkSupported(L) ?? checkSupported(R)
  if (problem) return unsupported(KIND, 'Ecuación', problem)
  const vars = [...new Set([...symbolsOf(L), ...symbolsOf(R)])]
  if (vars.length === 0) return unsupported(KIND, 'Ecuación', 'La igualdad no tiene incógnitas: es una afirmación numérica, no una ecuación a resolver.')
  if (vars.length > 1)
    return unsupported(KIND, 'Ecuación', `La ecuación tiene ${vars.length} incógnitas (${vars.join(', ')}). Una sola ecuación lineal con varias incógnitas tiene infinitas soluciones: hace falta un sistema de ecuaciones o fijar el valor de las demás.`, {
      ambiguities: [`¿Cuál es la incógnita? Aparecen ${vars.join(', ')}.`],
    })
  const x = vars[0]!
  const f = (t: number) => refEval(L, { [x]: t }) - refEval(R, { [x]: t })
  let pts: number[]
  try {
    pts = [0, 1, 2, -3, 0.5, 7].map(f)
  } catch {
    return unsupported(KIND, 'Ecuación', `La incógnita aparece dentro de una operación con restricciones (por ejemplo, en un denominador o una raíz). Esta versión resuelve ecuaciones lineales: a·${x} + b = c.`)
  }
  if (pts.some((v) => !Number.isFinite(v))) return unsupported(KIND, 'Ecuación', 'La ecuación no está definida en todos los puntos: no es lineal.')
  const a = clean(pts[1]! - pts[0]!)
  const k = pts[0]!
  const linear = [0, 1, 2, -3, 0.5, 7].every((t, i) => Math.abs(pts[i]! - (a * t + k)) <= 1e-9 * Math.max(1, Math.abs(pts[i]!)))
  if (!linear) {
    const quad = [0, 1, 2].map(f)
    const second = quad[2]! - 2 * quad[1]! + quad[0]!
    const isQuadratic = [3, -1, 0.5].every((t) => {
      const A = second / 2
      const B = quad[1]! - quad[0]! - A
      return Math.abs(f(t) - (A * t * t + B * t + quad[0]!)) < 1e-6 * Math.max(1, Math.abs(f(t)))
    })
    return unsupported(
      KIND,
      'Ecuación',
      isQuadratic
        ? `La ecuación es cuadrática en ${x} (aparece ${x}²). Puede tener 0, 1 o 2 soluciones reales según el discriminante; esta versión todavía no la traduce a código. Probá con una ecuación lineal.`
        : `La ecuación no es lineal en ${x}. Esta versión solo resuelve ecuaciones de la forma a·${x} + b = c.`,
    )
  }
  // a·x + b = c, con b = L(0) y c = R(0).
  const b = clean(refEval(L, { [x]: 0 }))
  const c = clean(refEval(R, { [x]: 0 }))
  const aL = clean(refEval(L, { [x]: 1 }) - b)
  const aR = clean(refEval(R, { [x]: 1 }) - c)
  const kind = a === 0 ? (b === c ? 'infinite' : 'none') : 'unique'
  const sol = kind === 'unique' ? clean((c - b) / a) : null
  const steps = [
    { text: 'Ecuación original.', tex: `${toTex(L)} = ${toTex(R)}` },
    { text: `Agrupamos: términos con ${x} a la izquierda (coeficiente ${fmt(aL)} − ${fmt(aR)}) y constantes a la derecha.`, tex: `${texNum(a)}\\,${x} = ${texNum(c)} - (${texNum(b)})` },
    { text: 'Forma general de la ecuación lineal.', tex: `a\\,${x} + b = c \\quad\\text{con}\\quad a = ${texNum(a)},\\ b = ${texNum(b)},\\ c = ${texNum(c)}` },
  ]
  if (kind === 'unique')
    steps.push(
      { text: `Como a ≠ 0, dividimos ambos miembros por a.`, tex: `${x} = \\frac{c - b}{a} = \\frac{${texNum(c)} - (${texNum(b)})}{${texNum(a)}}` },
      { text: 'Verificación: sustituimos en la ecuación original y ambos miembros coinciden.', tex: `${substituteTex(L, { [x]: sol! })} = ${texNum(refEval(L, { [x]: sol! }))} = ${texNum(refEval(R, { [x]: sol! }))}` },
    )
  else steps.push({ text: `El coeficiente de ${x} es 0: la ecuación queda 0·${x} = ${fmt(clean(c - b))}.`, tex: `0 \\cdot ${x} = ${texNum(clean(c - b))}` })
  return {
    kind: KIND,
    title: `${L.toString()} = ${R.toString()}`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Resolver la ecuación ${L.toString()} = ${R.toString()} y programar la resolución de cualquier ecuación lineal a·x + b = c.`,
      goal: `Encontrar el valor de ${x} que hace verdadera la igualdad.`,
      known: [`Ecuación: ${L.toString()} = ${R.toString()}`],
      unknown: [x],
      constraints: [`La ecuación es lineal en ${x} (comprobado evaluándola en varios puntos).`],
      conditions: ['Si a ≠ 0 hay una única solución.', 'Si a = 0 y b = c, todo número es solución.', 'Si a = 0 y b ≠ c, no hay solución.'],
      edgeCases: ['a = 0 (la incógnita desaparece).', 'Coeficientes decimales: el resultado puede tener error de redondeo.', 'Comparar un real con 0 exacto es frágil cuando a proviene de otros cálculos.'],
    }),
    math: {
      steps,
      validity: ['La división por a solo es válida si a ≠ 0.'],
      result: kind === 'unique' ? { text: 'Solución única.', tex: `${x} = ${texNum(sol!)}` } : { text: kind === 'infinite' ? 'Identidad: infinitas soluciones.' : 'Contradicción: no hay solución.', tex: kind === 'infinite' ? `${x} \\in \\mathbb{R}` : `\\nexists\\, ${x}` },
      symbolicVsProgram: `Resolvimos simbólicamente esta ecuación concreta. El programa, en cambio, resuelve la familia a·x + b = c para cualquier a, b y c: es la misma idea, pero tiene que contemplar todos los casos (incluido a = 0), no solo el del enunciado.`,
    },
    strategies: [{ id: 'despeje', label: 'Despeje directo', summary: 'Aplicar x = (c − b) / a después de descartar a = 0.' }],
    strategy: 'despeje',
    design: {
      inputs: ['a: real (coeficiente de x)', 'b: real (constante del primer miembro)', 'c: real (segundo miembro)'],
      outputs: ['x: real'],
      variables: ['Ninguna adicional.'],
      steps: ['Detectar si a = 0.', 'Si a = 0, distinguir identidad (b = c) de contradicción (b ≠ c).', 'Si a ≠ 0, calcular (c − b) / a.'],
      conditions: ['a = 0 y b = c → infinitas soluciones (error informativo).', 'a = 0 y b ≠ c → sin solución (error informativo).'],
      loops: ['Ninguno.'],
      special: ['La función devuelve un solo número, así que los casos sin solución única se informan como errores. Otra opción de diseño sería devolver un registro con el tipo de solución.'],
      complexity: { time: 'O(1)', space: 'O(1)', why: 'Unas pocas operaciones.' },
    },
    program: {
      entry: 'resolverLineal',
      fns: [
        {
          name: 'resolverLineal',
          params: [
            { name: 'a', type: 'float', doc: 'coeficiente de la incógnita.' },
            { name: 'b', type: 'float', doc: 'término independiente del primer miembro.' },
            { name: 'c', type: 'float', doc: 'segundo miembro.' },
          ],
          returns: 'float',
          fallible: true,
          doc: 'Resuelve la ecuación lineal a·x + b = c.',
          returnsDoc: 'El único valor de x que cumple la ecuación.',
          failsDoc: 'Si la ecuación no tiene solución única (a = 0).',
          body: [
            if_(eq(ref('a'), flt(0)), [if_(eq(ref('b'), ref('c')), [fail(INFINITE, { step: 2 })], [fail(NONE, { step: 2 })], { step: 2 })], undefined, { step: 1, note: 'Sin término en x no se puede despejar' }),
            ret(div(sub(ref('c'), ref('b')), ref('a')), { step: 3 }),
          ],
        },
      ],
    },
    tests: uniqueTests([
      tc([a, b, c], () => refSolve(a, b, c), kind === 'unique' ? 'normal' : 'límite', 'La ecuación del enunciado.'),
      tc([2, 3, 7], () => refSolve(2, 3, 7), 'normal', '2x + 3 = 7 → x = 2.'),
      tc([-4, 0, 10], () => refSolve(-4, 0, 10), 'normal', 'Coeficiente negativo y solución no entera.'),
      tc([0.5, -1, 0], () => refSolve(0.5, -1, 0), 'normal', 'Coeficiente decimal.'),
      tc([0, 5, 5], () => refSolve(0, 5, 5), 'límite', '0x + 5 = 5: identidad.'),
      tc([0, 1, 2], () => refSolve(0, 1, 2), 'límite', '0x + 1 = 2: contradicción.'),
    ]),
    sqlNote: 'SQL no aplica: no hay datos tabulares que consultar.',
    questions: [
      { stage: 'problem', question: '¿Una ecuación siempre tiene exactamente una solución?', answer: 'No. Si el coeficiente de x se anula puede no tener ninguna (5 = 7) o tener infinitas (5 = 5).' },
      { stage: 'math', question: '¿Qué operación "deshace" la multiplicación por a?', answer: 'Dividir por a, que solo es válido si a ≠ 0.' },
      { stage: 'tests', question: '¿Cómo comprobamos una solución?', answer: 'Sustituyéndola en la ecuación original: ambos miembros tienen que dar lo mismo.' },
    ],
  }
}

export const linearKind: KindDef = {
  id: KIND,
  label: 'Ecuación lineal',
  description: 'Ecuaciones de primer grado con una incógnita, incluidos los casos sin solución o con infinitas soluciones.',
  examples: [
    { title: 'Ecuación lineal', text: 'Resolver 3x + 5 = 20' },
    { title: 'Con paréntesis', text: '2(x - 1) = x + 4' },
    { title: 'Sin solución', text: 'x + 1 = x + 3' },
  ],
  detect(text) {
    const t = extract(text)
    if (!t || /[a-z]\w*\s*\([^)]*\)\s*=/.test(norm(text))) return 0
    return /[a-z]/i.test(t) ? 0.85 : 0
  },
  build,
}
