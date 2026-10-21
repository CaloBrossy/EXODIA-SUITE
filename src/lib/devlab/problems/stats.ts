import { add, at, div, each, eq, flt, gt, if_, int, len, let_, lt, ref, ret, set, sub, toF, fail, type Stmt } from '../ir'
import { emptyAnalysis, type KindDef, type Solution } from '../types'
import { decimalCommaClarifications, fmt, needsClarification, norm, numbers, texNum } from './shared'
import { tableScript } from './sqlgen'
import { RefError, tc, uniqueTests } from './testing'

const KIND = 'stats' as const
const EMPTY = 'La lista está vacía'

type Op = 'suma' | 'promedio' | 'maximo' | 'minimo' | 'rango'
const OPS: { id: Op; re: RegExp; label: string }[] = [
  { id: 'promedio', re: /promedio|\bmedia\b(?! ?na)/, label: 'Promedio' },
  { id: 'maximo', re: /maximo|\bmayor\b/, label: 'Máximo' },
  { id: 'minimo', re: /minimo|\bmenor\b/, label: 'Mínimo' },
  { id: 'rango', re: /\brango\b|amplitud/, label: 'Rango' },
  { id: 'suma', re: /\bsuma\b|\bsumar\b|\btotal\b/, label: 'Suma' },
]

function reference(op: Op, xs: number[]): number {
  if (op === 'suma') return xs.reduce((a, b) => a + b, 0)
  if (!xs.length) throw new RefError(EMPTY)
  if (op === 'promedio') return xs.reduce((a, b) => a + b, 0) / xs.length
  if (op === 'maximo') return Math.max(...xs)
  if (op === 'minimo') return Math.min(...xs)
  return Math.max(...xs) - Math.min(...xs)
}

function body(op: Op): Stmt[] {
  const guard = if_(eq(len('valores'), int(0)), [fail(EMPTY)], undefined, { step: 1, note: 'Sin datos no hay resultado' })
  const sum = [
    let_('total', 'float', flt(0), { step: 2, note: 'Acumulador; 0 es el neutro de la suma' }),
    each('valor', 'valores', [set('total', add(ref('total'), ref('valor')), { step: 3 })], { step: 3 }),
  ]
  switch (op) {
    case 'suma':
      return [...sum, ret(ref('total'), { step: 4 })]
    case 'promedio':
      return [guard, ...sum, ret(div(ref('total'), toF(len('valores'))), { step: 4, note: 'Convertir la cantidad a real antes de dividir' })]
    case 'maximo':
    case 'minimo': {
      const name = op === 'maximo' ? 'mayor' : 'menor'
      return [
        guard,
        let_(name, 'float', at('valores', int(0)), { step: 2, note: 'El primer elemento es el candidato inicial' }),
        each('valor', 'valores', [if_((op === 'maximo' ? gt : lt)(ref('valor'), ref(name)), [set(name, ref('valor'), { step: 3 })], undefined, { step: 3 })], { step: 3 }),
        ret(ref(name), { step: 4 }),
      ]
    }
    case 'rango':
      return [
        guard,
        let_('mayor', 'float', at('valores', int(0)), { step: 2 }),
        let_('menor', 'float', at('valores', int(0)), { step: 2 }),
        each(
          'valor',
          'valores',
          [if_(gt(ref('valor'), ref('mayor')), [set('mayor', ref('valor'), { step: 3 })], undefined, { step: 3 }), if_(lt(ref('valor'), ref('menor')), [set('menor', ref('valor'), { step: 3 })], undefined, { step: 3 })],
          { step: 3, note: 'Un solo recorrido actualiza ambos extremos' },
        ),
        ret(sub(ref('mayor'), ref('menor')), { step: 4 }),
      ]
  }
}

const SQL_AGG: Record<Op, [string, string]> = {
  suma: ['COALESCE(SUM(valor), 0.0) AS suma', 'SUM devuelve NULL si no hay filas; COALESCE lo reemplaza por 0 para coincidir con el programa.'],
  promedio: ['AVG(valor) AS promedio', 'AVG ignora los NULL y devuelve NULL si la tabla está vacía (el programa, en cambio, lanza un error).'],
  maximo: ['MAX(valor) AS maximo', 'MAX devuelve NULL si la tabla está vacía.'],
  minimo: ['MIN(valor) AS minimo', 'MIN devuelve NULL si la tabla está vacía.'],
  rango: ['MAX(valor) - MIN(valor) AS rango', 'Ambos agregados recorren la tabla; el motor puede hacerlo en una sola pasada.'],
}

function build(text: string): Solution {
  const decimal = decimalCommaClarifications(text)
  if (decimal) return needsClarification(KIND, 'Estadística', { summary: 'Hay números con coma.', ambiguities: ['¿La coma separa decimales o elementos de la lista?'] }, decimal)
  const t = norm(text)
  const found = OPS.filter((o) => o.re.test(t))
  const list = numbers(text)
  if (found.length !== 1) {
    const base = list.length ? list.map(fmt).join(', ') : '4, 8, 15, 16, 23, 42'
    return needsClarification(
      KIND,
      'Estadística',
      { summary: found.length ? 'Se piden varias medidas a la vez.' : 'No se indica qué medida calcular.', ambiguities: ['¿Qué medida hay que calcular? Cada una es un algoritmo distinto.'] },
      (found.length ? found : OPS).map((o) => ({ label: o.label, text: `${o.label} de ${base}` })),
    )
  }
  const op = found[0]!.id
  const assumptions: string[] = []
  let data = list
  if (!data.length) {
    data = [4, 8, 15, 16, 23, 42]
    assumptions.push('No se dieron datos: se usa la lista de ejemplo 4, 8, 15, 16, 23, 42.')
  }
  const label = found[0]!.label.toLowerCase()
  const n = data.length
  const result = reference(op, data)
  const tex: Record<Op, string> = {
    suma: 'S = \\sum_{i=1}^{n} x_i',
    promedio: '\\bar{x} = \\frac{1}{n} \\sum_{i=1}^{n} x_i',
    maximo: '\\max\\{x_1, \\ldots, x_n\\}',
    minimo: '\\min\\{x_1, \\ldots, x_n\\}',
    rango: 'R = \\max_i x_i - \\min_i x_i',
  }
  const shown = data.length > 8 ? [...data.slice(0, 6), NaN] : data
  const listTex = shown.map((x) => (Number.isNaN(x) ? '\\ldots' : texNum(x))).join(',\\ ')
  const subst: Record<Op, string> = {
    suma: `S = ${shown.map((x) => (Number.isNaN(x) ? '\\cdots' : texNum(x))).join(' + ')}`,
    promedio: `\\bar{x} = \\frac{${texNum(data.reduce((a, b) => a + b, 0))}}{${n}}`,
    maximo: `\\max\\{${listTex}\\}`,
    minimo: `\\min\\{${listTex}\\}`,
    rango: `R = ${texNum(Math.max(...data))} - (${texNum(Math.min(...data))})`,
  }
  const [agg, aggNote] = SQL_AGG[op]
  const sqlCode = `${tableScript(data, false)}-- ${found[0]!.label} de la columna valor.\nSELECT ${agg}\nFROM valores;\n`
  const isExtreme = op === 'maximo' || op === 'minimo' || op === 'rango'
  return {
    kind: KIND,
    title: `${found[0]!.label} de ${data.length > 6 ? `${data.slice(0, 6).map(fmt).join(', ')}, …` : data.map(fmt).join(', ')}`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Calcular el ${label} de una lista de ${n} números.`,
      goal: `El ${label} de los valores.`,
      known: [`Valores: ${data.map(fmt).join(', ')}`, `n = ${n}`],
      unknown: [`El ${label}.`],
      constraints: ['Los valores son números reales.', ...(op === 'suma' ? [] : ['La lista no puede estar vacía.'])],
      conditions: ['El orden de los valores no cambia el resultado.'],
      edgeCases: [op === 'suma' ? 'Lista vacía: la suma es 0.' : `Lista vacía: el ${label} no está definido.`, 'Un solo elemento.', 'Valores negativos.', 'Valores repetidos.', ...(op === 'promedio' || op === 'suma' ? ['Muchos decimales: la suma en punto flotante acumula error de redondeo.'] : [])],
      assumptions,
    }),
    math: {
      steps: [
        { text: 'Definición.', tex: tex[op] },
        { text: 'Datos.', tex: `x = (${listTex}),\\quad n = ${n}` },
        { text: 'Sustitución.', tex: subst[op] },
      ],
      validity: op === 'suma' ? ['Definida para cualquier lista (la suma vacía vale 0).'] : ['Requiere n ≥ 1.'],
      result: { text: 'Resultado.', tex: `${op === 'promedio' ? '\\bar{x}' : op === 'suma' ? 'S' : op === 'rango' ? 'R' : `\\${op === 'maximo' ? 'max' : 'min'}`} = ${texNum(result)}` },
      symbolicVsProgram: 'La definición matemática describe el resultado; el programa necesita además un orden concreto de recorrido y una decisión explícita para la lista vacía.',
    },
    strategies: [{ id: 'recorrido', label: 'Un recorrido', summary: isExtreme ? 'Recorrer la lista una vez manteniendo el mejor candidato.' : 'Recorrer la lista una vez acumulando la suma.' }],
    strategy: 'recorrido',
    design: {
      inputs: ['valores: lista de reales'],
      outputs: [`${label}: real`],
      variables: op === 'rango' ? ['mayor, menor: extremos encontrados hasta ahora', 'valor: elemento actual'] : isExtreme ? [`${op === 'maximo' ? 'mayor' : 'menor'}: mejor candidato hasta ahora`, 'valor: elemento actual'] : ['total: acumulador', 'valor: elemento actual'],
      steps: op === 'suma' ? ['(Sin validación: la suma vacía es 0.)', 'Inicializar el acumulador en 0.', 'Sumar cada valor.', 'Devolver el total.'] : isExtreme ? ['Rechazar la lista vacía.', 'Tomar el primer elemento como candidato.', 'Recorrer la lista y actualizar el candidato cuando aparece uno mejor.', 'Devolver el resultado.'] : ['Rechazar la lista vacía.', 'Inicializar el acumulador en 0.', 'Sumar cada valor.', 'Dividir el total por la cantidad de elementos.'],
      conditions: [...(op === 'suma' ? [] : ['Lista vacía → error.']), ...(isExtreme ? ['valor > candidato (o <) → actualizar.'] : [])],
      loops: ['PARA CADA valor EN valores: n iteraciones.'],
      special: isExtreme ? ['Inicializar con el primer elemento evita inventar un "−∞" o "+∞" que no existe en todos los lenguajes.'] : op === 'promedio' ? ['Hay que convertir n a real: en Java, C o Go dividir dos enteros trunca el resultado.'] : [],
      complexity: { time: 'O(n)', space: 'O(1)', why: 'Cada elemento se visita una vez y solo se guardan una o dos variables.' },
    },
    program: {
      entry: op,
      fns: [
        {
          name: op,
          params: [{ name: 'valores', type: 'float[]', doc: 'números a analizar.' }],
          returns: 'float',
          fallible: op !== 'suma',
          doc: `Calcula el ${label} de una lista de números.`,
          returnsDoc: `El ${label} de los valores.`,
          failsDoc: op !== 'suma' ? 'Si la lista está vacía.' : undefined,
          body: body(op),
        },
      ],
    },
    tests: uniqueTests([
      tc([data], () => reference(op, data), 'normal', 'Los datos del enunciado.'),
      tc([[2, 9, 4]], () => reference(op, [2, 9, 4]), 'normal', 'Lista corta desordenada.'),
      tc([[-3, -7, -1]], () => reference(op, [-3, -7, -1]), 'normal', 'Todos negativos: verifica que no se asuma 0 como valor inicial.'),
      tc([[0.5, 1.25, 2]], () => reference(op, [0.5, 1.25, 2]), 'normal', 'Valores decimales.'),
      tc([[5]], () => reference(op, [5]), 'límite', 'Un solo elemento.'),
      tc([[]], () => reference(op, []), op === 'suma' ? 'límite' : 'inválido', op === 'suma' ? 'Lista vacía: suma 0.' : 'Lista vacía.'),
    ]),
    sql: {
      code: sqlCode,
      expected: result,
      explanation: [
        'En SQL no se escribe el recorrido: se declara el resultado con una función de agregación y el motor decide cómo calcularlo.',
        aggNote,
        'La tabla temporal reproduce los datos del enunciado; en una base real ya existiría.',
      ],
    },
    questions: [
      { stage: 'problem', question: '¿Qué ocurre si la lista está vacía?', answer: op === 'suma' ? 'La suma de nada es 0.' : `No hay ${label}: hay que informar un error en lugar de devolver un número inventado.` },
      ...(isExtreme ? [{ stage: 'algorithm' as const, question: '¿Con qué valor empezamos a comparar?', answer: 'Con el primer elemento. Empezar con 0 falla si todos los valores son negativos (o todos mayores que 0, para el mínimo).' }] : []),
      ...(op === 'promedio' ? [{ stage: 'code' as const, question: '¿Por qué convertimos la cantidad a real?', answer: 'Porque en varios lenguajes dividir enteros descarta los decimales.' }] : []),
    ],
  }
}

export const statsKind: KindDef = {
  id: KIND,
  label: 'Estadística básica',
  description: 'Suma, promedio, máximo, mínimo y rango de una lista de números.',
  examples: [
    { title: 'Promedio', text: 'Promedio de 7.5, 9, 6, 8.25 y 10' },
    { title: 'Máximo', text: 'El mayor de -4, 12, 7, 31, -15' },
    { title: 'Rango', text: 'Rango de 18, 23, 15, 30, 27' },
  ],
  detect(text) {
    const t = norm(text)
    if (/maximo comun divisor|\bmcd\b|primeros|hasta|de 1 a/.test(t)) return 0
    return OPS.some((o) => o.re.test(t)) && numbers(text).length >= 2 ? 0.7 : OPS.some((o) => o.re.test(t)) ? 0.3 : 0
  },
  build,
}
