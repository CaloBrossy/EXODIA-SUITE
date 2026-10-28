/**
 * Validación previa a mostrar una solución. Reutiliza la lectura y la IR;
 * no duplica comprobaciones en cada emisor.
 */
import { features } from './ir'
import { unsupported } from './problems/shared'
import type { Reading } from './understanding'
import type { Solution } from './types'

export function auditSolution(_text: string, reading: Reading, sol: Solution): Solution {
  if (sol.status !== 'ok') return sol
  if ((reading.length.mode === 'exact' || reading.length.mode === 'range') && sol.strategy === 'kadane') {
    return unsupported('subarray', 'Restricción de longitud', 'Kadane no respeta una cota de longitud. Hace falta una estrategia de ventana.', {
      constraints: reading.constraints,
    })
  }
  if (reading.forbid.includes('sort') && sol.kind === 'sort') {
    return unsupported('sort', 'Ordenar está prohibido', 'El enunciado pide no ordenar; no se genera un algoritmo de ordenamiento.', { constraints: reading.constraints })
  }
  const firstList = sol.tests[0]?.args.find((a) => Array.isArray(a)) as number[] | undefined
  if (firstList && reading.data.length) {
    const leaked = reading.numbers.filter((n) => (n.role === 'contexto' || n.role === 'parametro') && firstList.includes(n.value) && !reading.data.includes(n.value))
    if (leaked.length) {
      return unsupported(sol.kind, 'Datos contextuales', `Los números ${leaked.map((n) => n.value).join(', ')} no son elementos de la lista de entrada.`, {
        constraints: reading.constraints,
        known: [`Lista extraída: ${reading.data.join(', ')}`],
      })
    }
  }
  for (const c of reading.constraints) {
    if (!sol.analysis.constraints.includes(c)) sol.analysis.constraints.push(c)
  }
  if (reading.forbid.includes('builtin-stats')) {
    sol.analysis.assumptions.push('La estrategia no usa agregados de biblioteca; no se verificó el runtime de cada lenguaje.')
  }
  if (reading.constraints.some((c) => c.includes('lineal')) && sol.design && /n\s*\^|n²|O\(n²\)/.test(sol.design.complexity.time)) {
    return unsupported(sol.kind, 'Complejidad incompatible', `El enunciado pide tiempo lineal y la estrategia «${sol.strategy}» es ${sol.design.complexity.time}.`)
  }
  if (sol.program && reading.forbid.includes('mutate') && features(sol.program).has('setAt') && !features(sol.program).has('listCopy') && !features(sol.program).has('listAlloc')) {
    return unsupported(sol.kind, 'Entrada mutable', 'El enunciado pide conservar la entrada y la estrategia la modifica in-place.')
  }
  return sol
}
