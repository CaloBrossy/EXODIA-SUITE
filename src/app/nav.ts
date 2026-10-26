import { BookOpen, Calculator, CalendarDays, FlaskConical, Home, ListChecks, NotebookPen, PenTool, Repeat, Settings, Target, Wrench, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  hint: string
  /** Clase de animación del ícono al pasar el mouse (definidas en index.css). */
  anim: string
  /** Función del módulo dentro del observatorio. */
  tagline: string
}

export const NAV: NavItem[] = [
  { to: '/app', label: 'Inicio', icon: Home, hint: 'Centro de operaciones', anim: 'ico-bounce', tagline: 'Punto de partida' },
  { to: '/notes', label: 'Notebook', icon: NotebookPen, hint: 'Cuaderno de investigación', anim: 'ico-draw', tagline: 'Registrar descubrimientos' },
  { to: '/knowledge', label: 'Knowledge Lab', icon: BookOpen, hint: 'Biblioteca de conceptos', anim: 'ico-flip', tagline: 'Explorar conceptos' },
  { to: '/workbench', label: 'Workbench', icon: Calculator, hint: 'Calculadoras y fórmulas', anim: 'ico-pop', tagline: 'Experimentar con cálculos' },
  { to: '/focus', label: 'Focus', icon: Target, hint: 'Pomodoro, tareas y materias', anim: 'ico-pulse', tagline: 'Organizar el estudio' },
  { to: '/sketch', label: 'Sketchpad', icon: PenTool, hint: 'Pizarras', anim: 'ico-wiggle', tagline: 'Dibujar ideas' },
  { to: '/tools', label: 'Tool Shelf', icon: Wrench, hint: 'Herramientas externas', anim: 'ico-swing', tagline: 'Herramientas externas' },
  { to: '/settings', label: 'Datos y ajustes', icon: Settings, hint: 'Exportar, importar, tema', anim: 'ico-spin', tagline: 'Datos y apariencia' },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays, hint: 'Clases, exámenes y estudio', anim: 'ico-flip', tagline: 'Planificar fechas' },
  { to: '/review', label: 'Repaso', icon: Repeat, hint: 'Tarjetas y SM-2', anim: 'ico-flip', tagline: 'Memorizar con intervalos' },
  { to: '/exercises', label: 'Ejercicios', icon: ListChecks, hint: 'Banco y simulados', anim: 'ico-pop', tagline: 'Practicar y examinar' },
]

export const LabIcon = FlaskConical
