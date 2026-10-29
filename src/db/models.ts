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
  updatedAt: ts.optional(),
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
  updatedAt: ts.optional(),
  completedAt: ts.nullable().optional(),
})
export type Task = z.infer<typeof TaskSchema>
export type Priority = (typeof PRIORITIES)[number]

export const SUBJECT_STATUSES = ['pendiente', 'cursando', 'regular', 'aprobada', 'libre'] as const
export type SubjectStatus = (typeof SUBJECT_STATUSES)[number]
export const SubjectStatusLabel: Record<SubjectStatus, string> = {
  pendiente: 'Pendiente',
  cursando: 'Cursando',
  regular: 'Regular',
  aprobada: 'Aprobada',
  libre: 'Libre',
}

const grade = z.number().min(0).max(10)

/** Datos del plan de la carrera. Ausente = materia solo de Focus, fuera del plan. */
export const SubjectPlanSchema = z.object({
  code: z.string().max(40),
  year: z.number().int().min(1).max(12).nullable(),
  term: z.string().max(40),
  hours: z.number().nonnegative().max(10_000).nullable(),
  credits: z.number().nonnegative().max(1000).nullable(),
  requiresCourse: z.array(id).max(100),
  requiresExam: z.array(id).max(100),
  status: z.enum(SUBJECT_STATUSES),
  grade: grade.nullable(),
  failedGrades: z.array(grade).max(50),
  approvedAt: ts.nullable(),
  teacher: z.string().max(200),
})
export type SubjectPlan = z.infer<typeof SubjectPlanSchema>

export const SubjectSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  period: z.string().max(100),
  objectives: z.string().max(50_000),
  notes: z.string().max(200_000),
  archived: z.boolean(),
  plan: SubjectPlanSchema.optional(),
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
  tool: z.enum(['pen', 'eraser', 'text']),
  color: z.string().max(30),
  size: z.number().positive().max(200),
  /** Coordenadas planas [x0, y0, p0, x1, y1, p1, ...] */
  points: z.array(z.number()),
  text: z.string().max(4000).optional(),
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
  updatedAt: ts.optional(),
})
export type ToolLink = z.infer<typeof ToolLinkSchema>

export const KvSchema = z.object({ key: z.string().min(1).max(200), value: z.unknown(), updatedAt: ts.optional() })
export type KvEntry = z.infer<typeof KvSchema>

export const EVENT_KINDS = ['clase', 'parcial', 'entrega', 'final', 'laboratorio', 'estudio', 'otro'] as const
export const EventKindLabel: Record<EventKind, string> = {
  clase: 'Clase',
  parcial: 'Parcial',
  entrega: 'Entrega de TP',
  final: 'Final',
  laboratorio: 'Laboratorio',
  estudio: 'Estudio',
  otro: 'Otro',
}
export const EVENT_STATUSES = ['pendiente', 'hecho'] as const
export const EVENT_REPEATS = ['none', 'weekly'] as const
const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const CalendarEventSchema = z.object({
  id,
  title: z.string().min(1).max(500),
  kind: z.enum(EVENT_KINDS),
  subjectId: optionalId,
  startAt: ts,
  endAt: ts,
  allDay: z.boolean(),
  repeat: z.enum(EVENT_REPEATS),
  repeatUntil: ts.nullable().optional(),
  skipOn: z.array(dayKey).max(800),
  location: z.string().max(300),
  notes: z.string().max(20_000),
  status: z.enum(EVENT_STATUSES),
  doneOn: z.array(dayKey).max(800),
  originId: optionalId,
  seriesId: optionalId,
  createdAt: ts,
  updatedAt: ts,
})
export type CalendarEvent = z.infer<typeof CalendarEventSchema>
export type EventKind = (typeof EVENT_KINDS)[number]
export type EventStatus = (typeof EVENT_STATUSES)[number]
export type EventRepeat = (typeof EVENT_REPEATS)[number]

export const CARD_RATINGS = ['again', 'hard', 'good', 'easy'] as const
export const CardRatingLabel: Record<CardRating, string> = {
  again: 'Otra vez',
  hard: 'Difícil',
  good: 'Bien',
  easy: 'Fácil',
}
export type CardRating = (typeof CARD_RATINGS)[number]

export const CARD_ORIGINS = ['manual', 'concept', 'formula', 'question'] as const
export const CardOriginLabel: Record<CardOrigin, string> = {
  manual: 'Manual',
  concept: 'Concepto',
  formula: 'Fórmula',
  question: 'Pregunta',
}
export const DEFAULT_EASE = 2.5
export const MIN_EASE = 1.3

export const CardSchema = z.object({
  id,
  front: z.string().min(1).max(500_000),
  back: z.string().min(1).max(500_000),
  subjectId: optionalId,
  tags,
  originKind: z.enum(CARD_ORIGINS),
  originId: optionalId,
  originUpdatedAt: ts.nullable().optional(),
  intervalDays: z.number().nonnegative(),
  ease: z.number().min(MIN_EASE),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  dueAt: ts,
  lastReviewedAt: ts.nullable().optional(),
  createdAt: ts,
  updatedAt: ts,
})
export type Card = z.infer<typeof CardSchema>
export type CardOrigin = (typeof CARD_ORIGINS)[number]

export const CardReviewSchema = z.object({
  id,
  cardId: id,
  rating: z.enum(CARD_RATINGS),
  intervalDays: z.number().nonnegative(),
  ease: z.number().min(MIN_EASE),
  at: ts,
})
export type CardReview = z.infer<typeof CardReviewSchema>

export const EXERCISE_STATUSES = ['sin_intentar', 'resuelto', 'fallo', 'repasar'] as const
export const ExerciseStatusLabel: Record<ExerciseStatus, string> = {
  sin_intentar: 'Sin intentar',
  resuelto: 'Resuelto',
  fallo: 'Falló',
  repasar: 'Para repasar',
}
export const PRACTICE_RESULTS = ['bien', 'mal', 'ayuda'] as const
export const PracticeResultLabel: Record<PracticeResult, string> = {
  bien: 'Bien',
  mal: 'Mal',
  ayuda: 'Con ayuda',
}

export const ExerciseSchema = z.object({
  id,
  prompt: z.string().min(1).max(500_000),
  subjectId: optionalId,
  topic: z.string().max(200),
  difficulty: z.number().int().min(1).max(5),
  source: z.string().max(300),
  solution: z.string().max(500_000),
  answer: z.string().max(50_000),
  status: z.enum(EXERCISE_STATUSES),
  attempts: z.number().int().nonnegative(),
  lastAttemptMs: z.number().nonnegative(),
  lastAttemptAt: ts.nullable().optional(),
  tags,
  conceptIds: z.array(id),
  createdAt: ts,
  updatedAt: ts,
})
export type Exercise = z.infer<typeof ExerciseSchema>
export type ExerciseStatus = (typeof EXERCISE_STATUSES)[number]
export type PracticeResult = (typeof PRACTICE_RESULTS)[number]

export const ExamItemSchema = z.object({
  exerciseId: id,
  result: z.enum(PRACTICE_RESULTS).nullable(),
  ms: z.number().nonnegative(),
})
export type ExamItem = z.infer<typeof ExamItemSchema>

export const ExamRunSchema = z.object({
  id,
  subjectId: optionalId,
  topics: z.array(z.string().max(200)).max(50),
  count: z.number().int().positive().max(100),
  limitMs: z.number().int().positive(),
  startedAt: ts,
  endedAt: ts.nullable().optional(),
  items: z.array(ExamItemSchema).max(100),
  createdAt: ts,
})
export type ExamRun = z.infer<typeof ExamRunSchema>

/** Problema de Dev Lab. Solo se guarda la entrada: la solución se regenera de forma determinista. */
export const DevProblemSchema = z.object({
  id,
  title: z.string().max(300),
  text: z.string().max(5000),
  kind: z.string().max(30),
  strategy: z.string().max(60),
  lang: z.string().max(20),
  mode: z.enum(['guided', 'consult']),
  stage: z.string().max(20),
  revealed: z.number().int().min(0).max(10),
  createdAt: ts,
  updatedAt: ts,
})
export type DevProblem = z.infer<typeof DevProblemSchema>

const finite = z.number().finite()
const err = z.number().finite().nonnegative().nullable()
export const DatasetRowSchema = z.object({ x: finite, y: finite, ex: err, ey: err })
export type DatasetRow = z.infer<typeof DatasetRowSchema>

export const DATASET_FITS = ['none', 'linear', 'poly', 'exp', 'power', 'log'] as const
export const DatasetAxisSchema = z.object({ label: z.string().max(120), unit: z.string().max(60), log: z.boolean() })
export type DatasetAxis = z.infer<typeof DatasetAxisSchema>

/** Serie de datos de Workbench › Datos, con su ajuste elegido. */
export const DatasetSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  subjectId: optionalId,
  notes: z.string().max(50_000),
  rows: z.array(DatasetRowSchema).max(5000),
  xAxis: DatasetAxisSchema,
  yAxis: DatasetAxisSchema,
  fit: z.enum(DATASET_FITS),
  degree: z.number().int().min(2).max(5),
  createdAt: ts,
  updatedAt: ts,
})
export type Dataset = z.infer<typeof DatasetSchema>
export type DatasetFit = (typeof DATASET_FITS)[number]

export const REPORT_SECTIONS = ['objetivo', 'marco', 'materiales', 'procedimiento', 'datos', 'calculos', 'resultados', 'analisis', 'bibliografia'] as const
export const ReportSectionLabel: Record<(typeof REPORT_SECTIONS)[number], string> = {
  objetivo: 'Objetivo',
  marco: 'Marco teórico',
  materiales: 'Materiales',
  procedimiento: 'Procedimiento',
  datos: 'Datos',
  calculos: 'Cálculos',
  resultados: 'Resultados',
  analisis: 'Análisis y conclusiones',
  bibliografia: 'Bibliografía',
}
export const ReportSectionSchema = z.object({ key: z.enum(REPORT_SECTIONS), markdown: z.string().max(50_000) })
export const MeasurementSchema = z.object({
  name: z.string().max(80),
  value: z.number().finite(),
  uncertainty: z.number().finite().nonnegative(),
  unit: z.string().max(40),
})
export const PropagationVarSchema = z.object({
  symbol: z.string().max(40),
  value: z.number().finite(),
  uncertainty: z.number().finite().nonnegative(),
})
export const PropagationInputSchema = z.object({
  formula: z.string().max(500),
  unit: z.string().max(40),
  variables: z.array(PropagationVarSchema).max(12),
})
export const ReportSchema = z.object({
  id,
  title: z.string().min(1).max(200),
  subjectId: optionalId,
  noteId: optionalId,
  datasetId: optionalId,
  conceptIds: z.array(id).max(50),
  sections: z.array(ReportSectionSchema).max(9),
  measurements: z.array(MeasurementSchema).max(200),
  propagation: PropagationInputSchema.nullable(),
  createdAt: ts,
  updatedAt: ts,
})
export const ExamTopicSchema = z.object({
  id,
  title: z.string().min(1).max(200),
  conceptId: optionalId,
  mastery: z.number().int().min(1).max(5),
})
export const ExamSessionSchema = z.object({
  id,
  startAt: ts,
  endAt: ts,
  topicId: optionalId,
  kind: z.enum(['tema', 'repaso', 'simulacro']),
  done: z.boolean(),
  reason: z.string().max(300),
})
export const ExamPlanSchema = z.object({
  id,
  eventId: id,
  subjectId: optionalId,
  hoursPerDay: z.number().min(1).max(8),
  topics: z.array(ExamTopicSchema).max(30),
  sessions: z.array(ExamSessionSchema).max(80),
  createdAt: ts,
  updatedAt: ts,
})
export type ExamTopic = z.infer<typeof ExamTopicSchema>
export type ExamSession = z.infer<typeof ExamSessionSchema>
export type ExamPlan = z.infer<typeof ExamPlanSchema>

export type ReportSection = z.infer<typeof ReportSectionSchema>
export type Measurement = z.infer<typeof MeasurementSchema>
export type PropagationInput = z.infer<typeof PropagationInputSchema>
export type Report = z.infer<typeof ReportSchema>

export const MISTAKE_ORIGINS = ['ejercicio', 'parcial', 'practica'] as const
export const MistakeOriginLabel: Record<(typeof MISTAKE_ORIGINS)[number], string> = {
  ejercicio: 'Ejercicio',
  parcial: 'Parcial',
  practica: 'Práctica',
}
export const MISTAKE_KINDS = [
  'de signo',
  'de cálculo',
  'de concepto',
  'de unidades',
  'no leí el enunciado',
  'de método',
  'de tiempo',
  'otro',
] as const

export const MistakeSchema = z.object({
  id,
  subjectId: optionalId,
  topic: z.string().max(200),
  what: z.string().min(1).max(20_000),
  solution: z.string().max(20_000),
  kind: z.string().min(1).max(80),
  origin: z.enum(MISTAKE_ORIGINS),
  at: ts,
  overcome: z.boolean(),
  exerciseId: optionalId,
  conceptId: optionalId,
  cardId: optionalId,
  createdAt: ts,
  updatedAt: ts,
})
export type Mistake = z.infer<typeof MistakeSchema>
export type MistakeOrigin = (typeof MISTAKE_ORIGINS)[number]

export const LIBRARY_KINDS = ['libro', 'pdf', 'guia', 'apunte', 'video', 'link'] as const
export const LibraryKindLabel: Record<(typeof LIBRARY_KINDS)[number], string> = {
  libro: 'Libro',
  pdf: 'PDF',
  guia: 'Guía',
  apunte: 'Apunte',
  video: 'Video',
  link: 'Enlace',
}
export const CHAPTER_STATUSES = ['pendiente', 'leyendo', 'leido'] as const
export const ChapterStatusLabel: Record<(typeof CHAPTER_STATUSES)[number], string> = {
  pendiente: 'Pendiente',
  leyendo: 'Leyendo',
  leido: 'Leído',
}
export const ChapterSchema = z.object({
  id,
  title: z.string().min(1).max(300),
  status: z.enum(CHAPTER_STATUSES),
  noteId: optionalId,
  conceptId: optionalId,
})
export const LibraryItemSchema = z.object({
  id,
  title: z.string().min(1).max(300),
  author: z.string().max(200),
  kind: z.enum(LIBRARY_KINDS),
  subjectId: optionalId,
  url: z.string().max(2_000),
  physical: z.string().max(300),
  chapters: z.array(ChapterSchema).max(200),
  notes: z.string().max(50_000),
  tags,
  favorite: z.boolean(),
  createdAt: ts,
  updatedAt: ts,
})
export type Chapter = z.infer<typeof ChapterSchema>
export type LibraryItem = z.infer<typeof LibraryItemSchema>
export type LibraryKind = (typeof LIBRARY_KINDS)[number]
export type ChapterStatus = (typeof CHAPTER_STATUSES)[number]
