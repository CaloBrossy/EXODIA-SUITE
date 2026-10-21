import type { KindDef, KindId, Solution } from '../types'
import { classifyKind } from './classify'
import { expressionKind } from './expression'
import { geometryKind } from './geometry'
import { iterationKind } from './iteration'
import { linearKind } from './linear'
import { searchKind } from './search'
import { statsKind } from './stats'
import { vectorsKind } from './vectors'
import { needsClarification, unsupported } from './shared'
import { analyzeStatement, planFromReading } from '../understanding'

export const KINDS: KindDef[] = [expressionKind, linearKind, geometryKind, statsKind, classifyKind, searchKind, iterationKind, vectorsKind]

export const kindById = (id: KindId) => KINDS.find((k) => k.id === id)

/** Tipo más probable según palabras clave; null si ninguno lo reconoce. */
export function detectKind(text: string): KindDef | null {
  let best: KindDef | null = null
  let score = 0
  for (const k of KINDS) {
    const s = k.detect(text)
    if (s > score) {
      best = k
      score = s
    }
  }
  return score > 0 ? best : null
}

export function solve(text: string, kind: KindId | 'auto', strategy?: string): Solution {
  const t = text.trim()
  if (!t) return unsupported('expression', 'Problema vacío', 'Escribí un enunciado o elegí un ejemplo.')
  const def = kind === 'auto' ? detectKind(t) : kindById(kind)
  const reading = analyzeStatement(t)
  const plan = planFromReading(reading, kind, def?.id ?? null)
  if (plan.type === 'unsupported') return unsupported('expression', 'Problema no soportado', plan.reason, { ambiguities: [], assumptions: [`Motivo: aparece «${plan.evidence}».`] })
  if (plan.type === 'clarify')
    return needsClarification(plan.kind, 'Hace falta una aclaración', { summary: reading.output ? `Calcular la ${reading.output}.` : 'Interpretar el enunciado.', ambiguities: reading.ambiguities, constraints: reading.constraints }, reading.clarifications)
  if (plan.type === 'rewrite') {
    const s = kindById(plan.kind)!.build(plan.text, strategy)
    s.analysis.assumptions.unshift(`Se interpretó como «${plan.text}».`, ...plan.notes.map((x) => `${x}.`))
    return s
  }
  if (!def)
    return unsupported(
      'expression',
      'Problema no reconocido',
      'No pude identificar el tipo de problema con las reglas de esta versión. Elegí el tipo manualmente o reformulá el enunciado siguiendo alguno de los ejemplos.',
    )
  return def.build(t, strategy)
}

/** Todos los ejemplos con todas sus estrategias: se usan en las pruebas automáticas. */
export function allSamples(): { text: string; kind: KindId; strategy: string; solution: Solution }[] {
  const out: { text: string; kind: KindId; strategy: string; solution: Solution }[] = []
  for (const k of KINDS) {
    for (const ex of k.examples) {
      const base = k.build(ex.text)
      for (const s of base.strategies.length ? base.strategies : [{ id: base.strategy }]) {
        out.push({ text: ex.text, kind: k.id, strategy: s.id, solution: k.build(ex.text, s.id) })
      }
    }
  }
  return out
}
