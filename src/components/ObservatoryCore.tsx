import { useId } from 'react'

/** Núcleo luminoso con órbitas finas. `detailed` agrega anillos graduados para la pantalla principal. */
export function ObservatoryCore({ size = 28, detailed = false, live = false, className }: { size?: number; detailed?: boolean; live?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '')
  const core = `core-${id}`
  const halo = `halo-${id}`
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className} aria-hidden>
      <defs>
        <radialGradient id={core}>
          <stop offset="0" stopColor="#f2fdff" />
          <stop offset="0.35" stopColor="#5ee7f7" />
          <stop offset="1" stopColor="#8b7cf6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={halo}>
          <stop offset="0" stopColor="#5ee7f7" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#8b7cf6" stopOpacity="0.1" />
          <stop offset="1" stopColor="#8b7cf6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r={detailed ? 96 : 70} fill={`url(#${halo})`} />
      {detailed && (
        <>
          <circle cx="100" cy="100" r="92" fill="none" stroke="var(--nx-line)" strokeWidth="0.6" />
          <g className="orbit" style={{ ['--orbit-t' as string]: live ? '14s' : '240s' }}>
            <circle cx="100" cy="100" r="86" fill="none" stroke="var(--nx-muted)" strokeOpacity="0.35" strokeWidth="0.6" strokeDasharray="0.6 5.4" />
          </g>
          <g className="orbit orbit-rev" style={{ ['--orbit-t' as string]: live ? '9s' : '160s' }}>
            <circle cx="100" cy="100" r="64" fill="none" stroke="var(--nx-line)" strokeWidth="0.8" strokeDasharray="22 6 2 6" />
            <circle cx="164" cy="100" r="2.2" fill="#e879c6" />
          </g>
        </>
      )}
      <g className="orbit" style={{ ['--orbit-t' as string]: live ? '6s' : detailed ? '90s' : '40s' }}>
        <ellipse cx="100" cy="100" rx={detailed ? 46 : 62} ry={detailed ? 18 : 26} fill="none" stroke="#5ee7f7" strokeOpacity="0.55" strokeWidth={detailed ? 0.9 : 7} transform="rotate(-24 100 100)" />
        <circle cx={detailed ? 142 : 156} cy={detailed ? 82 : 76} r={detailed ? 2.6 : 12} fill="#e6ecfa" />
      </g>
      {detailed && (
        <g className="orbit orbit-rev" style={{ ['--orbit-t' as string]: live ? '8s' : '120s' }}>
          <ellipse cx="100" cy="100" rx="34" ry="12" fill="none" stroke="#8b7cf6" strokeOpacity="0.5" strokeWidth="0.8" transform="rotate(38 100 100)" />
        </g>
      )}
      <circle className="core-glow" cx="100" cy="100" r={detailed ? 22 : 34} fill={`url(#${core})`} />
      <circle cx="100" cy="100" r={detailed ? 4 : 13} fill="#f2fdff" />
    </svg>
  )
}
