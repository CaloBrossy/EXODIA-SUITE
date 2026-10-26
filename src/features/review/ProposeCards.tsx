import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CardDraft } from '@/lib/flashcards'
import { saveDrafts } from '@/services/cards'
import { Markdown } from '@/components/Markdown'
import { useFeedback } from '@/components/feedback'
import { Button, Empty, Textarea } from '@/components/ui'

export function ProposeCards({ drafts, onClose }: { drafts: CardDraft[]; onClose: () => void }) {
  const { fail, notify } = useFeedback()
  const navigate = useNavigate()
  const [items, setItems] = useState(drafts)
  const [busy, setBusy] = useState(false)

  const accept = async () => {
    setBusy(true)
    try {
      const created = await saveDrafts(items)
      notify(`${created.length} tarjeta${created.length === 1 ? '' : 's'} creada${created.length === 1 ? '' : 's'}.`, 'ok')
      onClose()
      navigate('/review?tab=tarjetas')
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  if (!items.length) {
    return (
      <Empty title="Nada nuevo que proponer" action={<Button size="sm" onClick={onClose}>Cerrar</Button>}>
        Ya hay tarjetas de este origen o el contenido está vacío.
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Revisá las propuestas antes de crearlas. Markdown y LaTeX se ven igual que en el cuaderno.</p>
      <ul className="flex flex-col gap-3">
        {items.map((d, i) => (
          <li key={`${d.front}-${i}`} className="rounded-xl border border-line p-3">
            <Textarea rows={2} className="mb-2" value={d.front} onChange={(e) => setItems((xs) => xs.map((x, j) => j === i ? { ...x, front: e.target.value } : x))} />
            <div className="mb-2 text-sm"><Markdown source={d.front} /></div>
            <Textarea rows={3} className="mb-2" value={d.back} onChange={(e) => setItems((xs) => xs.map((x, j) => j === i ? { ...x, back: e.target.value } : x))} />
            <div className="text-sm"><Markdown source={d.back} /></div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>Quitar</Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={busy || !items.length} onClick={() => void accept()}>Crear {items.length}</Button>
        <Button onClick={onClose}>Descartar</Button>
      </div>
    </div>
  )
}
