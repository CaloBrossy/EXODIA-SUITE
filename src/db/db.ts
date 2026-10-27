import Dexie, { type EntityTable } from 'dexie'
import type {
  Calculation,
  CalendarEvent,
  Card,
  CardReview,
  Concept,
  Dataset,
  ExamRun,
  Report,
  ExamPlan,
  Mistake,
  Exercise,
  DevProblem,
  FocusSession,
  Formula,
  KvEntry,
  Note,
  Question,
  Sketch,
  Subject,
  Task,
  ToolLink,
} from './models'
import { seedDatabase } from './seed'
import { migrateConceptV2, migrateFormulaV2 } from './migrations'

export const DB_NAME = 'exodia'
/** Versión lógica del esquema; se incluye en las exportaciones JSON. */
export const SCHEMA_VERSION = 11

export class ExodiaDB extends Dexie {
  notes!: EntityTable<Note, 'id'>
  concepts!: EntityTable<Concept, 'id'>
  formulas!: EntityTable<Formula, 'id'>
  questions!: EntityTable<Question, 'id'>
  calculations!: EntityTable<Calculation, 'id'>
  tasks!: EntityTable<Task, 'id'>
  subjects!: EntityTable<Subject, 'id'>
  sessions!: EntityTable<FocusSession, 'id'>
  sketches!: EntityTable<Sketch, 'id'>
  tools!: EntityTable<ToolLink, 'id'>
  kv!: EntityTable<KvEntry, 'key'>
  devProblems!: EntityTable<DevProblem, 'id'>
  events!: EntityTable<CalendarEvent, 'id'>
  cards!: EntityTable<Card, 'id'>
  reviews!: EntityTable<CardReview, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  examRuns!: EntityTable<ExamRun, 'id'>
  datasets!: EntityTable<Dataset, 'id'>
  reports!: EntityTable<Report, 'id'>
  examPlans!: EntityTable<ExamPlan, 'id'>
  mistakes!: EntityTable<Mistake, 'id'>

  constructor(name = DB_NAME) {
    super(name)
    // Migraciones: nunca modificar una versión publicada. Para cambiar el esquema,
    // agregar `this.version(N + 1).stores({...}).upgrade(tx => ...)` y subir SCHEMA_VERSION.
    this.version(1).stores({
      notes: 'id, updatedAt, createdAt, *tags, subjectId',
      concepts: 'id, discipline, *tags, updatedAt, lastViewedAt',
      formulas: 'id, discipline, *tags, updatedAt',
      questions: 'id, createdAt, conceptId, noteId',
      calculations: 'id, createdAt, kind',
      tasks: 'id, createdAt, subjectId',
      subjects: 'id, name',
      sessions: 'id, startedAt, subjectId, taskId',
      sketches: 'id, updatedAt',
      tools: 'id, order',
      kv: 'key',
    })
    this.version(2).upgrade(async (tx) => {
      await tx.table('formulas').toCollection().modify((f: Formula) => Object.assign(f, migrateFormulaV2(f)))
      await tx.table('concepts').toCollection().modify((c: Concept) => Object.assign(c, migrateConceptV2(c)))
    })
    this.version(3).stores({ devProblems: 'id, updatedAt' })
    this.version(4).stores({ events: 'id, startAt, endAt, subjectId, kind, originId, updatedAt' })
    this.version(5).stores({ cards: 'id, subjectId, originKind, originId, dueAt, updatedAt, *tags' })
    this.version(6).stores({ reviews: 'id, cardId, at' })
    this.version(7).stores({
      exercises: 'id, subjectId, topic, difficulty, status, updatedAt, *tags, *conceptIds',
      examRuns: 'id, startedAt, subjectId',
    })
    this.version(8).stores({ datasets: 'id, subjectId, updatedAt' })
    this.version(9).stores({ reports: 'id, subjectId, updatedAt' })
    this.version(10).stores({ examPlans: 'id, eventId, subjectId, updatedAt' })
    this.version(11).stores({ mistakes: 'id, subjectId, kind, at, updatedAt' })
    this.on('populate', (tx) => seedDatabase(tx))
  }
}

export const db = new ExodiaDB()

export const TABLE_NAMES = [
  'notes',
  'concepts',
  'formulas',
  'questions',
  'calculations',
  'tasks',
  'subjects',
  'sessions',
  'sketches',
  'tools',
  'kv',
  'devProblems',
  'events',
  'cards',
  'reviews',
  'exercises',
  'examRuns',
  'datasets',
  'reports',
  'examPlans',
  'mistakes',
] as const
export type TableName = (typeof TABLE_NAMES)[number]
