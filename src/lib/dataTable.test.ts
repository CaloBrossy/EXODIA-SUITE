import { describe, expect, it } from 'vitest'
import { cellsToRows, parseXYTable, rowsToCells, rowsToCsv } from './dataTable'

describe('tabla X/Y', () => {
  it('pegado desde Excel: tabulado, coma decimal, encabezados con unidad', () => {
    const { cells, header } = parseXYTable('t (s)\tΔy\tv (m/s)\n1\t0,1\t2,5\n2\t0,1\t4,9\n')
    expect(header).toEqual(['t (s)', 'Δy', 'v (m/s)'])
    expect(cellsToRows(cells).rows).toEqual([{ x: 1, y: 2.5, ex: null, ey: 0.1 }, { x: 2, y: 4.9, ex: null, ey: 0.1 }])
  })

  it('una columna llamada «x» que no es la variable independiente', () => {
    const { cells } = parseXYTable('t (s)\tx (m)\n1\t2\n2\t4')
    expect(cellsToRows(cells).rows.map((r) => [r.x, r.y])).toEqual([[1, 2], [2, 4]])
  })

  it('encabezados reconocidos en cualquier orden', () => {
    const { cells } = parseXYTable('errY;y;x\n0,2;10;1\n0,3;20;2')
    expect(cellsToRows(cells).rows).toEqual([{ x: 1, y: 10, ex: null, ey: 0.2 }, { x: 2, y: 20, ex: null, ey: 0.3 }])
  })

  it('texto separado por espacios, sin encabezado', () => {
    const { cells, header } = parseXYTable('1 2\n3   4\n\n5 6')
    expect(header).toBeNull()
    expect(cellsToRows(cells).rows.map((r) => [r.x, r.y])).toEqual([[1, 2], [3, 4], [5, 6]])
  })

  it('filas incompletas se cuentan como inválidas; errores negativos pasan a positivos', () => {
    const r = cellsToRows([{ x: '1', y: '', ex: '', ey: '' }, { x: '', y: '', ex: '', ey: '' }, { x: '2', y: '3', ex: '-0,5', ey: 'abc' }, { x: '2', y: '3', ex: '-0,5', ey: '' }])
    expect(r.invalid).toBe(2)
    expect(r.rows).toEqual([{ x: 2, y: 3, ex: 0.5, ey: null }])
  })

  it('exporta CSV y vuelve a importarlo igual', () => {
    const rows = [{ x: 1.5, y: -2, ex: null, ey: 0.1 }, { x: 3, y: 4, ex: 0.2, ey: null }]
    const csv = rowsToCsv(rows, { label: 'Tiempo', unit: 's', log: false }, { label: 'Posición', unit: 'm', log: false })
    expect(csv.split('\n')[0]).toBe('Tiempo (s),Posición (m),errX,errY')
    expect(cellsToRows(parseXYTable(csv).cells).rows).toEqual(rows)
    expect(cellsToRows(rowsToCells(rows)).rows).toEqual(rows)
  })
})
