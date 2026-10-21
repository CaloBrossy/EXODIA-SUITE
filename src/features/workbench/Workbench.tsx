import { lazy } from 'react'
import { NavLink, Navigate, useParams } from 'react-router-dom'
import { cx } from '@/components/ui'

const Calculator = lazy(() => import('./Calculator'))
const PhysicsLab = lazy(() => import('./PhysicsLab'))
const UnitConverter = lazy(() => import('./UnitConverter'))
const MathTools = lazy(() => import('./MathTools'))
const Formulas = lazy(() => import('./Formulas'))

const TOOLS = [
  { id: 'calculator', label: 'Calculadora', el: Calculator },
  { id: 'physics', label: 'Física', el: PhysicsLab },
  { id: 'math', label: 'Matemática', el: MathTools },
  { id: 'units', label: 'Unidades', el: UnitConverter },
  { id: 'formulas', label: 'Fórmulas', el: Formulas },
] as const

export default function Workbench() {
  const { tool } = useParams()
  if (tool === 'entropy') return <Navigate to="/workbench/physics?t=entropy" replace />
  const current = TOOLS.find((t) => t.id === tool)
  if (!current) return <Navigate to="/workbench/calculator" replace />
  const El = current.el
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Workbench</h1>
        <nav className="inline-flex flex-wrap gap-1 rounded-md border border-line bg-panel p-0.5">
          {TOOLS.map((t) => (
            <NavLink key={t.id} to={`/workbench/${t.id}`} className={({ isActive }) => cx('rounded px-3 py-1 text-sm', isActive ? 'bg-sunken font-medium' : 'text-muted hover:text-fg')}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <El />
    </div>
  )
}
