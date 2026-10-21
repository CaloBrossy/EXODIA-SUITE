import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import { SEED_CONCEPTS } from '@/db/seed/concepts'
import { createNote, deleteNote, filterNotes, listNotes, updateNote } from './notes'
import { deleteConcept, emptyConcept, saveConcept } from './concepts'
import { emptyFormula, evaluateFormula, saveFormula, validateEvalExpression } from './formulas'
import { exportData, importData, parseBackup } from './backup'
import { createTask, setTaskDone, settleTimer, updateTimer } from './focus'
import { addQuestion } from './knowledge'
import { start } from '@/lib/pomodoro'
import { saveTool } from './tools'

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
    expect(parseBackup(JSON.stringify({ app: 'nexus', schemaVersion: 99, data: {} })).ok).toBe(false)
    const backup = await exportData()
    const broken = structuredClone(backup) as unknown as { data: { notes: unknown[] } }
    broken.data.notes = [{ id: 'x', title: 3 }]
    const r = parseBackup(JSON.stringify(broken))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/notes/)
  })
})
