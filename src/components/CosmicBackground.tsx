import { useEffect, useRef } from 'react'

/**
 * Fondo de espacio profundo: nebulosas estáticas (CSS) + campo estelar y polvo cósmico procedurales (Canvas 2D).
 * Un solo <canvas>, sin estado de React: todo el trabajo por cuadro ocurre fuera del ciclo de render.
 */

interface Star {
  x: number
  y: number
  /** Profundidad 0..1: más cerca = se desplaza más y reacciona más al parallax. */
  z: number
  r: number
  a: number
  /** Velocidad angular del titileo (0 = estrella fija). */
  tw: number
  ph: number
  vx: number
  vy: number
  color: number
}

interface Dust {
  x: number
  y: number
  z: number
  size: number
  a: number
  ph: number
  f: number
  vx: number
  vy: number
  sprite: number
}

const DARK_STAR_COLORS = ['232,238,252', '214,226,255', '186,206,255', '255,238,220', '200,240,255']
const LIGHT_STAR_COLORS = ['60,72,140', '84,70,160', '40,110,150']
const DUST_TINTS_DARK = ['94,231,247', '139,124,246', '232,238,252', '232,121,198']
const DUST_TINTS_LIGHT = ['14,116,144', '109,40,217', '60,72,140']
const FRAME_MS = 1000 / 30

const rand = (a: number, b: number) => a + Math.random() * (b - a)
function gauss(): number {
  let u = 0
  while (u === 0) u = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random())
}

function deviceBudget(w: number, h: number) {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const weak = (nav.hardwareConcurrency ?? 4) <= 4 || (nav.deviceMemory ?? 8) <= 4
  const k = weak ? 0.55 : 1
  const area = w * h
  return {
    stars: Math.round(Math.min(560, Math.max(90, area / 3800)) * k),
    dust: Math.round(Math.min(64, Math.max(14, area / 36000)) * k),
    dpr: Math.min(window.devicePixelRatio || 1, weak ? 1.25 : 2),
  }
}

function makeSprite(rgb: string, size = 64): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, `rgba(${rgb},1)`)
  grad.addColorStop(0.25, `rgba(${rgb},0.45)`)
  grad.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

function generate(w: number, h: number, nStars: number, nDust: number, palette: string[]) {
  const stars: Star[] = []
  // Banda galáctica diagonal + algunos cúmulos + fondo uniforme: distribución irregular, no una grilla.
  const bandAngle = -0.38
  const clusters = Array.from({ length: 3 }, () => ({ x: rand(0.1, 0.9) * w, y: rand(0.1, 0.9) * h, s: rand(40, 110) }))
  for (let i = 0; i < nStars; i++) {
    const roll = Math.random()
    let x: number
    let y: number
    if (roll < 0.38) {
      const t = Math.random() * 1.3 - 0.15
      const off = gauss() * h * 0.11
      x = t * w - Math.sin(bandAngle) * off
      y = h * 0.72 + Math.tan(bandAngle) * t * w + Math.cos(bandAngle) * off
    } else if (roll < 0.5) {
      const c = clusters[i % clusters.length]!
      x = c.x + gauss() * c.s
      y = c.y + gauss() * c.s
    } else {
      x = Math.random() * w
      y = Math.random() * h
    }
    const z = Math.pow(Math.random(), 1.6)
    const r = 0.3 + Math.pow(Math.random(), 3.4) * 1.5 + z * 0.25
    stars.push({
      x: ((x % w) + w) % w,
      y: ((y % h) + h) % h,
      z,
      r,
      a: Math.min(1, 0.22 + Math.random() * 0.5 + r * 0.18),
      tw: Math.random() < 0.3 ? rand(0.4, 1.6) : 0,
      ph: Math.random() * Math.PI * 2,
      vx: -(0.25 + z * 1.6) * rand(0.6, 1.4),
      vy: (Math.random() - 0.5) * 0.35 * (0.3 + z),
      color: Math.random() < 0.72 ? 0 : 1 + Math.floor(Math.random() * (palette.length - 1)),
    })
  }
  stars.sort((a, b) => a.color - b.color)

  const dust: Dust[] = Array.from({ length: nDust }, () => {
    const z = rand(0.2, 1)
    const angle = rand(0, Math.PI * 2)
    const speed = rand(1.5, 5) * (0.4 + z)
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      z,
      size: rand(5, 16) * (0.5 + z),
      a: rand(0.05, 0.2),
      ph: Math.random() * Math.PI * 2,
      f: rand(0.08, 0.3),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.6,
      sprite: Math.floor(Math.random() * 4),
    }
  })
  return { stars, dust }
}

export function CosmicBackground() {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nebulaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const nebula = nebulaRef.current
    const ctx = canvas?.getContext('2d', { alpha: true })
    if (!root || !canvas || !ctx) {
      root?.classList.add('cosmic-static')
      return
    }
    const html = document.documentElement
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    let w = 0
    let h = 0
    let dpr = 1
    let stars: Star[] = []
    let dust: Dust[] = []
    let palette = DARK_STAR_COLORS
    let sprites: HTMLCanvasElement[] = []
    let glow: HTMLCanvasElement | null = null
    let raf = 0
    let last = 0
    let time = 0
    const pointer = { tx: 0, ty: 0, x: 0, y: 0 }

    const animated = () => !motionQuery.matches && !html.classList.contains('fx-lite') && document.visibilityState === 'visible'

    const setup = () => {
      const dark = html.classList.contains('dark')
      palette = dark ? DARK_STAR_COLORS : LIGHT_STAR_COLORS
      sprites = (dark ? DUST_TINTS_DARK : DUST_TINTS_LIGHT).map((c) => makeSprite(c))
      glow = makeSprite(palette[0]!, 48)
      w = window.innerWidth
      h = window.innerHeight
      const budget = deviceBudget(w, h)
      dpr = budget.dpr
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ;({ stars, dust } = generate(w, h, budget.stars, budget.dust, palette))
    }

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const dark = palette === DARK_STAR_COLORS
      const px = pointer.x
      const py = pointer.y

      let currentColor = -1
      for (const s of stars) {
        if (s.color !== currentColor) {
          currentColor = s.color
          ctx.fillStyle = `rgb(${palette[s.color]})`
        }
        const twinkle = s.tw ? 0.62 + 0.38 * Math.sin(time * s.tw + s.ph) : 1
        const x = s.x + px * s.z * 14
        const y = s.y + py * s.z * 10
        ctx.globalAlpha = s.a * twinkle * (dark ? 1 : 0.45)
        if (s.r < 0.9) {
          ctx.fillRect(x - s.r, y - s.r, s.r * 2, s.r * 2)
        } else {
          ctx.beginPath()
          ctx.arc(x, y, s.r, 0, Math.PI * 2)
          ctx.fill()
          if (dark && s.r > 1.35 && glow) {
            ctx.globalAlpha = s.a * twinkle * 0.28
            const g = s.r * 7
            ctx.drawImage(glow, x - g / 2, y - g / 2, g, g)
          }
        }
      }

      for (const d of dust) {
        const sprite = sprites[d.sprite % sprites.length]
        if (!sprite) continue
        ctx.globalAlpha = d.a * (0.55 + 0.45 * Math.sin(time * d.f + d.ph)) * (dark ? 1 : 0.6)
        const x = d.x + px * d.z * 22
        const y = d.y + py * d.z * 16
        ctx.drawImage(sprite, x - d.size / 2, y - d.size / 2, d.size, d.size)
      }
      ctx.globalAlpha = 1
      if (nebula) nebula.style.transform = `translate3d(${px * 6}px, ${py * 4}px, 0)`
    }

    const step = (dt: number) => {
      time += dt
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 1.6)
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 1.6)
      const margin = 20
      for (const s of stars) {
        s.x += s.vx * dt
        s.y += s.vy * dt
        if (s.x < -margin) s.x += w + margin * 2
        else if (s.x > w + margin) s.x -= w + margin * 2
        if (s.y < -margin) s.y += h + margin * 2
        else if (s.y > h + margin) s.y -= h + margin * 2
      }
      for (const d of dust) {
        d.x += (d.vx + Math.sin(time * d.f * 2 + d.ph) * 3) * dt
        d.y += (d.vy + Math.cos(time * d.f * 1.7 + d.ph) * 2.4) * dt
        if (d.x < -40) d.x = w + 40
        else if (d.x > w + 40) d.x = -40
        if (d.y < -40) d.y = h + 40
        else if (d.y > h + 40) d.y = -40
      }
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const elapsed = now - last
      if (elapsed < FRAME_MS) return
      last = now
      step(Math.min(elapsed / 1000, 0.1))
      draw()
    }

    const start = () => {
      cancelAnimationFrame(raf)
      raf = 0
      if (animated()) {
        last = performance.now()
        raf = requestAnimationFrame(loop)
      } else {
        pointer.x = pointer.y = pointer.tx = pointer.ty = 0
        draw()
      }
    }

    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        setup()
        start()
      }, 150)
    }
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      pointer.tx = (e.clientX / w - 0.5) * 2
      pointer.ty = (e.clientY / h - 0.5) * 2
    }
    const classObserver = new MutationObserver(() => {
      setup()
      start()
    })

    setup()
    start()
    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', onPointer, { passive: true })
    document.addEventListener('visibilitychange', start)
    motionQuery.addEventListener('change', start)
    classObserver.observe(html, { attributes: true, attributeFilter: ['class'] })

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', start)
      motionQuery.removeEventListener('change', start)
      classObserver.disconnect()
    }
  }, [])

  return (
    <div ref={rootRef} className="cosmic" aria-hidden>
      <div ref={nebulaRef} className="cosmic-nebula" />
      <canvas ref={canvasRef} />
      <div className="cosmic-vignette" />
    </div>
  )
}
