import type { Program, Value } from './ir'

export const KIND_IDS = ['expression', 'linear', 'geometry', 'stats', 'classify', 'search', 'iteration', 'vectors', 'subarray', 'sort', 'strings', 'query'] as const
export type KindId = (typeof KIND_IDS)[number]

export const STAGES = [
  { id: 'problem', label: 'Problema' },
  { id: 'math', label: 'Matemática' },
  { id: 'algorithm', label: 'Algoritmo' },
  { id: 'pseudo', label: 'Pseudocódigo' },
  { id: 'code', label: 'Código' },
  { id: 'tests', label: 'Pruebas' },
] as const
export type StageId = (typeof STAGES)[number]['id']

export interface Clarification {
  label: string
  /** Enunciado reescrito que resuelve la ambigüedad. */
  text: string
}

export interface Analysis {
  summary: string
  goal: string
  known: string[]
  unknown: string[]
  constraints: string[]
  conditions: string[]
  edgeCases: string[]
  ambiguities: string[]
  clarifications?: Clarification[]
  /** Supuestos explícitos (por ejemplo, valores de ejemplo cuando el enunciado no los da). */
  assumptions: string[]
}

export interface MathStep {
  text: string
  tex?: string
}

export interface MathSolution {
  steps: MathStep[]
  validity: string[]
  result?: MathStep
  /** Diferencia entre resolver este caso y programar la familia de problemas. */
  symbolicVsProgram: string
}

export interface Strategy {
  id: string
  label: string
  summary: string
}

export interface Design {
  inputs: string[]
  outputs: string[]
  variables: string[]
  /** Pasos numerados desde 1; las instrucciones de la IR los referencian con `step`. */
  steps: string[]
  conditions: string[]
  loops: string[]
  special: string[]
  complexity: { time: string; space: string; why: string }
  comparison?: string
}

export type TestCategory = 'normal' | 'límite' | 'inválido'

export interface TestCase {
  args: Value[]
  /** Resultado esperado calculado de forma independiente del algoritmo (fórmula o razonamiento directo). */
  expect: { value: Value } | { error: string }
  category: TestCategory
  why: string
}

export interface GuidedQuestion {
  stage: StageId
  question: string
  answer: string
}

export interface SqlSolution {
  code: string
  /** Resultado esperado de la consulta sobre los datos del enunciado. */
  expected: Value
  explanation: string[]
}

export type SolutionStatus = 'ok' | 'clarify' | 'unsupported'

export interface Solution {
  kind: KindId
  title: string
  status: SolutionStatus
  analysis: Analysis
  /** null cuando el problema es puramente algorítmico; `mathNote` explica por qué. */
  math: MathSolution | null
  mathNote?: string
  strategies: Strategy[]
  strategy: string
  design?: Design
  program?: Program
  tests: TestCase[]
  sql?: SqlSolution
  sqlNote?: string
  questions: GuidedQuestion[]
  limitation?: string
}

export interface KindDef {
  id: KindId
  label: string
  description: string
  examples: { title: string; text: string }[]
  /** Puntaje de 0 a 1 de que el texto pertenezca a este tipo. */
  detect(text: string): number
  build(text: string, strategy?: string): Solution
}

export const emptyAnalysis = (over: Partial<Analysis> = {}): Analysis => ({
  summary: '',
  goal: '',
  known: [],
  unknown: [],
  constraints: [],
  conditions: [],
  edgeCases: [],
  ambiguities: [],
  assumptions: [],
  ...over,
})
