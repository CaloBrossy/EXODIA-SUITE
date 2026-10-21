import { getStroke } from 'perfect-freehand'
import type { Stroke } from '@/db/models'

const pathCache = new WeakMap<Stroke, Path2D>()

function toTriples(flat: number[]): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let i = 0; i + 2 < flat.length; i += 3) out.push([flat[i]!, flat[i + 1]!, flat[i + 2]!])
  return out
}

function outlineToPath(pts: number[][]): Path2D {
  const p = new Path2D()
  const first = pts[0]
  if (!first) return p
  p.moveTo(first[0]!, first[1]!)
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    p.quadraticCurveTo(a[0]!, a[1]!, (a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2)
  }
  p.closePath()
  return p
}

/** Presión 0.5 constante = dispositivo sin sensor (mouse/táctil): se simula por velocidad. */
const simulated = (flat: number[]) => {
  for (let i = 2; i < flat.length; i += 3) if (flat[i] !== 0.5) return false
  return true
}

export function strokePath(s: Stroke, live = false): Path2D {
  const cached = live ? undefined : pathCache.get(s)
  if (cached) return cached
  const outline = getStroke(toTriples(s.points), {
    size: s.size,
    thinning: s.tool === 'eraser' ? 0 : 0.55,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: simulated(s.points),
    last: !live,
  })
  const path = outlineToPath(outline)
  if (!live) pathCache.set(s, path)
  return path
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, opts: { live?: boolean; eraserPreviewColor?: string } = {}): void {
  ctx.save()
  if (s.tool === 'eraser' && !opts.eraserPreviewColor) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = '#000'
  } else {
    ctx.fillStyle = s.tool === 'eraser' ? opts.eraserPreviewColor! : s.color
  }
  ctx.fill(strokePath(s, opts.live))
  ctx.restore()
}

export function bounds(strokes: Stroke[]): { maxX: number; maxY: number } {
  let maxX = 0
  let maxY = 0
  for (const s of strokes) {
    for (let i = 0; i + 1 < s.points.length; i += 3) {
      maxX = Math.max(maxX, s.points[i]! + s.size)
      maxY = Math.max(maxY, s.points[i + 1]! + s.size)
    }
  }
  return { maxX, maxY }
}

/** Renderiza todos los trazos sobre un fondo sólido y devuelve un PNG. */
export function exportPng(strokes: Stroke[], background: string, minW: number, minH: number, scale = 2): Promise<Blob> {
  const { maxX, maxY } = bounds(strokes)
  const w = Math.ceil(Math.max(minW, maxX + 16))
  const h = Math.ceil(Math.max(minH, maxY + 16))
  const layer = document.createElement('canvas')
  layer.width = w * scale
  layer.height = h * scale
  const lctx = layer.getContext('2d')!
  lctx.scale(scale, scale)
  for (const s of strokes) drawStroke(lctx, s)
  const out = document.createElement('canvas')
  out.width = layer.width
  out.height = layer.height
  const octx = out.getContext('2d')!
  octx.fillStyle = background
  octx.fillRect(0, 0, out.width, out.height)
  octx.drawImage(layer, 0, 0)
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar el PNG'))), 'image/png'))
}
