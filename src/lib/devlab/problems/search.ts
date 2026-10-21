import { add, at, eq, for_, idiv, if_, int, le, len, let_, lt, neg, ref, ret, set, sub, while_, type Stmt } from '../ir'
import { emptyAnalysis, type KindDef, type Solution, type Strategy } from '../types'
import { allInts, decimalCommaClarifications, fmt, needsClarification, norm, numbers, pick, texList, texNum } from './shared'
import { tableScript } from './sqlgen'
import { tc, uniqueTests } from './testing'

const KIND = 'search' as const
const NUM = '(-?\\d+(?:\\.\\d+)?)'
const TARGET = new RegExp(`(?:buscar|busca|encontrar|encuentra|posicion del?|indice del?|esta el|aparece el|existe el)\\s*(?:el |la )?(?:numero |valor |elemento )?${NUM}`)

const STRATEGIES: Strategy[] = [
  { id: 'lineal', label: 'Búsqueda lineal', summary: 'Revisar los elementos de izquierda a derecha hasta encontrarlo. Sirve con cualquier lista.' },
  { id: 'binaria', label: 'Búsqueda binaria', summary: 'Descartar la mitad del rango en cada paso. Exige que la lista esté ordenada.' },
]

const linearRef = (xs: number[], x: number) => xs.indexOf(x)
/** Implementación de referencia escrita aparte de la IR (mismo criterio de mitad que el programa). */
function binaryRef(xs: number[], x: number): number {
  let lo = 0
  let hi = xs.length - 1
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2)
    if (xs[mid] === x) return mid
    if (xs[mid]! < x) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}

const sorted = (xs: number[]) => xs.every((x, i) => i === 0 || xs[i - 1]! <= x)

function linearBody(): Stmt[] {
  return [
    for_('i', int(0), sub(len('valores'), int(1)), [if_(eq(at('valores', ref('i')), ref('objetivo')), [ret(ref('i'), { step: 2, note: 'Primera aparición' })], undefined, { step: 2 })], { step: 1, note: 'Índices de 0 a n − 1' }),
    ret(neg(int(1)), { step: 3, note: '-1 indica "no está"' }),
  ]
}

function binaryBody(): Stmt[] {
  return [
    let_('izquierda', 'int', int(0), { step: 1 }),
    let_('derecha', 'int', sub(len('valores'), int(1)), { step: 1 }),
    while_(
      le(ref('izquierda'), ref('derecha')),
      [
        let_('medio', 'int', add(ref('izquierda'), idiv(sub(ref('derecha'), ref('izquierda')), int(2))), { step: 3, note: 'Evita el desborde de (izquierda + derecha)' }),
        if_(
          eq(at('valores', ref('medio')), ref('objetivo')),
          [ret(ref('medio'), { step: 4 })],
          [if_(lt(at('valores', ref('medio')), ref('objetivo')), [set('izquierda', add(ref('medio'), int(1)), { step: 5, note: 'Descartar la mitad izquierda' })], [set('derecha', sub(ref('medio'), int(1)), { step: 6, note: 'Descartar la mitad derecha' })], { step: 5 })],
          { step: 4 },
        ),
      ],
      { step: 2, note: 'Mientras quede rango por revisar' },
    ),
    ret(neg(int(1)), { step: 7 }),
  ]
}

function build(text: string, strategyId?: string): Solution {
  const decimal = decimalCommaClarifications(text)
  if (decimal) return needsClarification(KIND, 'Búsqueda', { summary: 'Hay números con coma.', ambiguities: ['¿La coma separa decimales o elementos?'] }, decimal)
  const t = norm(text)
  const m = t.match(TARGET)
  const rest = m ? t.replace(m[0], ' ') : t
  let data = numbers(rest)
  const assumptions: string[] = []
  if (!m) {
    const base = data.length ? data : [3, 8, 15, 21, 42]
    return needsClarification(
      KIND,
      'Búsqueda',
      { summary: 'Buscar un valor en una lista.', ambiguities: ['No se indica qué valor buscar.'] },
      [base[Math.min(2, base.length - 1)]!, 99].map((x) => ({ label: `Buscar ${fmt(x)}`, text: `Buscar ${fmt(x)} en ${base.map(fmt).join(', ')}` })),
    )
  }
  const target = Number(m[1])
  if (!data.length) {
    data = [3, 8, 15, 21, 42]
    assumptions.push('No se dio la lista: se usa 3, 8, 15, 21, 42.')
  }
  const isInt = allInts(data) && Number.isInteger(target)
  const elem = isInt ? 'int' : 'float'
  const wantsBinary = /binari|ordenad/.test(t)
  const st = pick(STRATEGIES, strategyId ?? (wantsBinary ? 'binaria' : 'lineal'))
  const binary = st.id === 'binaria'
  if (binary && !sorted(data)) {
    data = [...data].sort((a, b) => a - b)
    assumptions.push(`La búsqueda binaria exige una lista ordenada: se ordenó a ${data.map(fmt).join(', ')} y los índices se refieren a esa lista.`)
  }
  if (binary && new Set(data).size !== data.length) assumptions.push('Hay valores repetidos: la búsqueda binaria devuelve una de sus posiciones, no necesariamente la primera.')
  const find = binary ? binaryRef : linearRef
  const idx = find(data, target)
  const sortedSample = isInt ? [2, 5, 9, 14, 20, 31] : [0.5, 1.25, 2, 3.75, 8.5]
  const absent = isInt ? 7 : 1.5
  const tests = uniqueTests([
    tc([data, target], () => find(data, target), 'normal', 'Los datos del enunciado.'),
    tc([sortedSample, sortedSample[0]!], () => find(sortedSample, sortedSample[0]!), 'límite', 'El objetivo es el primero.'),
    tc([sortedSample, sortedSample[sortedSample.length - 1]!], () => find(sortedSample, sortedSample[sortedSample.length - 1]!), 'límite', 'El objetivo es el último.'),
    tc([sortedSample, sortedSample[2]!], () => find(sortedSample, sortedSample[2]!), 'normal', 'El objetivo está en el medio.'),
    tc([sortedSample, absent], () => find(sortedSample, absent), 'normal', 'El objetivo no está.'),
    tc([sortedSample, isInt ? -100 : -100.5], () => find(sortedSample, isInt ? -100 : -100.5), 'límite', 'Menor que todos.'),
    tc([sortedSample, isInt ? 1000 : 1000.5], () => find(sortedSample, isInt ? 1000 : 1000.5), 'límite', 'Mayor que todos.'),
    tc([[], target], () => find([], target), 'límite', 'Lista vacía.'),
    tc([[target], target], () => find([target], target), 'límite', 'Un solo elemento, presente.'),
    ...(binary ? [] : [tc([[4, 9, 4, 1], 4], () => linearRef([4, 9, 4, 1], 4), 'normal', 'Repetido: devuelve la primera aparición.'), tc([[9, 2, 7], 7], () => linearRef([9, 2, 7], 7), 'normal', 'Lista desordenada.')]),
  ])
  const sqlCode = `${tableScript(data, isInt)}-- Valor buscado como parámetro (evita concatenar texto en la consulta).\n.parameter set :objetivo ${isInt ? fmt(target) : String(target)}\n\n-- Primera posición donde aparece; -1 si no hay filas.\nSELECT COALESCE(MIN(indice), -1) AS posicion\nFROM valores\nWHERE valor = :objetivo;\n`
  const n = data.length
  return {
    kind: KIND,
    title: `Buscar ${fmt(target)} (${st.label.toLowerCase()})`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Encontrar la posición de ${fmt(target)} en una lista de ${n} ${isInt ? 'enteros' : 'números'}.`,
      goal: 'El índice (desde 0) donde está el objetivo, o -1 si no está.',
      known: [`Lista: ${data.map(fmt).join(', ')}`, `Objetivo: ${fmt(target)}`],
      unknown: ['La posición.'],
      constraints: ['Los índices empiezan en 0.', ...(binary ? ['La lista debe estar ordenada de menor a mayor.'] : [])],
      conditions: ['Si un elemento es igual al objetivo, se devuelve su índice.'],
      edgeCases: ['Lista vacía.', 'El objetivo es el primero o el último.', 'El objetivo no está.', 'Valores repetidos.', ...(isInt ? [] : ['Reales: la igualdad exacta falla con valores calculados (0.1 + 0.2 ≠ 0.3).'])],
      assumptions,
    }),
    math: {
      steps: [
        { text: 'Lista indexada desde 0.', tex: `x = (${texList(data.slice(0, 8))}${n > 8 ? ',\\ \\ldots' : ''}),\\quad n = ${n}` },
        { text: 'Lo que se busca.', tex: `\\min\\{\\, i \\in \\{0, \\ldots, n-1\\} : x_i = ${texNum(target)} \\,\\}` },
        ...(binary ? [{ text: 'Cada paso reduce el rango a la mitad.', tex: 'n \\to \\tfrac{n}{2} \\to \\tfrac{n}{4} \\to \\cdots \\to 1 \\quad\\Rightarrow\\quad \\lceil \\log_2 (n+1) \\rceil \\text{ pasos}' }] : []),
      ],
      validity: ['Si ningún índice cumple, el conjunto es vacío y se informa -1.'],
      result: { text: 'Resultado.', tex: idx >= 0 ? `i = ${idx}` : '\\text{no está} \\Rightarrow -1' },
      symbolicVsProgram: 'La definición dice qué índice buscamos; el algoritmo decide en qué orden mirar los elementos, y eso cambia el costo.',
    },
    strategies: STRATEGIES,
    strategy: st.id,
    design: {
      inputs: [`valores: lista de ${isInt ? 'enteros' : 'reales'}${binary ? ' ordenada' : ''}`, `objetivo: ${isInt ? 'entero' : 'real'}`],
      outputs: ['posición: entero (−1 si no está)'],
      variables: binary ? ['izquierda, derecha: extremos del rango que falta revisar', 'medio: índice central'] : ['i: índice actual'],
      steps: binary
        ? ['Empezar con el rango completo.', 'Repetir mientras el rango no esté vacío.', 'Calcular el índice del medio.', 'Si es el objetivo, devolverlo.', 'Si el del medio es menor, seguir por la derecha.', 'Si es mayor, seguir por la izquierda.', 'Rango vacío: devolver -1.']
        : ['Recorrer los índices de 0 a n − 1.', 'Si el elemento es el objetivo, devolver el índice.', 'Si terminó el recorrido, devolver -1.'],
      conditions: binary ? ['valores[medio] = objetivo → encontrado', 'valores[medio] < objetivo → mitad derecha', 'en otro caso → mitad izquierda'] : ['valores[i] = objetivo → encontrado'],
      loops: binary ? ['MIENTRAS izquierda ≤ derecha: a lo sumo ⌈log₂(n + 1)⌉ vueltas.'] : ['PARA i DESDE 0 HASTA n − 1: a lo sumo n vueltas.'],
      special: binary ? ['Con la lista desordenada el resultado es incorrecto sin ningún error visible.'] : ['Si el valor se repite, devuelve la primera aparición.'],
      complexity: binary ? { time: 'O(log n)', space: 'O(1)', why: 'El rango se divide por dos en cada vuelta.' } : { time: 'O(n)', space: 'O(1)', why: 'En el peor caso (no está) se mira cada elemento una vez.' },
      comparison: 'Lineal: sencilla y sin requisitos, O(n). Binaria: O(log n), pero solo si la lista ya está ordenada; ordenar cuesta O(n log n), así que conviene cuando se busca muchas veces en la misma lista.',
    },
    program: {
      entry: 'buscar',
      fns: [
        {
          name: 'buscar',
          params: [
            { name: 'valores', type: isInt ? 'int[]' : 'float[]', doc: binary ? 'lista ordenada de menor a mayor.' : 'lista donde buscar.' },
            { name: 'objetivo', type: elem, doc: 'valor buscado.' },
          ],
          returns: 'int',
          fallible: false,
          doc: `Busca un valor en una lista (${st.label.toLowerCase()}).`,
          returnsDoc: 'El índice del valor, o -1 si no está.',
          body: binary ? binaryBody() : linearBody(),
        },
      ],
    },
    tests,
    sql: {
      code: sqlCode,
      expected: linearRef(data, target),
      explanation: [
        'En SQL no hay índices implícitos: la posición se guarda como columna.',
        'WHERE filtra las filas iguales al objetivo y MIN se queda con la primera; si no hay ninguna, MIN da NULL y COALESCE lo cambia por -1.',
        'El motor decide cómo buscar: con un índice sobre la columna valor usaría una búsqueda en árbol, parecida a la binaria.',
        '.parameter es un comando de la consola sqlite3; en una aplicación se usan consultas preparadas con ?.',
      ],
    },
    questions: [
      { stage: 'problem', question: '¿Qué devolvemos si el valor no está?', answer: 'Un valor que nunca es un índice válido: -1.' },
      ...(binary ? [{ stage: 'algorithm' as const, question: '¿Qué pasa si la lista no está ordenada?', answer: 'La binaria puede descartar la mitad donde estaba el valor y responder -1 aunque esté.' }] : [{ stage: 'algorithm' as const, question: '¿Cuántas comparaciones hace en el peor caso?', answer: `n: con ${n} elementos, ${n} comparaciones.` }]),
    ],
  }
}

export const searchKind: KindDef = {
  id: KIND,
  label: 'Búsqueda en listas',
  description: 'Búsqueda lineal y binaria de un valor en una lista.',
  examples: [
    { title: 'Búsqueda lineal', text: 'Buscar 23 en la lista 4, 8, 15, 16, 23, 42' },
    { title: 'Búsqueda binaria', text: 'Buscar 31 en la lista ordenada 2, 5, 9, 14, 20, 31, 47 con búsqueda binaria' },
    { title: 'Valor ausente', text: 'Encontrar la posición del 7 en 9, 3, 12, 5' },
  ],
  detect: (text) => (TARGET.test(norm(text)) ? 0.85 : /busqueda|binaria/.test(norm(text)) ? 0.5 : 0),
  build,
}
