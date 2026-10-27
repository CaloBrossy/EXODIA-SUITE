import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import { SEED_CONCEPTS } from '@/db/seed/concepts'
import { createNote, deleteNote, filterNotes, listNotes, updateNote } from './notes'
import { deleteConcept, emptyConcept, saveConcept } from './concepts'
import { emptyFormula, evaluateFormula, saveFormula, validateEvalExpression } from './formulas'
import { exportData, importData, parseBackup } from './backup'
import { isMissingRelation, mapLocalToRemote, mapRemoteToLocal, mergeRows, takeRemote } from './sync'
import { deleteEvent, listStudyBlocks, LOAD_HOURS_KEY, replaceStudyPlan, saveEvent, SUBJECT_COLORS_KEY, writeLoadHours, writeSubjectColor } from './calendar'
import { applyReview, deleteCard, listCardsByOrigin, NEW_LIMIT_KEY, saveCard, writeNewLimit } from './cards'
import { recordAttempt, saveExercise } from './exercises'
import { createTask, deleteSubject, saveSubject, setTaskDone, settleTimer, updateTimer } from './focus'
import { importPlan, savePlan, setPlanStatus } from './plan'
import { eligibilityMap, inPlan, parsePlanImport } from '@/lib/plan'
import { addQuestion } from './knowledge'
import { start } from '@/lib/pomodoro'
import { saveTool } from './tools'
import { emptyDataset, saveDataset } from './datasets'
import { emptyReport, saveReport } from './reports'

describe('series de datos', () => {
  it('guarda, exporta, sincroniza y sobrevive al borrado de la materia', async () => {
    await expect(saveDataset(emptyDataset())).rejects.toThrow(/nombre/)
    const d = await saveDataset({ ...emptyDataset(), name: 'Péndulo', subjectId: 's-1', rows: [{ x: 1, y: 2, ex: null, ey: 0.1 }], fit: 'poly', degree: 3 })
    const again = await saveDataset({ ...d, notes: 'medido' }, d.id)
    expect(again.createdAt).toBe(d.createdAt)
    const backup = await exportData()
    expect(backup.data.datasets).toHaveLength(1)
    const parsed = parseBackup(JSON.stringify({ ...backup, schemaVersion: 7, data: { ...backup.data, datasets: undefined } }))
    expect(parsed.ok && parsed.backup.data.datasets).toEqual([])
    const remote = mapLocalToRemote(backup.data, 'u')
    expect(remote.datasets[0]).toMatchObject({ name: 'Péndulo', subject_id: 's-1', fit: 'poly', degree: 3 })
    const [row] = remote.datasets
    const back = mapRemoteToLocal({
      subjects: [], concepts: [], formulas: [], notes: [], questions: [], calculations: [], tasks: [], sessions: [], sketches: [], tools: [], kv: [], events: [], cards: [], card_reviews: [], exercises: [], exam_runs: [], dev_problems: [], reports: [], exam_plans: [], mistakes: [], library_items: [],
      datasets: [{ ...row!, created_at: row!.created_at!, updated_at: row!.updated_at!, user_id: 'u', subject_id: row!.subject_id ?? null, notes: row!.notes!, rows: [...(row!.rows as unknown[]), { x: 'mal' }] as never, x_axis: null as never, fit: 'raro', degree: row!.degree! }],
    })
    expect(back.datasets[0]).toMatchObject({ rows: [{ x: 1, y: 2, ex: null, ey: 0.1 }], xAxis: { label: '', unit: '', log: false }, fit: 'none', notes: 'medido' })
    await deleteSubject('s-1')
    expect((await db.datasets.get(d.id))?.subjectId).toBeNull()
  })
})

describe('informes', () => {
  it('guarda, exporta y descarta una medición remota inválida', async () => {
    await expect(saveReport(emptyReport())).rejects.toThrow(/título/)
    const r = await saveReport({ ...emptyReport(), title: 'Péndulo', subjectId: 's-1', measurements: [{ name: 'L', value: 1, uncertainty: 0.01, unit: 'm' }] })
    const backup = await exportData()
    expect(backup.data.reports).toHaveLength(1)
    const parsed = parseBackup(JSON.stringify({ ...backup, schemaVersion: 8, data: { ...backup.data, reports: undefined } }))
    expect(parsed.ok && parsed.backup.data.reports).toEqual([])
    const remote = mapLocalToRemote(backup.data, 'u')
    const [row] = remote.reports
    const back = mapRemoteToLocal({
      subjects: [], concepts: [], formulas: [], notes: [], questions: [], calculations: [], tasks: [], sessions: [], sketches: [], tools: [], kv: [], events: [], cards: [], card_reviews: [], exercises: [], exam_runs: [], dev_problems: [], datasets: [], exam_plans: [], mistakes: [], library_items: [],
      reports: [{ ...row!, created_at: row!.created_at!, updated_at: row!.updated_at!, user_id: 'u', subject_id: 's-1', note_id: null, dataset_id: null, concept_ids: [], measurements: [{ name: 'L', value: 1, uncertainty: 0.01, unit: 'm' }, { name: 'mala' }] as never, propagation: null }],
    })
    expect(back.reports[0]?.measurements).toEqual([{ name: 'L', value: 1, uncertainty: 0.01, unit: 'm' }])
    await deleteSubject('s-1')
    expect((await db.reports.get(r.id))?.subjectId).toBeNull()
  })
})

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
})

describe('base de datos y semillas', () => {
  it('carga la biblioteca inicial con relaciones válidas', async () => {
    const concepts = await db.concepts.toArray()
    expect(concepts.length).toBe(SEED_CONCEPTS.length)
    const ids = new Set(concepts.map((c) => c.id))
    for (const c of concepts) for (const r of c.relatedIds) expect(ids.has(r), `${c.id} → ${r}`).toBe(true)
    expect(await db.subjects.count()).toBe(9)
    expect(await db.tools.count()).toBeGreaterThanOrEqual(5)
    for (const f of await db.formulas.toArray()) expect(validateEvalExpression(f), f.id).toBeNull()
  })
})

describe('notas', () => {
  it('crea, edita, busca y elimina', async () => {
    const n = await createNote({ title: 'Entropía y café', tags: ['termo'] })
    await updateNote(n.id, { content: 'El café se enfría: $\\Delta S$' })
    const all = await listNotes()
    expect(all[0]!.content).toContain('café')
    expect(filterNotes(all, { query: 'CAFE' })).toHaveLength(1)
    expect(filterNotes(all, { tag: 'otra' })).toHaveLength(0)
    const q = await addQuestion('¿Por qué?', { noteId: n.id })
    await deleteNote(n.id)
    expect(await db.notes.get(n.id)).toBeUndefined()
    expect((await db.questions.get(q.id))!.noteId).toBeNull()
  })
  it('falla al actualizar una nota inexistente', async () => {
    await expect(updateNote('nope', { title: 'x' })).rejects.toThrow(/ya no existe/)
  })
})

describe('conceptos', () => {
  it('mantiene relaciones simétricas y limpia referencias al borrar', async () => {
    const id = await saveConcept({ ...emptyConcept(), title: 'Capacitor', relatedIds: ['c-ohm'] })
    expect((await db.concepts.get('c-ohm'))!.relatedIds).toContain(id)
    await saveConcept({ ...(await db.concepts.get(id))!, relatedIds: [] }, id)
    expect((await db.concepts.get('c-ohm'))!.relatedIds).not.toContain(id)
    const note = await createNote({ conceptIds: ['c-ohm'] })
    await deleteConcept('c-ohm')
    expect((await db.notes.get(note.id))!.conceptIds).toEqual([])
    expect((await db.concepts.get('c-energia'))!.relatedIds).not.toContain('c-ohm')
  })
  it('rechaza conceptos sin título', async () => {
    await expect(saveConcept(emptyConcept())).rejects.toThrow()
  })
})

describe('fórmulas', () => {
  it('evalúa solo con variables declaradas', async () => {
    const base = { ...emptyFormula(), name: 'Potencia', variables: [{ symbol: 'V', meaning: '', unit: 'V' }, { symbol: 'I', meaning: '', unit: 'A' }] }
    expect(validateEvalExpression({ ...base, evalExpression: 'V * I * X' })).toMatch(/no declaradas/)
    const id = await saveFormula({ ...base, evalExpression: 'V * I', evalTarget: 'P' })
    const f = (await db.formulas.get(id))!
    expect(evaluateFormula(f, { V: '5', I: '2e-3' })).toBe('0.01')
    expect(() => evaluateFormula(f, { V: '5' })).toThrow(/Falta/)
    await expect(saveFormula({ ...base, evalExpression: 'import(1)' })).rejects.toThrow()
  })
})

describe('tareas y pomodoro', () => {
  it('persisten tareas', async () => {
    const t = await createTask({ title: 'TP 1', details: '', priority: 'high', subjectId: 's-1', project: '', dueDate: null })
    await setTaskDone(t, true)
    expect((await db.tasks.get(t.id))!.done).toBe(true)
  })
  it('registra cada sesión vencida exactamente una vez', async () => {
    await updateTimer((s) => start(s, 0))
    const far = 26 * 60_000
    const [a, b] = await Promise.all([settleTimer(far), settleTimer(far)])
    expect([a, b].filter(Boolean)).toHaveLength(1)
    expect(await db.sessions.count()).toBe(1)
    expect(await settleTimer(far)).toBeNull()
  })
})

describe('calendario', () => {
  it('guarda, enlaza bloques de estudio y los borra en cascada', async () => {
    const exam = await saveEvent({ title: 'Parcial', kind: 'parcial', startAt: 100, endAt: 200, allDay: false, repeat: 'none' })
    await saveEvent({ title: 'Estudio', kind: 'estudio', startAt: 10, endAt: 20, allDay: false, repeat: 'none', originId: exam.id })
    await expect(saveEvent({ title: 'x', kind: 'otro', startAt: 5, endAt: 5, allDay: false, repeat: 'none' })).rejects.toThrow(/posterior/)
    await deleteEvent(exam.id, { cascadeStudy: true })
    expect(await db.events.count()).toBe(0)
  })

  it('reemplaza el plan de estudio ligado al examen', async () => {
    const exam = await saveEvent({ title: 'Final', kind: 'final', startAt: 1_000, endAt: 2_000, allDay: false, repeat: 'none' })
    await saveEvent({ title: 'Viejo', kind: 'estudio', startAt: 10, endAt: 20, allDay: false, repeat: 'none', originId: exam.id })
    await replaceStudyPlan(exam.id, [{ startAt: 30, endAt: 40 }], { title: exam.title, subjectId: null })
    const blocks = await listStudyBlocks(exam.id)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.title).toBe('Estudio: Final')
    expect(blocks[0]?.startAt).toBe(30)
    expect(await db.events.get(exam.id)).toBeTruthy()
  })
})

describe('tarjetas', () => {
  it('guarda, exige frente y dorso, y suelta la materia al borrarla', async () => {
    await expect(saveCard({ front: '', back: 'x' })).rejects.toThrow(/frente/)
    await expect(saveCard({ front: '¿Qué es X?', back: '  ' })).rejects.toThrow(/dorso/)
    const card = await saveCard({ front: '¿Qué es X?', back: 'Un concepto.', subjectId: 's-1', originKind: 'concept', originId: 'c-ohm', originUpdatedAt: 10 })
    expect(card.ease).toBe(2.5)
    expect(card.intervalDays).toBe(0)
    expect(card.reps).toBe(0)
    expect((await listCardsByOrigin('concept', 'c-ohm'))).toHaveLength(1)
    await deleteSubject('s-1')
    expect((await db.cards.get(card.id))?.subjectId).toBeNull()
    await deleteCard(card.id)
    expect(await db.cards.count()).toBe(0)
  })

  it('persiste el intervalo SM-2 al recargar', async () => {
    const card = await saveCard({ front: 'Q', back: 'A' })
    const now = new Date(2026, 9, 26, 14).getTime()
    await applyReview(card.id, 'good', now)
    await applyReview(card.id, 'good', now)
    db.close()
    await db.open()
    const loaded = await db.cards.get(card.id)
    expect(loaded?.intervalDays).toBe(6)
    expect(loaded?.reps).toBe(2)
    expect(loaded?.lastReviewedAt).toBe(now)
    expect(await db.reviews.count()).toBe(2)
  })

  it('registra un intento y suelta la materia', async () => {
    const e = await saveExercise({ prompt: 'Calcular $\\int x$', subjectId: 's-1', topic: 'integrales', difficulty: 2 })
    const next = await recordAttempt(e.id, 'mal', 1500, 99)
    expect(next.status).toBe('fallo')
    expect(next.attempts).toBe(1)
    expect(next.lastAttemptMs).toBe(1500)
    await deleteSubject('s-1')
    expect((await db.exercises.get(e.id))?.subjectId).toBeNull()
  })
})

describe('plan de estudios', () => {
  it('importa fusionando con Focus, aprueba y habilita', async () => {
    const before = (await db.subjects.get('s-1'))!
    await saveSubject({ ...before, objectives: 'Dominar límites' }, 's-1')
    await createTask({ title: 'TP 1', details: '', priority: 'medium', subjectId: 's-1', project: '', dueDate: null })
    const report = await importPlan(parsePlanImport(
      `codigo;nombre;anio;correlativas_cursar;correlativas_rendir\nAM1;${before.name};1;;\nAM2;Análisis Matemático II;2;AM1;AM1\nFIS;Física II;2;AM2|XX;`,
    ))
    expect(report).toMatchObject({ updated: 2, created: 1, unresolved: ['XX'] })
    const am1 = (await db.subjects.get('s-1'))!
    expect(am1.objectives).toBe('Dominar límites')
    expect(am1.plan?.code).toBe('AM1')
    expect(await db.tasks.where('subjectId').equals('s-1').count()).toBe(1)

    const plan = async () => eligibilityMap((await db.subjects.toArray()).filter(inPlan))
    const am2 = (await db.subjects.get('s-6'))!
    expect((await plan()).get(am2.id)?.canCourse).toBe(false)
    await setPlanStatus('s-1', 'aprobada', 8)
    expect((await db.subjects.get('s-1'))?.plan?.approvedAt).toBeTypeOf('number')
    expect((await plan()).get(am2.id)?.canCourse).toBe(true)

    await expect(savePlan('s-1', { ...am1.plan!, requiresCourse: [am2.id] })).rejects.toThrow(/ciclo/)
    await saveSubject({ ...am1, plan: undefined, notes: 'x' } as never, 's-1')
    expect((await db.subjects.get('s-1'))?.plan?.status).toBe('aprobada')

    await deleteSubject('s-1')
    expect((await db.subjects.get(am2.id))?.plan?.requiresCourse).toEqual([])
    expect(await db.tasks.where('subjectId').equals('s-1').count()).toBe(0)
  })
})

describe('herramientas externas', () => {
  it('valida URLs', async () => {
    await expect(saveTool({ name: 'x', url: 'javascript:alert(1)', description: '' })).rejects.toThrow()
    await saveTool({ name: 'Octave', url: 'https://octave-online.net', description: '' })
    expect(await db.tools.filter((t) => t.name === 'Octave').count()).toBe(1)
  })
})

describe('exportación e importación', () => {
  it('ida y vuelta completa con reemplazo', async () => {
    await createNote({ title: 'Respaldo' })
    const backup = await exportData()
    const text = JSON.stringify(backup)
    await createNote({ title: 'Posterior' })
    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await importData(parsed.backup, 'replace')
    const titles = (await db.notes.toArray()).map((n) => n.title)
    expect(titles).toEqual(['Respaldo'])
    expect(await db.concepts.count()).toBe(SEED_CONCEPTS.length)
  })
  it('fusión conserva datos locales', async () => {
    const backup = await exportData()
    await createNote({ title: 'Local' })
    await importData(backup, 'merge')
    expect((await db.notes.toArray()).map((n) => n.title)).toContain('Local')
  })
  it('rechaza archivos inválidos sin tocar los datos', async () => {
    expect(parseBackup('no json').ok).toBe(false)
    expect(parseBackup(JSON.stringify({ app: 'otra', schemaVersion: 1 })).ok).toBe(false)
    expect(parseBackup(JSON.stringify({ app: 'exodia', schemaVersion: 99, data: {} })).ok).toBe(false)
    const backup = await exportData()
    const broken = structuredClone(backup) as unknown as { data: { notes: unknown[] } }
    broken.data.notes = [{ id: 'x', title: 3 }]
    const r = parseBackup(JSON.stringify(broken))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/notes/)
  })
  it('importa un JSON v3 sin events y sin perder notas ni kv', async () => {
    await createNote({ title: 'Vieja' })
    await db.kv.put({ key: LOAD_HOURS_KEY, value: 18 })
    const current = await exportData()
    const v3 = {
      app: 'exodia',
      schemaVersion: 3,
      exportedAt: current.exportedAt,
      data: {
        notes: current.data.notes,
        concepts: current.data.concepts,
        formulas: current.data.formulas,
        questions: current.data.questions,
        calculations: current.data.calculations,
        tasks: current.data.tasks,
        subjects: current.data.subjects,
        sessions: current.data.sessions,
        sketches: current.data.sketches,
        tools: current.data.tools,
        kv: current.data.kv,
        devProblems: current.data.devProblems,
      },
    }
    const parsed = parseBackup(JSON.stringify(v3))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.data.events).toEqual([])
    expect(parsed.backup.data.cards).toEqual([])
    expect(parsed.counts.events).toBe(0)
    expect(parsed.counts.cards).toBe(0)
    await saveEvent({ title: 'Temporal', kind: 'otro', startAt: 1, endAt: 2, allDay: false, repeat: 'none' })
    await importData(parsed.backup, 'replace')
    expect((await db.notes.toArray()).map((n) => n.title)).toEqual(['Vieja'])
    expect(await db.events.count()).toBe(0)
    expect((await db.kv.get(LOAD_HOURS_KEY))?.value).toBe(18)
    expect(await db.concepts.count()).toBe(SEED_CONCEPTS.length)
  })
  it('exporta eventos y las claves kv del calendario', async () => {
    const ev = await saveEvent({
      title: 'Álgebra',
      kind: 'clase',
      startAt: Date.UTC(2026, 2, 9, 14, 0),
      endAt: Date.UTC(2026, 2, 9, 16, 0),
      allDay: false,
      repeat: 'weekly',
      repeatUntil: Date.UTC(2026, 5, 30),
      skipOn: ['2026-04-06'],
    })
    await writeLoadHours(22)
    await writeSubjectColor('s-1', '#5ee7f7')
    const backup = await exportData()
    expect(backup.schemaVersion).toBe(12)
    expect(backup.data.events).toHaveLength(1)
    expect(backup.data.cards).toEqual([])
    expect(backup.data.events[0]).toMatchObject({ id: ev.id, skipOn: ['2026-04-06'], repeat: 'weekly' })
    expect(backup.data.kv.some((k) => k.key === LOAD_HOURS_KEY && k.value === 22)).toBe(true)
    expect(backup.data.kv.some((k) => k.key === SUBJECT_COLORS_KEY)).toBe(true)
    await deleteEvent(ev.id)
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await importData(parsed.backup, 'replace')
    expect((await db.events.get(ev.id))?.title).toBe('Álgebra')
    expect((await db.kv.get(LOAD_HOURS_KEY))?.value).toBe(22)
  })
  it('importa un JSON v4 sin cards y exporta el cupo de nuevas', async () => {
    const card = await saveCard({ front: 'Q', back: 'A', tags: ['repaso'] })
    await writeNewLimit(8)
    const current = await exportData()
    const { cards, ...rest } = current.data
    expect(cards).toHaveLength(1)
    const v4 = {
      app: 'exodia',
      schemaVersion: 4,
      exportedAt: current.exportedAt,
      data: rest,
    }
    const parsed = parseBackup(JSON.stringify(v4))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.backup.data.cards).toEqual([])
    await importData(parsed.backup, 'replace')
    expect(await db.cards.count()).toBe(0)
    expect(current.data.kv.some((k) => k.key === NEW_LIMIT_KEY && k.value === 8)).toBe(true)
    await saveCard({ front: card.front, back: card.back })
    const again = await exportData()
    expect(again.data.cards).toHaveLength(1)
    expect(again.schemaVersion).toBe(12)
  })
})

describe('sync a supabase', () => {
  it('mapea seed Dexie a filas remotas', async () => {
    const uid = '11111111-1111-1111-1111-111111111111'
    const remote = mapLocalToRemote((await exportData()).data, uid)
    expect(remote.concepts.length).toBe(SEED_CONCEPTS.length)
    expect(remote.subjects).toHaveLength(9)
    expect(remote.tools[0]).toMatchObject({ user_id: uid, sort_order: 1, seed: true })
    expect(remote.concepts[0]?.created_at).toMatch(/T/)
    expect(remote.kv).toEqual([])
  })
  it('en un empate se queda la copia local', () => {
    expect(takeRemote(10, 10)).toBe(false)
    expect(takeRemote(null, 4)).toBe(true)
    const local = [{ id: 'a', updatedAt: 5, title: 'local' }]
    const remote = [{ id: 'a', updatedAt: 5, title: 'nube' }, { id: 'b', updatedAt: 1, title: 'nueva' }]
    const merged = mergeRows(local, remote, (r) => r.updatedAt, 'merge')
    expect(merged.map((r) => r.title)).toEqual(['local', 'nueva'])
    expect(mergeRows(local, remote, (r) => r.updatedAt, 'remote-wins').map((r) => r.title)).toEqual(['nube', 'nueva'])
  })
  it('detecta una tabla remota ausente y mapea events', async () => {
    expect(isMissingRelation({ code: 'PGRST205', message: 'Could not find the table public.events in the schema cache' })).toBe(true)
    expect(isMissingRelation({ code: '42P01', message: 'relation "events" does not exist' })).toBe(true)
    expect(isMissingRelation({ code: '42501', message: 'permission denied' })).toBe(false)
    await saveEvent({ title: 'Lab', kind: 'laboratorio', startAt: 10, endAt: 20, allDay: false, repeat: 'none' })
    await saveCard({ front: '¿F?', back: 'Sí.', originKind: 'formula', originId: 'f-1', originUpdatedAt: 1 })
    const mapped = mapLocalToRemote((await exportData()).data, '11111111-1111-1111-1111-111111111111')
    expect(mapped.events[0]).toMatchObject({ user_id: '11111111-1111-1111-1111-111111111111', kind: 'laboratorio', all_day: false })
    expect(mapped.cards[0]).toMatchObject({ user_id: '11111111-1111-1111-1111-111111111111', origin_kind: 'formula', interval_days: 0 })
  })
  it('traduce una fila remota a la forma local', () => {
    const local = mapRemoteToLocal({
      subjects: [], concepts: [], formulas: [], notes: [], questions: [], calculations: [], tasks: [], sessions: [], sketches: [], tools: [], kv: [], events: [], cards: [], card_reviews: [], exercises: [], exam_runs: [], datasets: [], reports: [], exam_plans: [], mistakes: [], library_items: [],
      dev_problems: [{
        id: 'p1', user_id: 'u', title: 'Suma', text: '1+1', kind: 'expr', strategy: 'direct', lang: 'py', mode: 'guided', stage: 'code', revealed: 2,
        created_at: '2020-01-01T00:00:00.000Z', updated_at: '2020-01-02T00:00:00.000Z',
      }],
    })
    expect(local.devProblems[0]).toMatchObject({ id: 'p1', title: 'Suma', revealed: 2, mode: 'guided' })
    expect(local.events).toEqual([])
    expect(local.cards).toEqual([])
  })
})
