import React, { useState, useEffect } from 'react';
import { Menu, X, ArrowUpRight } from 'lucide-react';

interface NavigationProps {
  onOpenOperations: () => void;
  onOpenAccount: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  onOpenOperations,
  onOpenAccount,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Inicio', href: '#inicio' },
    { label: 'Módulos', href: '#modulos' },
    { label: 'Arquitectura', href: '#arquitectura' },
    { label: 'Invariantes', href: '#invariantes' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled ? 'py-3' : 'py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Navegación principal"
          className="flex items-center justify-between gap-2 md:gap-8 px-3 sm:px-6 py-3.5 rounded-2xl glass-panel shadow-2xl transition-all"
        >
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#inicio"
            className="text-sm md:text-base font-bold font-mono tracking-[0.16em] md:tracking-[0.28em] text-[#e6ecfa] hover:text-[#5ee7f7] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ee7f7]"
          >
            EXODIA
          </a>

          {/* Zone 2: 4-5 clean single-line text navigation links */}
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-[#8d98b8]">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="hover:text-[#e6ecfa] transition-colors whitespace-nowrap shrink-0 relative py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ee7f7] rounded-sm"
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={onOpenAccount}
              className="text-sm text-[#8d98b8] hover:text-[#e6ecfa] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ee7f7] rounded-sm"
            >
              Acceso
            </button>
          </div>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenOperations}
              className="group relative hidden sm:inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-[10px] sm:text-xs font-mono font-medium tracking-wide text-[#05070d] bg-[#5ee7f7] rounded-lg hover:bg-[#7ef0fd] hover:shadow-[0_0_20px_rgba(94,231,247,0.35)] transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ee7f7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070d]"
            >
              <span>Centro de operaciones</span>
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[#8d98b8] hover:text-[#e6ecfa] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ee7f7]"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden max-w-7xl mx-auto px-4 mt-2">
          <div className="p-5 rounded-2xl glass-panel-elevated flex flex-col gap-4 text-sm font-medium border border-[#8ca0dc]/20 animate-in fade-in slide-in-from-top-2 duration-200">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#8d98b8] hover:text-[#5ee7f7] py-2 transition-colors border-b border-[#8ca0dc]/10 last:border-none"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAccount();
                }}
                className="w-full text-left py-2 text-sm text-[#8d98b8] hover:text-[#e6ecfa]"
              >
                Iniciar sesión / Cuenta
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenOperations();
                }}
                className="w-full py-2.5 text-xs font-mono font-medium tracking-wide text-[#05070d] bg-[#5ee7f7] rounded-lg text-center"
              >
                Entrar al centro de operaciones
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
