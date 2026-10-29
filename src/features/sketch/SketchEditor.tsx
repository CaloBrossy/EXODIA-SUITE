import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardPaste, Download, Eraser, Pencil, Redo2, Trash2, Type, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { Sketch, Stroke } from '@/db/models'
import { compactStroke, deleteSketch, saveSketch } from '@/services/sketches'
import { useAutosave } from '@/hooks/useAutosave'
import { useHotkeys } from '@/hooks/misc'
import { useFeedback } from '@/components/feedback'
import { Button, cx, Input } from '@/components/ui'
import { drawStroke, exportPng } from './render'

type Tool = 'pen' | 'eraser' | 'text'
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
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const spaceRef = useRef(false)
  const panRef = useRef<{ id: number; sx: number; sy: number; x: number; y: number } | null>(null)
  const [hand, setHand] = useState(false)

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(sketch.background === '#18181b' ? '#e8e5df' : '#1c1b19')
  const [size, setSize] = useState(4)
  const [textSize, setTextSize] = useState(22)
  const [draft, setDraftState] = useState<{ x: number; y: number; value: string } | null>(null)
  const draftRef = useRef<{ x: number; y: number; value: string } | null>(null)
  const colorRef = useRef(color)
  const textSizeRef = useRef(textSize)
  colorRef.current = color
  textSizeRef.current = textSize
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
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(layer, 0, 0)
    const cur = currentRef.current
    if (cur) {
      applyView(ctx)
      drawStroke(ctx, cur, { live: true, eraserPreviewColor: background })
    }
  }, [background])

  const rebuildLayer = useCallback(() => {
    const { w, h, dpr } = sizeRef.current
    const layer = layerRef.current ?? document.createElement('canvas')
    layer.width = Math.max(1, Math.round(w * dpr))
    layer.height = Math.max(1, Math.round(h * dpr))
    const lctx = layer.getContext('2d')!
    lctx.setTransform(1, 0, 0, 1, 0, 0)
    lctx.clearRect(0, 0, layer.width, layer.height)
    applyView(lctx)
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
  useEffect(() => { rebuildLayer() }, [view.zoom, view.x, view.y, rebuildLayer])

  const applyView = (ctx: CanvasRenderingContext2D) => {
    const { dpr } = sizeRef.current
    const { zoom, x, y } = viewRef.current
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -x * zoom * dpr, -y * zoom * dpr)
  }

  const zoomAt = (next: number, sx: number, sy: number) => {
    const v = viewRef.current
    const zoom = Math.min(4, Math.max(0.25, next))
    const wx = sx / v.zoom + v.x
    const wy = sy / v.zoom + v.y
    setView({ zoom, x: wx - sx / zoom, y: wy - sy / zoom })
  }

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = wrap.getBoundingClientRect()
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      zoomAt(viewRef.current.zoom * factor, e.clientX - rect.left, e.clientY - rect.top)
    }
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const t = e.target as HTMLElement | null
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return
      e.preventDefault()
      spaceRef.current = true
      setHand(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      spaceRef.current = false
      setHand(false)
    }
    wrap.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      wrap.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const schedulePaint = () => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      paint()
    })
  }

  const pointFrom = (e: PointerEvent | React.PointerEvent, rect: DOMRect): [number, number, number] => {
    const v = viewRef.current
    return [
      (e.clientX - rect.left) / v.zoom + v.x,
      (e.clientY - rect.top) / v.zoom + v.y,
      e.pointerType === 'pen' ? e.pressure : 0.5,
    ]
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || spaceRef.current) {
      const v = viewRef.current
      panRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: v.x, y: v.y }
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sigue el arrastre sin captura */ }
      return
    }
    if (tool === 'text') {
      commitDraft()
      const [x, y] = pointFrom(e, e.currentTarget.getBoundingClientRect())
      const next = { x, y, value: '' }
      draftRef.current = next
      setDraftState(next)
      return
    }
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
    const pan = panRef.current
    if (pan && pan.id === e.pointerId) {
      const v = viewRef.current
      setView({ zoom: v.zoom, x: pan.x - (e.clientX - pan.sx) / v.zoom, y: pan.y - (e.clientY - pan.sy) / v.zoom })
      return
    }
    const cur = currentRef.current
    if (!cur) return
    const rect = e.currentTarget.getBoundingClientRect()
    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? []
    const events = coalesced.length > 0 ? coalesced : [e.nativeEvent]
    for (const ev of events) cur.points.push(...pointFrom(ev, rect))
    schedulePaint()
  }
  const placeText = (x: number, y: number, value: string) => {
    const text = value.replace(/\s+$/g, '')
    if (!text.trim()) return
    const stroke: Stroke = { tool: 'text', color: colorRef.current, size: textSizeRef.current, points: [x, y, 0], text }
    strokesRef.current = [...strokesRef.current, stroke]
    undoRef.current.push({ type: 'add', stroke })
    redoRef.current = []
    const lctx = layerRef.current?.getContext('2d')
    if (lctx) drawStroke(lctx, stroke)
    paint()
    bump()
  }
  const commitDraft = () => {
    const d = draftRef.current
    if (!d) return
    draftRef.current = null
    setDraftState(null)
    placeText(d.x, d.y, d.value)
  }
  const pasteText = async () => {
    setTool('text')
    let value = ''
    try {
      value = await navigator.clipboard.readText()
    } catch {
      value = ''
    }
    commitDraft()
    if (value.trim()) {
      placeText(32, 32, value)
      return
    }
    const next = { x: 32, y: 32, value: '' }
    draftRef.current = next
    setDraftState(next)
    notify('No pude leer el portapapeles. Pegá el texto en el recuadro.', 'info')
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panRef.current?.id === e.pointerId) panRef.current = null
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
    { combo: 't', handler: () => setTool('text') },
  ])

  const statusText = status === 'saved' ? 'Guardado' : status === 'error' ? 'Error al guardar' : 'Guardando…'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 w-48" aria-label="Título de la pizarra" />
        <div className="flex gap-0.5 rounded-md border border-line p-0.5">
          <button title="Lápiz (P)" aria-pressed={tool === 'pen'} onClick={() => setTool('pen')} className={cx('rounded p-1.5', tool === 'pen' ? 'bg-sunken' : 'text-muted')}><Pencil size={15} /></button>
          <button title="Texto (T)" aria-pressed={tool === 'text'} onClick={() => setTool('text')} className={cx('rounded p-1.5', tool === 'text' ? 'bg-sunken' : 'text-muted')}><Type size={15} /></button>
          <button title="Pegar texto" aria-label="Pegar texto" onClick={() => void pasteText()} className="rounded p-1.5 text-muted"><ClipboardPaste size={15} /></button>
          <button title="Borrador (E)" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')} className={cx('rounded p-1.5', tool === 'eraser' ? 'bg-sunken' : 'text-muted')}><Eraser size={15} /></button>
        </div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Color">
          {COLORS.map((c) => (
            <button key={c} role="radio" aria-checked={color === c} aria-label={c} onClick={() => { setColor(c); setTool('pen') }} className={cx('h-5 w-5 rounded-full border', color === c && tool === 'pen' ? 'ring-2 ring-accent ring-offset-1 ring-offset-panel' : 'border-line')} style={{ background: c }} />
          ))}
          <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setTool('pen') }} aria-label="Color personalizado" className="h-6 w-7 cursor-pointer rounded border border-line bg-transparent" />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          {tool === 'text' ? 'Tamaño' : 'Grosor'}
          <input
            type="range"
            min={tool === 'text' ? 12 : 1}
            max={tool === 'text' ? 72 : 32}
            value={tool === 'text' ? textSize : size}
            onChange={(e) => (tool === 'text' ? setTextSize(Number(e.target.value)) : setSize(Number(e.target.value)))}
            className="w-24 accent-[var(--nx-accent)]"
          />
          <span className="w-5 font-mono">{tool === 'text' ? textSize : size}</span>
        </label>
        <select value={background} onChange={(e) => setBackground(e.target.value)} className="h-8 rounded-md border border-line bg-panel px-2 text-xs" aria-label="Fondo">
          {BACKGROUNDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <div className="flex gap-0.5">
          <Button size="icon" variant="ghost" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" onClick={undo} disabled={undoRef.current.length === 0}><Undo2 size={15} /></Button>
          <Button size="icon" variant="ghost" title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer" onClick={redo} disabled={redoRef.current.length === 0}><Redo2 size={15} /></Button>
          <Button size="icon" variant="ghost" title="Limpiar lienzo" aria-label="Limpiar lienzo" onClick={clear}><X size={15} /></Button>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <Button size="icon" variant="ghost" title="Achicar" aria-label="Achicar" onClick={() => { const r = wrapRef.current?.getBoundingClientRect(); zoomAt(view.zoom / 1.25, (r?.width ?? 0) / 2, (r?.height ?? 0) / 2) }}><ZoomOut size={15} /></Button>
          <button type="button" className="w-12 font-mono text-xs text-muted" title="Tamaño real" onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>{Math.round(view.zoom * 100)}%</button>
          <Button size="icon" variant="ghost" title="Ampliar" aria-label="Ampliar" onClick={() => { const r = wrapRef.current?.getBoundingClientRect(); zoomAt(view.zoom * 1.25, (r?.width ?? 0) / 2, (r?.height ?? 0) / 2) }}><ZoomIn size={15} /></Button>
        </div>
        <span className={cx('text-xs', status === 'error' ? 'text-danger' : 'text-muted')}>{statusText} · {strokesRef.current.length} trazos</span>
        <Button size="sm" onClick={exportImage}><Download size={14} /> PNG</Button>
        <Button size="icon" variant="ghost" title="Eliminar pizarra" aria-label="Eliminar pizarra" onClick={remove}><Trash2 size={15} /></Button>
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden" style={{ background }}>
        <canvas
          ref={canvasRef}
          className={cx('absolute inset-0 touch-none', hand || panRef.current ? 'cursor-grab' : tool === 'eraser' ? 'cursor-cell' : tool === 'text' ? 'cursor-text' : 'cursor-crosshair')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Lienzo de dibujo"
        />
        {draft && (
          <textarea
            autoFocus
            value={draft.value}
            aria-label="Texto de la pizarra"
            placeholder="Escribí o pegá"
            onChange={(e) => {
              const next = { ...draft, value: e.target.value }
              draftRef.current = next
              setDraftState(next)
            }}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                commitDraft()
              }
              if (e.key === 'Escape') {
                draftRef.current = null
                setDraftState(null)
              }
            }}
            className="absolute z-10 min-h-8 min-w-40 resize bg-transparent px-1 py-0.5 outline outline-accent/50"
            style={{ left: (draft.x - view.x) * view.zoom, top: (draft.y - view.y) * view.zoom, color, fontSize: textSize * view.zoom, lineHeight: 1.3 }}
          />
        )}
      </div>
    </div>
  )
}
