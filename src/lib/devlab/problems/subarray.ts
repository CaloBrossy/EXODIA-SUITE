import { add, and, at, eq, fail, for_, ge, gt, if_, int, le, len, let_, lt, or, ref, ret, set, sub } from '../ir'
import { emptyAnalysis, type KindDef, type Solution } from '../types'
import { analyzeStatement, lengthBoundOf, type LengthBound } from '../understanding'
import { decimalCommaClarifications, fmt, needsClarification, norm, numbers, texNum } from './shared'
import { RefError, tc, uniqueTests } from './testing'

const KIND = 'subarray' as const
const EMPTY = 'La lista está vacía'
const BAD_K = 'k debe estar entre 1 y n'
const BAD_LR = 'L y R deben cumplir 1 ≤ L ≤ R y L ≤ n'
const NO_WINDOW = 'No hay un subarreglo con esa longitud'

/** Oráculo: máxima suma de un tramo de longitud entre lo y hi, inclusive. */
export function bruteWindow(xs: number[], lo: number, hi: number): number {
  if (!xs.length) throw new RefError(EMPTY)
  let best: number | null = null
  for (let i = 0; i < xs.length; i++) {
    let s = 0
    for (let j = i; j < xs.length; j++) {
      s += xs[j]!
      const n = j - i + 1
      if (n >= lo && n <= hi) best = best === null ? s : Math.max(best, s)
    }
  }
  if (best === null) throw new RefError(lo < 1 || hi < lo || lo > xs.length ? BAD_LR : BAD_K)
  return best
}

function kadane(xs: number[]): number {
  if (!xs.length) throw new RefError(EMPTY)
  let best = xs[0]!
  let cur = xs[0]!
  for (let i = 1; i < xs.length; i++) {
    cur = Math.max(xs[i]!, cur + xs[i]!)
    best = Math.max(best, cur)
  }
  return best
}

function buildBounded(text: string, bound: LengthBound): Solution {
  const reading = analyzeStatement(text)
  const assumptions: string[] = []
  let data = reading.data
  if (!data.length) {
    data = [1, -2, 3, 4, -1, 2]
    assumptions.push('No se dieron datos: se usa 1, -2, 3, 4, -1, 2.')
  }
  if (bound.mode === 'exact') {
    let k = bound.k
    if (k === null) {
      k = Math.min(3, data.length)
      assumptions.push(`No se dio K: se usa k = ${k}.`)
    }
    const shown = data.length > 6 ? `${data.slice(0, 6).map(fmt).join(', ')}, …` : data.map(fmt).join(', ')
    return {
      kind: KIND,
      title: `Máximo subarreglo de longitud ${k} de ${shown}`,
      status: 'ok',
      analysis: emptyAnalysis({
        summary: `Suma máxima de un subarreglo contiguo de longitud exacta ${k}.`,
        goal: 'Un número: la mayor suma de un tramo de longitud K.',
        known: [`Valores: ${data.map(fmt).join(', ')}`, `K = ${k}`],
        unknown: ['La suma máxima.'],
        constraints: ['El subarreglo no puede ser vacío.', `La longitud debe ser exactamente ${k}.`, 'Kadane no aplica: ignora la cota de longitud.'],
        conditions: ['Se desliza una ventana de tamaño K y se actualiza el mejor.'],
        edgeCases: ['n < K: error.', 'Todos negativos.', 'Un solo elemento si K = 1.', 'Lista vacía: error.'],
        assumptions,
      }),
      math: {
        steps: [
          { text: 'Definición.', tex: `\\max_{0 \\le i \\le n-k} \\sum_{t=0}^{k-1} x_{i+t}` },
          { text: 'Ventana deslizante.', tex: 's_i = s_{i-1} - x_{i-1} + x_{i+k-1}' },
        ],
        validity: [`Requiere 1 ≤ k ≤ n.`],
        result: { text: 'Resultado.', tex: `${texNum(bruteWindow(data, k, k))}` },
        symbolicVsProgram: 'La ventana reutiliza la suma anterior; no se reexploran los k elementos en cada posición.',
      },
      strategies: [{ id: 'ventana', label: 'Ventana de tamaño K', summary: 'Un recorrido: se mantiene la suma de k elementos consecutivos.' }],
      strategy: 'ventana',
      design: {
        inputs: ['valores: lista de reales', 'k: entero, longitud de la ventana'],
        outputs: ['suma: real'],
        variables: ['suma: suma de la ventana actual', 'mejor: mejor suma vista'],
        steps: ['Rechazar lista vacía.', 'Rechazar k fuera de 1..n.', 'Sumar los primeros k.', 'Deslizar: sumar el que entra y restar el que sale.', 'Devolver mejor.'],
        conditions: ['Lista vacía → error.', 'k < 1 o k > n → error.'],
        loops: ['PARA i DESDE 0 HASTA k − 1; PARA i DESDE k HASTA n − 1.'],
        special: ['No se muta la lista. La cota de longitud se respeta en cada ventana.'],
        complexity: { time: 'O(n)', space: 'O(1)', why: 'Un pase después de la ventana inicial.' },
      },
      program: {
        entry: 'maximoSubarregloK',
        fns: [
          {
            name: 'maximoSubarregloK',
            params: [
              { name: 'valores', type: 'float[]', doc: 'lista de números.' },
              { name: 'k', type: 'int', doc: 'longitud exacta del tramo.' },
            ],
            returns: 'float',
            fallible: true,
            doc: 'Suma máxima de un subarreglo contiguo de longitud exacta k.',
            returnsDoc: 'La suma máxima.',
            failsDoc: 'Si la lista está vacía o k no está entre 1 y n.',
            body: [
              if_(eq(len('valores'), int(0)), [fail(EMPTY)], undefined, { step: 1 }),
              if_(or(lt(ref('k'), int(1)), gt(ref('k'), len('valores'))), [fail(BAD_K)], undefined, { step: 2 }),
              let_('suma', 'float', at('valores', int(0)), { step: 3 }),
              for_('i', int(1), sub(ref('k'), int(1)), [set('suma', add(ref('suma'), at('valores', ref('i'))), { step: 3 })], { step: 3 }),
              let_('mejor', 'float', ref('suma'), { step: 3 }),
              for_(
                'i',
                ref('k'),
                sub(len('valores'), int(1)),
                [
                  set('suma', add(sub(ref('suma'), at('valores', sub(ref('i'), ref('k')))), at('valores', ref('i'))), { step: 4 }),
                  if_(gt(ref('suma'), ref('mejor')), [set('mejor', ref('suma'), { step: 4 })], undefined, { step: 4 }),
                ],
                { step: 4 },
              ),
              ret(ref('mejor'), { step: 5 }),
            ],
          },
        ],
      },
      tests: uniqueTests([
        tc([data, k], () => bruteWindow(data, k, k), 'normal', 'Los datos del enunciado.'),
        tc([[1, -2, 3, 4, -1, 2], 3], () => bruteWindow([1, -2, 3, 4, -1, 2], 3, 3), 'normal', 'Ventana de 3.'),
        tc([[-3, -1, -2], 2], () => bruteWindow([-3, -1, -2], 2, 2), 'límite', 'Todos negativos.'),
        tc([[5], 1], () => 5, 'límite', 'K = n = 1.'),
        tc([[1, 2], 3], () => bruteWindow([1, 2], 3, 3), 'inválido', 'K > n.'),
        tc([[], k], () => bruteWindow([], k, k), 'inválido', 'Vacía.'),
      ]),
      sqlNote: 'SQL no expresa de forma natural una ventana de longitud fija sobre un arreglo.',
      questions: [{ stage: 'algorithm', question: '¿Por qué no Kadane?', answer: 'Kadane elige tramos de cualquier longitud. Aquí la longitud es una restricción, no un grado de libertad.' }],
    }
  }
  let l = bound.mode === 'range' ? bound.l : null
  let r = bound.mode === 'range' ? bound.r : null
  if (l === null) {
    l = 2
    assumptions.push('No se dio L: se usa L = 2.')
  }
  if (r === null) {
    r = Math.min(Math.max(l, 4), Math.max(l, data.length))
    assumptions.push(`No se dio R: se usa R = ${r}.`)
  }
  const shown = data.length > 6 ? `${data.slice(0, 6).map(fmt).join(', ')}, …` : data.map(fmt).join(', ')
  return {
    kind: KIND,
    title: `Máximo subarreglo de longitud ${l}..${r} de ${shown}`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Suma máxima de un subarreglo contiguo cuya longitud está entre ${l} y ${r}.`,
      goal: 'Un número: la mayor suma de un tramo con longitud en [L, R].',
      known: [`Valores: ${data.map(fmt).join(', ')}`, `L = ${l}`, `R = ${r}`],
      unknown: ['La suma máxima.'],
      constraints: ['El subarreglo no puede ser vacío.', `La longitud debe estar entre ${l} y ${r}.`, 'Kadane no aplica: ignora ambas cotas.'],
      conditions: ['Se enumeran los tramos de longitud L..R y se conserva el de mayor suma.'],
      edgeCases: ['n < L: error.', 'Todos negativos.', 'L = R: se reduce a ventana fija.', 'Lista vacía: error.'],
      assumptions,
    }),
    math: {
      steps: [
        { text: 'Definición.', tex: `\\max_{L \\le j-i+1 \\le R} \\sum_{t=i}^{j} x_t` },
        { text: 'Fuerza bruta con acumulador.', tex: 's_{i,j} = s_{i,j-1} + x_j' },
      ],
      validity: ['Requiere 1 ≤ L ≤ R y L ≤ n.'],
      result: { text: 'Resultado.', tex: `${texNum(bruteWindow(data, l, r))}` },
      symbolicVsProgram: 'Kadane maximiza sin cotas de longitud; aquí cada tramo se acepta solo si L ≤ longitud ≤ R.',
    },
    strategies: [{ id: 'ventanas', label: 'Tramos de longitud L..R', summary: 'Dos bucles: para cada inicio se acumula hasta R y se acepta si la longitud ≥ L.' }],
    strategy: 'ventanas',
    design: {
      inputs: ['valores: lista de reales', 'l: entero, longitud mínima', 'r: entero, longitud máxima'],
      outputs: ['suma: real'],
      variables: ['suma: acumulado del tramo i..j', 'mejor: mejor suma válida', 'hay: si ya se vio un tramo válido'],
      steps: ['Rechazar lista vacía.', 'Rechazar L, R inválidos.', 'Para cada inicio, acumular hacia la derecha.', 'Si la longitud está en [L, R], actualizar mejor.', 'Si no hubo tramo válido, error.'],
      conditions: ['Lista vacía → error.', 'L < 1, R < L o L > n → error.'],
      loops: ['PARA i DESDE 0 HASTA n − 1; PARA j DESDE i HASTA n − 1.'],
      special: ['No se muta la lista. Se usa un flag porque el primer tramo válido puede ser negativo.'],
      complexity: { time: 'O(n²)', space: 'O(1)', why: 'Se visitan todos los pares (i, j); no hay cola en la IR para el método O(n).' },
    },
    program: {
      entry: 'maximoSubarregloLR',
      fns: [
        {
          name: 'maximoSubarregloLR',
          params: [
            { name: 'valores', type: 'float[]', doc: 'lista de números.' },
            { name: 'l', type: 'int', doc: 'longitud mínima.' },
            { name: 'r', type: 'int', doc: 'longitud máxima.' },
          ],
          returns: 'float',
          fallible: true,
          doc: 'Suma máxima de un subarreglo contiguo con longitud entre l y r.',
          returnsDoc: 'La suma máxima.',
          failsDoc: 'Si la lista está vacía o no hay tramo con longitud en [l, r].',
          body: [
            if_(eq(len('valores'), int(0)), [fail(EMPTY)], undefined, { step: 1 }),
            if_(or(lt(ref('l'), int(1)), or(lt(ref('r'), ref('l')), gt(ref('l'), len('valores')))), [fail(BAD_LR)], undefined, { step: 2 }),
            let_('mejor', 'float', at('valores', int(0)), { step: 3 }),
            let_('hay', 'int', int(0), { step: 3 }),
            for_(
              'i',
              int(0),
              sub(len('valores'), int(1)),
              [
                let_('suma', 'float', at('valores', ref('i')), { step: 3 }),
                if_(and(ge(int(1), ref('l')), le(int(1), ref('r'))), [if_(or(eq(ref('hay'), int(0)), gt(ref('suma'), ref('mejor'))), [set('mejor', ref('suma'), { step: 4 }), set('hay', int(1), { step: 4 })], undefined, { step: 4 })], undefined, { step: 4 }),
                for_(
                  'j',
                  add(ref('i'), int(1)),
                  sub(len('valores'), int(1)),
                  [
                    set('suma', add(ref('suma'), at('valores', ref('j'))), { step: 3 }),
                    let_('largo', 'int', add(sub(ref('j'), ref('i')), int(1)), { step: 3 }),
                    if_(
                      and(ge(ref('largo'), ref('l')), le(ref('largo'), ref('r'))),
                      [if_(or(eq(ref('hay'), int(0)), gt(ref('suma'), ref('mejor'))), [set('mejor', ref('suma'), { step: 4 }), set('hay', int(1), { step: 4 })], undefined, { step: 4 })],
                      undefined,
                      { step: 4 },
                    ),
                  ],
                  { step: 3 },
                ),
              ],
              { step: 3 },
            ),
            if_(eq(ref('hay'), int(0)), [fail(NO_WINDOW)], undefined, { step: 5 }),
            ret(ref('mejor'), { step: 5 }),
          ],
        },
      ],
    },
    tests: uniqueTests([
      tc([data, l, r], () => bruteWindow(data, l, r), 'normal', 'Los datos del enunciado.'),
      tc([[1, -2, 3, 4, -1, 2], 2, 4], () => bruteWindow([1, -2, 3, 4, -1, 2], 2, 4), 'normal', 'L=2, R=4.'),
      tc([[-3, -1, -2], 1, 2], () => bruteWindow([-3, -1, -2], 1, 2), 'límite', 'Todos negativos.'),
      tc([[5], 1, 1], () => 5, 'límite', 'Un elemento.'),
      tc([[1, 2], 3, 4], () => bruteWindow([1, 2], 3, 4), 'inválido', 'L > n.'),
      tc([[], 1, 2], () => bruteWindow([], 1, 2), 'inválido', 'Vacía.'),
    ]),
    sqlNote: 'SQL no expresa de forma natural un subarreglo con cotas de longitud.',
    questions: [{ stage: 'algorithm', question: '¿Por qué no Kadane?', answer: 'Kadane puede devolver un tramo más corto que L o más largo que R. Las cotas son parte del problema.' }],
  }
}

function build(text: string): Solution {
  const decimal = decimalCommaClarifications(text)
  if (decimal) return needsClarification(KIND, 'Subarreglo', { summary: 'Hay números con coma.', ambiguities: ['¿La coma separa decimales o elementos?'] }, decimal)
  const bound = lengthBoundOf(analyzeStatement(text).normalized)
  if (bound.mode !== 'any') return buildBounded(text, bound)
  let data = numbers(text)
  const assumptions: string[] = []
  if (!data.length) {
    data = [1, -2, 3, 4]
    assumptions.push('No se dieron datos: se usa 1, -2, 3, 4.')
  }
  const result = kadane(data)
  return {
    kind: KIND,
    title: `Máximo subarreglo de ${data.length > 6 ? `${data.slice(0, 6).map(fmt).join(', ')}, …` : data.map(fmt).join(', ')}`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: 'Suma máxima de un subarreglo contiguo (algoritmo de Kadane).',
      goal: 'Un número: la mayor suma de un tramo consecutivo.',
      known: [`Valores: ${data.map(fmt).join(', ')}`],
      unknown: ['La suma máxima.'],
      constraints: ['El subarreglo no puede ser vacío.'],
      conditions: ['En cada posición se elige entre empezar de nuevo o extender el tramo actual.'],
      edgeCases: ['Todos negativos: el resultado es el mayor elemento.', 'Un solo elemento.', 'Ceros.', 'Lista vacía: error.'],
      assumptions,
    }),
    math: {
      steps: [
        { text: 'Definición.', tex: '\\max_{i \\le j} \\sum_{k=i}^{j} x_k' },
        { text: 'Kadane (un recorrido).', tex: 'c_i = \\max(x_i,\\ c_{i-1}+x_i),\\quad m_i = \\max(m_{i-1}, c_i)' },
      ],
      validity: ['Requiere n ≥ 1.'],
      result: { text: 'Resultado.', tex: `${texNum(result)}` },
      symbolicVsProgram: 'La definición mira todos los pares (i, j); Kadane calcula lo mismo en O(n) con dos acumuladores.',
    },
    strategies: [{ id: 'kadane', label: 'Kadane', summary: 'Un recorrido: en cada posición se extiende el tramo o se reinicia.' }],
    strategy: 'kadane',
    design: {
      inputs: ['valores: lista de reales'],
      outputs: ['suma: real'],
      variables: ['mejor: mejor suma vista', 'actual: suma del tramo que termina aquí'],
      steps: ['Rechazar la lista vacía.', 'Inicializar ambos acumuladores con el primer valor.', 'Para cada siguiente elemento, elegir entre reiniciar o extender.', 'Actualizar mejor si actual lo supera.', 'Devolver mejor.'],
      conditions: ['Lista vacía → error.', 'actual + valor < valor → reiniciar.'],
      loops: ['PARA i DESDE 1 HASTA n − 1.'],
      special: ['No se muta la lista. Se devuelve solo la suma, no los índices.'],
      complexity: { time: 'O(n)', space: 'O(1)', why: 'Un pase y dos variables.' },
    },
    program: {
      entry: 'maximoSubarreglo',
      fns: [
        {
          name: 'maximoSubarreglo',
          params: [{ name: 'valores', type: 'float[]', doc: 'lista de números.' }],
          returns: 'float',
          fallible: true,
          doc: 'Suma máxima de un subarreglo contiguo (Kadane).',
          returnsDoc: 'La suma máxima.',
          failsDoc: 'Si la lista está vacía.',
          body: [
            if_(eq(len('valores'), int(0)), [fail(EMPTY)], undefined, { step: 1 }),
            let_('mejor', 'float', at('valores', int(0)), { step: 2 }),
            let_('actual', 'float', at('valores', int(0)), { step: 2 }),
            for_(
              'i',
              int(1),
              sub(len('valores'), int(1)),
              [
                if_(gt(at('valores', ref('i')), add(ref('actual'), at('valores', ref('i')))), [set('actual', at('valores', ref('i')), { step: 3 })], [set('actual', add(ref('actual'), at('valores', ref('i'))), { step: 3 })], { step: 3 }),
                if_(gt(ref('actual'), ref('mejor')), [set('mejor', ref('actual'), { step: 4 })], undefined, { step: 4 }),
              ],
              { step: 3 },
            ),
            ret(ref('mejor'), { step: 5 }),
          ],
        },
      ],
    },
    tests: uniqueTests([
      tc([data], () => kadane(data), 'normal', 'Los datos del enunciado.'),
      tc([[1, -2, 3, 4]], () => 7, 'normal', 'Clásico: 3+4=7.'),
      tc([[-3, -1, -2]], () => -1, 'límite', 'Todos negativos.'),
      tc([[5]], () => 5, 'límite', 'Un elemento.'),
      tc([[2, 2, 2]], () => 6, 'normal', 'Todos positivos.'),
      tc([[]], () => kadane([]), 'inválido', 'Vacía.'),
    ]),
    sqlNote: 'SQL no expresa de forma natural un subarreglo contiguo de suma máxima.',
    questions: [{ stage: 'algorithm', question: '¿Qué pasa si todos son negativos?', answer: 'El mejor subarreglo es el mayor elemento: no conviene extender un tramo que solo empeora.' }],
  }
}

export const subarrayKind: KindDef = {
  id: KIND,
  label: 'Máximo subarreglo',
  description: 'Suma máxima de un tramo contiguo (Kadane).',
  examples: [{ title: 'Kadane', text: 'Subarreglo de suma máxima de 1, -2, 3, 4' }],
  detect: (text) => {
    const t = norm(text)
    if (/kadane|suma maxima|maximo subarreglo/.test(t) || (/\bsubarreglo\b/.test(t) && /\bsuma\b/.test(t))) return 0.92
    return 0
  },
  build,
}
