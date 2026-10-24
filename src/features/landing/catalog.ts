export interface LandingModule {
  id: string
  name: string
  to: string
  kicker: string
  lede: string
  points: string[]
  layout: 'feature' | 'wide' | 'stack'
}

export const LANDING_MODULES: LandingModule[] = [
  {
    id: 'notebook',
    name: 'Notebook',
    to: '/notes',
    kicker: 'Bitácora',
    lede: 'Notas en Markdown con LaTeX, etiquetas y vínculos a conceptos, fórmulas y cálculos.',
    points: ['Autoguardado', 'Enlaces internos', 'Plantilla de investigación'],
    layout: 'feature',
  },
  {
    id: 'knowledge',
    name: 'Knowledge Lab',
    to: '/knowledge',
    kicker: 'Biblioteca',
    lede: 'Conceptos con disciplina, formalismo, ejemplos y relaciones. Las preguntas abiertas viven al lado.',
    points: ['Relaciones entre conceptos', 'Preguntas con respuesta', 'Biblioteca inicial editable'],
    layout: 'stack',
  },
  {
    id: 'workbench',
    name: 'Workbench',
    to: '/workbench/calculator',
    kicker: 'Laboratorio',
    lede: 'Cálculo, física, matemática, unidades, fórmulas y un laboratorio de programación que pasa del enunciado al código.',
    points: ['Seis herramientas reales', 'Fórmulas evaluables', 'Pseudocódigo y varios lenguajes'],
    layout: 'wide',
  },
  {
    id: 'focus',
    name: 'Focus',
    to: '/focus',
    kicker: 'Estudio',
    lede: 'Pomodoro anclado al reloj del sistema, tareas con prioridad y materias del cursado.',
    points: ['Pomodoro, pausas y registro', 'Tareas por materia', 'Materias archivadas'],
    layout: 'stack',
  },
  {
    id: 'sketch',
    name: 'Sketchpad',
    to: '/sketch',
    kicker: 'Trazo',
    lede: 'Pizarras con lápiz y goma. El trazo se queda en el dispositivo, con deshacer y rehacer.',
    points: ['Presión del trazo', 'Deshacer / rehacer', 'Varias pizarras'],
    layout: 'stack',
  },
  {
    id: 'tools',
    name: 'Tool Shelf',
    to: '/tools',
    kicker: 'Estante',
    lede: 'Accesos a herramientas externas que ya usás: graficadores, CAS y pizarras en línea.',
    points: ['Enlaces http(s)', 'Orden propio', 'Semilla editable'],
    layout: 'stack',
  },
  {
    id: 'settings',
    name: 'Datos y ajustes',
    to: '/settings',
    kicker: 'Archivo',
    lede: 'Exportación JSON, tema, efectos y —con cuenta— copia de los datos hacia tu proyecto de Supabase.',
    points: ['Respaldo local en JSON', 'Tema y efectos', 'Subir o bajar la nube'],
    layout: 'wide',
  },
]

export const WORKBENCH_LINKS = [
  { name: 'Calculadora', to: '/workbench/calculator' },
  { name: 'Física', to: '/workbench/physics' },
  { name: 'Matemática', to: '/workbench/math' },
  { name: 'Unidades', to: '/workbench/units' },
  { name: 'Fórmulas', to: '/workbench/formulas' },
  { name: 'Programación', to: '/workbench/dev' },
] as const

export const FOCUS_LINKS = [
  { name: 'Pomodoro', to: '/focus' },
  { name: 'Tareas', to: '/focus/tasks' },
  { name: 'Materias', to: '/focus/subjects' },
] as const

export const ORBIT = LANDING_MODULES.filter((m) => m.id !== 'settings')
