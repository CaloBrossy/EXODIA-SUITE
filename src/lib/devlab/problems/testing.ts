import type { Value } from '../ir'
import type { TestCase, TestCategory } from '../types'

/** Error de validación del cálculo de referencia; su mensaje coincide con el `fail` del algoritmo. */
export class RefError extends Error {}

export function expectOf(fn: () => Value): TestCase['expect'] {
  try {
    return { value: fn() }
  } catch (e) {
    if (e instanceof RefError) return { error: e.message }
    throw e
  }
}

export const tc = (args: Value[], ref: () => Value, category: TestCategory, why: string): TestCase => ({ args, expect: expectOf(ref), category, why })

/** Elimina casos con los mismos argumentos conservando el primero. */
export function uniqueTests(list: TestCase[]): TestCase[] {
  const seen = new Set<string>()
  return list.filter((t) => {
    const k = JSON.stringify(t.args)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
