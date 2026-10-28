import { beforeEach, describe, expect, it } from 'vitest'
import { db, SCHEMA_VERSION } from '@/db/db'
import { exportData, importData, parseBackup } from './backup'
import { saveEvent } from './calendar'
import { saveExamPlan } from './examPlans'
import { deleteSubject } from './focus'
import { saveLibraryItem } from './library'
import { MISTAKE_KINDS_KEY, saveMistake } from './mistakes'
import { createNote } from './notes'
import { emptyReport, saveReport } from './reports'
import { WEEK_GOAL_KEY } from './studyGoal'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
})

describe('ida y vuelta de los módulos nuevos', () => {
  it('exporta, borra e importa informes, planes, errores, biblioteca y kv', async () => {
    const report = await saveReport({ ...emptyReport(), title: 'Densidad', subjectId: 's-1' })
    const event = await saveEvent({ title: 'Parcial', kind: 'parcial', startAt: 1, endAt: 2, allDay: false, repeat: 'none', subjectId: 's-1' })
    const plan = await saveExamPlan({ eventId: event.id, subjectId: 's-1', hoursPerDay: 2, topics: [], sessions: [] })
    const mistake = await saveMistake({
      subjectId: 's-1', topic: 'Límites', what: 'signo', solution: 'revisar', kind: 'de signo',
      origin: 'ejercicio', at: 10, overcome: false, exerciseId: null, conceptId: null, cardId: null,
    })
    const book = await saveLibraryItem({
      title: 'Spivak', author: '', kind: 'libro', subjectId: 's-1', url: '', physical: 'estante',
      chapters: [{ id: 'c1', title: 'Capítulo 1', status: 'leido', noteId: null, conceptId: null }],
      notes: '', tags: ['calculo'], favorite: true,
    })
    await db.kv.put({ key: WEEK_GOAL_KEY, value: 12 })
    await db.kv.put({ key: MISTAKE_KINDS_KEY, value: ['notación'] })
    await db.kv.put({ key: 'refs.favorites', value: ['c-g'] })

    const backup = await exportData()
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION)
    expect(backup.data.reports).toHaveLength(1)
    expect(backup.data.examPlans).toHaveLength(1)
    expect(backup.data.mistakes).toHaveLength(1)
    expect(backup.data.libraryItems).toHaveLength(1)

    db.close()
    await db.delete()
    await db.open()
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await importData(parsed.backup, 'replace')

    expect(await db.reports.get(report.id)).toMatchObject({ title: 'Densidad', subjectId: 's-1' })
    expect(await db.examPlans.get(plan.id)).toMatchObject({ hoursPerDay: 2, subjectId: 's-1' })
    expect(await db.mistakes.get(mistake.id)).toMatchObject({ what: 'signo', kind: 'de signo' })
    expect(await db.libraryItems.get(book.id)).toMatchObject({ title: 'Spivak', chapters: [expect.objectContaining({ title: 'Capítulo 1' })] })
    expect((await db.kv.get(WEEK_GOAL_KEY))?.value).toBe(12)
    expect((await db.kv.get(MISTAKE_KINDS_KEY))?.value).toEqual(['notación'])
    expect((await db.kv.get('refs.favorites'))?.value).toEqual(['c-g'])
  })

  it('un backup v3 y uno v8 migran a v12 sin perder lo viejo', async () => {
    await createNote({ title: 'Vieja' })
    const current = await exportData()
    for (const version of [3, 8]) {
      const data = { ...current.data, reports: undefined, examPlans: undefined, mistakes: undefined, libraryItems: undefined }
      const parsed = parseBackup(JSON.stringify({ ...current, schemaVersion: version, data }))
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) return
      expect(parsed.backup.schemaVersion).toBe(12)
      expect(parsed.backup.data.reports).toEqual([])
      expect(parsed.backup.data.examPlans).toEqual([])
      expect(parsed.backup.data.mistakes).toEqual([])
      expect(parsed.backup.data.libraryItems).toEqual([])
      expect(parsed.backup.data.notes.map((n) => n.title)).toEqual(['Vieja'])
    }
  })

  it('borrar la materia deja subjectId nulo en los módulos nuevos', async () => {
    const report = await saveReport({ ...emptyReport(), title: 'Lab', subjectId: 's-1' })
    const event = await saveEvent({ title: 'Final', kind: 'final', startAt: 3, endAt: 4, allDay: false, repeat: 'none' })
    const plan = await saveExamPlan({ eventId: event.id, subjectId: 's-1', hoursPerDay: 3, topics: [], sessions: [] })
    const mistake = await saveMistake({
      subjectId: 's-1', topic: '', what: 'unidades', solution: '', kind: 'de unidades',
      origin: 'practica', at: 1, overcome: false, exerciseId: null, conceptId: null, cardId: null,
    })
    const book = await saveLibraryItem({
      title: 'Guía', author: '', kind: 'guia', subjectId: 's-1', url: 'https://ejemplo.test', physical: '',
      chapters: [], notes: '', tags: [], favorite: false,
    })
    await deleteSubject('s-1')
    expect((await db.reports.get(report.id))?.subjectId).toBeNull()
    expect((await db.examPlans.get(plan.id))?.subjectId).toBeNull()
    expect((await db.mistakes.get(mistake.id))?.subjectId).toBeNull()
    expect((await db.libraryItems.get(book.id))?.subjectId).toBeNull()
  })

  it('ignora campos desconocidos y completa tablas que faltan', async () => {
    const book = await saveLibraryItem({
      title: 'Apunte', author: '', kind: 'apunte', subjectId: null, url: '', physical: '',
      chapters: [], notes: '', tags: [], favorite: false,
    })
    const backup = await exportData()
    const withExtra = {
      ...backup,
      data: {
        ...backup.data,
        libraryItems: [{ ...book, rutaFantasma: 'C:\\no' }],
        mistakes: undefined,
      },
    }
    const parsed = parseBackup(JSON.stringify(withExtra))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.data.mistakes).toEqual([])
    expect(parsed.backup.data.libraryItems[0]).toMatchObject({ title: 'Apunte' })
    expect('rutaFantasma' in parsed.backup.data.libraryItems[0]!).toBe(false)
  })
})
