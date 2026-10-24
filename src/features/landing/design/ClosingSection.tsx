import React from 'react';
import { ArrowRight, Orbit } from 'lucide-react';

interface ClosingSectionProps {
  onOpenOperations: () => void;
  onSelectModule: (moduleId: string) => void;
}

export const ClosingSection: React.FC<ClosingSectionProps> = ({
  onOpenOperations,
  onSelectModule,
}) => {
  return (
    <section className="relative py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10 overflow-hidden">
      {/* Focal Horizon Radial Lighting Effect (Delicate cyan focal glow, not neon purple) */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full blur-[140px] opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, #5ee7f7 0%, #0b1124 70%, transparent 100%)',
        }}
      />

      <div className="relative z-10 text-center max-w-3xl mx-auto flex flex-col items-center">
        {/* Orbital Ring Geometry Indicator */}
        <div className="w-16 h-16 rounded-full border border-[#5ee7f7]/30 flex items-center justify-center mb-8 relative">
          <div className="w-10 h-10 rounded-full border border-[#8b7cf6]/40 flex items-center justify-center">
            <Orbit className="w-5 h-5 text-[#5ee7f7]" />
          </div>
          {/* Orbital point */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#5ee7f7]" />
        </div>

        {/* Original Scientific & Philosophical Quote */}
        <p className="text-xs font-mono text-[#5ee7f7] tracking-[0.25em] uppercase mb-4">
          EPÍLOGO DEL OBSERVATORIO
        </p>

        <blockquote className="text-3xl sm:text-5xl font-bold tracking-tight text-[#e6ecfa] leading-tight mb-8 text-balance">
          «El universo no es un lugar que contemplamos desde fuera; es la estructura formal que descubrimos cuando pensamos con rigor.»
        </blockquote>

        <p className="text-sm sm:text-base text-[#8d98b8] leading-relaxed max-w-xl mb-10">
          Ingresá a tu estación de trabajo en el espacio profundo. Todos los
          módulos de cálculo, notas formales y relaciones conceptuales listos en tu navegador.
        </p>

        {/* Primary Action Button */}
        <button
          onClick={onOpenOperations}
          className="inline-flex items-center gap-3 px-8 py-4 text-sm font-mono font-medium tracking-wide text-[#05070d] bg-[#5ee7f7] rounded-xl hover:bg-[#7ef0fd] hover:shadow-[0_0_35px_rgba(94,231,247,0.45)] transition-all transform active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ee7f7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070d]"
        >
          <span>Entrar al centro de operaciones</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Quick Launchpad to all 7 modules */}
        <div className="mt-14 pt-8 border-t border-[#8ca0dc]/10 w-full flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-mono text-[#8d98b8]">
          <span className="text-[#e6ecfa]">Acceso directo:</span>
          {[
            { id: 'workbench', label: 'Workbench' },
            { id: 'knowledge', label: 'Knowledge Lab' },
            { id: 'notes', label: 'Notebook' },
            { id: 'focus', label: 'Focus' },
            { id: 'sketchpad', label: 'Sketchpad' },
            { id: 'tools', label: 'Tools' },
            { id: 'settings', label: 'Ajustes' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => onSelectModule(m.id)}
              className="hover:text-[#5ee7f7] transition-colors hover:underline"
            >
              /{m.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
