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
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { Pallet, PalletStock } from '../types';
import {
  updatePalletLocation,
  deletePallet,
  deleteStockItemFromPallet,
  withdrawStock,
  updateStockExpirationDate,
} from '../services/palletService';
import { getExpirationInfo } from '../utils/date';
import { User } from 'firebase/auth';
import { DeletePalletModal } from './DeletePalletModal';
import { QuickWithdrawModal } from './QuickWithdrawModal';

interface PalletDetailModalProps {
  pallet: Pallet | null;
  palletStocks: PalletStock[];
  currentUser?: User | null;
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
  currentUser,
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

  // State for direct item write-off (dar baixa) and instant quick subtraction
  const [stockItemToWithdraw, setStockItemToWithdraw] = useState<PalletStock | null>(null);
  const [processingSubtractId, setProcessingSubtractId] = useState<string | null>(null);
  const [withdrawSuccessToast, setWithdrawSuccessToast] = useState<string | null>(null);

  // State for optional expiration date inline editing
  const [editingExpiryStockId, setEditingExpiryStockId] = useState<string | null>(null);
  const [editingExpiryValue, setEditingExpiryValue] = useState<string>('');
  const [savingExpiry, setSavingExpiry] = useState(false);

  // State to confirm deleting a single stock item from this pallet
  const [stockItemToDelete, setStockItemToDelete] = useState<PalletStock | null>(null);
  const [deleteItemReason, setDeleteItemReason] = useState('');
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // State to confirm deleting the ENTIRE pallet
  const [showDeleteEntirePalletModal, setShowDeleteEntirePalletModal] = useState(false);

  // Filter items in this pallet with safe numeric parsing
  const itemsInPallet = palletStocks.filter(
    (s) => (s.palletId === pallet.id || s.palletCode === pallet.code) && (Number(s.quantity) || 0) > 0
  );

  const totalItemsCount = itemsInPallet.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

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

  const handleConfirmDeleteItemFromPallet = async () => {
    if (!stockItemToDelete) return;
    setIsDeletingItem(true);
    setDeleteError(null);
    try {
      await deleteStockItemFromPallet({
        stockId: stockItemToDelete.id,
        reason: deleteItemReason.trim() || `Item excluído do Pallet ${pallet.code}`,
        userEmail: currentUser?.email || 'Operador',
        userId: currentUser?.uid || '',
      });
      setStockItemToDelete(null);
      setDeleteItemReason('');
    } catch (err: any) {
      setDeleteError(err.message || 'Erro ao remover item do pallet.');
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleQuickSubtract = async (item: PalletStock, delta: number) => {
    const currentQty = Number(item.quantity) || 0;
    if (delta <= 0 || delta > currentQty || processingSubtractId === item.id) return;

    setProcessingSubtractId(item.id);
    setDeleteError(null);
    try {
      await withdrawStock({
        stockId: item.id,
        quantityToWithdraw: delta,
        reason: `Subtração rápida (-${delta}) ao retirar do Pallet ${pallet.code}`,
        userEmail: currentUser?.email || 'Operador',
        userId: currentUser?.uid || '',
      });

      const remaining = currentQty - delta;
      setWithdrawSuccessToast(
        remaining <= 0
          ? `-${delta} ${item.unit} de "${item.productName}". Item zerado e removido do ${pallet.code}.`
          : `-${delta} ${item.unit} de "${item.productName}". Restam ${remaining} ${item.unit}.`
      );
      setTimeout(() => setWithdrawSuccessToast(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Erro ao subtrair item do pallet.');
    } finally {
      setProcessingSubtractId(null);
    }
  };

  const handleSaveExpiry = async (item: PalletStock, newDate: string) => {
    setSavingExpiry(true);
    setDeleteError(null);
    try {
      await updateStockExpirationDate({
        stockId: item.id,
        productId: item.productId,
        expirationDate: newDate,
      });
      setEditingExpiryStockId(null);
      setWithdrawSuccessToast(
        newDate
          ? `Validade atualizada para ${getExpirationInfo(newDate).formattedDate}.`
          : `Validade removida de "${item.productName}".`
      );
      setTimeout(() => setWithdrawSuccessToast(null), 3500);
    } catch (err: any) {
      setDeleteError(err.message || 'Erro ao atualizar validade.');
    } finally {
      setSavingExpiry(false);
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

        {/* Inline Sub-Modal: Confirm Deleting Item from this Pallet */}
        {stockItemToDelete && (
          <div className="mx-4 mt-3 p-4 bg-red-50 border-2 border-red-300 rounded-2xl space-y-2.5 text-xs text-red-950 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="font-black text-red-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Remover item do Pallet {pallet.code}
              </span>
              <button
                onClick={() => setStockItemToDelete(null)}
                className="text-red-700 hover:text-red-900 font-bold"
              >
                ✕
              </button>
            </div>
            <p>
              Deseja realmente remover <strong>{stockItemToDelete.quantity} {stockItemToDelete.unit}</strong> de{' '}
              <strong>"{stockItemToDelete.productName}"</strong> deste pallet?
            </p>
            <input
              type="text"
              value={deleteItemReason}
              onChange={(e) => setDeleteItemReason(e.target.value)}
              placeholder="Motivo (ex: Lançamento duplicado, produto avariado...)"
              className="w-full bg-white border border-red-300 rounded-xl px-3 py-1.5 text-xs text-slate-800"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStockItemToDelete(null)}
                className="px-3 py-1 text-slate-600 font-bold hover:bg-red-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteItemFromPallet}
                disabled={isDeletingItem}
                className="bg-red-600 hover:bg-red-700 text-white font-black px-4 py-1.5 rounded-lg shadow-xs flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingItem ? 'Removendo...' : 'Confirmar Remoção'}</span>
              </button>
            </div>
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
            <div className="space-y-3">
              {itemsInPallet.map((item) => {
                const expInfo = getExpirationInfo(item.expirationDate);
                const isEditingExp = editingExpiryStockId === item.id;
                const isSubtracting = processingSubtractId === item.id;
                const itemQty = Number(item.quantity) || 0;

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs hover:border-emerald-300 transition space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                          {item.productName}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] text-slate-500">
                          {expInfo.status !== 'none' ? (
                            <span
                              className={`inline-flex items-center gap-1 font-bold ${
                                expInfo.status === 'expired'
                                  ? 'text-red-700'
                                  : expInfo.status === 'expiring_soon'
                                  ? 'text-amber-700'
                                  : 'text-slate-600'
                              }`}
                            >
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span>
                                Val: {expInfo.formattedDate}
                                {(expInfo.status === 'expired' || expInfo.status === 'expiring_soon') &&
                                  ` · ${expInfo.statusLabel}`}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingExpiryStockId(isEditingExp ? null : item.id);
                                  setEditingExpiryValue(item.expirationDate || '');
                                }}
                                className="ml-1 text-emerald-700 hover:underline font-semibold"
                              >
                                Editar
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingExpiryStockId(isEditingExp ? null : item.id);
                                setEditingExpiryValue('');
                              }}
                              className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-700 font-semibold transition"
                            >
                              <Calendar className="w-3 h-3" />
                              <span>+ Validade (opcional)</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-lg font-black text-emerald-800 tabular-nums">
                          {itemQty}
                        </span>
                        <span className="text-xs text-slate-600 font-semibold block -mt-1">
                          {item.unit}
                        </span>
                      </div>
                    </div>

                    {/* Inline Optional Expiration Date Editor */}
                    {isEditingExp && (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          value={editingExpiryValue}
                          onChange={(e) => setEditingExpiryValue(e.target.value)}
                          className="flex-1 min-w-[140px] bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                        />
                        <button
                          type="button"
                          disabled={savingExpiry}
                          onClick={() => handleSaveExpiry(item, editingExpiryValue)}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                        >
                          {savingExpiry ? 'Salvando...' : 'Salvar'}
                        </button>
                        {item.expirationDate && (
                          <button
                            type="button"
                            disabled={savingExpiry}
                            onClick={() => handleSaveExpiry(item, '')}
                            className="text-xs font-bold text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition"
                          >
                            Remover
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingExpiryStockId(null)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1.5"
                        >
                          Fechar
                        </button>
                      </div>
                    )}

                    {/* Subtração Rápida ao tirar do pallet */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500">
                        Tirar do pallet:
                      </span>
                      <div className="flex items-center gap-1.5 flex-1 justify-end">
                        <button
                          type="button"
                          disabled={isSubtracting || itemQty < 1}
                          onClick={() => handleQuickSubtract(item, 1)}
                          className="min-h-[40px] min-w-[44px] px-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-black text-sm rounded-xl shadow-2xs transition active:scale-95 disabled:opacity-50 tabular-nums"
                          title="Subtrair 1 imediatamente"
                        >
                          {isSubtracting ? '...' : '-1'}
                        </button>

                        {itemQty >= 2 && (
                          <button
                            type="button"
                            disabled={isSubtracting}
                            onClick={() => handleQuickSubtract(item, 2)}
                            className="min-h-[40px] min-w-[44px] px-2.5 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-900 border border-amber-300 font-black text-sm rounded-xl transition active:scale-95 disabled:opacity-50 tabular-nums"
                            title="Subtrair 2 imediatamente"
                          >
                            -2
                          </button>
                        )}

                        {itemQty >= 5 && (
                          <button
                            type="button"
                            disabled={isSubtracting}
                            onClick={() => handleQuickSubtract(item, 5)}
                            className="min-h-[40px] min-w-[44px] px-2.5 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-900 border border-amber-300 font-black text-sm rounded-xl transition active:scale-95 disabled:opacity-50 tabular-nums"
                            title="Subtrair 5 imediatamente"
                          >
                            -5
                          </button>
                        )}

                        {itemQty >= 10 && (
                          <button
                            type="button"
                            disabled={isSubtracting}
                            onClick={() => handleQuickSubtract(item, 10)}
                            className="min-h-[40px] min-w-[52px] px-3 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-900 border border-amber-300 font-black text-sm rounded-xl transition active:scale-95 disabled:opacity-50 tabular-nums"
                            title="Subtrair 10 imediatamente"
                          >
                            -10
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setStockItemToWithdraw(item)}
                          className="min-h-[40px] inline-flex items-center justify-center gap-1 text-xs font-bold bg-slate-100 hover:bg-amber-50 text-slate-800 hover:text-amber-900 border border-slate-200 px-3 rounded-xl transition active:scale-95 whitespace-nowrap"
                          title="Escolher quantidade personalizada ou retirar tudo"
                        >
                          <MinusCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Outro</span>
                        </button>
                      </div>
                    </div>

                    {/* Actions for this specific product in this pallet */}
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-1.5 w-full">
                      <button
                        onClick={() => {
                          onClose();
                          onTransferStock(item);
                        }}
                        className="min-h-[40px] inline-flex items-center justify-center gap-1 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200 py-2 px-2 rounded-xl transition active:scale-95"
                        title="Transferir para outro pallet"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                        <span>Transferir</span>
                      </button>

                      <button
                        onClick={() => {
                          onClose();
                          onAdjustStock(item);
                        }}
                        className="min-h-[40px] inline-flex items-center justify-center gap-1 text-xs font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 active:bg-purple-200 py-2 px-2 rounded-xl transition active:scale-95"
                        title="Ajuste manual com motivo"
                      >
                        <Sliders className="w-3.5 h-3.5 shrink-0" />
                        <span>Ajustar</span>
                      </button>

                      {/* Direct item delete/removal button from this pallet */}
                      <button
                        onClick={() => setStockItemToDelete(item)}
                        className="min-h-[40px] inline-flex items-center justify-center gap-1 text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 active:bg-red-200 py-2 px-2 rounded-xl transition active:scale-95"
                        title="Remover/desalocar este item deste pallet"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-2.5">
          <button
            onClick={() => setShowDeleteEntirePalletModal(true)}
            disabled={isDeleting}
            className="w-full sm:w-auto justify-center text-xs font-bold text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 py-2.5 px-3.5 rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-2xs"
            title={`Excluir o Pallet ${pallet.code} inteiro`}
          >
            <Trash2 className="w-4 h-4 text-red-600 shrink-0" />
            <span>Excluir Pallet Inteiro</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onAddProductToPallet(pallet);
            }}
            className="w-full sm:w-auto justify-center inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition active:scale-95"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Adicionar Produto</span>
          </button>
        </div>
      </div>

      {/* Modal Dedicado para Exclusão Completa do Pallet */}
      {showDeleteEntirePalletModal && (
        <DeletePalletModal
          pallet={pallet}
          palletStocks={palletStocks}
          currentUser={currentUser || null}
          onClose={() => setShowDeleteEntirePalletModal(false)}
          onSuccess={() => {
            if (onPalletDeleted) onPalletDeleted();
            onClose();
          }}
        />
      )}

      {/* Modal Dedicado para Baixa Direta de Estoque */}
      {stockItemToWithdraw && (
        <QuickWithdrawModal
          stock={stockItemToWithdraw}
          currentUser={currentUser || null}
          onClose={() => setStockItemToWithdraw(null)}
          onSuccess={(qty, remaining, unit, prodName) => {
            setStockItemToWithdraw(null);
            setWithdrawSuccessToast(
              remaining === 0
                ? `Baixa de ${qty} ${unit} concluída. "${prodName}" zerado e removido do Pallet ${pallet.code}.`
                : `Baixa de ${qty} ${unit} concluída. Saldo restante: ${remaining} ${unit}.`
            );
            setTimeout(() => setWithdrawSuccessToast(null), 5000);
          }}
        />
      )}

      {/* Toast Notification for Quick Baixa */}
      {withdrawSuccessToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-70 bg-emerald-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold border border-emerald-500 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{withdrawSuccessToast}</span>
        </div>
      )}
    </div>
  );
};
