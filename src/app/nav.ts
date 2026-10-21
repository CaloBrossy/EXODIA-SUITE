import { BookOpen, Calculator, FlaskConical, Home, NotebookPen, PenTool, Settings, Target, Wrench, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  hint: string
  /** Clase de animación del ícono al pasar el mouse (definidas en index.css). */
  anim: string
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home, hint: 'Panel principal', anim: 'ico-bounce' },
  { to: '/notes', label: 'Notebook', icon: NotebookPen, hint: 'Cuaderno de investigación', anim: 'ico-draw' },
  { to: '/knowledge', label: 'Knowledge Lab', icon: BookOpen, hint: 'Biblioteca de conceptos', anim: 'ico-flip' },
  { to: '/workbench', label: 'Workbench', icon: Calculator, hint: 'Calculadoras y fórmulas', anim: 'ico-pop' },
  { to: '/focus', label: 'Focus', icon: Target, hint: 'Pomodoro, tareas y materias', anim: 'ico-pulse' },
  { to: '/sketch', label: 'Sketchpad', icon: PenTool, hint: 'Pizarras', anim: 'ico-wiggle' },
  { to: '/tools', label: 'Tool Shelf', icon: Wrench, hint: 'Herramientas externas', anim: 'ico-swing' },
  { to: '/settings', label: 'Datos y ajustes', icon: Settings, hint: 'Exportar, importar, tema', anim: 'ico-spin' },
]

export const LabIcon = FlaskConical
