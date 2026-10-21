import Dexie, { type EntityTable } from 'dexie'
import type {
  Calculation,
  Concept,
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
export const SCHEMA_VERSION = 2

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
] as const
export type TableName = (typeof TABLE_NAMES)[number]
