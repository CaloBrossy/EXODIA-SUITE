import React, { useState, useEffect } from 'react';
import { X, Cloud } from 'lucide-react';

interface ContextualAccountInviteProps {
  onOpenAccountModal: () => void;
}

export const ContextualAccountInvite: React.FC<ContextualAccountInviteProps> = ({
  onOpenAccountModal,
}) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem('exodia_invite_dismissed');
    if (isDismissed) {
      setDismissed(true);
      return;
    }

    // Delay appearance so it never blocks the hero or feels intrusive
    const timer = setTimeout(() => {
      setVisible(true);
    }, 7000); // 7 seconds dwell time

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem('exodia_invite_dismissed', 'true');
  };

  if (!visible || dismissed) return null;

  return (
    <aside
      aria-label="Invitación de sincronización"
      className="fixed bottom-6 right-6 z-30 max-w-sm w-full mx-4 sm:mx-0 animate-in fade-in slide-in-from-bottom-5 duration-500"
    >
      <div className="p-5 rounded-2xl glass-panel-elevated border border-[#8ca0dc]/20 shadow-2xl relative">
        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 text-[#8d98b8] hover:text-[#e6ecfa] transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5ee7f7]"
          aria-label="Descartar invitación"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Kicker */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-[#5ee7f7] tracking-wider uppercase mb-2">
          <Cloud className="w-3.5 h-3.5" />
          <span>Sincronización Orbital</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-[#e6ecfa] mb-1.5 pr-6">
          Respaldá tu observatorio personal
        </h3>

        {/* Real Value Proposition */}
        <p className="text-xs text-[#8d98b8] leading-relaxed mb-4">
          Conectá tus cuadernos LaTeX, grafos epistémicos y cálculos del Workbench
          entre dispositivos con cifrado local de extremo a extremo.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              handleDismiss();
              onOpenAccountModal();
            }}
            className="flex-1 py-2 px-3 text-xs font-mono font-medium text-[#05070d] bg-[#5ee7f7] rounded-lg hover:bg-[#7ef0fd] transition-colors text-center"
          >
            Configurar sincronización
          </button>
          <button
            onClick={handleDismiss}
            className="py-2 px-3 text-xs font-mono text-[#8d98b8] hover:text-[#e6ecfa] transition-colors"
          >
            Ahora no
          </button>
        </div>
      </div>
    </aside>
  );
};
