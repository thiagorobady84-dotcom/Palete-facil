import React, { useState } from 'react';
import {
  X,
  Layers,
  MapPin,
  Edit2,
  Check,
  PlusCircle,
  ArrowLeftRight,
  MinusCircle,
  Sliders,
  Trash2,
  Package,
  AlertCircle,
} from 'lucide-react';
import { Pallet, PalletStock } from '../types';
import { updatePalletLocation, deletePallet } from '../services/palletService';

interface PalletDetailModalProps {
  pallet: Pallet | null;
  palletStocks: PalletStock[];
  onClose: () => void;
  onAddProductToPallet: (pallet: Pallet) => void;
  onTransferStock: (stock: PalletStock) => void;
  onWithdrawStock: (stock: PalletStock) => void;
  onAdjustStock: (stock: PalletStock) => void;
  onPalletDeleted?: () => void;
}

export const PalletDetailModal: React.FC<PalletDetailModalProps> = ({
  pallet,
  palletStocks,
  onClose,
  onAddProductToPallet,
  onTransferStock,
  onWithdrawStock,
  onAdjustStock,
  onPalletDeleted,
}) => {
  if (!pallet) return null;

  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState(pallet.location || '');
  const [savingLocation, setSavingLocation] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter items in this pallet
  const itemsInPallet = palletStocks.filter(
    (s) => (s.palletId === pallet.id || s.palletCode === pallet.code) && s.quantity > 0
  );

  const totalItemsCount = itemsInPallet.reduce((sum, item) => sum + item.quantity, 0);

  const handleSaveLocation = async () => {
    setSavingLocation(true);
    try {
      await updatePalletLocation(pallet.id, newLocation);
      pallet.location = newLocation;
      setIsEditingLocation(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDeletePallet = async () => {
    if (!window.confirm(`Tem certeza que deseja excluir o Pallet ${pallet.code}?`)) {
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deletePallet(pallet.id, pallet.code);
      if (onPalletDeleted) onPalletDeleted();
      onClose();
    } catch (err: any) {
      setDeleteError(err.message || 'Erro ao excluir pallet.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-emerald-800 text-white p-5 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-700 p-2.5 rounded-2xl shadow-inner border border-emerald-600">
              <Layers className="w-7 h-7 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-white font-mono">
                  {pallet.code}
                </h2>
                <span className="bg-emerald-600 text-emerald-100 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {itemsInPallet.length} {itemsInPallet.length === 1 ? 'produto' : 'produtos'}
                </span>
              </div>
              <p className="text-xs text-emerald-200 mt-0.5">
                Conteúdo completo deste pallet
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-700 rounded-full transition"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Location bar */}
        <div className="bg-emerald-50 px-5 py-3 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-emerald-900 flex-1 mr-2">
            <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
            {isEditingLocation ? (
              <div className="flex items-center gap-1.5 w-full">
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Ex: Rua 03, Prédio B, Nível 2"
                  className="bg-white border border-emerald-300 rounded-lg px-2.5 py-1 text-xs w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveLocation}
                  disabled={savingLocation}
                  className="bg-emerald-700 text-white p-1 rounded-lg hover:bg-emerald-800"
                  title="Salvar localização"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <span className="font-semibold truncate">
                {pallet.location ? pallet.location : 'Sem localização física cadastrada'}
              </span>
            )}
          </div>

          {!isEditingLocation && (
            <button
              onClick={() => {
                setNewLocation(pallet.location || '');
                setIsEditingLocation(true);
              }}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-emerald-100 transition"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          )}
        </div>

        {/* Delete Error Notification */}
        {deleteError && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{deleteError}</span>
          </div>
        )}

        {/* Content Body: All Products in this Pallet */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Produtos Armazenados ({itemsInPallet.length})
            </span>
            <span className="text-xs text-slate-500">
              Volume total: <strong className="text-slate-800">{totalItemsCount}</strong>
            </span>
          </div>

          {itemsInPallet.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Este pallet está vazio</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Nenhum produto cadastrado no {pallet.code} no momento.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {itemsInPallet.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs hover:border-emerald-300 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                        {item.productName}
                      </h4>
                      {item.productCode && (
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          Cód: {item.productCode}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-base sm:text-lg font-black text-emerald-800">
                        {item.quantity}
                      </span>
                      <span className="text-xs text-slate-600 font-semibold block -mt-1">
                        {item.unit}
                      </span>
                    </div>
                  </div>

                  {/* Actions for this specific product in this pallet */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => {
                        onClose();
                        onTransferStock(item);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition"
                      title="Transferir para outro pallet"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Transferir</span>
                    </button>

                    <button
                      onClick={() => {
                        onClose();
                        onWithdrawStock(item);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition"
                      title="Retirar produtos deste pallet"
                    >
                      <MinusCircle className="w-3.5 h-3.5" />
                      <span>Retirar</span>
                    </button>

                    <button
                      onClick={() => {
                        onClose();
                        onAdjustStock(item);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg transition"
                      title="Ajuste manual com motivo"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Ajustar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between gap-2">
          {itemsInPallet.length === 0 ? (
            <button
              onClick={handleDeletePallet}
              disabled={isDeleting}
              className="text-xs font-bold text-red-600 hover:text-red-800 hover:bg-red-50 py-2 px-3 rounded-xl flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir Pallet Vazio</span>
            </button>
          ) : (
            <div className="text-[11px] text-slate-400">
              Pallet em uso ativo
            </div>
          )}

          <button
            onClick={() => {
              onClose();
              onAddProductToPallet(pallet);
            }}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Adicionar Produto neste Pallet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
