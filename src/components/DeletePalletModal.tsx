import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Layers, Package } from 'lucide-react';
import { Pallet, PalletStock } from '../types';
import { deletePallet } from '../services/palletService';
import { User } from 'firebase/auth';

interface DeletePalletModalProps {
  pallet: Pallet | null;
  palletStocks: PalletStock[];
  currentUser: User | null;
  onClose: () => void;
  onSuccess: (palletCode: string) => void;
}

export const DeletePalletModal: React.FC<DeletePalletModalProps> = ({
  pallet,
  palletStocks,
  currentUser,
  onClose,
  onSuccess,
}) => {
  if (!pallet) return null;

  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter items in this pallet
  const itemsInPallet = palletStocks.filter(
    (s) => (s.palletId === pallet.id || s.palletCode === pallet.code) && s.quantity > 0
  );
  const hasItems = itemsInPallet.length > 0;
  const totalVolume = itemsInPallet.reduce((sum, item) => sum + item.quantity, 0);

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deletePallet({
        palletId: pallet.id,
        palletCode: pallet.code,
        reason: reason.trim() || `Exclusão do Pallet ${pallet.code} por completo`,
        userEmail: currentUser?.email || 'Operador',
        userId: currentUser?.uid || '',
      });

      onSuccess(pallet.code);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao excluir o pallet.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-red-700 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-red-800 rounded-xl">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">Excluir Pallet Inteiro</h3>
              <p className="text-xs text-red-200 font-mono">Pallet {pallet.code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-red-200 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* Pallet Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-start space-x-3">
            <div className="bg-emerald-100 text-emerald-900 font-mono font-black text-lg px-2.5 py-1 rounded-xl">
              {pallet.code}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs text-slate-500 font-medium block">
                {pallet.location ? pallet.location : 'Sem localização física cadastrada'}
              </span>
              <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                {hasItems ? `${itemsInPallet.length} produto(s) armazenado(s)` : 'Pallet vazio'}
              </span>
            </div>
          </div>

          {/* Warning if pallet has products */}
          {hasItems ? (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-2.5 text-xs text-amber-950">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Atenção: Este pallet contém produtos armazenados!</span>
              </div>
              <p className="leading-relaxed">
                Total de <strong>{totalVolume} itens</strong> divididos em{' '}
                <strong>{itemsInPallet.length} produto(s)</strong>:
              </p>

              {/* Items List */}
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {itemsInPallet.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-white border border-amber-200 p-2 rounded-xl text-[11px]"
                  >
                    <span className="font-semibold text-slate-800 truncate mr-2">
                      {item.productName}
                    </span>
                    <span className="font-bold text-amber-900 shrink-0 font-mono">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-amber-800 pt-1 border-t border-amber-200">
                Ao excluir o pallet por completo, todos esses itens serão baixados e o histórico
                de auditoria será registrado permanentemente.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Motivo da exclusão (opcional):
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Pallet danificado, descarte, reestruturação..."
                  className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs text-slate-800"
                />
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 space-y-1">
              <p className="font-bold text-slate-900">
                Tem certeza que deseja excluir o Pallet {pallet.code}?
              </p>
              <p className="text-[11px] text-slate-500">
                Este pallet está vazio. A exclusão removerá o endereço do armazém.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition text-center"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-xs transition disabled:opacity-50 text-center active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão do Pallet'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
