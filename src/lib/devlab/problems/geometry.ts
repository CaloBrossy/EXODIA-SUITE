import { add, div, flt, if_, le, let_, math, mul, or, pi, ref, ret, sub, fail, type Expr, type Stmt } from '../ir'
import { emptyAnalysis, type KindDef, type MathStep, type Solution, type Strategy } from '../types'
import { decimalCommaClarifications, fmt, needsClarification, norm, numbers, pick, texNum, unsupported } from './shared'
import { RefError, tc, uniqueTests } from './testing'

const KIND = 'geometry' as const
const POS = 'Las medidas deben ser positivas'
const TRI = 'Los lados no cumplen la desigualdad triangular'

type Shape = 'rectangulo' | 'cuadrado' | 'circulo' | 'triangulo'
type Measure = 'area' | 'perimetro'

interface Spec {
  fn: string
  params: { name: string; doc: string }[]
  /** Fórmula en TeX con los nombres de los parámetros. */
  tex: string
  formulaText: string
  value: Expr
  ref: (v: number[]) => number
  triangle?: boolean
  defaults: number[]
  extra: number[][]
}

const P = (...names: [string, string][]) => names.map(([name, doc]) => ({ name, doc }))
const r = ref

function spec(shape: Shape, measure: Measure, strategy: string): Spec {
  const A = measure === 'area'
  switch (shape) {
    case 'rectangulo':
      return A
        ? { fn: 'areaRectangulo', params: P(['base', 'base del rectángulo.'], ['altura', 'altura del rectángulo.']), tex: 'A = b \\cdot h', formulaText: 'A = base · altura', value: mul(r('base'), r('altura')), ref: ([b, h]) => b! * h!, defaults: [5, 3], extra: [[2.5, 4], [1, 1]] }
        : { fn: 'perimetroRectangulo', params: P(['base', 'base del rectángulo.'], ['altura', 'altura del rectángulo.']), tex: 'P = 2\\,(b + h)', formulaText: 'P = 2 · (base + altura)', value: mul(flt(2), add(r('base'), r('altura'))), ref: ([b, h]) => 2 * (b! + h!), defaults: [5, 3], extra: [[2.5, 4], [1, 1]] }
    case 'cuadrado':
      return A
        ? { fn: 'areaCuadrado', params: P(['lado', 'longitud del lado.']), tex: 'A = \\ell^2', formulaText: 'A = lado · lado', value: mul(r('lado'), r('lado')), ref: ([l]) => l! * l!, defaults: [4], extra: [[0.5], [12]] }
        : { fn: 'perimetroCuadrado', params: P(['lado', 'longitud del lado.']), tex: 'P = 4\\,\\ell', formulaText: 'P = 4 · lado', value: mul(flt(4), r('lado')), ref: ([l]) => 4 * l!, defaults: [4], extra: [[0.5], [12]] }
    case 'circulo':
      return A
        ? { fn: 'areaCirculo', params: P(['radio', 'radio del círculo.']), tex: 'A = \\pi r^2', formulaText: 'A = π · radio · radio', value: mul(mul(pi, r('radio')), r('radio')), ref: ([x]) => Math.PI * x! * x!, defaults: [3], extra: [[1], [0.5]] }
        : { fn: 'perimetroCirculo', params: P(['radio', 'radio del círculo.']), tex: 'P = 2 \\pi r', formulaText: 'P = 2 · π · radio', value: mul(mul(flt(2), pi), r('radio')), ref: ([x]) => 2 * Math.PI * x!, defaults: [3], extra: [[1], [0.5]] }
    case 'triangulo':
      if (A && strategy === 'base-altura')
        return { fn: 'areaTriangulo', params: P(['base', 'base del triángulo.'], ['altura', 'altura relativa a esa base.']), tex: 'A = \\frac{b \\cdot h}{2}', formulaText: 'A = base · altura / 2', value: div(mul(r('base'), r('altura')), flt(2)), ref: ([b, h]) => (b! * h!) / 2, defaults: [6, 4], extra: [[3, 2.5], [10, 1]] }
      if (A)
        return {
          fn: 'areaTriangulo',
          params: P(['a', 'primer lado.'], ['b', 'segundo lado.'], ['c', 'tercer lado.']),
          tex: 'A = \\sqrt{s(s-a)(s-b)(s-c)},\\quad s = \\frac{a+b+c}{2}',
          formulaText: 'Fórmula de Herón',
          value: math('sqrt', mul(mul(mul(r('s'), sub(r('s'), r('a'))), sub(r('s'), r('b'))), sub(r('s'), r('c')))),
          ref: ([a, b, c]) => {
            const s = (a! + b! + c!) / 2
            return Math.sqrt(s * (s - a!) * (s - b!) * (s - c!))
          },
          triangle: true,
          defaults: [3, 4, 5],
          extra: [[5, 5, 5], [7, 8, 9]],
        }
      return { fn: 'perimetroTriangulo', params: P(['a', 'primer lado.'], ['b', 'segundo lado.'], ['c', 'tercer lado.']), tex: 'P = a + b + c', formulaText: 'P = a + b + c', value: add(add(r('a'), r('b')), r('c')), ref: ([a, b, c]) => a! + b! + c!, triangle: true, defaults: [3, 4, 5], extra: [[5, 5, 5], [7, 8, 9]] }
  }
}

const SHAPE_LABEL: Record<Shape, string> = { rectangulo: 'rectángulo', cuadrado: 'cuadrado', circulo: 'círculo', triangulo: 'triángulo' }

function shapeOf(t: string): Shape | null {
  if (/rectangul/.test(t)) return 'rectangulo'
  if (/\bcuadrado\b/.test(t) && !/(metros|unidades|centimetros) cuadrad/.test(t)) return 'cuadrado'
  if (/circul|circunferencia|\bdisco\b/.test(t)) return 'circulo'
  if (/triangul/.test(t)) return 'triangulo'
  return null
}

function measureOf(t: string): Measure | 'both' | null {
  const a = /\barea\b|superficie/.test(t)
  const p = /perimetro|longitud de la circunferencia|\bcontorno\b/.test(t)
  if (a && p) return 'both'
  return a ? 'area' : p ? 'perimetro' : null
}

function build(text: string, strategyId?: string): Solution {
  const t = norm(text)
  const shape = shapeOf(t)
  if (!shape) return unsupported(KIND, 'Geometría', 'No reconocí la figura. Esta versión admite rectángulo, cuadrado, círculo y triángulo.')
  const decimal = decimalCommaClarifications(text)
  if (decimal) return needsClarification(KIND, 'Geometría', { summary: 'Hay un número con coma.', ambiguities: ['¿La coma separa decimales o dos medidas distintas?'] }, decimal)
  const measure = measureOf(t)
  if (measure === null || measure === 'both')
    return needsClarification(
      KIND,
      `Medida del ${SHAPE_LABEL[shape]}`,
      {
        summary: `Se trata de un ${SHAPE_LABEL[shape]}, pero ${measure === 'both' ? 'se piden dos medidas a la vez' : 'no se indica qué medida calcular'}.`,
        ambiguities: ['¿Hay que calcular el área (superficie) o el perímetro (contorno)? Cada uno es un algoritmo distinto.'],
      },
      [
        { label: 'Calcular el área', text: `Área del ${SHAPE_LABEL[shape]}: ${text.replace(/(area|área|perímetro|perimetro)\s*(y|e)?\s*/gi, '')}` },
        { label: 'Calcular el perímetro', text: `Perímetro del ${SHAPE_LABEL[shape]}: ${text.replace(/(area|área|perímetro|perimetro)\s*(y|e)?\s*/gi, '')}` },
      ],
    )
  const label = (re: RegExp) => {
    const m = t.match(re)
    return m ? Number(m[1]) : undefined
  }
  const num = '(-?\\d+(?:\\.\\d+)?)'
  const all = numbers(t)
  const assumptions: string[] = []
  const labeledSides = t.match(/lados?\s*(?:de|=|:|miden)?\s*(-?\d+(?:\.\d+)?)\s*,?\s*(?:y\s*)?(-?\d+(?:\.\d+)?)?\s*,?\s*(?:y\s*)?(-?\d+(?:\.\d+)?)?/)
  const strategies: Strategy[] =
    shape === 'triangulo' && measure === 'area'
      ? [
          { id: 'base-altura', label: 'Base por altura', summary: 'A = base · altura / 2. Requiere conocer la altura.' },
          { id: 'heron', label: 'Fórmula de Herón', summary: 'Calcula el área a partir de los tres lados.' },
        ]
      : [{ id: 'formula', label: 'Fórmula directa', summary: 'Aplicar la fórmula de la figura.' }]
  const preferHeron = labeledSides?.[3] !== undefined || (all.length >= 3 && !/altura/.test(t))
  const st = pick(strategies, strategyId ?? (shape === 'triangulo' && measure === 'area' ? (preferHeron ? 'heron' : 'base-altura') : undefined))
  const s = spec(shape, measure, st.id)
  let values: number[] = []
  if (shape === 'circulo') {
    const radio = label(new RegExp(`radio\\s*(?:de|=|:|mide)?\\s*${num}`))
    const diam = label(new RegExp(`diametro\\s*(?:de|=|:|mide)?\\s*${num}`))
    if (radio !== undefined) values = [radio]
    else if (diam !== undefined) {
      values = [diam / 2]
      assumptions.push(`Se dio el diámetro (${fmt(diam)}): el radio es la mitad, ${fmt(diam / 2)}.`)
    } else if (all.length) {
      values = [all[0]!]
      assumptions.push(`El número ${fmt(all[0]!)} se interpretó como el radio.`)
    }
  } else if (s.params.length === 1) {
    const lado = label(new RegExp(`lado\\s*(?:de|=|:|mide)?\\s*${num}`))
    values = lado !== undefined ? [lado] : all.slice(0, 1)
  } else if (s.params[0]!.name === 'base') {
    const b = label(new RegExp(`base\\s*(?:de|=|:|mide)?\\s*${num}`))
    const h = label(new RegExp(`altura\\s*(?:de|=|:|mide)?\\s*${num}`))
    if (b !== undefined && h !== undefined) values = [b, h]
    else if (all.length >= 2) {
      values = all.slice(0, 2)
      assumptions.push(`Los números se interpretaron en el orden base = ${fmt(values[0]!)}, altura = ${fmt(values[1]!)}.`)
    }
  } else {
    const sides = labeledSides ? labeledSides.slice(1, 4).filter((x) => x !== undefined).map(Number) : all
    if (sides.length >= 3) values = sides.slice(0, 3)
  }
  if (values.length !== s.params.length) {
    if (values.length) assumptions.push(`Faltan medidas para la estrategia elegida (${s.params.map((p) => p.name).join(', ')}).`)
    values = s.defaults
    assumptions.push(`Se usan medidas de ejemplo: ${s.params.map((p, i) => `${p.name} = ${fmt(values[i]!)}`).join(', ')}. El programa sirve para cualquier medida.`)
  }
  const reference = (v: number[]) => {
    if (v.some((x) => x <= 0)) throw new RefError(POS)
    if (s.triangle) {
      const [a, b, c] = v as [number, number, number]
      if (a + b <= c || a + c <= b || b + c <= a) throw new RefError(TRI)
    }
    return s.ref(v)
  }
  const validation: Stmt[] = [
    if_(s.params.map((p) => le(ref(p.name), flt(0))).reduce((x, y) => or(x, y)), [fail(POS)], undefined, { step: 1, note: 'Una longitud no puede ser cero ni negativa' }),
  ]
  if (s.triangle)
    validation.push(
      if_(or(or(le(add(ref('a'), ref('b')), ref('c')), le(add(ref('a'), ref('c')), ref('b'))), le(add(ref('b'), ref('c')), ref('a'))), [fail(TRI)], undefined, {
        step: 2,
        note: 'Cada lado debe ser menor que la suma de los otros dos',
      }),
    )
  const heron = s.formulaText === 'Fórmula de Herón'
  const body: Stmt[] = [
    ...validation,
    ...(heron ? [let_('s', 'float', div(add(add(ref('a'), ref('b')), ref('c')), flt(2)), { step: 3, note: 'Semiperímetro' })] : []),
    ret(s.value, { step: s.triangle ? (heron ? 4 : 3) : 2, note: s.formulaText }),
  ]
  const result = (() => {
    try {
      return reference(values)
    } catch (e) {
      return (e as Error).message
    }
  })()
  const unit = measure === 'area' ? 'u^2' : 'u'
  const mathSteps: MathStep[] = [
    { text: `Fórmula del ${measure === 'area' ? 'área' : 'perímetro'} del ${SHAPE_LABEL[shape]}.`, tex: s.tex },
    { text: 'Datos.', tex: s.params.map((p, i) => `${p.name} = ${texNum(values[i]!)}`).join(',\\quad ') },
  ]
  if (heron && typeof result === 'number') {
    const sp = (values[0]! + values[1]! + values[2]!) / 2
    mathSteps.push({ text: 'Semiperímetro.', tex: `s = \\frac{${values.map(texNum).join(' + ')}}{2} = ${texNum(sp)}` })
    mathSteps.push({ text: 'Sustitución.', tex: `A = \\sqrt{${texNum(sp)} (${texNum(sp)} - ${texNum(values[0]!)})(${texNum(sp)} - ${texNum(values[1]!)})(${texNum(sp)} - ${texNum(values[2]!)})}` })
  }
  const what = `${measure === 'area' ? 'área' : 'perímetro'} del ${SHAPE_LABEL[shape]}`
  return {
    kind: KIND,
    title: `${measure === 'area' ? 'Área' : 'Perímetro'} del ${SHAPE_LABEL[shape]}`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Calcular el ${what} a partir de sus medidas.`,
      goal: `El ${what}.`,
      known: s.params.map((p, i) => `${p.name} = ${fmt(values[i]!)}`),
      unknown: [`${measure === 'area' ? 'A' : 'P'} (${measure === 'area' ? 'en unidades cuadradas' : 'en unidades de longitud'})`],
      constraints: ['Todas las medidas deben ser positivas.', ...(s.triangle ? ['Desigualdad triangular: cada lado es menor que la suma de los otros dos.'] : [])],
      conditions: ['Todas las medidas en la misma unidad.'],
      edgeCases: ['Medidas iguales a 0 o negativas.', ...(s.triangle ? ['Triángulo degenerado, por ejemplo 1, 2, 3 (los puntos quedan alineados).'] : []), ...(shape === 'circulo' ? ['π es irracional: el resultado es una aproximación.'] : [])],
      assumptions,
    }),
    math: {
      steps: mathSteps,
      validity: ['Medidas positivas.', ...(s.triangle ? ['Los lados forman un triángulo.'] : [])],
      result: typeof result === 'number' ? { text: 'Resultado.', tex: `${measure === 'area' ? 'A' : 'P'} ${shape === 'circulo' ? '\\approx' : '='} ${texNum(result)}\\ \\mathrm{${unit}}` } : { text: result },
      symbolicVsProgram: 'La fórmula es general; el programa la aplica a las medidas que reciba y además valida que tengan sentido geométrico, algo que en papel se da por supuesto.',
    },
    strategies,
    strategy: st.id,
    design: {
      inputs: s.params.map((p) => `${p.name}: real`),
      outputs: [`${measure === 'area' ? 'área' : 'perímetro'}: real`],
      variables: heron ? ['s: semiperímetro'] : ['Ninguna adicional.'],
      steps: s.triangle ? ['Validar que las medidas sean positivas.', 'Validar la desigualdad triangular.', ...(heron ? ['Calcular el semiperímetro.', 'Aplicar la fórmula de Herón.'] : ['Aplicar la fórmula.'])] : ['Validar que las medidas sean positivas.', 'Aplicar la fórmula.'],
      conditions: ['Alguna medida ≤ 0 → error.', ...(s.triangle ? ['Desigualdad triangular no cumplida → error.'] : [])],
      loops: ['Ninguno.'],
      special: [],
      complexity: { time: 'O(1)', space: 'O(1)', why: 'Una cantidad fija de operaciones.' },
      comparison: strategies.length > 1 ? 'Base por altura es más simple pero exige conocer la altura; Herón solo necesita los lados, a cambio de más operaciones y de validar que formen un triángulo.' : undefined,
    },
    program: { entry: s.fn, fns: [{ name: s.fn, params: s.params.map((p) => ({ ...p, type: 'float' as const })), returns: 'float', fallible: true, doc: `Calcula el ${what}.`, returnsDoc: `El ${what}.`, failsDoc: s.triangle ? 'Si alguna medida no es positiva o los lados no forman un triángulo.' : 'Si alguna medida no es positiva.', body }] },
    tests: uniqueTests([
      tc(values, () => reference(values), 'normal', 'Las medidas del enunciado.'),
      ...s.extra.map((v) => tc(v, () => reference(v), 'normal', 'Otras medidas válidas.')),
      tc(s.defaults.map((x, i) => (i === 0 ? 0 : x)), () => reference(s.defaults.map((x, i) => (i === 0 ? 0 : x))), 'inválido', 'Una medida igual a 0.'),
      tc(s.defaults.map((x, i) => (i === 0 ? -x : x)), () => reference(s.defaults.map((x, i) => (i === 0 ? -x : x))), 'inválido', 'Una medida negativa.'),
      ...(s.triangle ? [tc([1, 2, 3], () => reference([1, 2, 3]), 'límite', 'Triángulo degenerado: 1 + 2 = 3.')] : []),
    ]),
    sqlNote: 'SQL no aplica: es un cálculo sobre valores sueltos, no una consulta sobre datos tabulares.',
    questions: [
      { stage: 'problem', question: '¿Qué datos necesitamos?', answer: s.params.map((p) => p.name).join(', ') + '.' },
      { stage: 'problem', question: '¿Qué ocurre si una medida es cero?', answer: 'La figura no existe (se degenera): el programa debe rechazarla.' },
      ...(s.triangle ? [{ stage: 'algorithm' as const, question: '¿Cualquier terna de números forma un triángulo?', answer: 'No: cada lado debe ser menor que la suma de los otros dos.' }] : []),
    ],
  }
}

export const geometryKind: KindDef = {
  id: KIND,
  label: 'Geometría',
  description: 'Área y perímetro de rectángulos, cuadrados, círculos y triángulos.',
  examples: [
    { title: 'Área de un círculo', text: 'Área de un círculo de radio 2.5' },
    { title: 'Triángulo por sus lados', text: 'Área de un triángulo de lados 7, 8 y 9' },
    { title: 'Perímetro', text: 'Perímetro de un rectángulo de base 12 y altura 4.5' },
  ],
  detect: (text) => (shapeOf(norm(text)) ? 0.8 : 0),
  build,
}
