import { BookOpen, Calculator, FlaskConical, Home, NotebookPen, PenTool, Settings, Target, Wrench, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  hint: string
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home, hint: 'Panel principal' },
  { to: '/notes', label: 'Notebook', icon: NotebookPen, hint: 'Cuaderno de investigación' },
  { to: '/knowledge', label: 'Knowledge Lab', icon: BookOpen, hint: 'Biblioteca de conceptos' },
  { to: '/workbench', label: 'Workbench', icon: Calculator, hint: 'Calculadoras y fórmulas' },
  { to: '/focus', label: 'Focus', icon: Target, hint: 'Pomodoro, tareas y materias' },
  { to: '/sketch', label: 'Sketchpad', icon: PenTool, hint: 'Pizarras' },
  { to: '/tools', label: 'Tool Shelf', icon: Wrench, hint: 'Herramientas externas' },
  { to: '/settings', label: 'Datos y ajustes', icon: Settings, hint: 'Exportar, importar, tema' },
]

export const LabIcon = FlaskConical
