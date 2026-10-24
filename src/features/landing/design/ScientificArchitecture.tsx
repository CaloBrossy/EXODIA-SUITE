import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface ScientificArchitectureProps {
  onOpenOperations: () => void;
}

export const ScientificArchitecture: React.FC<ScientificArchitectureProps> = ({
  onOpenOperations,
}) => {
  return (
    <section id="arquitectura" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 border-b border-[#8ca0dc]/10 pb-8">
        <div>
          <div className="text-xs font-mono text-[#5ee7f7] tracking-widest uppercase mb-2">
            02. Arquitectura de Cómputo Profundo
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#e6ecfa]">
            Fundamentos de Precisión
          </h2>
        </div>
        <p className="text-sm sm:text-base text-[#8d98b8] max-w-lg leading-relaxed">
          Diseñado bajo principios de invariancia física y matemática. Cero
          abstracciones engañosas, latencia mínima y soberanía absoluta de datos.
        </p>
      </div>

      {/* Asymmetric Core Specifications Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-16">
        {/* Left Column: Conceptual Breakdown (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-8 rounded-3xl glass-panel border border-[#8ca0dc]/15">
            <div className="text-xs font-mono text-[#5ee7f7] mb-2">PRINCIPIO 01</div>
            <h3 className="text-2xl font-bold text-[#e6ecfa] mb-3">
              Consistencia Dimensional y Verificación Formal
            </h3>
            <p className="text-sm sm:text-base text-[#8d98b8] leading-relaxed mb-4">
              Cada ecuación procesada en EXODIA pasa por un verificador de dimensiones
              físicas estricto. Las unidades se validan formalmente para evitar
              mezclas inválidas entre escalares y tensores, o discrepancias entre el
              sistema internacional y unidades de Planck.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#8d98b8]">
              <span>[L] · [M] · [T]</span>
              <span aria-hidden="true" className="text-[#8d98b8]/40">/</span>
              <span>Análisis Dimensional Automático</span>
              <span aria-hidden="true" className="text-[#8d98b8]/40">/</span>
              <span className="text-[#5ee7f7]">Error = 0.00%</span>
            </div>
          </div>

          <div className="p-8 rounded-3xl glass-panel border border-[#8ca0dc]/15">
            <div className="text-xs font-mono text-[#8b7cf6] mb-2">PRINCIPIO 02</div>
            <h3 className="text-2xl font-bold text-[#e6ecfa] mb-3">
              Grafo Sináptico Bidireccional
            </h3>
            <p className="text-sm sm:text-base text-[#8d98b8] leading-relaxed mb-4">
              El conocimiento no es un archivador jerárquico; es un espacio
              geométrico curvado por las relaciones entre conceptos. Al conectar
              un concepto matemático con una formulación de física cuántica, EXODIA
              recalcula la distancia topológica en el grafo.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#8d98b8]">
              <span>Topología de Red</span>
              <span aria-hidden="true" className="text-[#8d98b8]/40">/</span>
              <span>Centralidad de Intermediación</span>
              <span aria-hidden="true" className="text-[#8d98b8]/40">/</span>
              <span className="text-[#8b7cf6]">Vínculos no lineales</span>
            </div>
          </div>

          <div className="p-8 rounded-3xl glass-panel border border-[#8ca0dc]/15">
            <div className="text-xs font-mono text-[#e6ecfa] mb-2">PRINCIPIO 03</div>
            <h3 className="text-2xl font-bold text-[#e6ecfa] mb-3">
              Local-First & Persistencia Criptográfica
            </h3>
            <p className="text-sm sm:text-base text-[#8d98b8] leading-relaxed mb-4">
              El observatorio funciona plenamente sin conexión a internet. La
              memoria de trabajo se almacena en el cliente mediante IndexedDB y
              estructuras de datos libres de conflicto (CRDT). Podés exportar tu
              bóveda completa en un archivo JSON unificado en cualquier momento.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#8d98b8]">
              <span>Cero Bloqueo Propietario</span>
              <span aria-hidden="true" className="text-[#8d98b8]/40">/</span>
              <span>Exportación JSON</span>
              <span aria-hidden="true" className="text-[#8d98b8]/40">/</span>
              <span className="text-[#5ee7f7]">Independencia Tecnológica</span>
            </div>
          </div>
        </div>

        {/* Right Column: Quantitative Telemetry HUD (5 cols) */}
        <div id="invariantes" className="lg:col-span-5 rounded-3xl glass-panel-elevated p-8 border border-[#8ca0dc]/20 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#8ca0dc]/10 pb-4">
            <div className="text-xs font-mono text-[#5ee7f7] tracking-wider uppercase">
              CALIBRACIÓN DE SISTEMA
            </div>
            <span className="text-xs font-mono text-[#8d98b8] tabular-nums">
              STATUS: NOMINAL
            </span>
          </div>

          {/* Metric 1 */}
          <div className="p-5 rounded-2xl bg-[#070a16]/70 border border-[#8ca0dc]/10">
            <div className="text-xs font-mono text-[#8d98b8] uppercase tracking-wider mb-1">
              LATENCIA DE CÓMPUTO EN NAVEGADOR
            </div>
            <div className="text-4xl font-mono font-bold text-[#5ee7f7] tabular-nums">
              &lt; 0.15 <span className="text-sm text-[#8d98b8] font-normal">ms</span>
            </div>
            <div className="text-xs text-[#8d98b8] mt-2 font-mono">
              Evaluación sincrónica local sin viajes de ida y vuelta a servidor.
            </div>
          </div>

          {/* Metric 2 */}
          <div className="p-5 rounded-2xl bg-[#070a16]/70 border border-[#8ca0dc]/10">
            <div className="text-xs font-mono text-[#8d98b8] uppercase tracking-wider mb-1">
              FIDELIDAD DE TIPOGRAFÍA LATEX
            </div>
            <div className="text-4xl font-mono font-bold text-[#e6ecfa] tabular-nums">
              100 <span className="text-sm text-[#8d98b8] font-normal">%</span>
            </div>
            <div className="text-xs text-[#8d98b8] mt-2 font-mono">
              Compatibilidad con expresiones AMS-LaTeX complejas y matrices.
            </div>
          </div>

          {/* Metric 3 */}
          <div className="p-5 rounded-2xl bg-[#070a16]/70 border border-[#8ca0dc]/10">
            <div className="text-xs font-mono text-[#8d98b8] uppercase tracking-wider mb-1">
              MÓDULOS EN UN SOLO ESPACIO
            </div>
            <div className="text-4xl font-mono font-bold text-[#8b7cf6] tabular-nums">
              7 <span className="text-sm text-[#8d98b8] font-normal">subsistemas</span>
            </div>
            <div className="text-xs text-[#8d98b8] mt-2 font-mono">
              Notebook, Knowledge Lab, Workbench, Focus, Sketchpad, Tools, Settings.
            </div>
          </div>

          {/* Direct CTA */}
          <button
            onClick={onOpenOperations}
            className="w-full py-3.5 px-4 rounded-xl text-xs font-mono font-medium tracking-wide text-[#05070d] bg-[#5ee7f7] hover:bg-[#7ef0fd] hover:shadow-[0_0_20px_rgba(94,231,247,0.3)] transition-all flex items-center justify-center gap-2"
          >
            <span>Verificar en Centro de Operaciones</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
