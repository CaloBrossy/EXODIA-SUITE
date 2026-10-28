import React from 'react';
import { ArrowRight, Compass, Orbit } from 'lucide-react';

interface HeroProps {
  onOpenOperations: () => void;
  onExploreModules: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onOpenOperations,
  onExploreModules,
}) => {
  return (
    <section
      id="inicio"
      className="relative min-h-[92vh] flex flex-col justify-between pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
    >
      {/* Top Telemetry / Coordinate Kicker (Unboxed, clean monospace) */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-[#8d98b8] border-b border-[#8ca0dc]/10 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-[#5ee7f7]">OBSERVATORIO DE CONOCIMIENTO</span>
          <span aria-hidden="true" className="text-[#8d98b8]/40">·</span>
          <span>EPOCH J2000</span>
          <span aria-hidden="true" className="text-[#8d98b8]/40">·</span>
          <span>α 14h 29m 43s</span>
          <span aria-hidden="true" className="text-[#8d98b8]/40">·</span>
          <span>δ -62° 40′ 46″</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[#8d98b8]/80 tabular-nums">
          <span>LATENCIA: 0.00 ms (LOCAL)</span>
          <span aria-hidden="true" className="text-[#8d98b8]/40">/</span>
          <span>ENTROPÍA REDUCIDA</span>
        </div>
      </div>

      {/* Main Editorial Hero Center */}
      <div className="my-auto py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left / Center Column: Typography & Intent directly on deep space (NO glass card enclosure) */}
        <div className="lg:col-span-8 z-10">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-[#5ee7f7] uppercase mb-6">
            <Orbit className="w-3.5 h-3.5 text-[#5ee7f7]" />
            <span>Entorno Intelectual de Espacio Profundo</span>
          </div>

          {/* Main Headline: Large-scale, clean, powerful sans-serif */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#e6ecfa] leading-[1.08] max-w-4xl text-balance">
            Donde el cálculo formal converge con el{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e6ecfa] via-[#5ee7f7] to-[#8b7cf6]">
              pensamiento profundo
            </span>
            .
          </h1>

          {/* Description */}
          <p className="mt-8 text-base sm:text-lg lg:text-xl text-[#8d98b8] max-w-2xl font-normal leading-relaxed">
            EXODIA es un observatorio personal que unifica matemáticas puras,
            física computacional, estructuras de código y cartografía epistémica.
            Un territorio de trabajo sin ruido, diseñado para explorar las leyes
            fundamentales de la información.
          </p>

          {/* Actions Block */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            {/* Primary CTA */}
            <button
              onClick={onOpenOperations}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-mono font-medium tracking-wide text-[#05070d] bg-[#5ee7f7] rounded-xl hover:bg-[#7ef0fd] hover:shadow-[0_0_30px_rgba(94,231,247,0.4)] transition-all transform active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ee7f7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070d]"
            >
              <span>Entrar al centro de operaciones</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Secondary CTA */}
            <button
              onClick={onExploreModules}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-medium text-[#e6ecfa] glass-panel-subtle rounded-xl hover:bg-[#0b1124]/90 hover:border-[#5ee7f7]/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ee7f7]"
            >
              <Compass className="w-4 h-4 text-[#5ee7f7]" />
              <span>Explorar los módulos</span>
            </button>
          </div>

          {/* Scientific Disciplinary Tags (Unboxed text with separators, ZERO pills) */}
          <div className="mt-12 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#8d98b8]">
            <span className="text-[#e6ecfa] font-medium">Disciplinas integradas:</span>
            <span>Matemática Simbólica</span>
            <span aria-hidden="true" className="text-[#8d98b8]/40">·</span>
            <span>Física Cuántica y Mecánica</span>
            <span aria-hidden="true" className="text-[#8d98b8]/40">·</span>
            <span>Grafos Epistémicos</span>
            <span aria-hidden="true" className="text-[#8d98b8]/40">·</span>
            <span>LaTeX & Markdown</span>
            <span aria-hidden="true" className="text-[#8d98b8]/40">·</span>
            <span>Cálculo Vectorial</span>
          </div>
        </div>

        {/* Right Asymmetric Float: Space Coordinates & Planetary Orbital Readout (Lightweight glass HUD instrument) */}
        <div className="lg:col-span-4 flex flex-col justify-end lg:items-end z-10">
          <div className="p-6 rounded-2xl glass-panel max-w-sm w-full border border-[#8ca0dc]/15 shadow-2xl relative">
            <div className="flex items-center justify-between text-xs font-mono text-[#8d98b8] mb-4 pb-3 border-b border-[#8ca0dc]/10">
              <span className="text-[#5ee7f7]">VECTOR CELESTE EX-01</span>
              <span className="tabular-nums">ORB. 104° AZ</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center text-[#8d98b8]">
                <span>Masa computacional</span>
                <span className="text-[#e6ecfa] font-medium tabular-nums">1.989 × 10³⁰ kg eq.</span>
              </div>
              <div className="flex justify-between items-center text-[#8d98b8]">
                <span>Inclinación orbital</span>
                <span className="text-[#e6ecfa] font-medium tabular-nums">23.44° rad</span>
              </div>
              <div className="flex justify-between items-center text-[#8d98b8]">
                <span>Constelación de datos</span>
                <span className="text-[#5ee7f7] font-medium">7 Módulos Sincrónicos</span>
              </div>
              <div className="flex justify-between items-center text-[#8d98b8]">
                <span>Estado de persistencia</span>
                <span className="text-[#e6ecfa] font-medium">Local First / Cifrado</span>
              </div>
            </div>

            {/* Micro scientific diagram preview */}
            <div className="mt-5 pt-4 border-t border-[#8ca0dc]/10 flex items-center justify-between text-[11px] font-mono text-[#8d98b8]">
              <span>VECTOR GRAVITACIONAL</span>
              <span className="text-[#8b7cf6]">ψ(r, θ, φ)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Invariant Ribbon: Physical Constants (Quiet, precise) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-[#8ca0dc]/10 font-mono text-xs">
        <div>
          <div className="text-[#8d98b8] text-[11px] mb-1">VELOCIDAD LUZ (c)</div>
          <div className="text-[#e6ecfa] font-semibold tabular-nums">299,792,458 m/s</div>
        </div>
        <div>
          <div className="text-[#8d98b8] text-[11px] mb-1">CONSTANTE REDUCIDA (ħ)</div>
          <div className="text-[#e6ecfa] font-semibold tabular-nums">1.054571 × 10⁻³⁴ J·s</div>
        </div>
        <div>
          <div className="text-[#8d98b8] text-[11px] mb-1">GRAVITACIÓN (G)</div>
          <div className="text-[#e6ecfa] font-semibold tabular-nums">6.67430 × 10⁻¹¹ m³·kg⁻¹·s⁻²</div>
        </div>
        <div>
          <div className="text-[#8d98b8] text-[11px] mb-1">BOLTZMANN (k_B)</div>
          <div className="text-[#e6ecfa] font-semibold tabular-nums">1.380649 × 10⁻²³ J/K</div>
        </div>
      </div>
    </section>
  );
};
