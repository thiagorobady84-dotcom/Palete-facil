import React from 'react';
import { Share, PlusSquare, X, Smartphone, Sparkles, Check, ArrowUpRight } from 'lucide-react';

interface IOSInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IOSInstallGuideModal: React.FC<IOSInstallGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-emerald-800 text-white p-5 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-700 rounded-2xl shadow-inner border border-emerald-600">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-lg text-white">Instalar no iPhone / iPad</h3>
                <span className="bg-emerald-600 text-emerald-100 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  iOS
                </span>
              </div>
              <p className="text-xs text-emerald-200 mt-0.5">
                Adicione à Tela de Início como um App Nativo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-emerald-200 hover:text-white rounded-full transition"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content & Steps */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Instalando na Tela de Início, o <strong>Pallet Fácil</strong> funciona em{' '}
              <strong>tela cheia</strong>, sem a barra de endereços do Safari, ficando muito mais rápido
              para o uso diário no armazém.
            </p>
          </div>

          <div className="space-y-3">
            {/* Step 1 */}
            <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="w-8 h-8 bg-blue-600 text-white font-black text-xs rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                1
              </div>
              <div className="text-xs text-slate-800 flex-1">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  Toque no botão Compartilhar
                  <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 border border-blue-200 p-1 rounded-lg">
                    <Share className="w-3.5 h-3.5" />
                  </span>
                </p>
                <p className="text-slate-500 mt-0.5">
                  Fica na barra inferior do Safari no iPhone (ou no topo no iPad).
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="w-8 h-8 bg-emerald-600 text-white font-black text-xs rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                2
              </div>
              <div className="text-xs text-slate-800 flex-1">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  Toque em "Adicionar à Tela de Início"
                  <span className="inline-flex items-center justify-center bg-slate-200 text-slate-800 p-1 rounded-lg">
                    <PlusSquare className="w-3.5 h-3.5" />
                  </span>
                </p>
                <p className="text-slate-500 mt-0.5">
                  Role a lista de opções para baixo até encontrar essa ação.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="w-8 h-8 bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                3
              </div>
              <div className="text-xs text-slate-800 flex-1">
                <p className="font-bold text-slate-900 text-sm">
                  Toque em "Adicionar" no topo
                </p>
                <p className="text-slate-500 mt-0.5">
                  Confirme no canto superior direito para criar o ícone verde na sua tela.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-400">
            Dica: Se estiver usando o Chrome no iOS, abra este link no <strong>Safari</strong> para
            adicionar à Tela de Início.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs py-3 px-6 rounded-xl shadow-xs transition"
          >
            Entendido, vou adicionar!
          </button>
        </div>
      </div>
    </div>
  );
};
