import React, { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUpRight, Pause, Play, RotateCcw } from 'lucide-react'
import { db } from '@/db/db'
import { usePomodoro } from '@/hooks/usePomodoro'
import { evaluateExpression, formatValue } from '@/lib/math/calculator'
import { PhaseLabel, remaining } from '@/lib/pomodoro'
import { PriorityLabel } from '@/db/models'
import { snippet } from '@/lib/text'

interface ModuleExplorerProps {
  onSelectModule: (moduleId: string, path?: string) => void
}

interface ModuleData {
  id: string
  name: string
  path: string
  shortDesc: string
  fullDesc: string
  features: string[]
  tag: string
}

const WORKBENCH = [
  { label: 'Calculadora', path: '/workbench/calculator' },
  { label: 'Física', path: '/workbench/physics' },
  { label: 'Matemática', path: '/workbench/math' },
  { label: 'Unidades', path: '/workbench/units' },
  { label: 'Fórmulas', path: '/workbench/formulas' },
  { label: 'Programación', path: '/workbench/dev' },
] as const

const MODULES: ModuleData[] = [
  {
    id: 'workbench',
    name: 'Workbench',
    path: '/workbench/calculator',
    tag: 'Cálculo',
    shortDesc: 'Calculadora, física, matemática, unidades, fórmulas y programación.',
    fullDesc: 'Seis instrumentos en este dispositivo: expresión numérica, laboratorios de física, vectores y Shannon, conversor de unidades, biblioteca de fórmulas y Dev Lab.',
    features: [
      'Calculadora con funciones, constantes y modo grados o radianes',
      'Física: entropía, cinemática, dinámica, energía, circuitos, gases, átomo y constantes',
      'Matemática: vectores 2D/3D, ángulos, sistemas lineales, porcentajes y entropía de Shannon',
      'Fórmulas guardadas, con LaTeX y enlace a la herramienta que las calcula',
      'Dev Lab: enunciado, estrategia y código en Python, JavaScript, TypeScript, Java, C, C++, C#, Go, Rust, PHP y SQL',
    ],
  },
  {
    id: 'knowledge',
    name: 'Knowledge Lab',
    path: '/knowledge',
    tag: 'Conceptos',
    shortDesc: 'Biblioteca de conceptos, relaciones y preguntas pendientes.',
    fullDesc: 'Cada concepto tiene disciplina, etiquetas, definición, explicación, formalización, ejemplos y observaciones. Markdown y LaTeX. Las relaciones con otros conceptos son bidireccionales.',
    features: [
      'Alta, edición, favoritos y búsqueda por texto, disciplina y etiqueta',
      'Relaciones bidireccionales entre conceptos',
      'Preguntas pendientes, ligadas a un concepto o a una nota',
      'Los vínculos no borran las notas ni las fórmulas asociadas',
    ],
  },
  {
    id: 'notes',
    name: 'Notebook',
    path: '/notes',
    tag: 'Notas',
    shortDesc: 'Notas en Markdown con LaTeX, etiquetas y favoritos.',
    fullDesc: 'Cuaderno local. Cada nota tiene título, contenido, etiquetas y puede enlazar conceptos, fórmulas y cálculos. Se busca por título y contenido.',
    features: [
      'Markdown y fórmulas LaTeX en $…$ y $$…$$',
      'Favoritas, etiquetas y búsqueda',
      'Enlaces a conceptos, fórmulas y cálculos',
      'Atajos: Alt+N nueva nota, Ctrl+S guardar, Ctrl+B / Ctrl+I',
    ],
  },
  {
    id: 'focus',
    name: 'Focus',
    path: '/focus',
    tag: 'Estudio',
    shortDesc: 'Pomodoro, tareas y materias en este dispositivo.',
    fullDesc: 'El temporizador persiste en IndexedDB y es el mismo de la página Focus. Al lado están las tareas, con prioridad y materia, y las materias con objetivos.',
    features: [
      'Pomodoro: concentración, descanso corto y descanso largo',
      'Duraciones editables. Por defecto 25, 5 y 15 minutos, pausa larga cada 4',
      'Tareas con prioridad, materia, proyecto y fecha',
      'Materias con período, objetivos y notas. Historial de sesiones',
    ],
  },
  {
    id: 'sketchpad',
    name: 'Sketchpad',
    path: '/sketch',
    tag: 'Pizarras',
    shortDesc: 'Dibujo a mano: lápiz, borrador, color y exportación PNG.',
    fullDesc: 'Cada pizarra guarda trazos, color de fondo y título. El lápiz usa la presión del stylus. Se deshace, se rehace y se exporta a PNG.',
    features: [
      'Lápiz (P) y borrador (E)',
      'Paleta, color libre y grosor',
      'Deshacer y rehacer (Ctrl+Z / Ctrl+Shift+Z)',
      'Autoguardado y exportación PNG',
    ],
  },
  {
    id: 'tools',
    name: 'Tool Shelf',
    path: '/tools',
    tag: 'Accesos',
    shortDesc: 'Enlaces externos que abrís en otra pestaña.',
    fullDesc: 'Anaquel de URLs http(s). No ejecuta esas herramientas acá: las abre en una pestaña nueva. Podés agregar, editar, ordenar y quitar accesos.',
    features: [
      'Nombre, URL y descripción',
      'Se abren fuera de EXODIA y necesitan conexión',
      'Orden manual de la lista',
      'La biblioteca inicial trae Desmos, GeoGebra, Wolfram|Alpha y Miro',
    ],
  },
  {
    id: 'settings',
    name: 'Datos y Ajustes',
    path: '/settings',
    tag: 'Datos',
    shortDesc: 'JSON local, tema, efectos y copia en tu cuenta.',
    fullDesc: 'Todo vive en IndexedDB de este navegador. Podés exportar o importar un JSON con versión de esquema. Si hay cuenta, subís o bajás esa copia a tu proyecto de Supabase.',
    features: [
      'Exportar e importar JSON. La importación fusiona o reemplaza, en una sola transacción',
      'Conteo por tabla y espacio usado',
      'Tema claro u oscuro, y efectos completos o reducidos',
      'Cuenta: subir este dispositivo, bajar cambios o usar la nube',
    ],
  },
]

function cut(text: string, max: number) {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function clock(ms: number) {
  const total = Math.ceil(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export const ModuleExplorer: React.FC<ModuleExplorerProps> = ({ onSelectModule }) => {
  const [activeModuleId, setActiveModuleId] = useState('workbench')
  const [expr, setExpr] = useState('sqrt(2)')
  const [calcOut, setCalcOut] = useState('')
  const [calcErr, setCalcErr] = useState('')
  const [conceptId, setConceptId] = useState<string | null>(null)
  const pomodoro = usePomodoro()
  const snap = useLiveQuery(async () => {
    const [concepts, notes, formulas, tasks, subjects, sketches, tools, questions, calculations, devProblems] = await Promise.all([
      db.concepts.toArray(),
      db.notes.toArray(),
      db.formulas.toArray(),
      db.tasks.toArray(),
      db.subjects.toArray(),
      db.sketches.toArray(),
      db.tools.orderBy('order').toArray(),
      db.questions.toArray(),
      db.calculations.toArray(),
      db.devProblems.toArray(),
    ])
    return { concepts, notes, formulas, tasks, subjects, sketches, tools, questions, calculations, devProblems }
  }, [])

  const concepts = useMemo(() => [...(snap?.concepts ?? [])].sort((a, b) => a.title.localeCompare(b.title, 'es')), [snap])
  const notes = useMemo(() => [...(snap?.notes ?? [])].sort((a, b) => b.updatedAt - a.updatedAt), [snap])
  const formulas = useMemo(() => [...(snap?.formulas ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')), [snap])
  const tasks = useMemo(() => (snap?.tasks ?? []).filter((t) => !t.done), [snap])
  const subjects = snap?.subjects ?? []
  const sketches = useMemo(() => [...(snap?.sketches ?? [])].sort((a, b) => b.updatedAt - a.updatedAt), [snap])
  const selected = concepts.find((c) => c.id === conceptId) ?? concepts.find((c) => c.relatedIds.length > 0) ?? concepts[0]
  const graph = useMemo(() => {
    const ranked = [...concepts].sort((a, b) => b.relatedIds.length - a.relatedIds.length).slice(0, 7)
    const nodes = ranked.map((c, i) => {
      const angle = (Math.PI * 2 * i) / Math.max(ranked.length, 1) - Math.PI / 2
      return { c, x: 250 + Math.cos(angle) * 150, y: 118 + Math.sin(angle) * 78 }
    })
    const byId = new Map(nodes.map((n) => [n.c.id, n]))
    const edges: { a: string; x1: number; y1: number; x2: number; y2: number }[] = []
    const seen = new Set<string>()
    for (const n of nodes) {
      for (const rid of n.c.relatedIds) {
        const other = byId.get(rid)
        const key = [n.c.id, rid].sort().join(':')
        if (!other || seen.has(key)) continue
        seen.add(key)
        edges.push({ a: key, x1: n.x, y1: n.y, x2: other.x, y2: other.y })
      }
    }
    return { nodes, edges }
  }, [concepts])

  const runCalc = (input = expr) => {
    try {
      setCalcErr('')
      setCalcOut(formatValue(evaluateExpression(input)))
    } catch (e) {
      setCalcOut('')
      setCalcErr(e instanceof Error ? e.message : 'No se pudo calcular')
    }
  }

  const activeModule = MODULES.find((m) => m.id === activeModuleId) ?? MODULES[0]
  const relationCount = useMemo(() => {
    const seen = new Set<string>()
    for (const c of concepts) for (const rid of c.relatedIds) seen.add([c.id, rid].sort().join(':'))
    return seen.size
  }, [concepts])
  if (!activeModule) return null

  const latestCalc = [...(snap?.calculations ?? [])].sort((a, b) => b.createdAt - a.createdAt)[0]
  const subjectName = (id: string | null | undefined) => subjects.find((s) => s.id === id)?.name
  const openTasks = tasks.slice(0, 4)
  const rem = clock(remaining(pomodoro.state, pomodoro.now))

  return (
    <section id="modulos" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 border-b border-[#8ca0dc]/10 pb-8">
        <div>
          <div className="text-xs font-mono text-[#5ee7f7] tracking-widest uppercase mb-2">01. Instrumentos del Observatorio</div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#e6ecfa]">Explorador de Módulos</h2>
        </div>
        <p className="text-sm sm:text-base text-[#8d98b8] max-w-lg leading-relaxed">
          Lo que hay en este dispositivo: conceptos, notas, fórmulas, tareas y accesos. Si todavía no cargaste nada, ves la biblioteca inicial.
        </p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-10 scrollbar-none">
        {MODULES.map((mod) => {
          const isActive = mod.id === activeModuleId
          return (
            <button
              key={mod.id}
              onClick={() => setActiveModuleId(mod.id)}
              className={`px-4 py-2 text-xs font-mono whitespace-nowrap shrink-0 rounded-lg transition-all border ${
                isActive
                  ? 'bg-[#5ee7f7]/15 text-[#5ee7f7] border-[#5ee7f7]/40 shadow-[0_0_15px_rgba(94,231,247,0.15)] font-semibold'
                  : 'text-[#8d98b8] bg-[#0b1124]/50 border-[#8ca0dc]/10 hover:text-[#e6ecfa] hover:border-[#8ca0dc]/25'
              }`}
            >
              {mod.name}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mb-16">
        <div className="lg:col-span-5 rounded-3xl glass-panel p-8 sm:p-10 flex flex-col justify-between border border-[#8ca0dc]/15 shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-xs font-mono text-[#5ee7f7] tracking-wider uppercase mb-3">{activeModule.tag}</div>
            <div className="flex items-baseline gap-3 mb-4">
              <h3 className="text-2xl sm:text-3xl font-bold text-[#e6ecfa]">{activeModule.name}</h3>
              <span className="text-xs font-mono text-[#8d98b8]/60">{activeModule.path}</span>
            </div>
            <p className="text-sm sm:text-base text-[#8d98b8] leading-relaxed mb-8">{activeModule.fullDesc}</p>
            <div className="space-y-3 mb-8">
              <div className="text-xs font-mono text-[#e6ecfa] uppercase tracking-wide">En este módulo</div>
              {activeModule.features.map((feat) => (
                <div key={feat} className="flex items-start gap-2.5 text-xs text-[#8d98b8]">
                  <span className="text-[#5ee7f7] font-mono text-sm leading-none mt-0.5">·</span>
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-6 border-t border-[#8ca0dc]/10 flex items-center justify-between relative z-10">
            <span className="text-xs font-mono text-[#8d98b8]">
              LOCAL: <span className="text-[#5ee7f7]">{snap ? 'INDEXEDDB' : 'ABRIENDO'}</span>
            </span>
            <button
              onClick={() => onSelectModule(activeModule.id, activeModule.path)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-medium text-[#05070d] bg-[#5ee7f7] rounded-lg hover:bg-[#7ef0fd] transition-all"
            >
              <span>Abrir {activeModule.name}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-3xl glass-panel-elevated p-6 sm:p-8 border border-[#8ca0dc]/15 flex flex-col justify-between relative overflow-hidden min-h-[420px]">
          <div className="flex items-center justify-between text-xs font-mono text-[#8d98b8] border-b border-[#8ca0dc]/10 pb-4 mb-6">
            <span className="text-[#5ee7f7]">ESTE DISPOSITIVO · {activeModule.name.toUpperCase()}</span>
            <span className="tabular-nums">{snap ? 'DATOS LOCALES' : '…'}</span>
          </div>

          <div className="my-auto">
            {!snap && <p className="text-sm font-mono text-[#8d98b8]">Abriendo la base local…</p>}

            {snap && activeModule.id === 'workbench' && (
              <div className="space-y-4">
                <form
                  className="p-4 rounded-xl bg-[#070a16]/80 border border-[#8ca0dc]/15"
                  onSubmit={(e) => {
                    e.preventDefault()
                    runCalc()
                  }}
                >
                  <div className="text-xs font-mono text-[#8d98b8] mb-2">CALCULADORA</div>
                  <div className="flex gap-2">
                    <input
                      value={expr}
                      onChange={(e) => setExpr(e.target.value)}
                      aria-label="Expresión"
                      className="min-w-0 flex-1 rounded-lg border border-[#8ca0dc]/20 bg-[#05070d] px-3 py-2 font-mono text-sm text-[#e6ecfa]"
                    />
                    <button type="submit" className="rounded-lg bg-[#5ee7f7] px-3 py-2 text-xs font-mono text-[#05070d]">Calcular</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['sqrt(2)', 'sin(pi/2)', 'log(1000, 10)'].map((sample) => (
                      <button key={sample} type="button" className="rounded-md border border-[#8ca0dc]/15 px-2 py-1 font-mono text-[11px] text-[#8d98b8]" onClick={() => { setExpr(sample); runCalc(sample) }}>
                        {sample}
                      </button>
                    ))}
                  </div>
                  {calcOut && <p className="mt-3 font-mono text-2xl text-[#5ee7f7]">{calcOut}</p>}
                  {calcErr && <p className="mt-3 font-mono text-xs text-[#e879c6]">{calcErr}</p>}
                </form>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {WORKBENCH.map((tool) => (
                    <button key={tool.path} type="button" onClick={() => onSelectModule('workbench', tool.path)} className="rounded-lg border border-[#8ca0dc]/15 bg-[#070a16]/50 px-3 py-2 text-left text-xs font-mono text-[#e6ecfa] hover:border-[#5ee7f7]/40">
                      {tool.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {formulas.slice(0, 3).map((f) => (
                    <button key={f.id} type="button" onClick={() => onSelectModule('workbench', f.toolPath && f.toolPath.startsWith('/workbench') ? f.toolPath : '/workbench/formulas')} className="block w-full rounded-lg border border-[#8ca0dc]/10 bg-[#070a16]/40 px-3 py-2 text-left">
                      <span className="block text-xs text-[#e6ecfa]">{f.name}</span>
                      <span className="mt-1 block truncate font-mono text-[11px] text-[#5ee7f7]">{f.latex}</span>
                    </button>
                  ))}
                  {latestCalc && (
                    <p className="font-mono text-[11px] text-[#8d98b8]">
                      Último cálculo: {latestCalc.input} → {latestCalc.result}
                    </p>
                  )}
                </div>
              </div>
            )}

            {snap && activeModule.id === 'knowledge' && (
              <div className="space-y-4">
                <div className="text-xs font-mono text-[#8d98b8]">
                  {concepts.length} conceptos · {snap.questions.filter((q) => !q.resolved).length} preguntas pendientes
                </div>
                <div className="relative h-64 w-full rounded-2xl bg-[#070a16]/80 border border-[#8ca0dc]/15 p-2">
                  <svg className="h-full w-full" viewBox="0 0 500 240">
                    {graph.edges.map((e) => (
                      <line key={e.a} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#8ca0dc" strokeOpacity="0.35" strokeWidth="1.5" />
                    ))}
                    {graph.nodes.map((node) => {
                      const on = node.c.id === selected?.id
                      return (
                        <g key={node.c.id} className="cursor-pointer" onClick={() => setConceptId(node.c.id)}>
                          <circle cx={node.x} cy={node.y} r={on ? 8 : 5} fill={on ? '#5ee7f7' : '#8b7cf6'} />
                          <text x={node.x} y={node.y - 12} textAnchor="middle" fill={on ? '#e6ecfa' : '#8d98b8'} fontSize="10" fontFamily="JetBrains Mono">
                            {cut(node.c.title, 22)}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
                {selected && (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-[#e6ecfa]">{selected.title}</p>
                      <p className="mt-1 text-xs text-[#8d98b8]">{selected.discipline || 'Sin disciplina'} · {selected.relatedIds.length} relaciones</p>
                      <p className="mt-2 text-xs leading-relaxed text-[#8d98b8]">{cut(selected.summary || snippet(selected.explanation), 180) || 'Sin definición breve.'}</p>
                    </div>
                    <button type="button" className="shrink-0 font-mono text-[11px] text-[#5ee7f7]" onClick={() => onSelectModule('knowledge', `/knowledge/${selected.id}`)}>Abrir</button>
                  </div>
                )}
              </div>
            )}

            {snap && activeModule.id === 'notes' && (
              <div className="space-y-2">
                {notes.length === 0 && <p className="text-sm text-[#8d98b8]">Todavía no hay notas. Admiten Markdown y LaTeX.</p>}
                {notes.slice(0, 5).map((n) => (
                  <button key={n.id} type="button" onClick={() => onSelectModule('notes', `/notes/${n.id}`)} className="block w-full rounded-xl border border-[#8ca0dc]/10 bg-[#070a16]/60 px-4 py-3 text-left">
                    <span className="block text-sm text-[#e6ecfa]">{n.favorite ? '★ ' : ''}{n.title || 'Sin título'}</span>
                    <span className="mt-1 block text-xs text-[#8d98b8]">{snippet(n.content, 110) || 'Vacía'}</span>
                    {n.tags.length > 0 && <span className="mt-2 block font-mono text-[11px] text-[#5ee7f7]">{n.tags.map((t) => `#${t}`).join(' ')}</span>}
                  </button>
                ))}
              </div>
            )}

            {snap && activeModule.id === 'focus' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#8ca0dc]/15 bg-[#070a16]/80 p-6 text-center">
                  <div className="font-mono text-xs tracking-wider text-[#5ee7f7]">{PhaseLabel[pomodoro.state.phase].toUpperCase()}</div>
                  <div className="my-3 font-mono text-5xl font-bold tabular-nums text-[#e6ecfa]">{rem}</div>
                  <div className="flex items-center justify-center gap-3">
                    <button type="button" aria-label={pomodoro.state.status === 'running' ? 'Pausar' : 'Iniciar'} onClick={() => void (pomodoro.state.status === 'running' ? pomodoro.pause() : pomodoro.start())} className="rounded-full bg-[#5ee7f7] p-3 text-[#05070d]">
                      {pomodoro.state.status === 'running' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button type="button" aria-label="Reiniciar" onClick={() => void pomodoro.reset()} className="glass-panel-subtle rounded-full p-3 text-[#8d98b8]">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-3 font-mono text-[11px] text-[#8d98b8]">
                    {pomodoro.config.workMin}/{pomodoro.config.shortMin}/{pomodoro.config.longMin} min · cada {pomodoro.config.longEvery}
                    {subjectName(pomodoro.state.subjectId) ? ` · ${subjectName(pomodoro.state.subjectId)}` : ''}
                  </p>
                </div>
                <div className="space-y-2">
                  {openTasks.length === 0 && <p className="text-xs text-[#8d98b8]">No hay tareas pendientes.</p>}
                  {openTasks.map((t) => (
                    <button key={t.id} type="button" onClick={() => onSelectModule('focus', '/focus/tasks')} className="flex w-full items-center justify-between rounded-lg border border-[#8ca0dc]/10 px-3 py-2 text-left text-xs">
                      <span className="text-[#e6ecfa]">{t.title}</span>
                      <span className="font-mono text-[#8d98b8]">{PriorityLabel[t.priority]}{subjectName(t.subjectId) ? ` · ${subjectName(t.subjectId)}` : ''}</span>
                    </button>
                  ))}
                  {subjects.length > 0 && <p className="font-mono text-[11px] text-[#8d98b8]">Materias: {subjects.map((s) => s.name).join(' · ')}</p>}
                </div>
              </div>
            )}

            {snap && activeModule.id === 'sketchpad' && (
              <div className="space-y-2">
                {sketches.length === 0 && <p className="text-sm text-[#8d98b8]">Todavía no hay pizarras. Lápiz, borrador y exportación PNG.</p>}
                {sketches.slice(0, 5).map((s) => (
                  <button key={s.id} type="button" onClick={() => onSelectModule('sketchpad', `/sketch/${s.id}`)} className="flex w-full items-center justify-between rounded-xl border border-[#8ca0dc]/10 bg-[#070a16]/60 px-4 py-3 text-left">
                    <span className="text-sm text-[#e6ecfa]">{s.title || 'Sin título'}</span>
                    <span className="font-mono text-[11px] text-[#8d98b8]">{s.strokes.length} trazos</span>
                  </button>
                ))}
              </div>
            )}

            {snap && activeModule.id === 'tools' && (
              <div className="space-y-2">
                {snap.tools.length === 0 && <p className="text-sm text-[#8d98b8]">El anaquel está vacío.</p>}
                {snap.tools.map((tool) => (
                  <a key={tool.id} href={tool.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-[#8ca0dc]/10 bg-[#070a16]/60 px-3 py-3">
                    <span>
                      <span className="block text-sm text-[#e6ecfa]">{tool.name}</span>
                      <span className="mt-1 block text-[11px] text-[#8d98b8]">{tool.description || tool.url}</span>
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#5ee7f7]" />
                  </a>
                ))}
              </div>
            )}

            {snap && activeModule.id === 'settings' && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ['Notas', notes.length],
                  ['Conceptos', concepts.length],
                  ['Fórmulas', formulas.length],
                  ['Preguntas', snap.questions.length],
                  ['Cálculos', snap.calculations.length],
                  ['Tareas', snap.tasks.length],
                  ['Materias', subjects.length],
                  ['Pizarras', sketches.length],
                  ['Accesos', snap.tools.length],
                  ['Programas', snap.devProblems.length],
                ].map(([label, n]) => (
                  <div key={String(label)} className="rounded-lg border border-[#8ca0dc]/10 bg-[#070a16]/50 px-3 py-2">
                    <div className="font-mono text-[11px] text-[#8d98b8]">{label}</div>
                    <div className="font-mono text-xl text-[#e6ecfa]">{n}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#8ca0dc]/10 flex items-center justify-between text-xs font-mono text-[#8d98b8]">
            <span className="text-[#e6ecfa]">{activeModule.shortDesc}</span>
            <span className="text-[#5ee7f7]">INDEXEDDB</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 rounded-3xl glass-panel border border-[#8ca0dc]/15 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-[#5ee7f7] mb-2">01 / BIBLIOTECA</div>
            <h4 className="text-xl font-bold text-[#e6ecfa] mb-3">Fórmulas guardadas</h4>
            <p className="text-xs sm:text-sm text-[#8d98b8] leading-relaxed mb-6">LaTeX, variables y, cuando existe, un enlace al instrumento que las evalúa.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#070a16]/80 border border-[#8ca0dc]/10 font-mono text-xs text-[#5ee7f7]">
            {formulas.length} fórmulas{formulas[0] ? ` · ${cut(formulas[0].name, 42)}` : ''}
          </div>
        </div>
        <div className="p-8 rounded-3xl glass-panel border border-[#8ca0dc]/15 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-[#8b7cf6] mb-2">02 / RELACIONES</div>
            <h4 className="text-xl font-bold text-[#e6ecfa] mb-3">Conceptos enlazados</h4>
            <p className="text-xs sm:text-sm text-[#8d98b8] leading-relaxed mb-6">El grafo de arriba sale de las relaciones guardadas, no de un mapa inventado.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#070a16]/80 border border-[#8ca0dc]/10 font-mono text-xs text-[#8b7cf6]">
            {concepts.length} conceptos · {relationCount} vínculos
          </div>
        </div>
        <div className="p-8 rounded-3xl glass-panel border border-[#8ca0dc]/15 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-[#e6ecfa] mb-2">03 / ESTE NAVEGADOR</div>
            <h4 className="text-xl font-bold text-[#e6ecfa] mb-3">Datos locales</h4>
            <p className="text-xs sm:text-sm text-[#8d98b8] leading-relaxed mb-6">JSON de exportación e importación. La cuenta copia esos datos a tu nube si la configurás.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#070a16]/80 border border-[#8ca0dc]/10 font-mono text-xs text-[#e6ecfa]">
            {notes.length} notas · {sketches.length} pizarras · {snap?.devProblems.length ?? 0} problemas
          </div>
        </div>
      </div>
    </section>
  )
}
