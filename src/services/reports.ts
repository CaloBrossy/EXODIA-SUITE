import { db } from '@/db/db'
import { REPORT_SECTIONS, ReportSchema, type Report } from '@/db/models'
import { uid } from '@/lib/text'
import { guard } from './errors'

export type ReportInput = Omit<Report, 'id' | 'createdAt' | 'updatedAt'>

export const emptyReport = (): ReportInput => ({
  title: '',
  subjectId: null,
  noteId: null,
  datasetId: null,
  conceptIds: [],
  sections: REPORT_SECTIONS.map((key) => ({ key, markdown: '' })),
  measurements: [],
  propagation: null,
})

export function listReports(): Promise<Report[]> {
  return guard('No se pudieron leer los informes', () => db.reports.orderBy('updatedAt').reverse().toArray())
}

export function saveReport(input: ReportInput, id?: string): Promise<Report> {
  return guard('No se pudo guardar el informe', async () => {
    const now = Date.now()
    const prev = id ? await db.reports.get(id) : undefined
    const parsed = ReportSchema.safeParse({
      ...input,
      title: input.title.trim(),
      id: prev?.id ?? uid(),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new Error(issue?.path[0] === 'title' ? 'Poné un título al informe.' : `Datos inválidos en ${issue?.path.join('.')}: ${issue?.message}`)
    }
    await db.reports.put(parsed.data)
    return parsed.data
  })
}

export function deleteReport(id: string): Promise<void> {
  return guard('No se pudo eliminar el informe', () => db.reports.delete(id))
}
