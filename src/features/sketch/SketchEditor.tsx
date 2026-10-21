import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Eraser, Pencil, Redo2, Trash2, Undo2, X } from 'lucide-react'
import type { Sketch, Stroke } from '@/db/models'
import { compactStroke, deleteSketch, saveSketch } from '@/services/sketches'
import { useAutosave } from '@/hooks/useAutosave'
import { useHotkeys } from '@/hooks/misc'
import { useFeedback } from '@/components/feedback'
import { Button, cx, Input } from '@/components/ui'
import { drawStroke, exportPng } from './render'

type Tool = 'pen' | 'eraser'
type Action = { type: 'add'; stroke: Stroke } | { type: 'clear'; prev: Stroke[] }

const COLORS = ['#1c1b19', '#e8e5df', '#c2410c', '#a66a00', '#15803d', '#1d4ed8', '#7c3aed', '#be185d']
const BACKGROUNDS = [
  { id: '#ffffff', label: 'Blanco' },
  { id: '#f6f1e3', label: 'Papel' },
  { id: '#18181b', label: 'Pizarra oscura' },
]

export function SketchEditor({ sketch }: { sketch: Sketch }) {
  const navigate = useNavigate()
  const { fail, confirm, notify } = useFeedback()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layerRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<Stroke[]>(sketch.strokes)
  const undoRef = useRef<Action[]>([])
  const redoRef = useRef<Action[]>([])
  const currentRef = useRef<Stroke | null>(null)
  const frame = useRef(0)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(sketch.background === '#18181b' ? '#e8e5df' : '#1c1b19')
  const [size, setSize] = useState(4)
  const [background, setBackground] = useState(sketch.background)
  const [title, setTitle] = useState(sketch.title)
  const [snapshot, setSnapshot] = useState({ strokes: sketch.strokes, title: sketch.title, background: sketch.background })

  const bump = () => setSnapshot((s) => ({ ...s, strokes: strokesRef.current }))
  useEffect(() => setSnapshot((s) => ({ ...s, title, background })), [title, background])

  const save = useCallback(
    (v: typeof snapshot) => saveSketch(sketch.id, { title: v.title.trim() || 'Pizarra sin título', background: v.background, strokes: v.strokes.map(compactStroke) }),
    [sketch.id],
  )
  const { status } = useAutosave(snapshot, save, 900)

  const paint = useCallback(() => {
    const c = canvasRef.current
    const layer = layerRef.current
    if (!c || !layer) return
    const ctx = c.getContext('2d')!
    const { dpr } = sizeRef.current
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(layer, 0, 0)
    const cur = currentRef.current
    if (cur) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawStroke(ctx, cur, { live: true, eraserPreviewColor: background })
    }
  }, [background])

  const rebuildLayer = useCallback(() => {
    const { w, h, dpr } = sizeRef.current
    const layer = layerRef.current ?? document.createElement('canvas')
    layer.width = Math.max(1, Math.round(w * dpr))
    layer.height = Math.max(1, Math.round(h * dpr))
    const lctx = layer.getContext('2d')!
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    lctx.clearRect(0, 0, w, h)
    for (const s of strokesRef.current) drawStroke(lctx, s)
    layerRef.current = layer
    paint()
  }, [paint])

  useEffect(() => {
    const wrap = wrapRef.current
    const c = canvasRef.current
    if (!wrap || !c) return
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      sizeRef.current = { w: r.width, h: r.height, dpr }
      c.width = Math.round(r.width * dpr)
      c.height = Math.round(r.height * dpr)
      c.style.width = `${r.width}px`
      c.style.height = `${r.height}px`
      rebuildLayer()
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [rebuildLayer])

  useEffect(() => paint(), [paint, background])

  const schedulePaint = () => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      paint()
    })
  }

  const pointFrom = (e: PointerEvent | React.PointerEvent, rect: DOMRect): [number, number, number] => [
    e.clientX - rect.left,
    e.clientY - rect.top,
    e.pointerType === 'pen' ? e.pressure : 0.5,
  ]

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* puntero ya liberado: el trazo continúa sin captura */
    }
    const rect = e.currentTarget.getBoundingClientRect()
    currentRef.current = { tool, color, size: tool === 'eraser' ? size * 4 : size, points: [...pointFrom(e, rect)] }
    schedulePaint()
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cur = currentRef.current
    if (!cur) return
    const rect = e.currentTarget.getBoundingClientRect()
    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? []
    const events = coalesced.length > 0 ? coalesced : [e.nativeEvent]
    for (const ev of events) cur.points.push(...pointFrom(ev, rect))
    schedulePaint()
  }
  const onPointerUp = () => {
    const cur = currentRef.current
    if (!cur) return
    currentRef.current = null
    const stroke = { ...cur, points: [...cur.points] }
    strokesRef.current = [...strokesRef.current, stroke]
    undoRef.current.push({ type: 'add', stroke })
    redoRef.current = []
    const lctx = layerRef.current?.getContext('2d')
    if (lctx) drawStroke(lctx, stroke)
    paint()
    bump()
  }

  const undo = () => {
    const a = undoRef.current.pop()
    if (!a) return
    strokesRef.current = a.type === 'add' ? strokesRef.current.filter((s) => s !== a.stroke) : a.prev
    redoRef.current.push(a)
    rebuildLayer()
    bump()
  }
  const redo = () => {
    const a = redoRef.current.pop()
    if (!a) return
    strokesRef.current = a.type === 'add' ? [...strokesRef.current, a.stroke] : []
    undoRef.current.push(a)
    rebuildLayer()
    bump()
  }
  const clear = async () => {
    if (strokesRef.current.length === 0) return
    if (!(await confirm({ title: '¿Limpiar el lienzo?', body: 'Podés recuperarlo con Deshacer mientras no cierres la pizarra.', confirmLabel: 'Limpiar', danger: true }))) return
    undoRef.current.push({ type: 'clear', prev: strokesRef.current })
    redoRef.current = []
    strokesRef.current = []
    rebuildLayer()
    bump()
  }
  const exportImage = async () => {
    try {
      const { w, h } = sizeRef.current
      const blob = await exportPng(strokesRef.current, background, w, h)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(title.trim() || 'pizarra').replace(/[\\/:*?"<>|]+/g, '_')}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      notify('PNG exportado.', 'ok')
    } catch (e) {
      fail(e)
    }
  }
  const remove = async () => {
    if (!(await confirm({ title: `¿Eliminar «${title || 'pizarra'}»?`, danger: true, confirmLabel: 'Eliminar' }))) return
    try {
      await deleteSketch(sketch.id)
      navigate('/sketch')
    } catch (e) {
      fail(e)
    }
  }

  useHotkeys([
    { combo: 'mod+z', handler: undo },
    { combo: 'mod+shift+z', handler: redo },
    { combo: 'mod+y', handler: redo },
    { combo: 'p', handler: () => setTool('pen') },
    { combo: 'e', handler: () => setTool('eraser') },
  ])

  const statusText = status === 'saved' ? 'Guardado' : status === 'error' ? 'Error al guardar' : 'Guardando…'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 w-48" aria-label="Título de la pizarra" />
        <div className="flex gap-0.5 rounded-md border border-line p-0.5">
          <button title="Lápiz (P)" aria-pressed={tool === 'pen'} onClick={() => setTool('pen')} className={cx('rounded p-1.5', tool === 'pen' ? 'bg-sunken' : 'text-muted')}><Pencil size={15} /></button>
          <button title="Borrador (E)" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')} className={cx('rounded p-1.5', tool === 'eraser' ? 'bg-sunken' : 'text-muted')}><Eraser size={15} /></button>
        </div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Color">
          {COLORS.map((c) => (
            <button key={c} role="radio" aria-checked={color === c} aria-label={c} onClick={() => { setColor(c); setTool('pen') }} className={cx('h-5 w-5 rounded-full border', color === c && tool === 'pen' ? 'ring-2 ring-accent ring-offset-1 ring-offset-panel' : 'border-line')} style={{ background: c }} />
          ))}
          <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setTool('pen') }} aria-label="Color personalizado" className="h-6 w-7 cursor-pointer rounded border border-line bg-transparent" />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Grosor
          <input type="range" min={1} max={32} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-24 accent-[var(--nx-accent)]" />
          <span className="w-5 font-mono">{size}</span>
        </label>
        <select value={background} onChange={(e) => setBackground(e.target.value)} className="h-8 rounded-md border border-line bg-panel px-2 text-xs" aria-label="Fondo">
          {BACKGROUNDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <div className="flex gap-0.5">
          <Button size="icon" variant="ghost" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" onClick={undo} disabled={undoRef.current.length === 0}><Undo2 size={15} /></Button>
          <Button size="icon" variant="ghost" title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer" onClick={redo} disabled={redoRef.current.length === 0}><Redo2 size={15} /></Button>
          <Button size="icon" variant="ghost" title="Limpiar lienzo" aria-label="Limpiar lienzo" onClick={clear}><X size={15} /></Button>
        </div>
        <span className={cx('ml-auto text-xs', status === 'error' ? 'text-danger' : 'text-muted')}>{statusText} · {strokesRef.current.length} trazos</span>
        <Button size="sm" onClick={exportImage}><Download size={14} /> PNG</Button>
        <Button size="icon" variant="ghost" title="Eliminar pizarra" aria-label="Eliminar pizarra" onClick={remove}><Trash2 size={15} /></Button>
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden" style={{ background }}>
        <canvas
          ref={canvasRef}
          className={cx('absolute inset-0 touch-none', tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Lienzo de dibujo"
        />
      </div>
    </div>
  )
}
