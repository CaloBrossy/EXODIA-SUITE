import { add, and, eq, fail, flt, ge, gt, if_, int, le, lt, mod, or, ref, ret, str, type Stmt } from '../ir'
import { emptyAnalysis, type GuidedQuestion, type KindDef, type MathStep, type Solution } from '../types'
import { allInts, decimalCommaClarifications, fmt, needsClarification, norm, numbers, texNum, unsupported } from './shared'
import { sqliteReal, tableScript } from './sqlgen'
import { RefError, tc, uniqueTests } from './testing'

const KIND = 'classify' as const
const POS = 'Las medidas deben ser positivas'
const TRI = 'Los lados no cumplen la desigualdad triangular'

type Variant = 'signo' | 'paridad' | 'nota' | 'triangulo'

function variantOf(t: string): Variant | null {
  if (/triangul/.test(t) && /equilatero|isosceles|escaleno|tipo|clasific/.test(t)) return 'triangulo'
  if (/\bnotas?\b|aprob|calificacion/.test(t)) return 'nota'
  if (/\bpar\b|\bimpar|paridad|\bpares\b/.test(t)) return 'paridad'
  if (/positiv|negativ|\bsigno\b/.test(t)) return 'signo'
  return null
}

const num = '(-?\\d+(?:\\.\\d+)?)'

function build(text: string): Solution {
  const decimal = decimalCommaClarifications(text)
  if (decimal) return needsClarification(KIND, 'Clasificación', { summary: 'Hay números con coma.', ambiguities: ['¿La coma separa decimales o elementos?'] }, decimal)
  const t = norm(text)
  const v = variantOf(t)
  if (!v) return unsupported(KIND, 'Clasificación', 'No reconocí el criterio. Esta versión clasifica por signo, paridad, nota aprobada o tipo de triángulo.')
  if (v === 'triangulo') return triangle(text)
  if (v === 'nota') return grade(text, t)
  return v === 'signo' ? sign(text) : parity(text)
}

/** Expectativa de SQL: una fila "valor|clase" por dato, en el formato de la CLI de sqlite3. */
const sqlRows = (values: number[], classOf: (x: number) => string, int: boolean) => values.map((x) => `${int ? String(x) : sqliteReal(x)}|${classOf(x)}`).join('\n')

function sqlCase(values: number[], int: boolean, cases: string[], comment: string): string {
  return `${tableScript(values, int)}-- ${comment}\nSELECT valor,\n       CASE\n${cases.map((c) => `           ${c}`).join('\n')}\n       END AS clase\nFROM valores\nORDER BY indice;\n`
}

function sign(text: string): Solution {
  const assumptions: string[] = []
  let data = numbers(text)
  if (!data.length) {
    data = [-3, 0, 7.5]
    assumptions.push('No se dieron números: se usan -3, 0 y 7.5 como ejemplo.')
  }
  const ref_ = (x: number) => (x > 0 ? 'positivo' : x < 0 ? 'negativo' : 'cero')
  const body: Stmt[] = [
    if_(gt(ref('numero'), flt(0)), [ret(str('positivo'), { step: 1 })], [if_(lt(ref('numero'), flt(0)), [ret(str('negativo'), { step: 2 })], undefined, { step: 2 })], { step: 1 }),
    ret(str('cero'), { step: 3, note: 'Si no es mayor ni menor que 0, es 0' }),
  ]
  return base({
    title: `Signo de ${data.map(fmt).join(', ')}`,
    summary: 'Clasificar cada número como positivo, negativo o cero.',
    known: [`Números: ${data.map(fmt).join(', ')}`],
    constraints: ['Cualquier número real.'],
    conditions: ['x > 0 → positivo', 'x < 0 → negativo', 'x = 0 → cero'],
    edgeCases: ['El 0 no es positivo ni negativo.', 'Números muy cercanos a 0, como 0.000001.'],
    assumptions,
    math: [{ text: 'Función signo (versión con palabras).', tex: '\\operatorname{signo}(x) = \\begin{cases} \\text{positivo} & x > 0 \\\\ \\text{negativo} & x < 0 \\\\ \\text{cero} & x = 0 \\end{cases}' }, ...data.slice(0, 4).map((x) => ({ text: `Caso x = ${fmt(x)}.`, tex: `${texNum(x)} ${x > 0 ? '> 0' : x < 0 ? '< 0' : '= 0'} \\Rightarrow \\text{${ref_(x)}}` }))],
    fn: 'signo',
    params: [{ name: 'numero', type: 'float', doc: 'número a clasificar.' }],
    fallible: false,
    body,
    steps: ['Si es mayor que 0, devolver "positivo".', 'Si no, y es menor que 0, devolver "negativo".', 'En otro caso, devolver "cero".'],
    tests: uniqueTests([
      ...data.map((x) => tc([x], () => ref_(x), 'normal', 'Dato del enunciado.')),
      tc([12], () => 'positivo', 'normal', 'Positivo.'),
      tc([-4.5], () => 'negativo', 'normal', 'Negativo decimal.'),
      tc([0], () => 'cero', 'límite', 'El borde entre ambas clases.'),
      tc([0.000001], () => 'positivo', 'límite', 'Muy cerca de 0, pero positivo.'),
    ]),
    sql: { code: sqlCase(data, false, ["WHEN valor > 0 THEN 'positivo'", "WHEN valor < 0 THEN 'negativo'", "ELSE 'cero'"], 'Clasificación de cada fila con CASE.'), expected: sqlRows(data, ref_, false), explanation: ['CASE evalúa las condiciones en orden, igual que la cadena SI / SI NO del pseudocódigo.', 'La consulta clasifica todas las filas a la vez; el programa clasifica un número por llamada.'] },
    questions: [{ stage: 'problem', question: '¿El 0 es positivo?', answer: 'No: es su propia categoría. Por eso hace falta una tercera rama.' }],
  })
}

function parity(text: string): Solution {
  const assumptions: string[] = []
  let data = numbers(text)
  if (data.length && !allInts(data))
    return unsupported(KIND, 'Paridad', `La paridad solo está definida para enteros, y el enunciado incluye ${data.filter((x) => !Number.isInteger(x)).map(fmt).join(', ')}.`, { ambiguities: ['¿Se quiso redondear? Indicá los números enteros a clasificar.'] })
  if (!data.length) {
    data = [14, 7, -3]
    assumptions.push('No se dieron números: se usan 14, 7 y -3 como ejemplo.')
  }
  const ref_ = (x: number) => (x % 2 === 0 ? 'par' : 'impar')
  return base({
    title: `Paridad de ${data.map(fmt).join(', ')}`,
    summary: 'Clasificar cada entero como par o impar.',
    known: [`Números: ${data.map(fmt).join(', ')}`],
    constraints: ['Solo enteros.'],
    conditions: ['x mod 2 = 0 → par', 'en otro caso → impar'],
    edgeCases: ['El 0 es par.', 'Negativos: en C, Java, JavaScript y otros, -3 % 2 vale -1, no 1.'],
    assumptions,
    math: [{ text: 'Un entero es par si es múltiplo de 2.', tex: 'x \\text{ es par} \\iff \\exists k \\in \\mathbb{Z} : x = 2k \\iff x \\bmod 2 = 0' }, ...data.slice(0, 4).map((x) => ({ text: `Caso x = ${fmt(x)}.`, tex: `${texNum(x)} = 2 \\cdot ${Math.trunc(x / 2) < 0 ? `(${Math.trunc(x / 2)})` : Math.trunc(x / 2)} ${x % 2 === 0 ? '' : x < 0 ? '- 1' : '+ 1'} \\Rightarrow \\text{${ref_(x)}}` }))],
    fn: 'paridad',
    params: [{ name: 'numero', type: 'int', doc: 'entero a clasificar.' }],
    fallible: false,
    body: [if_(eq(mod(ref('numero'), int(2)), int(0)), [ret(str('par'), { step: 1, note: 'Comparar con 0 funciona también con negativos' })], undefined, { step: 1 }), ret(str('impar'), { step: 2 })],
    steps: ['Si el resto de dividir por 2 es 0, devolver "par".', 'En otro caso, devolver "impar".'],
    special: ['Se compara el resto con 0 y no con 1: con negativos el resto puede ser -1.'],
    tests: uniqueTests([
      ...data.map((x) => tc([x], () => ref_(x), 'normal', 'Dato del enunciado.')),
      tc([8], () => 'par', 'normal', 'Par.'),
      tc([11], () => 'impar', 'normal', 'Impar.'),
      tc([0], () => 'par', 'límite', 'El 0 es par.'),
      tc([-7], () => 'impar', 'límite', 'Negativo impar: el resto es -1 en muchos lenguajes.'),
      tc([-10], () => 'par', 'límite', 'Negativo par.'),
    ]),
    sql: { code: sqlCase(data, true, ["WHEN valor % 2 = 0 THEN 'par'", "ELSE 'impar'"], 'Paridad de cada fila.'), expected: sqlRows(data, ref_, true), explanation: ['En SQLite, % es el resto entero y conserva el signo del dividendo, como en C.'] },
    questions: [{ stage: 'algorithm', question: '¿Por qué no comparar el resto con 1?', answer: 'Porque para -7 muchos lenguajes devuelven -1: la comparación con 1 diría que no es impar.' }],
  })
}

function grade(text: string, t: string): Solution {
  const um = t.match(new RegExp(`(?:aprueba\\w*|umbral|minimo|aprobar)\\s*(?:con|de|es|=|:)?\\s*(?:un |una |nota )?${num}`))
  const mm = t.match(new RegExp(`(?:sobre|de 0 a|escala de(?: 0 a)?|hasta)\\s*${num}`))
  if (!um)
    return needsClarification(
      KIND,
      'Nota aprobada',
      { summary: 'Clasificar notas en aprobadas y desaprobadas.', ambiguities: ['No se indica la nota mínima para aprobar; varía según la institución.'] },
      [4, 6, 7].map((u) => ({ label: `Se aprueba con ${u}`, text: `${text.trim()}, se aprueba con ${u}` })),
    )
  const U = Number(um[1])
  const MAX = mm ? Number(mm[1]) : 10
  if (!(U > 0 && U <= MAX)) return unsupported(KIND, 'Nota aprobada', `El umbral ${fmt(U)} debe estar entre 0 y la nota máxima ${fmt(MAX)}.`)
  const RANGE = `La nota debe estar entre 0 y ${fmt(MAX)}`
  const rest = t.replace(um[0], ' ').replace(mm?.[0] ?? '\u0000', ' ')
  const assumptions = mm ? [] : ['Escala de 0 a 10 (no se indicó otra).']
  let data = numbers(rest)
  if (!data.length) {
    data = [MAX * 0.85, U, U - MAX * 0.05].map((x) => Math.round(x * 100) / 100)
    assumptions.push(`No se dieron notas: se usan ${data.map(fmt).join(', ')} como ejemplo.`)
  }
  const ref_ = (x: number) => {
    if (x < 0 || x > MAX) throw new RefError(RANGE)
    return x >= U ? 'aprobado' : 'desaprobado'
  }
  const sqlRef = (x: number) => (x < 0 || x > MAX ? 'invalida' : x >= U ? 'aprobado' : 'desaprobado')
  return base({
    title: `Notas: aprueba con ${fmt(U)}`,
    summary: `Clasificar notas de 0 a ${fmt(MAX)}: aprobado si la nota es al menos ${fmt(U)}.`,
    known: [`Notas: ${data.map(fmt).join(', ')}`, `Umbral: ${fmt(U)}`, `Nota máxima: ${fmt(MAX)}`],
    constraints: [`0 ≤ nota ≤ ${fmt(MAX)}`],
    conditions: [`nota ≥ ${fmt(U)} → aprobado`, `nota < ${fmt(U)} → desaprobado`],
    edgeCases: [`Exactamente ${fmt(U)}: aprueba (≥, no >).`, 'Notas fuera de la escala.', `Decimales justo debajo del umbral, como ${fmt(U - 0.01)}.`],
    assumptions,
    math: [{ text: 'Regla de clasificación.', tex: `c(n) = \\begin{cases} \\text{aprobado} & ${texNum(U)} \\le n \\le ${texNum(MAX)} \\\\ \\text{desaprobado} & 0 \\le n < ${texNum(U)} \\end{cases}` }, { text: 'Fuera de [0, máximo] la función no está definida.', tex: `\\operatorname{dom}(c) = [0, ${texNum(MAX)}]` }],
    fn: 'clasificarNota',
    params: [{ name: 'nota', type: 'float', doc: `calificación entre 0 y ${fmt(MAX)}.` }],
    fallible: true,
    failsDoc: 'Si la nota está fuera de la escala.',
    body: [
      if_(or(lt(ref('nota'), flt(0)), gt(ref('nota'), flt(MAX))), [fail(RANGE)], undefined, { step: 1, note: 'Primero validar, después clasificar' }),
      if_(ge(ref('nota'), flt(U)), [ret(str('aprobado'), { step: 2 })], undefined, { step: 2 }),
      ret(str('desaprobado'), { step: 3 }),
    ],
    steps: ['Rechazar notas fuera de la escala.', `Si la nota es mayor o igual que ${fmt(U)}, devolver "aprobado".`, 'En otro caso, devolver "desaprobado".'],
    tests: uniqueTests([
      ...data.map((x) => tc([x], () => ref_(x), 'normal', 'Dato del enunciado.')),
      tc([U], () => ref_(U), 'límite', 'Exactamente el umbral.'),
      tc([U - 0.01], () => ref_(U - 0.01), 'límite', 'Apenas debajo del umbral.'),
      tc([0], () => ref_(0), 'límite', 'Nota mínima.'),
      tc([MAX], () => ref_(MAX), 'límite', 'Nota máxima.'),
      tc([-1], () => ref_(-1), 'inválido', 'Negativa.'),
      tc([MAX + 1], () => ref_(MAX + 1), 'inválido', 'Mayor que la máxima.'),
    ]),
    sql: {
      code: sqlCase(data, false, [`WHEN valor < 0 OR valor > ${sqliteReal(MAX)} THEN 'invalida'`, `WHEN valor >= ${sqliteReal(U)} THEN 'aprobado'`, "ELSE 'desaprobado'"], 'Clasificación de cada nota.'),
      expected: sqlRows(data, sqlRef, false),
      explanation: ['Una consulta no "lanza" errores por fila: las notas fuera de escala se marcan como invalida en lugar de detener todo.', 'El orden de los WHEN importa: la validación va primero, como en el programa.'],
    },
    questions: [
      { stage: 'problem', question: `¿Un ${fmt(U)} aprueba?`, answer: `Sí: la condición es "al menos ${fmt(U)}", es decir ≥.` },
      { stage: 'algorithm', question: '¿Por qué validar antes de clasificar?', answer: `Porque si no, una nota de ${fmt(MAX + 5)} saldría "aprobado" sin avisar del error.` },
    ],
  })
}

function triangle(text: string): Solution {
  const assumptions: string[] = []
  let data = numbers(text).slice(0, 3)
  if (data.length < 3) {
    data = [5, 5, 8]
    assumptions.push('No se dieron tres lados: se usan 5, 5 y 8 como ejemplo.')
  }
  const ref_ = ([a, b, c]: number[]) => {
    if (a! <= 0 || b! <= 0 || c! <= 0) throw new RefError(POS)
    if (a! + b! <= c! || a! + c! <= b! || b! + c! <= a!) throw new RefError(TRI)
    return a === b && b === c ? 'equilátero' : a === b || b === c || a === c ? 'isósceles' : 'escaleno'
  }
  const r = ref
  return base({
    title: `Tipo de triángulo ${data.map(fmt).join(', ')}`,
    summary: 'Clasificar un triángulo por la cantidad de lados iguales.',
    known: [`Lados: ${data.map(fmt).join(', ')}`],
    constraints: ['Lados positivos.', 'Desigualdad triangular.'],
    conditions: ['3 lados iguales → equilátero', 'exactamente 2 iguales → isósceles', 'todos distintos → escaleno'],
    edgeCases: ['Lados que no forman triángulo, como 1, 2, 3.', 'Lados con decimales: la igualdad exacta entre reales es frágil.'],
    assumptions,
    math: [
      { text: 'Primero, que exista el triángulo.', tex: 'a + b > c,\\quad a + c > b,\\quad b + c > a' },
      { text: 'Luego, contar lados iguales.', tex: '\\begin{cases} \\text{equilátero} & a = b = c \\\\ \\text{isósceles} & a = b \\lor b = c \\lor a = c \\\\ \\text{escaleno} & \\text{en otro caso} \\end{cases}' },
    ],
    fn: 'tipoTriangulo',
    params: [
      { name: 'a', type: 'float', doc: 'primer lado.' },
      { name: 'b', type: 'float', doc: 'segundo lado.' },
      { name: 'c', type: 'float', doc: 'tercer lado.' },
    ],
    fallible: true,
    failsDoc: 'Si los lados no forman un triángulo.',
    body: [
      if_(or(or(le(r('a'), flt(0)), le(r('b'), flt(0))), le(r('c'), flt(0))), [fail(POS)], undefined, { step: 1 }),
      if_(or(or(le(add(r('a'), r('b')), r('c')), le(add(r('a'), r('c')), r('b'))), le(add(r('b'), r('c')), r('a'))), [fail(TRI)], undefined, { step: 2 }),
      if_(and(eq(r('a'), r('b')), eq(r('b'), r('c'))), [ret(str('equilátero'), { step: 3 })], undefined, { step: 3, note: 'El caso más restrictivo va primero' }),
      if_(or(or(eq(r('a'), r('b')), eq(r('b'), r('c'))), eq(r('a'), r('c'))), [ret(str('isósceles'), { step: 4 })], undefined, { step: 4 }),
      ret(str('escaleno'), { step: 5 }),
    ],
    steps: ['Rechazar lados no positivos.', 'Rechazar lados que no cumplen la desigualdad triangular.', 'Si los tres son iguales, "equilátero".', 'Si dos son iguales, "isósceles".', 'Si no, "escaleno".'],
    special: ['El orden de las condiciones importa: un equilátero también cumple la condición de isósceles.', 'Se compara con == entre reales; con medidas calculadas (no ingresadas) convendría una tolerancia.'],
    tests: uniqueTests([
      tc(data, () => ref_(data), 'normal', 'Los lados del enunciado.'),
      tc([6, 6, 6], () => ref_([6, 6, 6]), 'normal', 'Equilátero.'),
      tc([5, 5, 8], () => ref_([5, 5, 8]), 'normal', 'Isósceles.'),
      tc([8, 5, 5], () => ref_([8, 5, 5]), 'normal', 'Isósceles con los lados iguales al final.'),
      tc([3, 4, 5], () => ref_([3, 4, 5]), 'normal', 'Escaleno.'),
      tc([1, 2, 3], () => ref_([1, 2, 3]), 'inválido', 'Degenerado.'),
      tc([0, 4, 4], () => ref_([0, 4, 4]), 'inválido', 'Lado cero.'),
    ]),
    sqlNote: 'SQL no aplica: se clasifica una terna de valores sueltos.',
    questions: [{ stage: 'algorithm', question: '¿Importa el orden de las preguntas?', answer: 'Sí: si se pregunta primero "¿dos lados iguales?", un equilátero saldría isósceles.' }],
  })
}

interface BaseArgs {
  title: string
  summary: string
  known: string[]
  constraints: string[]
  conditions: string[]
  edgeCases: string[]
  assumptions: string[]
  math: MathStep[]
  fn: string
  params: { name: string; type: 'int' | 'float'; doc: string }[]
  fallible: boolean
  failsDoc?: string
  body: Stmt[]
  steps: string[]
  special?: string[]
  tests: Solution['tests']
  sql?: Solution['sql']
  sqlNote?: string
  questions: GuidedQuestion[]
}

function base(a: BaseArgs): Solution {
  const branches = a.conditions.length
  return {
    kind: KIND,
    title: a.title,
    status: 'ok',
    analysis: emptyAnalysis({ summary: a.summary, goal: 'Una etiqueta (texto) por cada entrada.', known: a.known, unknown: ['La clase de cada dato.'], constraints: a.constraints, conditions: a.conditions, edgeCases: a.edgeCases, assumptions: a.assumptions }),
    math: { steps: a.math, validity: a.constraints, symbolicVsProgram: 'En matemática una función por partes se lee entera de una vez; el programa evalúa las condiciones en orden y se detiene en la primera que se cumple.' },
    strategies: [{ id: 'condiciones', label: 'Condiciones encadenadas', summary: 'Evaluar las condiciones en orden y devolver la primera clase que corresponda.' }],
    strategy: 'condiciones',
    design: {
      inputs: a.params.map((p) => `${p.name}: ${p.type === 'int' ? 'entero' : 'real'}`),
      outputs: ['clase: texto'],
      variables: ['Ninguna adicional.'],
      steps: a.steps,
      conditions: a.conditions,
      loops: ['Ninguno.'],
      special: a.special ?? [],
      complexity: { time: 'O(1)', space: 'O(1)', why: `Como máximo ${branches + (a.fallible ? 2 : 0)} comparaciones.` },
    },
    program: { entry: a.fn, fns: [{ name: a.fn, params: a.params, returns: 'str', fallible: a.fallible, doc: a.summary, returnsDoc: 'La clase como texto.', failsDoc: a.failsDoc, body: a.body }] },
    tests: a.tests,
    sql: a.sql,
    sqlNote: a.sqlNote,
    questions: a.questions,
  }
}

export const classifyKind: KindDef = {
  id: KIND,
  label: 'Clasificación por condiciones',
  description: 'Signo, paridad, nota aprobada y tipo de triángulo.',
  examples: [
    { title: 'Signo', text: 'Clasificar -3, 0 y 7.5 como positivo, negativo o cero' },
    { title: 'Par o impar', text: 'Decir si 14, 7, -3 y 0 son pares o impares' },
    { title: 'Nota', text: 'Notas 8.5, 6, 5.99 y 10 sobre 10, se aprueba con 6' },
    { title: 'Tipo de triángulo', text: 'Clasificar el triángulo de lados 5, 5 y 8' },
  ],
  detect: (text) => {
    const t = norm(text)
    const v = variantOf(t)
    if (!v) return 0
    if (/triangul/.test(t)) return 0.9
    if (v === 'nota' && /(?:promedio|media|\bsuma\b|\bmaximo\b|\bminimo\b|\brango\b|mediana)/.test(t) && !/aprob|clasific|umbral|calificacion/.test(t)) return 0.2
    return 0.75
  },
  build,
}
