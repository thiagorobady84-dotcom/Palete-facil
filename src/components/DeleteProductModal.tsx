import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Check, Package, Layers } from 'lucide-react';
import { Product, PalletStock } from '../types';
import { deleteProductFromCatalog } from '../services/palletService';
import { User } from 'firebase/auth';

interface DeleteProductModalProps {
  product: Product | null;
  stocks: PalletStock[];
  currentUser: User | null;
  onClose: () => void;
  onSuccess: (productName: string) => void;
}

export const DeleteProductModal: React.FC<DeleteProductModalProps> = ({
  product,
  stocks,
  currentUser,
  onClose,
  onSuccess,
}) => {
  if (!product) return null;

  const [confirmWithStock, setConfirmWithStock] = useState(false);
  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active stocks with quantity > 0
  const activeStocks = stocks.filter((s) => s.productId === product.id && s.quantity > 0);
  const hasActiveStock = activeStocks.length > 0;
  const totalQty = activeStocks.reduce((sum, s) => sum + s.quantity, 0);

  const handleDelete = async () => {
    if (hasActiveStock && !confirmWithStock) {
      setErrorMessage(
        'Marque a confirmação para remover o saldo ativo dos pallets antes de excluir.'
      );
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteProductFromCatalog({
        productId: product.id,
        productName: product.name,
        removeActiveStocks: hasActiveStock ? true : false,
        reason: reason.trim() || (hasActiveStock ? 'Exclusão do produto com baixa do estoque' : 'Exclusão do catálogo'),
        userEmail: currentUser?.email || 'Operador',
        userId: currentUser?.uid || '',
      });

      onSuccess(product.name);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao excluir o produto.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-red-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-red-800 rounded-xl">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">Excluir Produto</h3>
              <p className="text-xs text-red-200">Remoção do catálogo</p>
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

          {/* Product Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-start space-x-3">
            <Package className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-900 text-sm">{product.name}</h4>
            </div>
          </div>

          {/* Active Stock Warning */}
          {hasActiveStock ? (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-2.5 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Este produto possui saldo ativo no armazém!</span>
              </div>
              <p className="leading-relaxed">
                Total de <strong>{totalQty} itens</strong> armazenados em{' '}
                <strong>{activeStocks.length} pallet(s)</strong>:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeStocks.map((s) => (
                  <span
                    key={s.id}
                    className="bg-white border border-amber-300 px-2.5 py-1 rounded-lg text-slate-800 font-medium font-mono text-[11px]"
                  >
                    {s.palletCode}: <strong>{s.quantity} {s.unit}</strong>
                  </span>
                ))}
              </div>

              <div className="pt-2 border-t border-amber-200">
                <label className="flex items-start gap-2 cursor-pointer font-bold text-slate-900">
                  <input
                    type="checkbox"
                    checked={confirmWithStock}
                    onChange={(e) => setConfirmWithStock(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-red-600 rounded focus:ring-red-500"
                  />
                  <span>
                    Confirmar a baixa completa do saldo e remover dos pallets com registro de auditoria no histórico
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Motivo da exclusão (opcional):
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Cadastro duplicado, produto descontinuado..."
                  className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs text-slate-800"
                />
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
              <p className="font-semibold">
                ✓ Este produto está com <strong>saldo zerado</strong> (sem produtos físicos nos pallets).
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                A exclusão removerá o item do catálogo, preservando o histórico de movimentações anteriores.
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
            disabled={isDeleting || (hasActiveStock && !confirmWithStock)}
            className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-xs transition disabled:opacity-50 text-center active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
