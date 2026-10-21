/** Utilidades para generar scripts SQL (dialecto SQLite, ejecutables con la CLI `sqlite3`). */

const lit = (v: number, int: boolean) => (int ? String(v) : Number.isInteger(v) ? `${v}.0` : String(v))

export function tableScript(values: number[], int: boolean, column = 'valor'): string {
  const rows = values.map((v, i) => `    (${i}, ${lit(v, int)})`).join(',\n')
  return [
    '-- Tabla con los datos del problema.',
    'CREATE TABLE valores (',
    '    indice INTEGER PRIMARY KEY,',
    `    ${column.padEnd(6)} ${int ? 'INTEGER' : 'REAL'} NOT NULL`,
    ');',
    '',
    ...(values.length ? [`INSERT INTO valores (indice, ${column}) VALUES`, `${rows};`, '', ''] : ['-- (sin filas)', '', '']),
  ].join('\n')
}

/** Formato de salida de la CLI de sqlite3 para un REAL. */
export const sqliteReal = (v: number) => (Number.isInteger(v) ? `${v}.0` : String(v))
