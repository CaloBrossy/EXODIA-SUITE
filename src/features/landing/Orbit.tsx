import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ORBIT } from './catalog'
import { markEnteredOps } from '@/app/gate'
import { useFx } from '@/hooks/misc'

export function Orbit() {
  const { fx } = useFx()
  const [i, setI] = useState(0)
  const [reduce, setReduce] = useState(false)
  const current = ORBIT[i] ?? ORBIT[0]!

  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduce(q.matches)
    sync()
    q.addEventListener('change', sync)
    return () => q.removeEventListener('change', sync)
  }, [])

  const flat = reduce || fx === 'lite'
  const step = (d: number) => setI((n) => (n + d + ORBIT.length) % ORBIT.length)

  return (
    <section id="orbita" className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-20 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div>
        <p className="eyebrow">Exploración</p>
        <h2 className="mt-2 max-w-md text-3xl font-semibold tracking-tight">Seis instrumentos, una órbita.</h2>
        <p className="mt-3 max-w-md text-sm text-muted">Elegí un módulo con el puntero, las flechas o el toque. El panel dice qué hace hoy, no qué promete.</p>
        {flat ? (
          <ul className="mt-6 flex flex-col gap-2">
            {ORBIT.map((m, n) => (
              <li key={m.id}>
                <button type="button" className={n === i ? 'text-accent' : 'text-muted'} aria-current={n === i} onClick={() => setI(n)}>{m.name}</button>
              </li>
            ))}
          </ul>
        ) : (
          <div
            className="orbit-stage mt-8"
            tabIndex={0}
            role="listbox"
            aria-label="Módulos en órbita"
            aria-activedescendant={`orbit-${current.id}`}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1) }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
            }}
          >
            <div className="orbit-ring" style={{ ['--turn' as string]: `${-i * (360 / ORBIT.length)}deg` }}>
              {ORBIT.map((m, n) => (
                <button
                  key={m.id}
                  id={`orbit-${m.id}`}
                  type="button"
                  role="option"
                  aria-selected={n === i}
                  className="orbit-node"
                  style={{ ['--a' as string]: `${n * (360 / ORBIT.length)}deg` }}
                  onClick={() => setI(n)}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <article className="glass rounded-2xl p-6" aria-live="polite">
        <p className="eyebrow">{current.kicker}</p>
        <h3 className="mt-2 text-2xl font-semibold">{current.name}</h3>
        <p className="mt-3 text-sm text-muted">{current.lede}</p>
        <ul className="mt-4 flex flex-col gap-1 text-sm">
          {current.points.map((p) => <li key={p}>· {p}</li>)}
        </ul>
        <Link to={current.to} onClick={markEnteredOps} className="mt-6 inline-flex text-sm text-accent">Abrir {current.name}</Link>
      </article>
    </section>
  )
}
