import { lazy } from 'react'
import { NavLink, Navigate, useParams } from 'react-router-dom'
import { pillClass } from '@/components/ui'

const Calculator = lazy(() => import('./Calculator'))
const PhysicsLab = lazy(() => import('./PhysicsLab'))
const UnitConverter = lazy(() => import('./UnitConverter'))
const MathTools = lazy(() => import('./MathTools'))
const Formulas = lazy(() => import('./Formulas'))
const DevLab = lazy(() => import('./devlab/DevLab'))
const DataLab = lazy(() => import('./DataLab'))
const Symbolic = lazy(() => import('./Symbolic'))
const Circuits = lazy(() => import('./Circuits'))

const TOOLS = [
  { id: 'calculator', label: 'Calculadora', el: Calculator },
  { id: 'physics', label: 'Física', el: PhysicsLab },
  { id: 'math', label: 'Matemática', el: MathTools },
  { id: 'units', label: 'Unidades', el: UnitConverter },
  { id: 'formulas', label: 'Fórmulas', el: Formulas },
  { id: 'data', label: 'Gráficas', el: DataLab },
  { id: 'symbolic', label: 'Simbólico', el: Symbolic },
  { id: 'circuits', label: 'Circuitos', el: Circuits },
  { id: 'dev', label: 'Programación', el: DevLab },
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
        <h1 className="text-gradient text-2xl font-semibold tracking-tight">Workbench</h1>
        <nav className="glass inline-flex flex-wrap gap-1 rounded-xl p-1">
          {TOOLS.map((t) => (
            <NavLink key={t.id} to={`/workbench/${t.id}`} className={({ isActive }) => pillClass(isActive)}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <El />
    </div>
  )
}
