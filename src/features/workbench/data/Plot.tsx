import { forwardRef, useId, useMemo } from 'react'
import type { DatasetAxis } from '@/db/models'
import { fmtSig, logTicks, niceTicks, type DataPoint } from '@/lib/math/fit'

const W = 640
const M = { top: 16, right: 18, bottom: 46, left: 64 }

type Props = {
  points: DataPoint[]
  xAxis: DatasetAxis
  yAxis: DatasetAxis
  grid: boolean
  curve?: ((x: number) => number) | null
  pointsLabel?: string
  curveLabel?: string
  /** Línea horizontal en y = 0 (gráfico de residuos). */
  zeroLine?: boolean
  height?: number
  title?: string
}

const axisText = (a: DatasetAxis) => (a.unit ? `${a.label || ''} (${a.unit})` : a.label)

function domain(values: number[], log: boolean, extra: number[] = []): [number, number] | null {
  const vs = [...values, ...extra].filter((v) => Number.isFinite(v) && (!log || v > 0))
  if (!vs.length) return null
  let lo = Math.min(...vs)
  let hi = Math.max(...vs)
  if (log) {
    let a = Math.log10(lo)
    let b = Math.log10(hi)
    if (a === b) { a -= 0.5; b += 0.5 }
    const pad = (b - a) * 0.06
    return [10 ** (a - pad), 10 ** (b + pad)]
  }
  if (lo === hi) {
    const d = Math.abs(lo) || 1
    lo -= d / 2
    hi += d / 2
  }
  const pad = (hi - lo) * 0.06
  return [lo - pad, hi + pad]
}

function scale([lo, hi]: [number, number], log: boolean, from: number, to: number) {
  const t = log ? Math.log10 : (v: number) => v
  const a = t(lo)
  const b = t(hi)
  return (v: number) => from + ((t(v) - a) / (b - a)) * (to - from)
}

export const Plot = forwardRef<SVGSVGElement, Props>(function Plot(
  { points, xAxis, yAxis, grid, curve, pointsLabel = 'Datos', curveLabel, zeroLine, height = 380, title },
  ref,
) {
  const clip = useId().replace(/:/g, '')
  const H = height
  const view = useMemo(() => {
    const xd = domain(points.flatMap((p) => [p.x - (p.ex ?? 0), p.x + (p.ex ?? 0), p.x]), xAxis.log)
    const yd = domain(points.flatMap((p) => [p.y - (p.ey ?? 0), p.y + (p.ey ?? 0), p.y]), yAxis.log, zeroLine ? [0] : [])
    if (!xd || !yd) return null
    const sx = scale(xd, xAxis.log, M.left, W - M.right)
    const sy = scale(yd, yAxis.log, H - M.bottom, M.top)
    const xt = (xAxis.log ? logTicks(...xd) : niceTicks(...xd, 7)).filter((v) => v >= xd[0] && v <= xd[1])
    const yt = (yAxis.log ? logTicks(...yd) : niceTicks(...yd, 6)).filter((v) => v >= yd[0] && v <= yd[1])
    let path = ''
    if (curve) {
      const t0 = xAxis.log ? Math.log10(xd[0]) : xd[0]
      const t1 = xAxis.log ? Math.log10(xd[1]) : xd[1]
      let pen = false
      for (let i = 0; i <= 240; i++) {
        const t = t0 + ((t1 - t0) * i) / 240
        const x = xAxis.log ? 10 ** t : t
        const y = curve(x)
        if (!Number.isFinite(y) || (yAxis.log && y <= 0)) { pen = false; continue }
        const py = Math.max(-H, Math.min(2 * H, sy(y)))
        path += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)},${py.toFixed(1)}`
        pen = true
      }
    }
    return { xd, yd, sx, sy, xt, yt, path }
  }, [points, xAxis.log, yAxis.log, curve, zeroLine, H])

  const visible = points.filter((p) => (!xAxis.log || p.x > 0) && (!yAxis.log || p.y > 0))
  const L = M.left
  const R = W - M.right
  const T = M.top
  const B = H - M.bottom

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title ?? 'Gráfico'} xmlns="http://www.w3.org/2000/svg" style={{ fontFamily: 'inherit', fontSize: 11 }}>
      {title && <title>{title}</title>}
      <defs><clipPath id={clip}><rect x={L} y={T} width={R - L} height={B - T} /></clipPath></defs>
      {!view ? (
        <text x={W / 2} y={H / 2} textAnchor="middle" style={{ fill: 'var(--nx-muted)', fontSize: 13 }}>
          {points.length ? 'No hay puntos representables en esta escala.' : 'Cargá datos para ver el gráfico.'}
        </text>
      ) : (
        <>
          {view.xt.map((v) => (
            <g key={`x${v}`}>
              {grid && <line x1={view.sx(v)} x2={view.sx(v)} y1={T} y2={B} style={{ stroke: 'var(--nx-line)' }} />}
              <line x1={view.sx(v)} x2={view.sx(v)} y1={B} y2={B + 4} style={{ stroke: 'var(--nx-muted)' }} />
              <text x={view.sx(v)} y={B + 16} textAnchor="middle" style={{ fill: 'var(--nx-muted)' }}>{fmtSig(v, 3)}</text>
            </g>
          ))}
          {view.yt.map((v) => (
            <g key={`y${v}`}>
              {grid && <line x1={L} x2={R} y1={view.sy(v)} y2={view.sy(v)} style={{ stroke: 'var(--nx-line)' }} />}
              <line x1={L - 4} x2={L} y1={view.sy(v)} y2={view.sy(v)} style={{ stroke: 'var(--nx-muted)' }} />
              <text x={L - 7} y={view.sy(v) + 3.5} textAnchor="end" style={{ fill: 'var(--nx-muted)' }}>{fmtSig(v, 3)}</text>
            </g>
          ))}
          <rect x={L} y={T} width={R - L} height={B - T} style={{ fill: 'none', stroke: 'var(--nx-muted)', strokeOpacity: 0.6 }} />
          <text x={(L + R) / 2} y={H - 8} textAnchor="middle" style={{ fill: 'var(--nx-fg)', fontSize: 12 }}>{axisText(xAxis)}</text>
          <text transform={`translate(14 ${(T + B) / 2}) rotate(-90)`} textAnchor="middle" style={{ fill: 'var(--nx-fg)', fontSize: 12 }}>{axisText(yAxis)}</text>

          <g clipPath={`url(#${clip})`}>
            {zeroLine && view.yd[0] < 0 && view.yd[1] > 0 && (
              <line x1={L} x2={R} y1={view.sy(0)} y2={view.sy(0)} style={{ stroke: 'var(--nx-muted)', strokeDasharray: '4 3' }} />
            )}
            {view.path && <path d={view.path} style={{ fill: 'none', stroke: 'var(--nx-accent-2)', strokeWidth: 2 }} />}
            {visible.map((p, i) => {
              const cx = view.sx(p.x)
              const cy = view.sy(p.y)
              const ey = p.ey ?? 0
              const ex = p.ex ?? 0
              const y0 = view.sy(yAxis.log ? Math.max(view.yd[0], p.y - ey) : p.y - ey)
              const y1 = view.sy(p.y + ey)
              const x0 = view.sx(xAxis.log ? Math.max(view.xd[0], p.x - ex) : p.x - ex)
              const x1 = view.sx(p.x + ex)
              return (
                <g key={i} style={{ stroke: 'var(--nx-accent)' }}>
                  {ey > 0 && <><line x1={cx} x2={cx} y1={y0} y2={y1} /><line x1={cx - 3} x2={cx + 3} y1={y0} y2={y0} /><line x1={cx - 3} x2={cx + 3} y1={y1} y2={y1} /></>}
                  {ex > 0 && <><line x1={x0} x2={x1} y1={cy} y2={cy} /><line x1={x0} x2={x0} y1={cy - 3} y2={cy + 3} /><line x1={x1} x2={x1} y1={cy - 3} y2={cy + 3} /></>}
                  <circle cx={cx} cy={cy} r={3.5} style={{ fill: 'var(--nx-accent)', fillOpacity: 0.85 }} />
                </g>
              )
            })}
          </g>

          <g transform={`translate(${L + 10} ${T + 10})`}>
            <rect width={curveLabel ? 190 : 80} height={curveLabel ? 38 : 20} rx={4} style={{ fill: 'var(--nx-panel)', stroke: 'var(--nx-line)' }} />
            <circle cx={12} cy={10} r={3.5} style={{ fill: 'var(--nx-accent)' }} />
            <text x={22} y={13.5} style={{ fill: 'var(--nx-fg)' }}>{pointsLabel}</text>
            {curveLabel && (
              <>
                <line x1={5} x2={19} y1={28} y2={28} style={{ stroke: 'var(--nx-accent-2)', strokeWidth: 2 }} />
                <text x={22} y={31.5} style={{ fill: 'var(--nx-fg)' }}>{curveLabel}</text>
              </>
            )}
          </g>
        </>
      )}
    </svg>
  )
})
