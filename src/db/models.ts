import { z } from 'zod'

const id = z.string().min(1).max(200)
const ts = z.number().int().nonnegative()
const tags = z.array(z.string().max(80)).max(100)
const optionalId = id.nullable().optional()

export const PRIORITIES = ['low', 'medium', 'high'] as const
export const PriorityLabel: Record<Priority, string> = { low: 'Baja', medium: 'Media', high: 'Alta' }

export const NoteSchema = z.object({
  id,
  title: z.string().max(500),
  content: z.string().max(2_000_000),
  tags,
  favorite: z.boolean(),
  conceptIds: z.array(id),
  formulaIds: z.array(id),
  calculationIds: z.array(id),
  subjectId: optionalId,
  createdAt: ts,
  updatedAt: ts,
})
export type Note = z.infer<typeof NoteSchema>

export const ConceptSchema = z.object({
  id,
  title: z.string().min(1).max(300),
  discipline: z.string().max(120),
  tags,
  summary: z.string().max(5000),
  explanation: z.string().max(500_000),
  formalism: z.string().max(500_000),
  examples: z.string().max(500_000),
  observations: z.string().max(500_000),
  relatedIds: z.array(id),
  favorite: z.boolean(),
  seed: z.boolean().optional(),
  createdAt: ts,
  updatedAt: ts,
  lastViewedAt: ts.nullable().optional(),
})
export type Concept = z.infer<typeof ConceptSchema>

export const FormulaVariableSchema = z.object({
  symbol: z.string().min(1).max(40),
  meaning: z.string().max(300),
  unit: z.string().max(80),
})
export type FormulaVariable = z.infer<typeof FormulaVariableSchema>

export const FormulaSchema = z.object({
  id,
  name: z.string().min(1).max(300),
  latex: z.string().max(5000),
  description: z.string().max(20_000),
  variables: z.array(FormulaVariableSchema).max(50),
  resultUnit: z.string().max(80),
  example: z.string().max(20_000),
  discipline: z.string().max(120),
  tags,
  conceptIds: z.array(id),
  /** Expresión numérica (sintaxis de la calculadora) en función de las variables. Vacía = solo visualización. */
  evalExpression: z.string().max(2000),
  /** Variable que calcula evalExpression (p. ej. "F"). */
  evalTarget: z.string().max(40),
  /** Calculadora dedicada de EXODIA que implementa esta fórmula (ruta interna). */
  toolPath: z.string().max(200).optional(),
  seed: z.boolean().optional(),
  createdAt: ts,
  updatedAt: ts,
})
export type Formula = z.infer<typeof FormulaSchema>

export const QuestionSchema = z.object({
  id,
  text: z.string().min(1).max(5000),
  resolved: z.boolean(),
  answer: z.string().max(50_000),
  conceptId: optionalId,
  noteId: optionalId,
  createdAt: ts,
  resolvedAt: ts.nullable().optional(),
})
export type Question = z.infer<typeof QuestionSchema>

export const CalculationSchema = z.object({
  id,
  kind: z.string().max(60),
  input: z.string().max(10_000),
  result: z.string().max(10_000),
  createdAt: ts,
})
export type Calculation = z.infer<typeof CalculationSchema>

export const TaskSchema = z.object({
  id,
  title: z.string().min(1).max(500),
  details: z.string().max(20_000),
  priority: z.enum(PRIORITIES),
  subjectId: optionalId,
  project: z.string().max(200),
  done: z.boolean(),
  dueDate: z.string().max(20).nullable().optional(),
  createdAt: ts,
  completedAt: ts.nullable().optional(),
})
export type Task = z.infer<typeof TaskSchema>
export type Priority = (typeof PRIORITIES)[number]

export const SubjectSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  period: z.string().max(100),
  objectives: z.string().max(50_000),
  notes: z.string().max(200_000),
  archived: z.boolean(),
  seed: z.boolean().optional(),
  createdAt: ts,
  updatedAt: ts,
})
export type Subject = z.infer<typeof SubjectSchema>

export const SessionSchema = z.object({
  id,
  phase: z.enum(['work', 'short', 'long']),
  startedAt: ts,
  endedAt: ts,
  durationMs: z.number().nonnegative(),
  taskId: optionalId,
  subjectId: optionalId,
})
export type FocusSession = z.infer<typeof SessionSchema>

export const StrokeSchema = z.object({
  tool: z.enum(['pen', 'eraser']),
  color: z.string().max(30),
  size: z.number().positive().max(200),
  /** Coordenadas planas [x0, y0, p0, x1, y1, p1, ...] */
  points: z.array(z.number()),
})
export type Stroke = z.infer<typeof StrokeSchema>

export const SketchSchema = z.object({
  id,
  title: z.string().max(300),
  strokes: z.array(StrokeSchema),
  background: z.string().max(30),
  createdAt: ts,
  updatedAt: ts,
})
export type Sketch = z.infer<typeof SketchSchema>

export const ToolLinkSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  url: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), 'Solo se admiten URLs http(s)'),
  description: z.string().max(2000),
  order: z.number(),
  seed: z.boolean().optional(),
})
export type ToolLink = z.infer<typeof ToolLinkSchema>

export const KvSchema = z.object({ key: z.string().min(1).max(200), value: z.unknown() })
export type KvEntry = z.infer<typeof KvSchema>
