import React, { useState } from 'react';
import { Download, Smartphone, X, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { IOSInstallGuideModal } from './IOSInstallGuideModal';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  // Se já estiver rodando em tela cheia como PWA instalado, não mostra botões de instalação
  if (isInstalled) {
    return null;
  }

  // Banner variant (ideal para a página inicial em dispositivos móveis)
  if (variant === 'banner') {
    if (dismissedBanner) return null;

    if (isIOS) {
      return (
        <>
          <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 text-white p-3.5 rounded-2xl shadow-sm border border-emerald-700/60 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="p-2 bg-emerald-700/80 rounded-xl shrink-0">
                <Smartphone className="w-5 h-5 text-emerald-200" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-xs sm:text-sm text-emerald-50 leading-tight">
                  Usar como App no iPhone
                </p>
                <p className="text-[11px] text-emerald-200 truncate mt-0.5">
                  Adicione à Tela de Início para usar em tela cheia sem barras.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowIOSModal(true)}
                className="bg-white text-emerald-900 hover:bg-emerald-50 font-black text-xs py-1.5 px-3 rounded-xl shadow-xs transition"
              >
                Instalar
              </button>
              <button
                onClick={() => setDismissedBanner(true)}
                className="p-1 text-emerald-300 hover:text-white rounded-lg"
                title="Fechar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <IOSInstallGuideModal
            isOpen={showIOSModal}
            onClose={() => setShowIOSModal(false)}
          />
        </>
      );
    }

    if (isInstallable) {
      return (
        <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 text-white p-3.5 rounded-2xl shadow-sm border border-emerald-700/60 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="p-2 bg-emerald-700/80 rounded-xl shrink-0">
              <Download className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs sm:text-sm text-emerald-50 leading-tight">
                Instalar Pallet Fácil
              </p>
              <p className="text-[11px] text-emerald-200 truncate mt-0.5">
                Acesse direto da sua tela inicial offline.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={install}
              className="bg-white text-emerald-900 hover:bg-emerald-50 font-black text-xs py-1.5 px-3 rounded-xl shadow-xs transition"
            >
              Instalar
            </button>
            <button
              onClick={() => setDismissedBanner(true)}
              className="p-1 text-emerald-300 hover:text-white rounded-lg"
              title="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    return null;
  }

  // Header / Compact button variant
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSModal(true)}
          className="inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-emerald-100 text-xs font-bold py-1 px-2.5 rounded-lg shadow-xs transition"
          title="Como instalar no iPhone ou iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-300" />
          <span className="hidden sm:inline">Instalar no iOS</span>
          <span className="sm:hidden">App iOS</span>
        </button>

        <IOSInstallGuideModal
          isOpen={showIOSModal}
          onClose={() => setShowIOSModal(false)}
        />
      </>
    );
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-emerald-100 text-xs font-bold py-1 px-2.5 rounded-lg shadow-xs transition"
        title="Instalar aplicativo no dispositivo"
      >
        <Download className="w-3.5 h-3.5 text-emerald-300" />
        <span>Instalar App</span>
      </button>
    );
  }

  return null;
};
