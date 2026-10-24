import { emptyAnalysis, type KindDef, type Solution } from '../types'
import { needsClarification, norm, numbers, unsupported } from './shared'

const KIND = 'query' as const

const TABLES: Record<string, { cols: string[]; rows: Record<string, string | number>[]; pk: string }> = {
  usuarios: {
    cols: ['id', 'nombre', 'edad'],
    pk: 'id',
    rows: [
      { id: 1, nombre: 'Ana', edad: 17 },
      { id: 2, nombre: 'Luis', edad: 22 },
      { id: 3, nombre: 'Mia', edad: 31 },
      { id: 4, nombre: 'Omar', edad: 18 },
    ],
  },
  alumnos: {
    cols: ['id', 'nombre', 'nota'],
    pk: 'id',
    rows: [
      { id: 1, nombre: 'Eva', nota: 4 },
      { id: 2, nombre: 'Paz', nota: 8 },
      { id: 3, nombre: 'Sol', nota: 10 },
    ],
  },
}

const IDENT = /^[a-z][a-z0-9_]*$/

function lit(v: string | number) {
  return typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`
}

function build(text: string): Solution {
  const t = norm(text)
  const table = (/\b(usuarios|alumnos)\b/.exec(t) ?? [])[1] as keyof typeof TABLES | undefined
  if (!table) {
    return needsClarification(KIND, 'Consulta', { summary: 'Hace falta una tabla conocida.', ambiguities: ['¿Sobre usuarios o alumnos?'] }, [
      { label: 'usuarios', text: 'Mostrar usuarios mayores de 18 ordenados por edad' },
      { label: 'alumnos', text: 'Listar alumnos con nota mayor a 6 ordenados por nota' },
    ])
  }
  const schema = TABLES[table]!
  const orderCol = (/\bordenad[oa]s?\s+por\s+([a-z]+)/.exec(t) ?? /\border\s+by\s+([a-z]+)/.exec(t))?.[1]
  const desc = /\bdesc|\bmayor a menor/.test(t)
  const whereNum = numbers(text)[0]
  let whereCol: string | null = null
  let whereOp: '>' | '<' | '=' | '>=' | '<=' = '>'
  if (/mayores de|mayor(?:es)? (?:de|a|que)/.test(t)) {
    whereCol = schema.cols.includes('edad') ? 'edad' : schema.cols.includes('nota') ? 'nota' : null
    whereOp = '>'
  } else if (/menores de|menor(?:es)? (?:de|a|que)/.test(t)) {
    whereCol = schema.cols.includes('edad') ? 'edad' : schema.cols.includes('nota') ? 'nota' : null
    whereOp = '<'
  }
  if (whereCol && !IDENT.test(whereCol)) return unsupported(KIND, 'Consulta', 'Identificador de columna inválido.')
  if (orderCol && !schema.cols.includes(orderCol)) return unsupported(KIND, 'Consulta', `La tabla ${table} no tiene la columna «${orderCol}». Columnas: ${schema.cols.join(', ')}.`)
  const selectCols = schema.cols.filter((c) => c !== schema.pk)
  const where = whereCol !== null && whereNum !== undefined ? { col: whereCol, op: whereOp, value: whereNum } : null
  const order = orderCol && schema.cols.includes(orderCol) ? { col: orderCol, desc } : null

  const filtered = schema.rows.filter((r) => {
    if (!where) return true
    const v = r[where.col]
    if (typeof v !== 'number') return false
    if (where.op === '>') return v > where.value
    if (where.op === '<') return v < where.value
    if (where.op === '>=') return v >= where.value
    if (where.op === '<=') return v <= where.value
    return v === where.value
  })
  const sorted = order ? [...filtered].sort((a, b) => {
    const av = a[order.col]
    const bv = b[order.col]
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return order.desc ? -cmp : cmp
  }) : filtered
  const expected = sorted.map((r) => selectCols.map((c) => r[c]).join('|')).join('\n')

  const create = [
    `CREATE TABLE ${table} (`,
    ...schema.cols.map((c, i) => `    ${c} ${c === schema.pk ? 'INTEGER PRIMARY KEY' : typeof schema.rows[0]?.[c] === 'number' ? 'INTEGER NOT NULL' : 'TEXT NOT NULL'}${i < schema.cols.length - 1 ? ',' : ''}`),
    ');',
    '',
    `INSERT INTO ${table} (${schema.cols.join(', ')}) VALUES`,
    schema.rows.map((r) => `    (${schema.cols.map((c) => lit(r[c]!)).join(', ')})`).join(',\n') + ';',
    '',
    `SELECT ${selectCols.join(', ')}`,
    `FROM ${table}`,
    ...(where ? [`WHERE ${where.col} ${where.op} ${where.value}`] : []),
    ...(order ? [`ORDER BY ${order.col} ${order.desc ? 'DESC' : 'ASC'}`] : []),
    ';',
  ].join('\n')

  return {
    kind: KIND,
    title: `Consulta sobre ${table}`,
    status: 'ok',
    analysis: emptyAnalysis({
      summary: `Generar una consulta SQLite sobre la tabla ${table} (esquema de ejemplo).`,
      goal: 'Un script SQL: CREATE + INSERT de ejemplo + SELECT.',
      known: [`Tabla ${table}(${schema.cols.join(', ')})`, ...(where ? [`Filtro: ${where.col} ${where.op} ${where.value}`] : []), ...(order ? [`Orden: ${order.col} ${order.desc ? 'DESC' : 'ASC'}`] : [])],
      unknown: ['Las filas que cumplen.'],
      constraints: ['Solo tablas del catálogo (usuarios, alumnos). Identificadores en lista blanca. Los valores van como literales, no concatenados a nombres.'],
      conditions: where ? [`${where.col} ${where.op} ${where.value}`] : [],
      edgeCases: ['Tabla desconocida → aclaración.', 'Columna de ORDER BY inexistente → error.'],
      assumptions: ['Los datos INSERT son de ejemplo, no de una base del usuario. No se ejecuta SQL contra archivos locales.'],
    }),
    math: null,
    mathNote: 'Una consulta no es un cálculo numérico.',
    strategies: [{ id: 'select', label: 'SELECT', summary: 'Una tabla, WHERE comparativo y ORDER BY. Sin JOIN ni GROUP BY en esta versión.' }],
    strategy: 'select',
    design: {
      inputs: [`tabla ${table}`, ...(where ? [`filtro ${where.col}`] : [])],
      outputs: ['script SQLite'],
      variables: schema.cols,
      steps: ['Elegir tabla del catálogo.', 'Validar columnas.', 'Emitir CREATE/INSERT de ejemplo.', 'Emitir SELECT con WHERE y ORDER BY.'],
      conditions: where ? [`${where.col} ${where.op} ${where.value}`] : [],
      loops: ['Ninguno: es declarativo.'],
      special: ['No se ejecuta contra una base del usuario.'],
      complexity: { time: 'O(n) al verificar', space: 'O(n)', why: 'El motor recorre las filas de ejemplo.' },
    },
    tests: [],
    sql: {
      code: create,
      expected,
      explanation: [
        'SQL de entrada es un subsistema aparte: no pasa por la IR algorítmica.',
        'CREATE/INSERT reconstruyen el esquema de ejemplo para poder verificar el SELECT con sqlite3.',
        'ORDER BY aquí ordena registros, no implementa un algoritmo de ordenar listas.',
      ],
    },
    questions: [
      { stage: 'problem', question: '¿Esto ordena una lista en memoria?', answer: 'No: pide filas de una tabla. El tipo «Ordenar una lista» es otro problema.' },
      { stage: 'code', question: '¿Por qué no concatenamos el texto del usuario?', answer: 'Para no inyectar SQL. Tabla, columnas y operadores salen de una lista blanca; el número del WHERE es un literal parseado.' },
    ],
  }
}

export const queryKind: KindDef = {
  id: KIND,
  label: 'Consulta SQL',
  description: 'Traduce un pedido en español (o SELECT básico) a un script SQLite de una tabla. No es el lenguaje de salida SQL de los otros tipos.',
  examples: [{ title: 'Mayores de edad', text: 'Mostrar usuarios mayores de 18 ordenados por edad' }],
  detect: (text) => {
    const t = norm(text)
    if (/\bselect\b.+\bfrom\b/.test(t) || /\b(mostrar|listar)\b.+\b(usuarios|alumnos)\b/.test(t) || /\bordenad[oa]s?\s+por\b/.test(t)) return 0.91
    return 0
  },
  build,
}
