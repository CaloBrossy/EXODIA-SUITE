import { add, and, at, copy, for_, ge, int, len, let_, lt, ref, ret, set, setAt, sub, while_ } from '../ir'
import { emptyAnalysis, type KindDef, type Solution } from '../types'
import { allInts, decimalCommaClarifications, fmt, needsClarification, norm, numbers } from './shared'
import { tc, uniqueTests } from './testing'

const KIND = 'sort' as const

const insertion = (xs: number[], desc: boolean) => {
  const out = xs.slice()
  for (let i = 1; i < out.length; i++) {
    const key = out[i]!
    let j = i - 1
    while (j >= 0 && (desc ? out[j]! < key : out[j]! > key)) {
      out[j + 1] = out[j]!
      j--
    }
    out[j + 1] = key
  }
  return out
}

function build(text: string): Solution {
  const decimal = decimalCommaClarifications(text)
  if (decimal) return needsClarification(KIND, 'Ordenar', { summary: 'Hay números con coma.', ambiguities: ['¿La coma separa decimales o elementos?'] }, decimal)
  const t = norm(text)
  const desc = /mayor a menor|descendente|de mayor/.test(t)
  let data = numbers(text)
  const assumptions: string[] = []
  if (!data.length) {
    data = [5, 3, 1, 4]
    assumptions.push('No se dieron datos: se usa 5, 3, 1, 4.')
  }
  const isInt = allInts(data)
  const cmp = desc ? 'el de la izquierda es menor que la clave' : 'el de la izquierda es mayor que la clave'
  return {
    kind: KIND,
    title: `Ordenar ${desc ? 'descendente' : 'ascendente'}`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Ordenar una lista de ${data.length} números de ${desc ? 'mayor a menor' : 'menor a mayor'} por inserción.`,
      goal: 'Una lista nueva, ordenada. La entrada no se modifica.',
      known: [`Valores: ${data.map(fmt).join(', ')}`],
      unknown: ['La lista ordenada.'],
      constraints: ['Se copia la entrada antes de mover elementos.'],
      conditions: [cmp],
      edgeCases: ['Vacía.', 'Un elemento.', 'Duplicados.', 'Negativos.'],
      assumptions,
    }),
    mathNote: 'Ordenar no es una fórmula: el resultado es una permutación de los datos.',
    math: null,
    strategies: [{ id: 'insercion', label: 'Inserción', summary: 'Insertar cada elemento en su lugar dentro del prefijo ya ordenado. O(n²), estable.' }],
    strategy: 'insercion',
    design: {
      inputs: [`valores: lista de ${isInt ? 'enteros' : 'reales'}`],
      outputs: ['salida: lista ordenada (copia)'],
      variables: ['i: elemento a insertar', 'j: hueco que se desplaza', 'clave: valor extraído'],
      steps: ['Copiar la lista.', 'Para i desde 1 hasta n − 1, extraer la clave.', 'Desplazar a la derecha los mayores (o menores) del prefijo.', 'Dejar la clave en el hueco.', 'Devolver la copia.'],
      conditions: ['j ≥ 0 y el vecino está fuera de orden → desplazar.'],
      loops: ['PARA i; MIENTRAS j ≥ 0.'],
      special: ['La entrada no se muta: se trabaja sobre COPIA(valores).'],
      complexity: { time: 'O(n²)', space: 'O(n)', why: 'Inserción compara en el peor caso i veces por elemento; la copia ocupa n celdas.' },
    },
    program: {
      entry: 'ordenar',
      fns: [
        {
          name: 'ordenar',
          params: [{ name: 'valores', type: isInt ? 'int[]' : 'float[]', doc: 'lista a ordenar (no se modifica).' }],
          returns: isInt ? 'int[]' : 'float[]',
          fallible: false,
          doc: `Ordena una copia de la lista de ${desc ? 'mayor a menor' : 'menor a mayor'} por inserción.`,
          returnsDoc: 'La lista ordenada.',
          body: [
            copy('salida', isInt ? 'int[]' : 'float[]', 'valores', { step: 1, note: 'Copia: la entrada queda intacta' }),
            for_(
              'i',
              int(1),
              sub(len('salida'), int(1)),
              [
                let_('clave', isInt ? 'int' : 'float', at('salida', ref('i')), { step: 2 }),
                let_('j', 'int', sub(ref('i'), int(1)), { step: 2 }),
                while_(
                  and(ge(ref('j'), int(0)), desc ? lt(at('salida', ref('j')), ref('clave')) : lt(ref('clave'), at('salida', ref('j')))),
                  [setAt('salida', add(ref('j'), int(1)), at('salida', ref('j')), { step: 3 }), set('j', sub(ref('j'), int(1)), { step: 3 })],
                  { step: 3, note: 'Y corto-circuita: no se lee salida[-1]' },
                ),
                setAt('salida', add(ref('j'), int(1)), ref('clave'), { step: 4 }),
              ],
              { step: 2 },
            ),
            ret(ref('salida'), { step: 5 }),
          ],
        },
      ],
    },
    tests: uniqueTests([
      tc([data], () => insertion(data, desc), 'normal', 'Los datos del enunciado.'),
      tc([[5, 3, 1]], () => insertion([5, 3, 1], desc), 'normal', 'Tres elementos desordenados.'),
      tc([[1, 2, 2, 1]], () => insertion([1, 2, 2, 1], desc), 'normal', 'Duplicados.'),
      tc([[-2, 0, -5]], () => insertion([-2, 0, -5], desc), 'normal', 'Negativos.'),
      tc([[7]], () => [7], 'límite', 'Un elemento.'),
      tc([[]], () => [], 'límite', 'Vacía.'),
    ]),
    sqlNote: 'ORDER BY describe el resultado, no el algoritmo de inserción. El programa es la referencia.',
    questions: [{ stage: 'algorithm', question: '¿Por qué copiamos la lista?', answer: 'Para no modificar la entrada. El contrato promete una salida nueva.' }],
  }
}

export const sortKind: KindDef = {
  id: KIND,
  label: 'Ordenar una lista',
  description: 'Ordenamiento por inserción, ascendente o descendente, sin mutar la entrada.',
  examples: [
    { title: 'Menor a mayor', text: 'Ordená de menor a mayor 5, 3, 1' },
    { title: 'Mayor a menor', text: 'Ordenar de mayor a menor 2, 9, 4, 4' },
  ],
  detect: (text) => {
    const t = norm(text)
    if (/\border\s+by\b|\bordenad[oa]s?\s+por\b|\bselect\b|\bsin ordenar\b/.test(t)) return 0
    if (/\bordenar(?:los|las)?\b|\bde (?:menor a mayor|mayor a menor)\b/.test(t)) return 0.88
    return 0
  },
  build,
}
