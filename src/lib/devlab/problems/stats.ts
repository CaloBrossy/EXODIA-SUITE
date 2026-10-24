import { add, and, at, call, div, each, eq, fail, flt, for_, gt, idiv, if_, int, le, len, let_, lt, math, mod, mul, ref, ret, set, sub, toF, type Fn, type Program, type Stmt } from '../ir'
import { emptyAnalysis, type KindDef, type Solution } from '../types'
import { decimalCommaClarifications, fmt, needsClarification, norm, numbers, texNum } from './shared'
import { tableScript } from './sqlgen'
import { RefError, tc, uniqueTests } from './testing'

const KIND = 'stats' as const
const EMPTY = 'La lista está vacía'

type Op = 'suma' | 'promedio' | 'maximo' | 'minimo' | 'rango' | 'mediana' | 'moda' | 'varianza_pob' | 'varianza_mue' | 'desvio_pob' | 'desvio_mue' | 'percentil' | 'conteo' | 'producto'
const OPS: { id: Op; re: RegExp; label: string }[] = [
  { id: 'mediana', re: /\bmediana\b/, label: 'Mediana' },
  { id: 'moda', re: /\bmoda\b/, label: 'Moda' },
  { id: 'varianza_pob', re: /varianza poblacional/, label: 'Varianza poblacional' },
  { id: 'varianza_mue', re: /varianza muestral/, label: 'Varianza muestral' },
  { id: 'desvio_pob', re: /desvi(?:o|acion)(?: estandar)? poblacional/, label: 'Desvío poblacional' },
  { id: 'desvio_mue', re: /desvi(?:o|acion)(?: estandar)? muestral/, label: 'Desvío muestral' },
  { id: 'percentil', re: /\bpercentil\b/, label: 'Percentil' },
  { id: 'conteo', re: /\bconteo\b|cantidad de (?:elementos|valores|numeros)/, label: 'Conteo' },
  { id: 'producto', re: /\bproducto\b/, label: 'Producto' },
  { id: 'promedio', re: /promedio|\bmedia\b(?! ?na)/, label: 'Promedio' },
  { id: 'maximo', re: /maximo|\bmayor\b/, label: 'Máximo' },
  { id: 'minimo', re: /minimo|\bmenor\b/, label: 'Mínimo' },
  { id: 'rango', re: /\brango\b|amplitud/, label: 'Rango' },
  { id: 'suma', re: /\bsuma\b|\bsumar\b|(?<!en )\btotal\b/, label: 'Suma' },
]

const SPARSE = 'n debe ser al menos 2 para la varianza muestral'
const MULTI_MODE = 'Hay varias modas: indicá cuál o reformulá el enunciado'

function kth(xs: number[], k: number): number {
  for (const cand of xs) {
    const menores = xs.filter((x) => x < cand).length
    const iguales = xs.filter((x) => x === cand).length
    if (menores <= k && k < menores + iguales) return cand
  }
  throw new RefError(EMPTY)
}

function modesOf(xs: number[]): number[] {
  const freq = new Map<number, number>()
  for (const x of xs) freq.set(x, (freq.get(x) ?? 0) + 1)
  const best = Math.max(0, ...freq.values())
  return [...freq.entries()].filter(([, n]) => n === best).map(([v]) => v)
}

function reference(op: Op, xs: number[], p = 50): number {
  if (op === 'conteo') return xs.length
  if (op === 'suma') return xs.reduce((a, b) => a + b, 0)
  if (op === 'producto') return xs.reduce((a, b) => a * b, 1)
  if (!xs.length) throw new RefError(EMPTY)
  if (op === 'promedio') return xs.reduce((a, b) => a + b, 0) / xs.length
  if (op === 'maximo') return Math.max(...xs)
  if (op === 'minimo') return Math.min(...xs)
  if (op === 'rango') return Math.max(...xs) - Math.min(...xs)
  if (op === 'mediana') {
    const n = xs.length
    return n % 2 ? kth(xs, (n - 1) / 2) : (kth(xs, n / 2 - 1) + kth(xs, n / 2)) / 2
  }
  if (op === 'moda') {
    const ms = modesOf(xs)
    if (ms.length !== 1) throw new RefError(MULTI_MODE)
    return ms[0]!
  }
  if (op === 'percentil') {
    if (p < 0 || p > 100) throw new RefError('El percentil debe estar entre 0 y 100')
    const rank = Math.max(1, Math.ceil((p / 100) * xs.length))
    return kth(xs, rank - 1)
  }
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const ss = xs.reduce((a, x) => a + (x - mean) ** 2, 0)
  if (op === 'varianza_pob') return ss / xs.length
  if (op === 'desvio_pob') return Math.sqrt(ss / xs.length)
  if (xs.length < 2) throw new RefError(SPARSE)
  if (op === 'varianza_mue') return ss / (xs.length - 1)
  return Math.sqrt(ss / (xs.length - 1))
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
    case 'conteo':
      return [ret(toF(len('valores')), { step: 1 })]
    case 'producto':
      return [
        let_('total', 'float', flt(1), { step: 1, note: '1 es el neutro del producto' }),
        each('valor', 'valores', [set('total', mul(ref('total'), ref('valor')), { step: 2 })], { step: 2 }),
        ret(ref('total'), { step: 3 }),
      ]
    default:
      return [guard, ret(flt(0), { step: 2 })]
  }
}

function kthFn(): Fn {
  return {
    name: 'enesimo',
    params: [
      { name: 'valores', type: 'float[]', doc: 'lista.' },
      { name: 'k', type: 'int', doc: 'posición 0-indexada en el orden creciente.' },
    ],
    returns: 'float',
    fallible: false,
    doc: 'Devuelve el k-ésimo menor sin reordenar la lista, contando cuántos son menores.',
    returnsDoc: 'El valor en esa posición del orden.',
    body: [
      for_(
        'i',
        int(0),
        sub(len('valores'), int(1)),
        [
          let_('candidato', 'float', at('valores', ref('i')), { step: 2 }),
          let_('menores', 'int', int(0), { step: 2 }),
          let_('iguales', 'int', int(0), { step: 2 }),
          for_(
            'j',
            int(0),
            sub(len('valores'), int(1)),
            [
              if_(lt(at('valores', ref('j')), ref('candidato')), [set('menores', add(ref('menores'), int(1)), { step: 3 })], undefined, { step: 3 }),
              if_(eq(at('valores', ref('j')), ref('candidato')), [set('iguales', add(ref('iguales'), int(1)), { step: 3 })], undefined, { step: 3 }),
            ],
            { step: 3 },
          ),
          if_(and(le(ref('menores'), ref('k')), lt(ref('k'), add(ref('menores'), ref('iguales')))), [ret(ref('candidato'), { step: 4 })], undefined, { step: 4 }),
        ],
        { step: 2 },
      ),
      ret(at('valores', int(0)), { step: 5 }),
    ],
  }
}

function programOf(op: Op, label: string, p = 50): Program {
  const simple: Op[] = ['suma', 'promedio', 'maximo', 'minimo', 'rango', 'conteo', 'producto']
  if (simple.includes(op)) {
    return {
      entry: op,
      fns: [
        {
          name: op,
          params: [{ name: 'valores', type: 'float[]', doc: 'números a analizar.' }],
          returns: 'float',
          fallible: op !== 'suma' && op !== 'conteo' && op !== 'producto',
          doc: `Calcula el ${label} de una lista de números.`,
          returnsDoc: `El ${label} de los valores.`,
          failsDoc: op !== 'suma' && op !== 'conteo' && op !== 'producto' ? 'Si la lista está vacía.' : undefined,
          body: body(op),
        },
      ],
    }
  }
  const guard = if_(eq(len('valores'), int(0)), [fail(EMPTY)], undefined, { step: 1 })
  if (op === 'mediana') {
    return {
      entry: 'mediana',
      fns: [
        kthFn(),
        {
          name: 'mediana',
          params: [{ name: 'valores', type: 'float[]', doc: 'números a analizar.' }],
          returns: 'float',
          fallible: true,
          doc: 'Mediana: valor central del orden. Si n es par, promedio de los dos centrales.',
          returnsDoc: 'La mediana.',
          failsDoc: 'Si la lista está vacía.',
          body: [
            guard,
            let_('n', 'int', len('valores'), { step: 2 }),
            if_(eq(mod(ref('n'), int(2)), int(1)), [ret(call('enesimo', ref('valores'), idiv(sub(ref('n'), int(1)), int(2))), { step: 3 })], undefined, { step: 3 }),
            let_('a', 'float', call('enesimo', ref('valores'), sub(idiv(ref('n'), int(2)), int(1))), { step: 4 }),
            let_('b', 'float', call('enesimo', ref('valores'), idiv(ref('n'), int(2))), { step: 4 }),
            ret(div(add(ref('a'), ref('b')), flt(2)), { step: 5 }),
          ],
        },
      ],
    }
  }
  if (op === 'percentil') {
    const rankNote = `Rango nearest-rank: ceil(p/100 · n), p = ${p}`
    return {
      entry: 'percentil',
      fns: [
        kthFn(),
        {
          name: 'percentil',
          params: [{ name: 'valores', type: 'float[]', doc: 'números a analizar.' }],
          returns: 'float',
          fallible: true,
          doc: `Percentil ${p} por el método nearest-rank (NIST). ${rankNote}.`,
          returnsDoc: `El percentil ${p}.`,
          failsDoc: 'Si la lista está vacía.',
          body: [
            guard,
            let_('n', 'int', len('valores'), { step: 2 }),
            let_('rango', 'int', math('ceil', mul(div(flt(p), flt(100)), toF(ref('n')))), { step: 3, note: rankNote }),
            if_(lt(ref('rango'), int(1)), [set('rango', int(1), { step: 3 })], undefined, { step: 3 }),
            ret(call('enesimo', ref('valores'), sub(ref('rango'), int(1))), { step: 4 }),
          ],
        },
      ],
    }
  }
  if (op === 'moda') {
    return {
      entry: 'moda',
      fns: [
        {
          name: 'moda',
          params: [{ name: 'valores', type: 'float[]', doc: 'números a analizar.' }],
          returns: 'float',
          fallible: true,
          doc: 'Moda: el único valor de mayor frecuencia. Si hay empate, error.',
          returnsDoc: 'La moda.',
          failsDoc: 'Lista vacía o varias modas.',
          body: [
            guard,
            let_('mejor', 'float', at('valores', int(0)), { step: 2 }),
            let_('maxFreq', 'int', int(0), { step: 2 }),
            let_('empates', 'int', int(0), { step: 2 }),
            each(
              'candidato',
              'valores',
              [
                let_('freq', 'int', int(0), { step: 3 }),
                each('valor', 'valores', [if_(eq(ref('valor'), ref('candidato')), [set('freq', add(ref('freq'), int(1)), { step: 3 })], undefined, { step: 3 })], { step: 3 }),
                if_(
                  gt(ref('freq'), ref('maxFreq')),
                  [set('maxFreq', ref('freq'), { step: 4 }), set('mejor', ref('candidato'), { step: 4 }), set('empates', int(1), { step: 4 })],
                  [if_(and(eq(ref('freq'), ref('maxFreq')), lt(ref('candidato'), ref('mejor'))), [set('empates', add(ref('empates'), int(1)), { step: 4 })], [if_(and(eq(ref('freq'), ref('maxFreq')), gt(ref('candidato'), ref('mejor'))), [set('empates', add(ref('empates'), int(1)), { step: 4 })])])],
                  { step: 4 },
                ),
              ],
              { step: 3 },
            ),
            if_(gt(ref('empates'), int(1)), [fail(MULTI_MODE)], undefined, { step: 5 }),
            ret(ref('mejor'), { step: 6 }),
          ],
        },
      ],
    }
  }
  const sample = op === 'varianza_mue' || op === 'desvio_mue'
  const root = op === 'desvio_pob' || op === 'desvio_mue'
  const name = root ? 'desvio' : 'varianza'
  return {
    entry: name,
    fns: [
      {
        name,
        params: [{ name: 'valores', type: 'float[]', doc: 'números a analizar.' }],
        returns: 'float',
        fallible: true,
        doc: sample ? 'Varianza o desvío muestral (÷ n − 1).' : 'Varianza o desvío poblacional (÷ n).',
        returnsDoc: 'La medida.',
        failsDoc: sample ? 'Si n < 2.' : 'Si la lista está vacía.',
        body: [
          guard,
          ...(sample ? [if_(lt(len('valores'), int(2)), [fail(SPARSE)], undefined, { step: 1 })] : []),
          let_('total', 'float', flt(0), { step: 2 }),
          each('valor', 'valores', [set('total', add(ref('total'), ref('valor')), { step: 2 })], { step: 2 }),
          let_('media', 'float', div(ref('total'), toF(len('valores'))), { step: 3 }),
          let_('ss', 'float', flt(0), { step: 4 }),
          each('valor', 'valores', [set('ss', add(ref('ss'), mul(sub(ref('valor'), ref('media')), sub(ref('valor'), ref('media')))), { step: 4 })], { step: 4 }),
          let_('den', 'float', sample ? sub(toF(len('valores')), flt(1)) : toF(len('valores')), { step: 5 }),
          ret(root ? math('sqrt', div(ref('ss'), ref('den'))) : div(ref('ss'), ref('den')), { step: 6 }),
        ],
      },
    ],
  }
}

const SQL_AGG: Partial<Record<Op, [string, string]>> = {
  suma: ['COALESCE(SUM(valor), 0.0) AS suma', 'SUM devuelve NULL si no hay filas; COALESCE lo reemplaza por 0 para coincidir con el programa.'],
  promedio: ['AVG(valor) AS promedio', 'AVG ignora los NULL y devuelve NULL si la tabla está vacía (el programa, en cambio, lanza un error).'],
  maximo: ['MAX(valor) AS maximo', 'MAX devuelve NULL si la tabla está vacía.'],
  minimo: ['MIN(valor) AS minimo', 'MIN devuelve NULL si la tabla está vacía.'],
  rango: ['MAX(valor) - MIN(valor) AS rango', 'Ambos agregados recorren la tabla; el motor puede hacerlo en una sola pasada.'],
  conteo: ['COUNT(*) AS conteo', 'COUNT(*) cuenta filas, incluida la tabla vacía (0).'],
  producto: ['EXP(COALESCE(SUM(LN(valor)), 0.0)) AS producto', 'El producto se obtiene como exp(suma de logs); solo vale para positivos.'],
}

function build(text: string): Solution {
  const decimal = decimalCommaClarifications(text)
  if (decimal) return needsClarification(KIND, 'Estadística', { summary: 'Hay números con coma.', ambiguities: ['¿La coma separa decimales o elementos de la lista?'] }, decimal)
  const t = norm(text)
  const list = numbers(text)
  const base = list.length ? list.map(fmt).join(', ') : '4, 8, 15, 16, 23, 42'
  if (/\bvarianza\b/.test(t) && !/poblacional|muestral/.test(t))
    return needsClarification(KIND, 'Varianza', { summary: 'Hay dos convenciones de varianza.', ambiguities: ['¿Varianza poblacional (÷ n) o muestral (÷ n − 1)?'] }, [
      { label: 'Poblacional', text: `Varianza poblacional de ${base}` },
      { label: 'Muestral', text: `Varianza muestral de ${base}` },
    ])
  if (/desvi(?:o|acion)/.test(t) && !/poblacional|muestral/.test(t))
    return needsClarification(KIND, 'Desvío', { summary: 'Hay dos convenciones de desvío estándar.', ambiguities: ['¿Desvío poblacional o muestral?'] }, [
      { label: 'Poblacional', text: `Desvío estándar poblacional de ${base}` },
      { label: 'Muestral', text: `Desvío estándar muestral de ${base}` },
    ])
  const found = OPS.filter((o) => o.re.test(t))
  if (found.length !== 1) {
    const base = list.length ? list.map(fmt).join(', ') : '4, 8, 15, 16, 23, 42'
    const classic: Op[] = ['promedio', 'maximo', 'minimo', 'rango', 'suma']
    const suggest = found.length ? found : OPS.filter((o) => classic.includes(o.id))
    return needsClarification(
      KIND,
      'Estadística',
      { summary: found.length ? 'Se piden varias medidas a la vez.' : 'No se indica qué medida calcular.', ambiguities: ['¿Qué medida hay que calcular? Cada una es un algoritmo distinto.'] },
      suggest.map((o) => ({ label: o.label, text: `${o.label} de ${base}` })),
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
  const pct = Number(t.match(/percentil\s+(\d+)/)?.[1] ?? t.match(/(\d+)\s*(?:-?esimo\s+)?percentil/)?.[1] ?? 50)
  if (op === 'moda' && modesOf(data).length !== 1)
    return needsClarification(KIND, 'Moda', { summary: 'Hay varias modas.', ambiguities: [`Valores de máxima frecuencia: ${modesOf(data).map(fmt).join(', ')}.`] }, modesOf(data).map((x) => ({ label: `Usar ${fmt(x)}`, text: `Máximo de ${fmt(x)}, ${fmt(x)}` })))
  const result = reference(op, data, pct)
  const tex: Partial<Record<Op, string>> = {
    suma: 'S = \\sum_{i=1}^{n} x_i',
    promedio: '\\bar{x} = \\frac{1}{n} \\sum_{i=1}^{n} x_i',
    maximo: '\\max\\{x_1, \\ldots, x_n\\}',
    minimo: '\\min\\{x_1, \\ldots, x_n\\}',
    rango: 'R = \\max_i x_i - \\min_i x_i',
    mediana: n % 2 ? 'x_{(n+1)/2}' : '\\tfrac{1}{2}(x_{n/2}+x_{n/2+1})',
    moda: 'valor de mayor frecuencia (única)',
    varianza_pob: '\\sigma^2 = \\frac{1}{n}\\sum (x_i-\\bar{x})^2',
    varianza_mue: 's^2 = \\frac{1}{n-1}\\sum (x_i-\\bar{x})^2',
    desvio_pob: '\\sigma = \\sqrt{\\sigma^2}',
    desvio_mue: 's = \\sqrt{s^2}',
    percentil: `P_{${pct}}\\ \\text{nearest-rank}`,
    conteo: 'n',
    producto: '\\prod x_i',
  }
  const shown = data.length > 8 ? [...data.slice(0, 6), NaN] : data
  const listTex = shown.map((x) => (Number.isNaN(x) ? '\\ldots' : texNum(x))).join(',\\ ')
  const subst: Partial<Record<Op, string>> = {
    suma: `S = ${shown.map((x) => (Number.isNaN(x) ? '\\cdots' : texNum(x))).join(' + ')}`,
    promedio: `\\bar{x} = \\frac{${texNum(data.reduce((a, b) => a + b, 0))}}{${n}}`,
    maximo: `\\max\\{${listTex}\\}`,
    minimo: `\\min\\{${listTex}\\}`,
    rango: `R = ${texNum(Math.max(...data))} - (${texNum(Math.min(...data))})`,
  }
  const sqlPair = SQL_AGG[op]
  const sqlCode = sqlPair ? `${tableScript(data, false)}-- ${found[0]!.label} de la columna valor.\nSELECT ${sqlPair[0]}\nFROM valores;\n` : ''
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
        { text: 'Definición.', tex: tex[op] ?? label },
        { text: 'Datos.', tex: `x = (${listTex}),\\quad n = ${n}` },
        { text: 'Sustitución.', tex: subst[op] ?? `${label} = ${texNum(result)}` },
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
      steps:
        op === 'mediana'
          ? ['Rechazar la lista vacía.', 'Leer n.', 'Si n es impar, devolver el central.', 'Si n es par, promediar los dos centrales.', 'El k-ésimo se elige contando menores, sin reordenar.']
          : op === 'moda'
            ? ['Rechazar la lista vacía.', 'Inicializar el mejor candidato.', 'Contar la frecuencia de cada valor.', 'Si hay empate de máximas frecuencias, error.', 'Si hay más de una moda, rechazar.', 'Devolver la moda única.']
            : op === 'varianza_pob' || op === 'varianza_mue' || op === 'desvio_pob' || op === 'desvio_mue'
              ? ['Rechazar la lista vacía (y n < 2 si es muestral).', 'Sumar para la media.', 'Calcular la media.', 'Acumular (x − media)².', 'den ← n o n − 1.', 'Devolver ss/den o su raíz.']
              : op === 'percentil'
                ? ['Rechazar la lista vacía.', 'Leer n.', 'rango ← ceil(p/100 · n) (nearest-rank).', 'Devolver el (rango − 1)-ésimo.']
                : op === 'conteo'
                  ? ['Devolver la longitud.']
                  : op === 'producto'
                    ? ['Inicializar el acumulador en 1.', 'Multiplicar cada valor.', 'Devolver el total.']
                    : op === 'suma'
                      ? ['(Sin validación: la suma vacía es 0.)', 'Inicializar el acumulador en 0.', 'Sumar cada valor.', 'Devolver el total.']
                      : isExtreme
                        ? ['Rechazar la lista vacía.', 'Tomar el primer elemento como candidato.', 'Recorrer la lista y actualizar el candidato cuando aparece uno mejor.', 'Devolver el resultado.']
                        : ['Rechazar la lista vacía.', 'Inicializar el acumulador en 0.', 'Sumar cada valor.', 'Dividir el total por la cantidad de elementos.'],
      conditions: [...(op === 'suma' ? [] : ['Lista vacía → error.']), ...(isExtreme ? ['valor > candidato (o <) → actualizar.'] : [])],
      loops: ['PARA CADA valor EN valores: n iteraciones.'],
      special: isExtreme ? ['Inicializar con el primer elemento evita inventar un "−∞" o "+∞" que no existe en todos los lenguajes.'] : op === 'promedio' ? ['Hay que convertir n a real: en Java, C o Go dividir dos enteros trunca el resultado.'] : [],
      complexity: { time: 'O(n)', space: 'O(1)', why: 'Cada elemento se visita una vez y solo se guardan una o dos variables.' },
    },
    program: programOf(op, label, pct),
    tests: uniqueTests([
      tc([data], () => reference(op, data, pct), 'normal', 'Los datos del enunciado.'),
      tc([[2, 9, 4]], () => reference(op, [2, 9, 4], pct), 'normal', 'Lista corta desordenada.'),
      tc([[-3, -7, -1]], () => reference(op, [-3, -7, -1], pct), 'normal', 'Todos negativos: verifica que no se asuma 0 como valor inicial.'),
      tc([[0.5, 1.25, 2]], () => reference(op, [0.5, 1.25, 2], pct), 'normal', 'Valores decimales.'),
      tc([[5]], () => reference(op, [5], pct), 'límite', 'Un solo elemento.'),
      tc([[]], () => reference(op, [], pct), op === 'suma' || op === 'conteo' || op === 'producto' ? 'límite' : 'inválido', op === 'suma' ? 'Lista vacía: suma 0.' : 'Lista vacía.'),
    ]),
    ...(sqlPair
      ? {
          sql: {
            code: sqlCode,
            expected: result,
            explanation: ['En SQL no se escribe el recorrido: se declara el resultado con una función de agregación y el motor decide cómo calcularlo.', sqlPair[1], 'La tabla temporal reproduce los datos del enunciado; en una base real ya existiría.'],
          },
        }
      : { sqlNote: 'Esta medida no tiene un agregado SQL portable en SQLite; el programa es la referencia.' }),
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
  description: 'Suma, promedio, máximo, mínimo, rango, mediana, moda, varianza, desvío, percentil, conteo y producto.',
  examples: [
    { title: 'Promedio', text: 'Promedio de 7.5, 9, 6, 8.25 y 10' },
    { title: 'Máximo', text: 'El mayor de -4, 12, 7, 31, -15' },
    { title: 'Rango', text: 'Rango de 18, 23, 15, 30, 27' },
    { title: 'Mediana', text: 'Mediana de 3, 1, 4, 2, 5' },
    { title: 'Varianza poblacional', text: 'Varianza poblacional de 2, 4, 4, 4, 5, 5, 7, 9' },
  ],
  detect(text) {
    const t = norm(text)
    if (/maximo comun divisor|\bmcd\b|primeros|hasta|de 1 a|subarreglo|kadane|producto vectorial|producto cruz/.test(t)) return 0
    return OPS.some((o) => o.re.test(t)) && numbers(text).length >= 2 ? 0.7 : OPS.some((o) => o.re.test(t)) ? 0.3 : 0
  },
  build,
}
