import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { db } from '@/db/db'
import type { Sketch } from '@/db/models'
import { createSketch, listSketchesMeta } from '@/services/sketches'
import { useFeedback } from '@/components/feedback'
import { Button, Empty, Loading, PageHeader } from '@/components/ui'
import { relativeTime } from '@/lib/text'
import { SketchEditor } from './SketchEditor'

function SketchLoader({ id }: { id: string }) {
  const [sketch, setSketch] = useState<Sketch | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void db.sketches.get(id).then((s) => alive && setSketch(s ?? null))
    return () => {
      alive = false
    }
  }, [id])
  if (sketch === undefined) return <div className="p-6"><Loading /></div>
  if (sketch === null) return <div className="p-6 text-sm">La pizarra no existe. <Link className="text-accent" to="/sketch">Volver</Link></div>
  return (
    <div className="flex h-full flex-col">
      <Link to="/sketch" className="flex items-center gap-1 border-b border-line px-3 py-1.5 text-xs text-muted hover:text-fg"><ArrowLeft size={12} /> Todas las pizarras</Link>
      <div className="min-h-0 flex-1"><SketchEditor key={sketch.id} sketch={sketch} /></div>
    </div>
  )
}

export default function SketchPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { fail } = useFeedback()
  const list = useLiveQuery(listSketchesMeta, [])
  if (id) return <SketchLoader id={id} />

  const create = async () => {
    try {
      const s = await createSketch()
      navigate(`/sketch/${s.id}`)
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <PageHeader
        title="Sketchpad"
        subtitle="Pizarras para ideas, diagramas y esquemas. Mouse, trackpad, lápiz y pantalla táctil."
        actions={<Button variant="primary" onClick={create}><Plus size={15} /> Nueva pizarra</Button>}
      />
      {!list && <Loading />}
      {list?.length === 0 && <Empty title="Todavía no hay pizarras" action={<Button size="sm" onClick={create}>Crear una</Button>}>Se guardan automáticamente y pueden exportarse a PNG.</Empty>}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list?.map((s) => (
          <li key={s.id}>
            <Link to={`/sketch/${s.id}`} className="block rounded-lg border border-line bg-panel px-4 py-3 hover:bg-sunken">
              <p className="truncate font-medium">{s.title}</p>
              <p className="text-xs text-muted">{s.strokeCount} trazos · {relativeTime(s.updatedAt)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
