import { add, at, each, fail, flt, for_, if_, int, len, let_, math, mul, ne, ref, ret, set, sub } from '../ir'
import { emptyAnalysis, type KindDef, type Solution } from '../types'
import { fmt, needsClarification, norm, numbers, texNum, unsupported } from './shared'
import { RefError, tc, uniqueTests } from './testing'

const KIND = 'vectors' as const
const DIM = 'Los vectores deben tener la misma dimensión'

type Op = 'escalar' | 'norma'

const opOf = (t: string): Op | null => (/producto (escalar|punto|interno)|\bdot\b/.test(t) ? 'escalar' : /\bnorma\b|modulo del vector|longitud del vector|magnitud/.test(t) ? 'norma' : null)

/** Grupos entre paréntesis o corchetes: dentro de ellos la coma separa componentes. */
const groups = (text: string) => [...text.matchAll(/[([]([^)\]]*)[)\]]/g)].map((m) => numbers(m[1]!.replace(/,/g, ' ')))

const dotRef = (u: number[], v: number[]) => {
  if (u.length !== v.length) throw new RefError(DIM)
  return u.reduce((s, x, i) => s + x * v[i]!, 0)
}
const normRef = (v: number[]) => Math.hypot(...v)

function build(text: string): Solution {
  const t = norm(text)
  const op = opOf(t)
  if (!op)
    return needsClarification(KIND, 'Vectores', { summary: 'Operación con vectores.', ambiguities: ['¿Qué operación hay que hacer?'] }, [
      { label: 'Producto escalar', text: 'Producto escalar de (1, 2, 3) y (4, -5, 6)' },
      { label: 'Norma', text: 'Norma del vector (3, 4)' },
    ])
  const g = groups(text).filter((x) => x.length)
  const assumptions: string[] = []
  if (op === 'escalar') {
    let [u, v] = g
    if (!u || !v) {
      u = [1, 2, 3]
      v = [4, -5, 6]
      assumptions.push('No se dieron dos vectores entre paréntesis: se usan (1, 2, 3) y (4, -5, 6).')
    }
    if (u.length !== v.length) return unsupported(KIND, 'Producto escalar', `${DIM}: (${u.map(fmt).join(', ')}) tiene ${u.length} componentes y (${v.map(fmt).join(', ')}) tiene ${v.length}.`, { ambiguities: ['¿Falta o sobra alguna componente?'] })
    const u_ = u
    const v_ = v
    const result = dotRef(u_, v_)
    const n = u_.length
    return {
      kind: KIND,
      title: 'Producto escalar',
      status: 'ok',
      analysis: emptyAnalysis({
        summary: `Producto escalar de dos vectores de dimensión ${n}.`,
        goal: 'Un número real: u · v.',
        known: [`u = (${u_.map(fmt).join(', ')})`, `v = (${v_.map(fmt).join(', ')})`],
        unknown: ['u · v'],
        constraints: ['Misma dimensión.'],
        conditions: ['Se multiplican componentes en la misma posición.'],
        edgeCases: ['Dimensiones distintas.', 'Vectores vacíos (el producto es 0).', 'Vectores perpendiculares: el resultado es 0.'],
        assumptions,
      }),
      math: {
        steps: [
          { text: 'Definición.', tex: 'u \\cdot v = \\sum_{i=1}^{n} u_i\\, v_i' },
          { text: 'Sustitución.', tex: `u \\cdot v = ${u_.map((x, i) => `(${texNum(x)})(${texNum(v_[i]!)})`).join(' + ')}` },
          { text: 'Productos.', tex: `= ${u_.map((x, i) => texNum(x * v_[i]!)).join(' + ')}` },
        ],
        validity: ['Solo está definido si u y v tienen la misma dimensión.'],
        result: { text: 'Resultado.', tex: `u \\cdot v = ${texNum(result)}` },
        symbolicVsProgram: 'En matemática los índices van de 1 a n; en casi todos los lenguajes van de 0 a n − 1.',
      },
      strategies: [{ id: 'indices', label: 'Recorrido por índice', summary: 'Un índice común recorre ambas listas a la vez.' }],
      strategy: 'indices',
      design: {
        inputs: ['u: lista de reales', 'v: lista de reales'],
        outputs: ['producto: real'],
        variables: ['total: acumulador', 'i: índice compartido'],
        steps: ['Rechazar dimensiones distintas.', 'Inicializar el acumulador en 0.', 'Para cada índice, sumar u[i] · v[i].', 'Devolver el total.'],
        conditions: ['longitud(u) ≠ longitud(v) → error.'],
        loops: ['PARA i DESDE 0 HASTA n − 1.'],
        special: ['PARA CADA no alcanza: hace falta el índice para leer la misma posición en las dos listas.'],
        complexity: { time: 'O(n)', space: 'O(1)', why: 'Una multiplicación y una suma por componente.' },
      },
      program: {
        entry: 'productoEscalar',
        fns: [
          {
            name: 'productoEscalar',
            params: [
              { name: 'u', type: 'float[]', doc: 'primer vector.' },
              { name: 'v', type: 'float[]', doc: 'segundo vector.' },
            ],
            returns: 'float',
            fallible: true,
            doc: 'Calcula el producto escalar de dos vectores.',
            returnsDoc: 'La suma de los productos componente a componente.',
            failsDoc: 'Si los vectores tienen distinta dimensión.',
            body: [
              if_(ne(len('u'), len('v')), [fail(DIM)], undefined, { step: 1 }),
              let_('total', 'float', flt(0), { step: 2 }),
              for_('i', int(0), sub(len('u'), int(1)), [set('total', add(ref('total'), mul(at('u', ref('i')), at('v', ref('i')))), { step: 3 })], { step: 3 }),
              ret(ref('total'), { step: 4 }),
            ],
          },
        ],
      },
      tests: uniqueTests([
        tc([u_, v_], () => dotRef(u_, v_), 'normal', 'Los vectores del enunciado.'),
        tc([[1, 0], [0, 1]], () => dotRef([1, 0], [0, 1]), 'normal', 'Perpendiculares: 0.'),
        tc([[2.5, -1], [4, 3]], () => dotRef([2.5, -1], [4, 3]), 'normal', 'Con decimales y negativos.'),
        tc([[7], [3]], () => dotRef([7], [3]), 'límite', 'Dimensión 1.'),
        tc([[], []], () => dotRef([], []), 'límite', 'Vectores vacíos.'),
        tc([[1, 2, 3], [1, 2]], () => dotRef([1, 2, 3], [1, 2]), 'inválido', 'Dimensiones distintas.'),
      ]),
      sqlNote: 'SQL no aplica de forma natural: haría falta una tabla por vector y un JOIN por posición.',
      questions: [
        { stage: 'problem', question: '¿Se puede multiplicar (1, 2, 3) por (1, 2)?', answer: 'No: el producto escalar exige la misma dimensión.' },
        { stage: 'algorithm', question: '¿Por qué un índice y no PARA CADA?', answer: 'Porque hay que leer la misma posición en dos listas.' },
      ],
    }
  }
  let v = g[0]
  if (!v) {
    v = [3, 4]
    assumptions.push('No se dio un vector entre paréntesis: se usa (3, 4).')
  }
  const v_ = v
  const result = normRef(v_)
  return {
    kind: KIND,
    title: `Norma de (${v_.map(fmt).join(', ')})`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Longitud (norma euclídea) de un vector de dimensión ${v_.length}.`,
      goal: '‖v‖, un real no negativo.',
      known: [`v = (${v_.map(fmt).join(', ')})`],
      unknown: ['‖v‖'],
      constraints: ['Cualquier vector real.'],
      conditions: ['Raíz de la suma de los cuadrados.'],
      edgeCases: ['Vector nulo: norma 0.', 'Vector vacío: norma 0.', 'Componentes negativas: el cuadrado las vuelve positivas.'],
      assumptions,
    }),
    math: {
      steps: [
        { text: 'Definición (teorema de Pitágoras generalizado).', tex: '\\lVert v \\rVert = \\sqrt{\\sum_{i=1}^{n} v_i^2}' },
        { text: 'Sustitución.', tex: `\\lVert v \\rVert = \\sqrt{${v_.map((x) => `(${texNum(x)})^2`).join(' + ')}} = \\sqrt{${texNum(v_.reduce((s, x) => s + x * x, 0))}}` },
      ],
      validity: ['La suma de cuadrados nunca es negativa: la raíz siempre existe.'],
      result: { text: 'Resultado.', tex: `\\lVert v \\rVert ${Number.isInteger(result) ? '=' : '\\approx'} ${texNum(result)}` },
      symbolicVsProgram: 'La fórmula es exacta; el programa calcula en punto flotante, así que √2 queda aproximado.',
    },
    strategies: [{ id: 'cuadrados', label: 'Suma de cuadrados', summary: 'Acumular v_i · v_i y sacar la raíz al final.' }],
    strategy: 'cuadrados',
    design: {
      inputs: ['v: lista de reales'],
      outputs: ['norma: real ≥ 0'],
      variables: ['suma: acumulador de cuadrados', 'componente: valor actual'],
      steps: ['Inicializar el acumulador en 0.', 'Sumar el cuadrado de cada componente.', 'Devolver la raíz cuadrada.'],
      conditions: ['Ninguna: está definida para todo vector.'],
      loops: ['PARA CADA componente EN v.'],
      special: ['Se multiplica x · x en lugar de usar potencia: es exacto y más barato.'],
      complexity: { time: 'O(n)', space: 'O(1)', why: 'Un cuadrado y una suma por componente.' },
    },
    program: {
      entry: 'norma',
      fns: [
        {
          name: 'norma',
          params: [{ name: 'v', type: 'float[]', doc: 'vector.' }],
          returns: 'float',
          fallible: false,
          doc: 'Calcula la norma euclídea de un vector.',
          returnsDoc: 'La longitud del vector.',
          body: [
            let_('suma', 'float', flt(0), { step: 1 }),
            each('componente', 'v', [set('suma', add(ref('suma'), mul(ref('componente'), ref('componente'))), { step: 2 })], { step: 2 }),
            ret(math('sqrt', ref('suma')), { step: 3 }),
          ],
        },
      ],
    },
    tests: uniqueTests([
      tc([v_], () => normRef(v_), 'normal', 'El vector del enunciado.'),
      tc([[3, 4]], () => 5, 'normal', 'Terna pitagórica: 5.'),
      tc([[1, 1]], () => Math.SQRT2, 'normal', 'Resultado irracional: √2.'),
      tc([[-2, 3, -6]], () => 7, 'normal', 'Negativos en 3D: 7.'),
      tc([[0, 0, 0]], () => 0, 'límite', 'Vector nulo.'),
      tc([[]], () => 0, 'límite', 'Vector vacío.'),
    ]),
    sqlNote: 'SQL no aplica: es un cálculo sobre un único vector.',
    questions: [{ stage: 'math', question: '¿Puede la norma ser negativa?', answer: 'No: es la raíz de una suma de cuadrados.' }],
  }
}

export const vectorsKind: KindDef = {
  id: KIND,
  label: 'Vectores',
  description: 'Producto escalar y norma euclídea.',
  examples: [
    { title: 'Producto escalar', text: 'Producto escalar de (1, 2, 3) y (4, -5, 6)' },
    { title: 'Norma', text: 'Norma del vector (2, -3, 6)' },
  ],
  detect: (text) => (opOf(norm(text)) ? 0.9 : /vector/.test(norm(text)) ? 0.6 : 0),
  build,
}
