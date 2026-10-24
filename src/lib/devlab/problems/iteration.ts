import {
  add,
  and,
  call,
  eq,
  for_,
  gt,
  if_,
  int,
  le,
  let_,
  lt,
  mod,
  mul,
  ne,
  neg,
  or,
  pow,
  ref,
  ret,
  set,
  sub,
  toF,
  while_,
  fail,
  idiv,
  type Fn,
  type Program,
} from '../ir'
import { emptyAnalysis, type KindDef, type Solution, type Strategy, type TestCase } from '../types'
import { fmt, norm, numbers, pick, texNum, unsupported } from './shared'
import { RefError, tc, uniqueTests } from './testing'

const KIND = 'iteration' as const

type Variant = 'factorial' | 'suma' | 'fibonacci' | 'primo' | 'mcd' | 'mcm' | 'aritmetica' | 'geometrica'

function variantOf(text: string): Variant | null {
  const t = norm(text)
  if (/a\s*_?\s*[\(\{\[]\s*[a-z]\s*\+\s*[a-z]/.test(t)) return null
  if (/factorial|\d\s*!/.test(t)) return 'factorial'
  if (/fibonacci/.test(t)) return 'fibonacci'
  if (/primo/.test(t)) return 'primo'
  if (/\bmcm\b|minimo comun multiplo|\blcm\b/.test(t)) return 'mcm'
  if (/\bmcd\b|maximo comun divisor|\bgcd\b/.test(t)) return 'mcd'
  if (/geometrica|razon/.test(t)) return 'geometrica'
  if (/sucesion|progresion|secuencia|termino/.test(t)) return 'aritmetica'
  if (/(suma|sumar|sumatoria).*(primeros|hasta|de 1 a|desde 1|del 1 al)|1 \+ 2 \+ /.test(t)) return 'suma'
  return null
}

const firstInt = (text: string): number | undefined => numbers(text).find((n) => Number.isSafeInteger(n))

// ---------- Factorial ----------

const FACT_MAX = 18
const FACT_NEG = 'El factorial no está definido para números negativos'
const FACT_BIG = `n debe ser como máximo ${FACT_MAX} para que el resultado sea exacto en todos los lenguajes`

function refFactorial(n: number): number {
  if (n < 0) throw new RefError(FACT_NEG)
  if (n > FACT_MAX) throw new RefError(FACT_BIG)
  return Array.from({ length: n }, (_, i) => i + 1).reduce((a, b) => a * b, 1)
}

function factorial(text: string, strategyId?: string): Solution {
  const strategies: Strategy[] = [
    { id: 'iterativo', label: 'Iterativa', summary: 'Un acumulador que se multiplica por 2, 3, …, n dentro de un bucle PARA.' },
    { id: 'recursivo', label: 'Recursiva', summary: 'Usa la definición n! = n · (n − 1)! con el caso base 0! = 1! = 1.' },
  ]
  const st = pick(strategies, strategyId)
  const n = firstInt(text)
  const userN = n !== undefined && n >= 0 && n <= FACT_MAX ? n : 5
  const validate = [
    if_(lt(ref('n'), int(0)), [fail(FACT_NEG)], undefined, { step: 1, note: 'Validar la entrada antes de calcular' }),
    if_(gt(ref('n'), int(FACT_MAX)), [fail(FACT_BIG)], undefined, { step: 1 }),
  ]
  const doc = 'Calcula el factorial de n (n!).'
  let program: Program
  if (st.id === 'iterativo') {
    program = {
      entry: 'factorial',
      fns: [
        {
          name: 'factorial',
          params: [{ name: 'n', type: 'int', doc: 'entero entre 0 y 18.' }],
          returns: 'int',
          fallible: true,
          doc,
          returnsDoc: 'El producto 1 · 2 · … · n.',
          failsDoc: 'Si n es negativo o mayor que 18.',
          body: [
            ...validate,
            let_('resultado', 'int', int(1), { step: 2, note: '1 es el elemento neutro del producto: así 0! = 1' }),
            for_('i', int(2), ref('n'), [set('resultado', mul(ref('resultado'), ref('i')), { step: 3 })], { step: 3 }),
            ret(ref('resultado'), { step: 4 }),
          ],
        },
      ],
    }
  } else {
    const rec: Fn = {
      name: 'factorialRecursivo',
      params: [{ name: 'n', type: 'int', doc: 'entero no negativo ya validado.' }],
      returns: 'int',
      fallible: false,
      doc: 'Aplica la definición recursiva del factorial.',
      returnsDoc: 'n!',
      body: [
        if_(le(ref('n'), int(1)), [ret(int(1), { step: 3 })], undefined, { step: 3, note: 'Caso base: 0! = 1! = 1' }),
        ret(mul(ref('n'), call('factorialRecursivo', sub(ref('n'), int(1)))), { step: 4, note: 'Caso recursivo: n! = n · (n − 1)!' }),
      ],
    }
    program = {
      entry: 'factorial',
      fns: [
        rec,
        {
          name: 'factorial',
          params: [{ name: 'n', type: 'int', doc: 'entero entre 0 y 18.' }],
          returns: 'int',
          fallible: true,
          doc,
          returnsDoc: 'El producto 1 · 2 · … · n.',
          failsDoc: 'Si n es negativo o mayor que 18.',
          body: [...validate, ret(call('factorialRecursivo', ref('n')), { step: 2, note: 'La validación se hace una sola vez, fuera de la recursión' })],
        },
      ],
    }
  }
  const expansion = userN <= 10 && userN >= 2 ? `${userN}! = ${Array.from({ length: userN }, (_, i) => userN - i).join(' \\cdot ')}` : `${userN}! = ${userN} \\cdot ${userN - 1} \\cdots 1`
  const tests: TestCase[] = uniqueTests([
    tc([userN], () => refFactorial(userN), 'normal', 'El valor del enunciado.'),
    tc([5], () => refFactorial(5), 'normal', '5! = 120, un valor fácil de verificar a mano.'),
    tc([10], () => refFactorial(10), 'normal', 'Un resultado de 7 cifras.'),
    tc([0], () => refFactorial(0), 'límite', 'Producto vacío: 0! = 1 por convención.'),
    tc([1], () => refFactorial(1), 'límite', 'El bucle no se ejecuta ninguna vez.'),
    tc([FACT_MAX], () => refFactorial(FACT_MAX), 'límite', 'El mayor valor admitido: 18! < 2⁵³, exacto incluso en JavaScript.'),
    tc([-1], () => refFactorial(-1), 'inválido', 'Los negativos no tienen factorial.'),
    tc([FACT_MAX + 1], () => refFactorial(FACT_MAX + 1), 'inválido', '19! ya no se representa exactamente en todos los lenguajes.'),
  ])
  return {
    kind: KIND,
    title: `Factorial de ${userN}`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Calcular n! (el producto de los enteros de 1 a n) para n = ${userN}, y construir una función que sirva para cualquier n válido.`,
      goal: 'Obtener n! = 1 · 2 · … · n.',
      known: n !== undefined ? [`n = ${n}`] : [],
      unknown: ['n! (el producto)'],
      constraints: ['n es un entero.', `n ≥ 0 (no hay factorial de negativos) y n ≤ ${FACT_MAX} (límite de exactitud elegido).`],
      conditions: ['0! = 1 por convención (producto vacío).'],
      edgeCases: ['n = 0 y n = 1 devuelven 1.', 'n negativo es inválido.', `n > ${FACT_MAX}: el resultado supera 2⁵³ y JavaScript pierde exactitud; con n > 20 se desborda un entero de 64 bits.`],
      assumptions: n === undefined ? ['No se indicó n: se usa n = 5 como ejemplo.'] : n < 0 || n > FACT_MAX ? [`n = ${n} está fuera del rango admitido; el ejemplo usa n = 5 y el caso aparece en las pruebas como inválido.`] : [],
    }),
    math: {
      steps: [
        { text: 'Definición: producto de los enteros positivos hasta n.', tex: 'n! = \\prod_{k=1}^{n} k = 1 \\cdot 2 \\cdots n' },
        { text: 'Convención del producto vacío.', tex: '0! = 1' },
        { text: 'Relación de recurrencia: cada factorial se obtiene del anterior.', tex: 'n! = n \\cdot (n-1)! \\quad (n \\ge 1)' },
        { text: `Desarrollo para n = ${userN}.`, tex: expansion },
      ],
      validity: ['Definido para enteros n ≥ 0.', 'Crece muy rápido: 20! ≈ 2.4 · 10¹⁸ ya roza el máximo de un entero de 64 bits.'],
      result: { text: `Resultado para n = ${userN}.`, tex: `${userN}! = ${refFactorial(userN)}` },
      symbolicVsProgram: 'La definición matemática vale para todo n ≥ 0; el programa además debe respetar el tamaño finito de los enteros, por eso valida un máximo.',
    },
    strategies,
    strategy: st.id,
    design: {
      inputs: ['n: entero'],
      outputs: ['n!: entero'],
      variables: st.id === 'iterativo' ? ['resultado: acumulador del producto', 'i: factor actual (2 … n)'] : ['n en cada llamada (la pila de llamadas guarda los valores pendientes)'],
      steps:
        st.id === 'iterativo'
          ? ['Validar que 0 ≤ n ≤ 18.', 'Inicializar el acumulador en 1.', 'Multiplicar el acumulador por cada entero de 2 a n.', 'Devolver el acumulador.']
          : ['Validar que 0 ≤ n ≤ 18.', 'Delegar el cálculo en la función recursiva.', 'Caso base: si n ≤ 1, el resultado es 1.', 'Caso recursivo: n · factorial(n − 1).'],
      conditions: ['n < 0 → error.', `n > ${FACT_MAX} → error.`, ...(st.id === 'recursivo' ? ['n ≤ 1 → caso base.'] : [])],
      loops: st.id === 'iterativo' ? ['PARA i DESDE 2 HASTA n: se ejecuta n − 1 veces (ninguna si n < 2).'] : ['Sin bucles: la repetición la produce la recursión.'],
      special: ['0! y 1! valen 1 sin entrar al bucle ni recursar.'],
      complexity:
        st.id === 'iterativo'
          ? { time: 'O(n)', space: 'O(1)', why: 'Una multiplicación por cada entero y dos variables.' }
          : { time: 'O(n)', space: 'O(n)', why: 'n llamadas anidadas: cada una ocupa un marco en la pila hasta que llega al caso base.' },
      comparison:
        'Ambas hacen n − 1 multiplicaciones. La recursiva es una traducción literal de la definición, pero usa memoria de pila proporcional a n; la iterativa usa memoria constante y es la elección habitual en lenguajes sin optimización de recursión de cola (Python, Java, JavaScript).',
    },
    program,
    tests,
    questions: [
      { stage: 'problem', question: '¿Qué ocurre si n es 0?', answer: '0! = 1: es el producto vacío. El algoritmo debe devolver 1 sin multiplicar nada.' },
      { stage: 'algorithm', question: '¿Necesitamos una condición, una iteración o ambas?', answer: 'Ambas: una condición para rechazar entradas inválidas y una repetición (bucle o recursión) para multiplicar.' },
      { stage: 'tests', question: '¿Cómo podemos comprobar el resultado?', answer: 'Con valores conocidos (5! = 120) y con la propiedad n! = n · (n − 1)!.' },
    ],
  }
}

// ---------- Suma 1..n ----------

const SUM_MAX = 1_000_000
const SUM_NEG = 'n debe ser mayor o igual que 0'
const SUM_BIG = `n debe ser como máximo ${SUM_MAX}`

function refSum(n: number): number {
  if (n < 0) throw new RefError(SUM_NEG)
  if (n > SUM_MAX) throw new RefError(SUM_BIG)
  let s = 0
  for (let k = 1; k <= n; k++) s += k
  return s
}

function suma(text: string, strategyId?: string): Solution {
  const strategies: Strategy[] = [
    { id: 'bucle', label: 'Bucle acumulador', summary: 'Recorre 1, 2, …, n y va sumando.' },
    { id: 'formula', label: 'Fórmula de Gauss', summary: 'Usa la fórmula cerrada n(n + 1) / 2, sin bucle.' },
  ]
  const st = pick(strategies, strategyId)
  const nums = numbers(text).filter((x) => Number.isSafeInteger(x))
  const n = nums.length ? nums[nums.length - 1]! : undefined
  const userN = n !== undefined && n >= 0 && n <= SUM_MAX ? n : 100
  const validate = [
    if_(lt(ref('n'), int(0)), [fail(SUM_NEG)], undefined, { step: 1, note: 'Validar la entrada' }),
    if_(gt(ref('n'), int(SUM_MAX)), [fail(SUM_BIG)], undefined, { step: 1 }),
  ]
  const body =
    st.id === 'bucle'
      ? [
          ...validate,
          let_('total', 'int', int(0), { step: 2, note: '0 es el elemento neutro de la suma' }),
          for_('i', int(1), ref('n'), [set('total', add(ref('total'), ref('i')), { step: 3 })], { step: 3 }),
          ret(ref('total'), { step: 4 }),
        ]
      : [...validate, ret(idiv(mul(ref('n'), add(ref('n'), int(1))), int(2)), { step: 2, note: 'n(n + 1) siempre es par: la división entera es exacta' })]
  return {
    kind: KIND,
    title: `Suma de 1 a ${userN}`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Sumar los enteros 1 + 2 + … + n para n = ${userN}.`,
      goal: 'Obtener S(n) = 1 + 2 + … + n.',
      known: n !== undefined ? [`n = ${n}`] : [],
      unknown: ['La suma S(n).'],
      constraints: ['n entero, n ≥ 0.', `n ≤ ${SUM_MAX} (límite de seguridad para el bucle y para la exactitud en JavaScript).`],
      conditions: ['Si n = 0 la suma es vacía y vale 0.'],
      edgeCases: ['n = 0 → 0.', 'n = 1 → 1.', 'n negativo es inválido.'],
      assumptions: n === undefined ? ['No se indicó n: se usa n = 100.'] : n < 0 || n > SUM_MAX ? [`n = ${n} está fuera del rango; el ejemplo usa 100.`] : [],
    }),
    math: {
      steps: [
        { text: 'Escribimos la suma dos veces, una en orden inverso.', tex: '\\begin{aligned} S &= 1 + 2 + \\cdots + n \\\\ S &= n + (n-1) + \\cdots + 1 \\end{aligned}' },
        { text: 'Sumando término a término, cada par da n + 1 y hay n pares.', tex: '2S = n(n+1)' },
        { text: 'Despejamos S.', tex: 'S = \\frac{n(n+1)}{2}' },
        { text: `Para n = ${userN}:`, tex: `S = \\frac{${userN} \\cdot ${userN + 1}}{2}` },
      ],
      validity: ['Válida para todo entero n ≥ 0.', 'n(n + 1) es producto de dos enteros consecutivos, por lo tanto par: la división es exacta.'],
      result: { text: 'Resultado.', tex: `S = ${refSum(userN)}` },
      symbolicVsProgram: 'La fórmula resuelve el problema en un paso; el bucle reproduce la definición. Las dos implementaciones calculan lo mismo, con costos distintos.',
    },
    strategies,
    strategy: st.id,
    design: {
      inputs: ['n: entero'],
      outputs: ['S(n): entero'],
      variables: st.id === 'bucle' ? ['total: acumulador', 'i: sumando actual'] : ['Ninguna: se evalúa la fórmula directamente.'],
      steps: st.id === 'bucle' ? ['Validar n.', 'Inicializar total en 0.', 'Sumar cada i de 1 a n.', 'Devolver total.'] : ['Validar n.', 'Evaluar n(n + 1) / 2 con división entera.'],
      conditions: ['n < 0 → error.', `n > ${SUM_MAX} → error.`],
      loops: st.id === 'bucle' ? ['PARA i DESDE 1 HASTA n: n iteraciones.'] : ['Ninguno.'],
      special: ['n = 0: el bucle no se ejecuta y se devuelve 0.'],
      complexity: st.id === 'bucle' ? { time: 'O(n)', space: 'O(1)', why: 'Una suma por cada entero.' } : { time: 'O(1)', space: 'O(1)', why: 'Tres operaciones sin importar n.' },
      comparison: 'La fórmula es más rápida, pero el bucle es más fácil de adaptar (por ejemplo, para sumar solo los pares). Entender ambas muestra cómo el análisis matemático puede eliminar un bucle.',
    },
    program: {
      entry: 'sumaHasta',
      fns: [
        {
          name: 'sumaHasta',
          params: [{ name: 'n', type: 'int', doc: 'último entero a sumar (0 ≤ n ≤ 1 000 000).' }],
          returns: 'int',
          fallible: true,
          doc: 'Suma los enteros de 1 a n.',
          returnsDoc: 'La suma 1 + 2 + … + n.',
          failsDoc: 'Si n está fuera del rango admitido.',
          body,
        },
      ],
    },
    tests: uniqueTests([
      tc([userN], () => refSum(userN), 'normal', 'El valor del enunciado.'),
      tc([10], () => refSum(10), 'normal', '1 + … + 10 = 55.'),
      tc([0], () => refSum(0), 'límite', 'Suma vacía.'),
      tc([1], () => refSum(1), 'límite', 'Un solo sumando.'),
      tc([SUM_MAX], () => refSum(SUM_MAX), 'límite', 'El mayor n admitido.'),
      tc([-3], () => refSum(-3), 'inválido', 'n negativo.'),
    ]),
    questions: [
      { stage: 'math', question: '¿Hay una forma de evitar sumar uno por uno?', answer: 'Sí: emparejando el primero con el último (1 + n), el segundo con el penúltimo, etc., se obtiene n(n + 1)/2.' },
      { stage: 'problem', question: '¿Qué ocurre si n es 0?', answer: 'No hay nada que sumar: el resultado es 0.' },
    ],
  }
}

// ---------- Fibonacci ----------

const FIB_NEG = 'n debe ser mayor o igual que 0'
const FIB_MAX_IT = 78
const FIB_MAX_REC = 25

function refFib(n: number, max: number): number {
  if (n < 0) throw new RefError(FIB_NEG)
  if (n > max) throw new RefError(`n debe ser como máximo ${max}`)
  const f = [0, 1]
  for (let k = 2; k <= n; k++) f.push(f[k - 1]! + f[k - 2]!)
  return f[n]!
}

function fibonacci(text: string, strategyId?: string): Solution {
  const strategies: Strategy[] = [
    { id: 'iterativo', label: 'Iterativa', summary: 'Avanza guardando solo los dos últimos términos.' },
    { id: 'recursivo', label: 'Recursiva directa', summary: 'Traduce F(n) = F(n − 1) + F(n − 2) literalmente; recalcula muchos términos.' },
  ]
  const st = pick(strategies, strategyId)
  const max = st.id === 'iterativo' ? FIB_MAX_IT : FIB_MAX_REC
  const n = firstInt(text)
  const userN = n !== undefined && n >= 0 && n <= max ? n : 10
  const big = `n debe ser como máximo ${max}`
  const validate = [
    if_(lt(ref('n'), int(0)), [fail(FIB_NEG)], undefined, { step: 1, note: 'Validar la entrada' }),
    if_(gt(ref('n'), int(max)), [fail(big)], undefined, { step: 1 }),
  ]
  const fns: Fn[] =
    st.id === 'iterativo'
      ? [
          {
            name: 'fibonacci',
            params: [{ name: 'n', type: 'int', doc: `posición en la sucesión (0 ≤ n ≤ ${max}).` }],
            returns: 'int',
            fallible: true,
            doc: 'Calcula el n-ésimo número de Fibonacci, con F(0) = 0 y F(1) = 1.',
            returnsDoc: 'F(n).',
            failsDoc: 'Si n está fuera del rango admitido.',
            body: [
              ...validate,
              let_('anterior', 'int', int(0), { step: 2, note: 'anterior = F(0), actual = F(1)' }),
              let_('actual', 'int', int(1), { step: 2 }),
              for_(
                'i',
                int(1),
                ref('n'),
                [
                  let_('siguiente', 'int', add(ref('anterior'), ref('actual')), { step: 3 }),
                  set('anterior', ref('actual'), { step: 3 }),
                  set('actual', ref('siguiente'), { step: 3 }),
                ],
                { step: 3, note: 'Tras k pasos, anterior = F(k)' },
              ),
              ret(ref('anterior'), { step: 4 }),
            ],
          },
        ]
      : [
          {
            name: 'fibonacciRecursivo',
            params: [{ name: 'n', type: 'int', doc: 'posición ya validada.' }],
            returns: 'int',
            fallible: false,
            doc: 'Aplica la recurrencia de Fibonacci.',
            returnsDoc: 'F(n).',
            body: [
              if_(lt(ref('n'), int(2)), [ret(ref('n'), { step: 3 })], undefined, { step: 3, note: 'Casos base: F(0) = 0, F(1) = 1' }),
              ret(add(call('fibonacciRecursivo', sub(ref('n'), int(1))), call('fibonacciRecursivo', sub(ref('n'), int(2)))), { step: 4 }),
            ],
          },
          {
            name: 'fibonacci',
            params: [{ name: 'n', type: 'int', doc: `posición en la sucesión (0 ≤ n ≤ ${max}).` }],
            returns: 'int',
            fallible: true,
            doc: 'Calcula el n-ésimo número de Fibonacci, con F(0) = 0 y F(1) = 1.',
            returnsDoc: 'F(n).',
            failsDoc: 'Si n está fuera del rango admitido.',
            body: [...validate, ret(call('fibonacciRecursivo', ref('n')), { step: 2 })],
          },
        ]
  return {
    kind: KIND,
    title: `Fibonacci: F(${userN})`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Calcular el término ${userN} de la sucesión de Fibonacci (0, 1, 1, 2, 3, 5, 8, …).`,
      goal: 'Obtener F(n).',
      known: n !== undefined ? [`n = ${n}`] : [],
      unknown: ['F(n).'],
      constraints: ['n entero, n ≥ 0.', `n ≤ ${max} con esta estrategia (${st.id === 'iterativo' ? 'F(78) es el mayor término exacto en JavaScript' : 'la versión recursiva crece exponencialmente en tiempo'}).`],
      conditions: ['Se usa la convención F(0) = 0, F(1) = 1. Algunos textos empiezan en F(1) = F(2) = 1: conviene confirmarlo.'],
      edgeCases: ['n = 0 → 0.', 'n = 1 → 1.', 'n negativo es inválido.'],
      ambiguities: ['La indexación de Fibonacci varía entre textos; se asume F(0) = 0.'],
      assumptions: n === undefined ? ['No se indicó n: se usa n = 10.'] : n < 0 || n > max ? [`n = ${n} está fuera del rango; el ejemplo usa 10.`] : [],
    }),
    math: {
      steps: [
        { text: 'Definición por recurrencia.', tex: 'F(0) = 0,\\quad F(1) = 1,\\quad F(n) = F(n-1) + F(n-2)\\ (n \\ge 2)' },
        { text: 'Primeros términos.', tex: '0,\\ 1,\\ 1,\\ 2,\\ 3,\\ 5,\\ 8,\\ 13,\\ 21,\\ 34,\\ 55,\\ \\ldots' },
        { text: 'Cada término solo depende de los dos anteriores: basta recordar dos valores.' },
      ],
      validity: ['Definida para enteros n ≥ 0.', 'Crece aproximadamente como φⁿ/√5, con φ ≈ 1.618.'],
      result: { text: 'Resultado.', tex: `F(${userN}) = ${refFib(userN, max)}` },
      symbolicVsProgram: 'La recurrencia define la sucesión; el programa elige cómo recorrerla. Traducirla literalmente (recursión doble) es correcto pero ineficiente.',
    },
    strategies,
    strategy: st.id,
    design: {
      inputs: ['n: entero'],
      outputs: ['F(n): entero'],
      variables: st.id === 'iterativo' ? ['anterior: F(k)', 'actual: F(k + 1)', 'siguiente: valor temporal'] : ['n en cada llamada'],
      steps:
        st.id === 'iterativo'
          ? ['Validar n.', 'Empezar con anterior = F(0) y actual = F(1).', 'Repetir n veces: desplazar la ventana (anterior, actual) un lugar.', 'Devolver anterior.']
          : ['Validar n.', 'Delegar en la función recursiva.', 'Casos base: F(0) y F(1).', 'Caso recursivo: sumar los dos anteriores.'],
      conditions: ['n < 0 → error.', `n > ${max} → error.`],
      loops: st.id === 'iterativo' ? ['PARA i DESDE 1 HASTA n: n iteraciones.'] : ['Recursión doble: cada llamada genera dos.'],
      special: ['n = 0 no entra al bucle y devuelve 0.'],
      complexity:
        st.id === 'iterativo'
          ? { time: 'O(n)', space: 'O(1)', why: 'Una suma por paso y tres variables.' }
          : { time: 'O(φⁿ) ≈ O(1.618ⁿ)', space: 'O(n)', why: 'El árbol de llamadas recalcula los mismos términos una y otra vez; la profundidad máxima es n.' },
      comparison: 'La recursiva directa es la traducción más fiel a la definición, pero F(40) ya requiere cientos de millones de llamadas. La iterativa hace lo mismo en 40 pasos. (Una tercera opción, la memoización, guarda resultados ya calculados.)',
    },
    program: { entry: 'fibonacci', fns },
    tests: uniqueTests([
      tc([userN], () => refFib(userN, max), 'normal', 'El valor del enunciado.'),
      tc([10], () => refFib(10, max), 'normal', 'F(10) = 55.'),
      tc([st.id === 'iterativo' ? 50 : 20], () => refFib(st.id === 'iterativo' ? 50 : 20, max), 'normal', 'Un término grande.'),
      tc([0], () => refFib(0, max), 'límite', 'Primer caso base.'),
      tc([1], () => refFib(1, max), 'límite', 'Segundo caso base.'),
      tc([max], () => refFib(max, max), 'límite', 'El mayor n admitido por esta estrategia.'),
      tc([-1], () => refFib(-1, max), 'inválido', 'n negativo.'),
      tc([max + 1], () => refFib(max + 1, max), 'inválido', 'Fuera del rango admitido.'),
    ]),
    questions: [
      { stage: 'algorithm', question: '¿Cuántos valores necesitamos recordar en cada paso?', answer: 'Solo dos: el término actual y el anterior.' },
      { stage: 'algorithm', question: '¿Por qué la versión recursiva es lenta?', answer: 'Porque F(n − 1) y F(n − 2) vuelven a calcular los mismos términos: el trabajo se duplica en cada nivel.' },
    ],
  }
}

// ---------- Primalidad ----------

function refPrime(n: number): boolean {
  if (n < 2) return false
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false
  return true
}

function primo(text: string, strategyId?: string): Solution {
  const strategies: Strategy[] = [
    { id: 'raiz', label: 'Divisores hasta √n', summary: 'Solo prueba divisores d con d · d ≤ n.' },
    { id: 'ingenua', label: 'Todos los divisores', summary: 'Prueba todos los d entre 2 y n − 1.' },
  ]
  const st = pick(strategies, strategyId)
  const n = firstInt(text)
  const userN = n ?? 97
  const fn: Fn =
    st.id === 'raiz'
      ? {
          name: 'esPrimo',
          params: [{ name: 'n', type: 'int', doc: 'entero a analizar.' }],
          returns: 'bool',
          fallible: false,
          doc: 'Indica si n es un número primo.',
          returnsDoc: 'Verdadero si n es primo.',
          body: [
            if_(lt(ref('n'), int(2)), [ret({ k: 'bool', v: false }, { step: 1 })], undefined, { step: 1, note: '0, 1 y los negativos no son primos' }),
            let_('divisor', 'int', int(2), { step: 2 }),
            while_(
              le(mul(ref('divisor'), ref('divisor')), ref('n')),
              [
                if_(eq(mod(ref('n'), ref('divisor')), int(0)), [ret({ k: 'bool', v: false }, { step: 3 })], undefined, { step: 3, note: 'Encontramos un divisor: no es primo' }),
                set('divisor', add(ref('divisor'), int(1)), { step: 2 }),
              ],
              { step: 2, note: 'Basta con d · d ≤ n (equivale a d ≤ √n sin usar reales)' },
            ),
            ret({ k: 'bool', v: true }, { step: 4 }),
          ],
        }
      : {
          name: 'esPrimo',
          params: [{ name: 'n', type: 'int', doc: 'entero a analizar.' }],
          returns: 'bool',
          fallible: false,
          doc: 'Indica si n es un número primo.',
          returnsDoc: 'Verdadero si n es primo.',
          body: [
            if_(lt(ref('n'), int(2)), [ret({ k: 'bool', v: false }, { step: 1 })], undefined, { step: 1, note: '0, 1 y los negativos no son primos' }),
            for_('divisor', int(2), sub(ref('n'), int(1)), [if_(eq(mod(ref('n'), ref('divisor')), int(0)), [ret({ k: 'bool', v: false }, { step: 3 })], undefined, { step: 3 })], { step: 2 }),
            ret({ k: 'bool', v: true }, { step: 4 }),
          ],
        }
  const sq = Math.floor(Math.sqrt(Math.max(userN, 0)))
  return {
    kind: KIND,
    title: `¿Es primo ${userN}?`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Decidir si ${userN} es primo: si sus únicos divisores positivos son 1 y él mismo.`,
      goal: 'Responder verdadero o falso.',
      known: n !== undefined ? [`n = ${n}`] : [],
      unknown: ['Si existe un divisor d con 1 < d < n.'],
      constraints: ['n entero.'],
      conditions: ['Por definición, los primos son mayores que 1.'],
      edgeCases: ['n = 0, 1 o negativo → no es primo.', 'n = 2 es el único primo par.', 'Cuadrados perfectos como 9 o 49: el divisor es exactamente √n.'],
      assumptions: n === undefined ? ['No se indicó n: se usa 97.'] : [],
    }),
    math: {
      steps: [
        { text: 'Definición.', tex: 'n \\text{ es primo} \\iff n > 1 \\ \\wedge\\ \\nexists\\, d \\in \\{2, \\ldots, n-1\\} : d \\mid n' },
        { text: 'Si n = a · b con 1 < a ≤ b, entonces a · a ≤ a · b = n, es decir, a ≤ √n.', tex: 'n = a \\cdot b,\\ a \\le b \\implies a \\le \\sqrt{n}' },
        { text: 'Por lo tanto, si no hay divisores hasta √n, no los hay en absoluto.', tex: `\\sqrt{${userN}} \\approx ${texNum(Math.sqrt(Math.max(userN, 0)))}\\ \\Rightarrow\\ d \\in \\{2, \\ldots, ${Math.max(sq, 1)}\\}` },
      ],
      validity: ['Válido para cualquier entero; los menores que 2 se descartan por definición.'],
      result: { text: 'Conclusión.', tex: `${userN}\\ ${refPrime(userN) ? '\\text{es primo}' : '\\text{no es primo}'}` },
      symbolicVsProgram: 'El argumento de √n es una demostración; el programa lo aprovecha comparando d · d ≤ n para trabajar solo con enteros.',
    },
    strategies,
    strategy: st.id,
    design: {
      inputs: ['n: entero'],
      outputs: ['lógico: verdadero si es primo'],
      variables: ['divisor: candidato actual'],
      steps: ['Descartar n < 2.', st.id === 'raiz' ? 'Probar divisores mientras divisor · divisor ≤ n.' : 'Probar divisores de 2 a n − 1.', 'Si alguno divide a n (resto 0), no es primo.', 'Si ninguno divide a n, es primo.'],
      conditions: ['n < 2 → falso.', 'n MOD divisor = 0 → falso (salida anticipada).'],
      loops: [st.id === 'raiz' ? 'MIENTRAS divisor · divisor ≤ n: como máximo √n iteraciones.' : 'PARA divisor DESDE 2 HASTA n − 1: hasta n − 2 iteraciones.'],
      special: ['La salida anticipada evita seguir buscando cuando ya se encontró un divisor.'],
      complexity: st.id === 'raiz' ? { time: 'O(√n)', space: 'O(1)', why: 'Como máximo √n divisiones.' } : { time: 'O(n)', space: 'O(1)', why: 'Hasta n − 2 divisiones para un primo.' },
      comparison: 'Para n = 1 000 003 (primo), la versión ingenua hace un millón de divisiones y la de √n unas mil. La mejora sale del razonamiento matemático, no del lenguaje.',
    },
    program: { entry: 'esPrimo', fns: [fn] },
    tests: uniqueTests([
      tc([userN], () => refPrime(userN), 'normal', 'El valor del enunciado.'),
      tc([17], () => refPrime(17), 'normal', 'Primo pequeño.'),
      tc([91], () => refPrime(91), 'normal', '91 = 7 · 13 parece primo, pero no lo es.'),
      tc([49], () => refPrime(49), 'límite', 'Cuadrado perfecto: el divisor es exactamente √n.'),
      tc([2], () => refPrime(2), 'límite', 'El único primo par; el bucle no se ejecuta.'),
      tc([1], () => refPrime(1), 'límite', '1 no es primo por definición.'),
      tc([0], () => refPrime(0), 'límite', '0 no es primo.'),
      tc([-7], () => refPrime(-7), 'límite', 'Los negativos no son primos.'),
      ...(st.id === 'raiz' ? [tc([1000003], () => refPrime(1000003), 'normal', 'Primo de 7 cifras: muestra la ventaja de llegar solo hasta √n.')] : [tc([7919], () => refPrime(7919), 'normal', 'El primo número 1000.')]),
    ]),
    questions: [
      { stage: 'math', question: '¿Hasta qué número necesitamos buscar divisores?', answer: 'Hasta √n: si hubiera un divisor mayor, su "pareja" sería menor que √n y ya la habríamos encontrado.' },
      { stage: 'problem', question: '¿Qué pasa con 1 y con los negativos?', answer: 'No son primos por definición; se resuelven con una condición antes del bucle.' },
    ],
  }
}

// ---------- MCD ----------

const MCD_ZERO = 'mcd(0, 0) no está definido'

function refGcd(a: number, b: number): number {
  if (a === 0 && b === 0) throw new RefError(MCD_ZERO)
  a = Math.abs(a)
  b = Math.abs(b)
  let best = 1
  for (let d = 1; d <= Math.max(a, b); d++) if (a % d === 0 && b % d === 0) best = d
  return best
}

function mcd(text: string, strategyId?: string): Solution {
  const strategies: Strategy[] = [
    { id: 'iterativo', label: 'Euclides iterativo', summary: 'Reemplaza (x, y) por (y, x mod y) hasta que y sea 0.' },
    { id: 'recursivo', label: 'Euclides recursivo', summary: 'mcd(x, y) = mcd(y, x mod y), con mcd(x, 0) = x.' },
  ]
  const st = pick(strategies, strategyId)
  const ints = numbers(text).filter((x) => Number.isSafeInteger(x))
  const [a, b] = ints.length >= 2 ? [ints[0]!, ints[1]!] : [48, 18]
  const absPart = [
    if_(and(eq(ref('a'), int(0)), eq(ref('b'), int(0))), [fail(MCD_ZERO)], undefined, { step: 1, note: 'Todo entero divide a 0: no hay un máximo' }),
    let_('x', 'int', ref('a'), { step: 2, note: 'Trabajamos con valores absolutos en variables locales' }),
    if_(lt(ref('x'), int(0)), [set('x', neg(ref('x')), { step: 2 })], undefined, { step: 2 }),
    let_('y', 'int', ref('b'), { step: 2 }),
    if_(lt(ref('y'), int(0)), [set('y', neg(ref('y')), { step: 2 })], undefined, { step: 2 }),
  ]
  const fns: Fn[] =
    st.id === 'iterativo'
      ? [
          {
            name: 'mcd',
            params: [
              { name: 'a', type: 'int', doc: 'primer entero.' },
              { name: 'b', type: 'int', doc: 'segundo entero.' },
            ],
            returns: 'int',
            fallible: true,
            doc: 'Calcula el máximo común divisor con el algoritmo de Euclides.',
            returnsDoc: 'El mayor entero positivo que divide a ambos.',
            failsDoc: 'Si a y b son ambos 0.',
            body: [
              ...absPart,
              while_(
                ne(ref('y'), int(0)),
                [let_('resto', 'int', mod(ref('x'), ref('y')), { step: 3 }), set('x', ref('y'), { step: 3 }), set('y', ref('resto'), { step: 3 })],
                { step: 3, note: 'mcd(x, y) = mcd(y, x mod y)' },
              ),
              ret(ref('x'), { step: 4 }),
            ],
          },
        ]
      : [
          {
            name: 'mcdRecursivo',
            params: [
              { name: 'x', type: 'int', doc: 'entero no negativo.' },
              { name: 'y', type: 'int', doc: 'entero no negativo.' },
            ],
            returns: 'int',
            fallible: false,
            doc: 'Aplica la recurrencia de Euclides.',
            returnsDoc: 'mcd(x, y).',
            body: [if_(eq(ref('y'), int(0)), [ret(ref('x'), { step: 4 })], undefined, { step: 4, note: 'Caso base: mcd(x, 0) = x' }), ret(call('mcdRecursivo', ref('y'), mod(ref('x'), ref('y'))), { step: 3 })],
          },
          {
            name: 'mcd',
            params: [
              { name: 'a', type: 'int', doc: 'primer entero.' },
              { name: 'b', type: 'int', doc: 'segundo entero.' },
            ],
            returns: 'int',
            fallible: true,
            doc: 'Calcula el máximo común divisor con el algoritmo de Euclides.',
            returnsDoc: 'El mayor entero positivo que divide a ambos.',
            failsDoc: 'Si a y b son ambos 0.',
            body: [...absPart, ret(call('mcdRecursivo', ref('x'), ref('y')), { step: 3 })],
          },
        ]
  // Traza de Euclides para el ejemplo.
  const trace: string[] = []
  if (!(a === 0 && b === 0)) {
    let x = Math.abs(a)
    let y = Math.abs(b)
    while (y !== 0 && trace.length < 12) {
      trace.push(`${x} = ${Math.floor(x / y)} \\cdot ${y} + ${x % y}`)
      ;[x, y] = [y, x % y]
    }
  }
  const valid = !(a === 0 && b === 0)
  return {
    kind: KIND,
    title: `MCD(${a}, ${b})`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Hallar el máximo común divisor de ${a} y ${b}.`,
      goal: 'El mayor entero positivo que divide a ambos números.',
      known: ints.length >= 2 ? [`a = ${a}`, `b = ${b}`] : [],
      unknown: ['mcd(a, b).'],
      constraints: ['a y b enteros, no ambos 0.'],
      conditions: ['El signo no cambia los divisores: mcd(a, b) = mcd(|a|, |b|).'],
      edgeCases: ['mcd(a, 0) = |a|.', 'mcd(0, 0) no está definido.', 'Números negativos.', 'Coprimos: el resultado es 1.'],
      assumptions: ints.length < 2 ? ['Se necesitan dos enteros; se usan 48 y 18 como ejemplo.'] : [],
    }),
    math: {
      steps: [
        { text: 'Propiedad clave: todo divisor común de a y b también divide a a mod b.', tex: '\\gcd(a, b) = \\gcd(b,\\ a \\bmod b)' },
        { text: 'Caso base.', tex: '\\gcd(a, 0) = |a|' },
        ...(trace.length ? [{ text: 'Divisiones sucesivas para el ejemplo (dividendo = cociente · divisor + resto).', tex: `\\begin{aligned} ${trace.join(' \\\\ ')} \\end{aligned}` }] : []),
      ],
      validity: ['Termina siempre: el resto es estrictamente menor que el divisor, así que decrece hasta 0.'],
      result: valid ? { text: 'El último divisor no nulo es el MCD.', tex: `\\gcd(${a}, ${b}) = ${refGcd(a, b)}` } : { text: 'mcd(0, 0) no está definido.' },
      symbolicVsProgram: 'La propiedad de Euclides es un teorema; el programa la aplica repetidamente hasta llegar al caso base.',
    },
    strategies,
    strategy: st.id,
    design: {
      inputs: ['a: entero', 'b: entero'],
      outputs: ['mcd: entero positivo'],
      variables: ['x, y: copias no negativas de a y b', ...(st.id === 'iterativo' ? ['resto: x mod y'] : [])],
      steps: ['Rechazar a = b = 0.', 'Tomar valores absolutos.', 'Reemplazar (x, y) por (y, x mod y).', 'Cuando y = 0, x es el MCD.'],
      conditions: ['a = 0 y b = 0 → error.', 'x < 0 o y < 0 → cambiar el signo.', 'y = 0 → terminar.'],
      loops: st.id === 'iterativo' ? ['MIENTRAS y ≠ 0.'] : ['Recursión de cola: la llamada recursiva es lo último que se hace.'],
      special: ['Si b = 0 desde el inicio, el resultado es |a| sin iterar.'],
      complexity: { time: 'O(log(min(a, b)))', space: st.id === 'iterativo' ? 'O(1)' : 'O(log(min(a, b)))', why: 'Cada dos pasos el resto se reduce al menos a la mitad (teorema de Lamé).' },
      comparison: 'Las dos versiones hacen exactamente las mismas divisiones. La recursiva es más cercana a la fórmula; la iterativa no usa la pila. Ambas son mucho más rápidas que probar todos los divisores.',
    },
    program: { entry: 'mcd', fns },
    tests: uniqueTests([
      tc([a, b], () => refGcd(a, b), valid ? 'normal' : 'inválido', 'El caso del enunciado.'),
      tc([48, 18], () => refGcd(48, 18), 'normal', 'mcd(48, 18) = 6.'),
      tc([1071, 462], () => refGcd(1071, 462), 'normal', 'El ejemplo clásico de Euclides.'),
      tc([17, 5], () => refGcd(17, 5), 'normal', 'Números coprimos.'),
      tc([0, 7], () => refGcd(0, 7), 'límite', 'Un argumento cero.'),
      tc([-12, 18], () => refGcd(-12, 18), 'límite', 'Un argumento negativo.'),
      tc([0, 0], () => refGcd(0, 0), 'inválido', 'Ambos cero.'),
    ]),
    questions: [
      { stage: 'algorithm', question: '¿Por qué el algoritmo siempre termina?', answer: 'Porque el resto es menor que el divisor: y decrece en cada paso y no puede bajar de 0.' },
      { stage: 'problem', question: '¿Qué hacemos con los números negativos?', answer: 'Tomamos el valor absoluto: los divisores de −12 y de 12 son los mismos.' },
    ],
  }
}

const LCM_BIG = 'El MCM supera el rango de enteros exactos de esta versión'

function refLcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  const g = refGcd(a, b)
  const v = Math.abs(a / g) * Math.abs(b)
  if (!Number.isSafeInteger(v)) throw new RefError(LCM_BIG)
  return v
}

function mcm(text: string, _strategyId?: string): Solution {
  const ints = numbers(text).filter((x) => Number.isSafeInteger(x))
  const [a, b] = ints.length >= 2 ? [ints[0]!, ints[1]!] : [12, 18]
  const program: Program = {
    entry: 'mcm',
    fns: [
      {
        name: 'mcm',
        params: [
          { name: 'a', type: 'int', doc: 'primer entero.' },
          { name: 'b', type: 'int', doc: 'segundo entero.' },
        ],
        returns: 'int',
        fallible: true,
        doc: 'Calcula el mínimo común múltiplo usando mcm(a, b) = |a| / mcd(a, b) · |b|.',
        returnsDoc: 'El menor entero no negativo múltiplo de ambos.',
        failsDoc: 'Si el resultado no cabe en un entero exacto.',
        body: [
          let_('x', 'int', ref('a'), { step: 1 }),
          if_(lt(ref('x'), int(0)), [set('x', neg(ref('x')), { step: 1 })], undefined, { step: 1 }),
          let_('y', 'int', ref('b'), { step: 1 }),
          if_(lt(ref('y'), int(0)), [set('y', neg(ref('y')), { step: 1 })], undefined, { step: 1 }),
          if_(or(eq(ref('x'), int(0)), eq(ref('y'), int(0))), [ret(int(0), { step: 2, note: 'mcm(0, n) = 0' })], undefined, { step: 2 }),
          let_('u', 'int', ref('x'), { step: 3 }),
          let_('v', 'int', ref('y'), { step: 3 }),
          while_(ne(ref('v'), int(0)), [let_('resto', 'int', mod(ref('u'), ref('v')), { step: 3 }), set('u', ref('v'), { step: 3 }), set('v', ref('resto'), { step: 3 })], { step: 3, note: 'Euclides: u termina siendo el MCD' }),
          let_('producto', 'int', mul(idiv(ref('x'), ref('u')), ref('y')), { step: 4, note: 'Dividir antes de multiplicar evita el desborde de a·b' }),
          if_(lt(ref('producto'), int(0)), [fail(LCM_BIG)], undefined, { step: 4 }),
          ret(ref('producto'), { step: 5 }),
        ],
      },
    ],
  }
  return {
    kind: KIND,
    title: `MCM(${a}, ${b})`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Hallar el mínimo común múltiplo de ${a} y ${b}.`,
      goal: 'El menor entero no negativo que es múltiplo de ambos.',
      known: ints.length >= 2 ? [`a = ${a}`, `b = ${b}`] : [],
      unknown: ['mcm(a, b).'],
      constraints: ['a y b enteros. mcm(0, n) = 0. El resultado es no negativo.'],
      conditions: ['mcm(a, b) = |a| / mcd(a, b) · |b|.'],
      edgeCases: ['Un argumento 0: el resultado es 0.', 'Negativos: se toman valores absolutos.', 'Coprimos: el MCM es |a·b|.'],
      assumptions: ints.length < 2 ? ['Se necesitan dos enteros; se usan 12 y 18 como ejemplo.'] : [],
    }),
    math: {
      steps: [
        { text: 'Relación con el MCD.', tex: '\\operatorname{lcm}(a,b)=\\frac{|a|}{\\gcd(a,b)}\\cdot |b|' },
        { text: 'Caso cero.', tex: '\\operatorname{lcm}(0, n) = 0' },
      ],
      validity: ['Se divide primero por el MCD para no desbordar a·b.'],
      result: { text: 'Resultado.', tex: `\\operatorname{lcm}(${a}, ${b}) = ${refLcm(a, b)}` },
      symbolicVsProgram: 'La identidad es un teorema; el programa calcula el MCD con Euclides y luego el cociente.',
    },
    strategies: [{ id: 'euclides', label: 'Vía MCD', summary: 'Calcular el MCD con Euclides y aplicar lcm = |a|/gcd · |b|.' }],
    strategy: 'euclides',
    design: {
      inputs: ['a: entero', 'b: entero'],
      outputs: ['mcm: entero no negativo'],
      variables: ['x, y: absolutos', 'u, v: Euclides'],
      steps: ['Tomar absolutos.', 'Si alguno es 0, devolver 0.', 'Calcular el MCD.', 'producto ← (x / mcd) · y.', 'Devolver el producto.'],
      conditions: ['x = 0 o y = 0 → 0.'],
      loops: ['MIENTRAS v ≠ 0 (Euclides).'],
      special: ['No se calcula a·b / gcd: el producto intermedio puede desbordar.'],
      complexity: { time: 'O(log(min(a, b)))', space: 'O(1)', why: 'El costo lo domina Euclides.' },
    },
    program,
    tests: uniqueTests([
      tc([a, b], () => refLcm(a, b), 'normal', 'El caso del enunciado.'),
      tc([12, 18], () => 36, 'normal', 'mcm(12, 18) = 36.'),
      tc([7, 5], () => 35, 'normal', 'Coprimos.'),
      tc([0, 5], () => 0, 'límite', 'Un cero.'),
      tc([-4, 6], () => 12, 'límite', 'Negativo.'),
      tc([0, 0], () => 0, 'límite', 'Ambos cero: 0 por convención (distinto del MCD).'),
    ]),
    questions: [{ stage: 'algorithm', question: '¿Por qué no hacemos a · b / mcd?', answer: 'Porque a · b puede desbordar aunque el MCM final no lo haga. Se divide primero.' }],
  }
}

// ---------- Sucesiones ----------

const SEQ_N = 'n debe ser al menos 1'

function sequence(text: string, geometric: boolean, strategyId?: string): Solution {
  if (/a\s*_?\s*[\(\{\[]\s*[a-z]\s*\+\s*[a-z]/.test(norm(text)))
    return unsupported(KIND, 'Sucesión', 'Las recurrencias de dos índices con parámetros simbólicos no se representan en esta versión. No se inventan d, n ni demás constantes.')
  const strategies: Strategy[] = [
    { id: 'formula', label: 'Término general', summary: geometric ? 'aₙ = a₁ · rⁿ⁻¹ en un paso.' : 'aₙ = a₁ + (n − 1) · d en un paso.' },
    { id: 'iterativo', label: 'Construcción paso a paso', summary: geometric ? 'Parte de a₁ y multiplica por r, n − 1 veces.' : 'Parte de a₁ y suma d, n − 1 veces.' },
  ]
  const st = pick(strategies, strategyId)
  const t = norm(text)
  const assumptions: string[] = []
  const ambiguities: string[] = []
  // Posición pedida: "término 10", "posición 10", "n = 10".
  const posMatch = t.match(/(?:termino|posicion|lugar|n\s*=)\s*(?:numero\s*|n\s*=\s*)?(\d+)/)
  let rest = posMatch ? t.replace(posMatch[0], ' ') : t
  const label = (re: RegExp) => {
    const m = rest.match(re)
    if (!m) return undefined
    rest = rest.replace(m[0], ' ')
    return Number(m[1])
  }
  let a1 = label(/(?:a1|a_1|primer termino|empieza en|comienza en|inicia en|inicial)\s*(?:=|es|de)?\s*(-?\d+(?:\.\d+)?)/)
  let step = geometric ? label(/(?:razon|r\s*=)\s*(?:=|es|de)?\s*(-?\d+(?:\.\d+)?)/) : label(/(?:diferencia|d\s*=)\s*(?:comun\s*)?(?:=|es|de)?\s*(-?\d+(?:\.\d+)?)/)
  let n = posMatch ? Number(posMatch[1]) : undefined
  const loose = numbers(rest)
  if (a1 === undefined && step === undefined && loose.length >= 3) {
    // Se dieron términos consecutivos: se deduce la regla y se verifica.
    const diffs = loose.slice(1).map((x, i) => x - loose[i]!)
    const ratios = loose[0] !== 0 ? loose.slice(1).map((x, i) => x / loose[i]!) : []
    const constant = (xs: number[]) => xs.length > 0 && xs.every((x) => Math.abs(x - xs[0]!) < 1e-12)
    if (!geometric && constant(diffs)) {
      a1 = loose[0]
      step = diffs[0]
      assumptions.push(`Se deduce la regla de los términos dados: diferencia constante ${fmt(step!)}.`)
    } else if (constant(ratios)) {
      if (!geometric) return sequence(text, true, strategyId)
      a1 = loose[0]
      step = ratios[0]
      assumptions.push(`Se deduce la regla de los términos dados: razón constante ${fmt(step!)}.`)
    } else return unsupported(KIND, 'Sucesión', 'Los términos dados no tienen diferencia ni razón constante: esta versión solo reconoce sucesiones aritméticas y geométricas.')
  } else if (a1 === undefined || step === undefined || n === undefined) {
    const free = [...loose]
    if (a1 === undefined && free.length) a1 = free.shift()
    if (step === undefined && free.length) step = free.shift()
    if (n === undefined && free.length) n = free.shift()
    if (free.length || loose.length) assumptions.push(`Los números sin etiqueta se interpretaron en el orden a₁, ${geometric ? 'r' : 'd'}, n. Si no es así, etiquetalos (por ejemplo "primer término 3, ${geometric ? 'razón' : 'diferencia'} 4, término 10").`)
  }
  if (a1 === undefined) {
    a1 = geometric ? 2 : 3
    assumptions.push(`No se indicó el primer término: se usa a₁ = ${a1}.`)
  }
  if (step === undefined) {
    step = geometric ? 3 : 4
    assumptions.push(`No se indicó la ${geometric ? 'razón' : 'diferencia'}: se usa ${step}.`)
  }
  if (n === undefined || !Number.isSafeInteger(n) || n < 1) {
    if (n !== undefined) ambiguities.push(`La posición debe ser un entero ≥ 1 (se recibió ${n}).`)
    n = 10
    assumptions.push('Se calcula el término 10.')
  }
  const A = a1
  const S = step
  const N = n
  const refSeq = (a: number, s: number, k: number): number => {
    if (k < 1) throw new RefError(SEQ_N)
    return geometric ? a * Math.pow(s, k - 1) : a + (k - 1) * s
  }
  const sym = geometric ? 'r' : 'd'
  const param = geometric ? 'razon' : 'diferencia'
  const body =
    st.id === 'formula'
      ? [
          if_(lt(ref('n'), int(1)), [fail(SEQ_N)], undefined, { step: 1, note: 'Las posiciones empiezan en 1' }),
          ret(geometric ? mul(ref('primero'), pow(ref(param), toF(sub(ref('n'), int(1))))) : add(ref('primero'), mul(toF(sub(ref('n'), int(1))), ref(param))), {
            step: 2,
            note: geometric ? 'a(n) = a1 · r^(n − 1)' : 'a(n) = a1 + (n − 1) · d',
          }),
        ]
      : [
          if_(lt(ref('n'), int(1)), [fail(SEQ_N)], undefined, { step: 1, note: 'Las posiciones empiezan en 1' }),
          let_('termino', 'float', ref('primero'), { step: 2 }),
          for_('i', int(2), ref('n'), [set('termino', geometric ? mul(ref('termino'), ref(param)) : add(ref('termino'), ref(param)), { step: 3 })], { step: 3, note: `Cada término se obtiene del anterior ${geometric ? 'multiplicando por r' : 'sumando d'}` }),
          ret(ref('termino'), { step: 4 }),
        ]
  return {
    kind: KIND,
    title: `Sucesión ${geometric ? 'geométrica' : 'aritmética'}: término ${N}`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Calcular el término ${N} de la sucesión ${geometric ? 'geométrica' : 'aritmética'} con a₁ = ${fmt(A)} y ${sym} = ${fmt(S)}.`,
      goal: `Obtener aₙ para n = ${N}.`,
      known: [`a₁ = ${fmt(A)}`, `${sym} = ${fmt(S)}`, `n = ${N}`],
      unknown: ['aₙ.'],
      constraints: ['n entero, n ≥ 1.'],
      conditions: [geometric ? 'Cada término es el anterior multiplicado por r.' : 'Cada término es el anterior más d.'],
      edgeCases: ['n = 1 devuelve a₁.', geometric ? 'r = 0: a partir del segundo término todo vale 0.' : 'd = 0: sucesión constante.', geometric ? 'r negativa: los signos alternan.' : 'd negativa: sucesión decreciente.', 'n < 1 es inválido.'],
      ambiguities,
      assumptions,
    }),
    math: {
      steps: [
        { text: 'Definición recursiva.', tex: geometric ? 'a_1 \\text{ dado},\\quad a_{n} = a_{n-1} \\cdot r' : 'a_1 \\text{ dado},\\quad a_{n} = a_{n-1} + d' },
        { text: `Aplicando la regla n − 1 veces se obtiene el término general.`, tex: geometric ? 'a_n = a_1 \\cdot r^{\\,n-1}' : 'a_n = a_1 + (n-1)\\,d' },
        { text: 'Sustitución.', tex: geometric ? `a_{${N}} = ${texNum(A)} \\cdot (${texNum(S)})^{${N - 1}}` : `a_{${N}} = ${texNum(A)} + (${N} - 1) \\cdot (${texNum(S)})` },
      ],
      validity: ['n ≥ 1.', 'Con reales de 64 bits, términos muy grandes pierden precisión.'],
      result: { text: 'Resultado.', tex: `a_{${N}} = ${texNum(refSeq(A, S, N))}` },
      symbolicVsProgram: 'La fórmula cerrada es un resultado matemático; la versión iterativa reconstruye la sucesión paso a paso, como la definición.',
    },
    strategies,
    strategy: st.id,
    design: {
      inputs: ['primero: real (a₁)', `${param}: real (${sym})`, 'n: entero (posición)'],
      outputs: ['aₙ: real'],
      variables: st.id === 'formula' ? ['Ninguna adicional.'] : ['termino: término actual', 'i: posición actual'],
      steps: st.id === 'formula' ? ['Validar n ≥ 1.', 'Evaluar el término general.'] : ['Validar n ≥ 1.', 'Empezar en a₁.', `Repetir n − 1 veces: ${geometric ? 'multiplicar por r' : 'sumar d'}.`, 'Devolver el término.'],
      conditions: ['n < 1 → error.'],
      loops: st.id === 'formula' ? ['Ninguno.'] : ['PARA i DESDE 2 HASTA n: n − 1 iteraciones.'],
      special: ['n = 1: devuelve a₁ directamente.'],
      complexity: st.id === 'formula' ? { time: 'O(1)', space: 'O(1)', why: geometric ? 'Una potencia (calculada por la biblioteca matemática).' : 'Tres operaciones.' } : { time: 'O(n)', space: 'O(1)', why: 'Una operación por término.' },
      comparison: 'El término general responde en un paso y no acumula error de redondeo; la versión paso a paso es útil cuando también se necesitan los términos intermedios.',
    },
    program: {
      entry: geometric ? 'terminoGeometrico' : 'terminoAritmetico',
      fns: [
        {
          name: geometric ? 'terminoGeometrico' : 'terminoAritmetico',
          params: [
            { name: 'primero', type: 'float', doc: 'primer término de la sucesión.' },
            { name: param, type: 'float', doc: geometric ? 'razón entre términos consecutivos.' : 'diferencia entre términos consecutivos.' },
            { name: 'n', type: 'int', doc: 'posición pedida (n ≥ 1).' },
          ],
          returns: 'float',
          fallible: true,
          doc: `Calcula el n-ésimo término de una sucesión ${geometric ? 'geométrica' : 'aritmética'}.`,
          returnsDoc: 'El término en la posición n.',
          failsDoc: 'Si n es menor que 1.',
          body,
        },
      ],
    },
    tests: uniqueTests([
      tc([A, S, N], () => refSeq(A, S, N), 'normal', 'El caso del enunciado.'),
      ...(geometric
        ? [
            tc([2, 3, 5], () => refSeq(2, 3, 5), 'normal', '2, 6, 18, 54, 162.'),
            tc([1, 0.5, 4], () => refSeq(1, 0.5, 4), 'normal', 'Razón fraccionaria: 1, 0.5, 0.25, 0.125.'),
            tc([-1, -2, 3], () => refSeq(-1, -2, 3), 'límite', 'Razón negativa: los signos alternan.'),
            tc([5, 0, 3], () => refSeq(5, 0, 3), 'límite', 'Razón 0.'),
          ]
        : [
            tc([3, 4, 10], () => refSeq(3, 4, 10), 'normal', '3, 7, 11, …, 39.'),
            tc([5, -2, 4], () => refSeq(5, -2, 4), 'normal', 'Diferencia negativa.'),
            tc([0.5, 0.25, 3], () => refSeq(0.5, 0.25, 3), 'normal', 'Valores decimales.'),
          ]),
      tc([A, S, 1], () => refSeq(A, S, 1), 'límite', 'n = 1 devuelve el primer término.'),
      tc([A, S, 0], () => refSeq(A, S, 0), 'inválido', 'No existe la posición 0.'),
    ]),
    questions: [
      { stage: 'problem', question: '¿Qué datos necesitamos?', answer: `El primer término, la ${geometric ? 'razón' : 'diferencia'} y la posición n.` },
      { stage: 'algorithm', question: '¿Necesitamos un bucle?', answer: 'No necesariamente: el término general da el resultado en un paso. El bucle es una alternativa que imita la definición.' },
    ],
  }
}

export const iterationKind: KindDef = {
  id: KIND,
  label: 'Iteración y secuencias',
  description: 'Factorial, suma hasta n, Fibonacci, primos, MCD, MCM y sucesiones aritméticas o geométricas.',
  examples: [
    { title: 'Factorial', text: 'Calcular el factorial de 6' },
    { title: 'Fibonacci', text: 'Término 15 de la sucesión de Fibonacci' },
    { title: 'Primo', text: '¿Es primo 221?' },
    { title: 'MCD', text: 'Máximo común divisor de 84 y 36' },
    { title: 'MCM', text: 'Mínimo común múltiplo de 12 y 18' },
    { title: 'Sucesión', text: 'Término 20 de la sucesión 2, 5, 8, 11' },
    { title: 'Suma de 1 a n', text: 'Suma de los primeros 100 números naturales' },
  ],
  detect: (text) => (variantOf(text) ? 0.9 : 0),
  build(text, strategy) {
    switch (variantOf(text)) {
      case 'factorial':
        return factorial(text, strategy)
      case 'suma':
        return suma(text, strategy)
      case 'fibonacci':
        return fibonacci(text, strategy)
      case 'primo':
        return primo(text, strategy)
      case 'mcd':
        return mcd(text, strategy)
      case 'mcm':
        return mcm(text, strategy)
      case 'aritmetica':
        return sequence(text, false, strategy)
      case 'geometrica':
        return sequence(text, true, strategy)
      default:
        return unsupported(KIND, 'Iteración', 'No reconocí el problema de iteración. Esta versión admite: factorial, suma de 1 a n, Fibonacci, números primos, MCD y sucesiones aritméticas o geométricas.')
    }
  },
}
