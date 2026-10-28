import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="relative z-10 border-t border-[#8ca0dc]/10 bg-[#05070d]/80 py-12 px-4 sm:px-6 lg:px-8 text-xs font-mono text-[#8d98b8]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand & Mission Statement */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-center">
          <span className="font-bold tracking-[0.25em] text-[#e6ecfa]">EXODIA</span>
          <span aria-hidden="true" className="text-[#8d98b8]/40">·</span>
          <span>OBSERVATORIO PERSONAL DE CONOCIMIENTO</span>
        </div>

        {/* Quiet Navigation Mirror */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a href="#inicio" className="hover:text-[#e6ecfa] transition-colors">
            Inicio
          </a>
          <a href="#modulos" className="hover:text-[#e6ecfa] transition-colors">
            Módulos
          </a>
          <a href="#arquitectura" className="hover:text-[#e6ecfa] transition-colors">
            Arquitectura
          </a>
          <a href="#invariantes" className="hover:text-[#e6ecfa] transition-colors">
            Invariantes
          </a>
        </div>

        {/* Telemetry & Privacy notice */}
        <div className="text-[#8d98b8]/70">
          <span>LOCAL-FIRST · SIN TELEMETRÍA INVASIVA · 2026</span>
        </div>
      </div>
    </footer>
  );
};
