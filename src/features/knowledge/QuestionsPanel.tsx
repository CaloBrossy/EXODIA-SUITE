import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Check, RotateCcw, Trash2 } from 'lucide-react'
import { db } from '@/db/db'
import type { Question } from '@/db/models'
import { addQuestion, deleteQuestion, setQuestionResolved, updateQuestion } from '@/services/knowledge'
import { listCards } from '@/services/cards'
import { proposeFromQuestion, skipExisting } from '@/lib/flashcards'
import { ProposeCards } from '@/features/review/ProposeCards'
import { useFeedback } from '@/components/feedback'
import { Button, cx, Input, Textarea } from '@/components/ui'
import { relativeTime } from '@/lib/text'

function QuestionRow({ q, showOrigin }: { q: Question; showOrigin?: boolean }) {
  const { fail, confirm } = useFeedback()
  const [drafts, setDrafts] = useState<ReturnType<typeof proposeFromQuestion> | null>(null)
  const [answer, setAnswer] = useState(q.answer)
  const [open, setOpen] = useState(false)
  const origin = useLiveQuery(async () => {
    if (!showOrigin) return null
    if (q.conceptId) return { to: `/knowledge/${q.conceptId}`, label: (await db.concepts.get(q.conceptId))?.title }
    if (q.noteId) return { to: `/notes/${q.noteId}`, label: (await db.notes.get(q.noteId))?.title || 'Nota' }
    return null
  }, [q.conceptId, q.noteId, showOrigin])

  return (
    <li className="flex flex-col gap-1.5 border-b border-line py-2 last:border-0">
      <div className="flex items-start gap-2">
        <button
          aria-label={q.resolved ? 'Marcar como pendiente' : 'Marcar como resuelta'}
          onClick={() => setQuestionResolved(q, !q.resolved).catch(fail)}
          className={cx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', q.resolved ? 'border-ok bg-ok/20 text-ok' : 'border-line')}
        >
          {q.resolved && <Check size={11} />}
        </button>
        <button onClick={() => setOpen((o) => !o)} className={cx('flex-1 text-left text-sm', q.resolved && 'text-muted line-through')}>
          {q.text}
        </button>
        <span className="shrink-0 text-xs text-muted">{relativeTime(q.createdAt)}</span>
      </div>
      {origin?.label && (
        <Link to={origin.to} className="ml-6 text-xs text-accent hover:underline">
          {origin.label}
        </Link>
      )}
      {open && (
        <div className="ml-6 flex flex-col gap-1.5">
          <Textarea
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onBlur={() => answer !== q.answer && updateQuestion(q.id, { answer }).catch(fail)}
            placeholder="Respuesta o pistas encontradas…"
          />
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setQuestionResolved(q, !q.resolved).catch(fail)}>
              {q.resolved ? <><RotateCcw size={13} /> Reabrir</> : <><Check size={13} /> Resuelta</>}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void listCards().then((cards) => setDrafts(skipExisting(proposeFromQuestion(q), cards))).catch(fail)
              }}
            >
              Crear tarjeta
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={async () => {
                if (await confirm({ title: '¿Eliminar la pregunta?', danger: true, confirmLabel: 'Eliminar' })) deleteQuestion(q.id).catch(fail)
              }}
            >
              <Trash2 size={13} /> Eliminar
            </Button>
          </div>
          {drafts && <ProposeCards drafts={drafts} onClose={() => setDrafts(null)} />}
        </div>
      )}
    </li>
  )
}

/** Preguntas pendientes; filtradas por concepto o nota si se indica. */
export function QuestionsPanel({ conceptId, noteId, showResolved = false, showOrigin = false, limit }: { conceptId?: string; noteId?: string; showResolved?: boolean; showOrigin?: boolean; limit?: number }) {
  const { fail } = useFeedback()
  const [text, setText] = useState('')
  const [withResolved, setWithResolved] = useState(showResolved)
  const questions = useLiveQuery(async () => {
    let list = conceptId
      ? await db.questions.where('conceptId').equals(conceptId).toArray()
      : noteId
        ? await db.questions.where('noteId').equals(noteId).toArray()
        : await db.questions.toArray()
    if (!withResolved) list = list.filter((q) => !q.resolved)
    return list.sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.createdAt - a.createdAt)
  }, [conceptId, noteId, withResolved])

  const submit = async () => {
    if (!text.trim()) return
    try {
      await addQuestion(text, { conceptId, noteId })
      setText('')
    } catch (e) {
      fail(e)
    }
  }

  const shown = limit ? questions?.slice(0, limit) : questions
  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="flex gap-2"
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nueva pregunta pendiente…" className="h-8" />
        <Button size="sm" type="submit" disabled={!text.trim()}>Agregar</Button>
      </form>
      {shown && shown.length === 0 && <p className="text-xs text-muted">No hay preguntas {withResolved ? '' : 'pendientes'}.</p>}
      <ul>{shown?.map((q) => <QuestionRow key={q.id} q={q} showOrigin={showOrigin} />)}</ul>
      {!limit && (
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={withResolved} onChange={(e) => setWithResolved(e.target.checked)} /> Mostrar resueltas
        </label>
      )}
    </div>
  )
}
