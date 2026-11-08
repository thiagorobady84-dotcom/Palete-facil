import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight,
  MinusCircle,
  Sliders,
  CheckCircle,
  AlertCircle,
  Layers,
  Package,
  Plus,
} from 'lucide-react';
import { Pallet, PalletStock } from '../types';
import { transferStock, withdrawStock, adjustStock, createPallet, suggestNextPalletCode } from '../services/palletService';
import { User } from 'firebase/auth';

interface MovementTabProps {
  pallets: Pallet[];
  palletStocks: PalletStock[];
  currentUser: User | null;
  initialStock?: PalletStock | null;
  initialAction?: 'transfer' | 'withdraw' | 'adjust';
  onSuccessMovement?: () => void;
}

export const MovementTab: React.FC<MovementTabProps> = ({
  pallets,
  palletStocks,
  currentUser,
  initialStock,
  initialAction = 'transfer',
  onSuccessMovement,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'transfer' | 'withdraw' | 'adjust'>(initialAction);

  // Available stocks with quantity > 0
  const activeStocks = useMemo(() => {
    return palletStocks.filter((s) => s.quantity > 0);
  }, [palletStocks]);

  // Selected stock item (contains palletId, productId, unit, current quantity)
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const currentSelectedStock = useMemo(() => {
    return activeStocks.find((s) => s.id === selectedStockId);
  }, [activeStocks, selectedStockId]);

  // Transfer specific state
  const [destPalletId, setDestPalletId] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferReason, setTransferReason] = useState<string>('');
  const [isCreatingDestPallet, setIsCreatingDestPallet] = useState(false);
  const [newDestCode, setNewDestCode] = useState('');
  const [newDestLoc, setNewDestLoc] = useState('');

  // Withdraw specific state
  const [withdrawQty, setWithdrawQty] = useState<number>(1);
  const [withdrawReason, setWithdrawReason] = useState<string>('');

  // Adjust specific state
  const [adjustNewQty, setAdjustNewQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set initial stock if passed
  useEffect(() => {
    if (initialStock) {
      setSelectedStockId(initialStock.id);
      setTransferQty(1);
      setWithdrawQty(1);
      setAdjustNewQty(initialStock.quantity);
      if (initialAction) setActiveSubTab(initialAction);
    } else if (activeStocks.length > 0 && !selectedStockId) {
      setSelectedStockId(activeStocks[0].id);
      setAdjustNewQty(activeStocks[0].quantity);
    }
  }, [initialStock, activeStocks, selectedStockId, initialAction]);

  // Keep destination pallet valid
  useEffect(() => {
    if (currentSelectedStock) {
      const otherPallets = pallets.filter((p) => p.id !== currentSelectedStock.palletId);
      if (otherPallets.length > 0 && (!destPalletId || destPalletId === currentSelectedStock.palletId)) {
        setDestPalletId(otherPallets[0].id);
      }
    }
  }, [currentSelectedStock, pallets, destPalletId]);

  // Reset notifications on tab switch
  const handleSwitchTab = (tab: 'transfer' | 'withdraw' | 'adjust') => {
    setActiveSubTab(tab);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // 1. Submit Transferência
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!currentSelectedStock) {
      setErrorMessage('Selecione um produto de origem.');
      return;
    }

    if (transferQty <= 0 || !Number.isInteger(Number(transferQty))) {
      setErrorMessage('A quantidade a transferir deve ser um número inteiro positivo.');
      return;
    }

    if (transferQty > currentSelectedStock.quantity) {
      setErrorMessage(
        `Saldo insuficiente no Pallet ${currentSelectedStock.palletCode}! Disponível: ${currentSelectedStock.quantity} ${currentSelectedStock.unit}.`
      );
      return;
    }

    let targetDestId = destPalletId;
    let targetDestCode = pallets.find((p) => p.id === targetDestId)?.code || '';

    // If creating pallet on the fly
    if (isCreatingDestPallet) {
      if (!newDestCode.trim()) {
        setErrorMessage('Informe a identificação do novo pallet de destino.');
        return;
      }
      try {
        const created = await createPallet(newDestCode, newDestLoc);
        targetDestId = created.id;
        targetDestCode = created.code;
        setIsCreatingDestPallet(false);
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao criar pallet de destino.');
        return;
      }
    }

    if (!targetDestId) {
      setErrorMessage('Selecione o pallet de destino.');
      return;
    }

    if (targetDestId === currentSelectedStock.palletId) {
      setErrorMessage('O pallet de destino deve ser diferente do pallet de origem.');
      return;
    }

    setIsSubmitting(true);
    try {
      await transferStock({
        originStockId: currentSelectedStock.id,
        destinationPalletId: targetDestId,
        destinationPalletCode: targetDestCode,
        quantityToTransfer: Number(transferQty),
        reason: transferReason.trim() || 'Transferência entre pallets',
        userEmail: currentUser?.email || 'Operador',
        userId: currentUser?.uid || '',
      });

      setSuccessMessage(
        `Transferência concluída! ${transferQty} ${currentSelectedStock.unit} transferidos de ${currentSelectedStock.palletCode} para ${targetDestCode}.`
      );
      setTransferReason('');
      setTransferQty(1);
      if (onSuccessMovement) onSuccessMovement();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao realizar transferência.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Submit Retirada
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!currentSelectedStock) {
      setErrorMessage('Selecione o produto a retirar.');
      return;
    }

    if (withdrawQty <= 0 || !Number.isInteger(Number(withdrawQty))) {
      setErrorMessage('A quantidade a retirar deve ser um número inteiro positivo.');
      return;
    }

    if (withdrawQty > currentSelectedStock.quantity) {
      setErrorMessage(
        `Saldo insuficiente no Pallet ${currentSelectedStock.palletCode}! Disponível: ${currentSelectedStock.quantity} ${currentSelectedStock.unit}.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await withdrawStock({
        stockId: currentSelectedStock.id,
        quantityToWithdraw: Number(withdrawQty),
        reason: withdrawReason.trim() || 'Retirada operacional',
        userEmail: currentUser?.email || 'Operador',
        userId: currentUser?.uid || '',
      });

      setSuccessMessage(
        `Retirada efetuada com sucesso! ${withdrawQty} ${currentSelectedStock.unit} retirados do Pallet ${currentSelectedStock.palletCode}.`
      );
      setWithdrawReason('');
      setWithdrawQty(1);
      if (onSuccessMovement) onSuccessMovement();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao realizar retirada.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Submit Ajuste Manual
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!currentSelectedStock) {
      setErrorMessage('Selecione o produto a ajustar.');
      return;
    }

    if (adjustNewQty < 0 || !Number.isInteger(Number(adjustNewQty))) {
      setErrorMessage('A nova quantidade deve ser um número inteiro maior ou igual a zero.');
      return;
    }

    if (!adjustReason.trim()) {
      setErrorMessage('É obrigatório descrever o motivo do ajuste manual (ex: Contagem de inventário, Avaria).');
      return;
    }

    if (adjustNewQty === currentSelectedStock.quantity) {
      setErrorMessage('A nova quantidade é idêntica ao saldo atual.');
      return;
    }

    setIsSubmitting(true);
    try {
      await adjustStock({
        stockId: currentSelectedStock.id,
        newQuantity: Number(adjustNewQty),
        reason: adjustReason.trim(),
        userEmail: currentUser?.email || 'Operador',
        userId: currentUser?.uid || '',
      });

      setSuccessMessage(
        `Ajuste salvo com sucesso! Saldo do Pallet ${currentSelectedStock.palletCode} atualizado para ${adjustNewQty} ${currentSelectedStock.unit}.`
      );
      setAdjustReason('');
      if (onSuccessMovement) onSuccessMovement();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao ajustar estoque.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-20">
      {/* Sub-tab navigation */}
      <div className="bg-slate-200 p-1 rounded-2xl grid grid-cols-3 gap-1">
        <button
          onClick={() => handleSwitchTab('transfer')}
          className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeSubTab === 'transfer'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>Transferência</span>
        </button>

        <button
          onClick={() => handleSwitchTab('withdraw')}
          className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeSubTab === 'withdraw'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <MinusCircle className="w-4 h-4" />
          <span>Retirada</span>
        </button>

        <button
          onClick={() => handleSwitchTab('adjust')}
          className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
            activeSubTab === 'adjust'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Ajuste</span>
        </button>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl text-emerald-900 text-sm flex items-start gap-3 shadow-xs">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{successMessage}</div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      {activeStocks.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800">Sem estoque para movimentar</h3>
          <p className="text-xs text-slate-500 mt-1">
            Não há produtos com saldo em nenhum pallet no momento. Dê entrada primeiro.
          </p>
        </div>
      ) : (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          {/* Item Selector (Pallet de Origem + Produto) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              Pallet de Origem e Produto *
            </label>
            <select
              value={selectedStockId}
              onChange={(e) => {
                setSelectedStockId(e.target.value);
                const s = activeStocks.find((item) => item.id === e.target.value);
                if (s) {
                  setAdjustNewQty(s.quantity);
                }
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            >
              {activeStocks.map((s) => (
                <option key={s.id} value={s.id}>
                  Pallet {s.palletCode} ➔ {s.productName} ({s.quantity} {s.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Current Stock Banner */}
          {currentSelectedStock && (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase block">
                  Saldo Disponível em {currentSelectedStock.palletCode}
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {currentSelectedStock.productName}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-emerald-900">
                  {currentSelectedStock.quantity}
                </span>
                <span className="text-xs text-emerald-700 font-bold block -mt-1">
                  {currentSelectedStock.unit}
                </span>
              </div>
            </div>
          )}

          {/* FORM: TRANSFERÊNCIA */}
          {activeSubTab === 'transfer' && (
            <form onSubmit={handleTransferSubmit} className="space-y-4 pt-1">
              {/* Destination Pallet */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Pallet de Destino *
                  </label>
                  {!isCreatingDestPallet && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewDestCode(suggestNextPalletCode(pallets));
                        setNewDestLoc('');
                        setIsCreatingDestPallet(true);
                      }}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Criar Novo Pallet</span>
                    </button>
                  )}
                </div>

                {isCreatingDestPallet ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-emerald-900">Criar Novo Pallet:</span>
                      <button
                        type="button"
                        onClick={() => setIsCreatingDestPallet(false)}
                        className="text-xs text-slate-500 underline"
                      >
                        Cancelar
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newDestCode}
                        onChange={(e) => setNewDestCode(e.target.value.toUpperCase())}
                        placeholder="Ex: P04"
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono"
                      />
                      <input
                        type="text"
                        value={newDestLoc}
                        onChange={(e) => setNewDestLoc(e.target.value)}
                        placeholder="Local (opcional)"
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <select
                    value={destPalletId}
                    onChange={(e) => setDestPalletId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    {pallets
                      .filter((p) => p.id !== currentSelectedStock?.palletId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          Pallet {p.code} {p.location ? `— ${p.location}` : ''}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {/* Quantity to transfer */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Quantidade a Transferir *
                  </label>
                  {currentSelectedStock && (
                    <button
                      type="button"
                      onClick={() => setTransferQty(currentSelectedStock.quantity)}
                      className="text-xs font-bold text-emerald-700 hover:underline"
                    >
                      Transferir Tudo ({currentSelectedStock.quantity})
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setTransferQty((q) => Math.max(1, q - 1))}
                    className="w-11 h-11 bg-slate-100 text-slate-700 font-black text-lg rounded-xl border border-slate-200"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={currentSelectedStock?.quantity || 9999}
                    value={transferQty}
                    onChange={(e) =>
                      setTransferQty(
                        Math.min(
                          currentSelectedStock?.quantity || 9999,
                          Math.max(1, parseInt(e.target.value, 10) || 1)
                        )
                      )
                    }
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl py-2 text-center text-xl font-black text-emerald-900 focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setTransferQty((q) =>
                        Math.min(currentSelectedStock?.quantity || 9999, q + 1)
                      )
                    }
                    className="w-11 h-11 bg-slate-100 text-slate-700 font-black text-lg rounded-xl border border-slate-200"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Optional Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Motivo ou Observação (Opcional)
                </label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Ex: Reorganização do corredor, Otimização de espaço..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm py-3.5 rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>{isSubmitting ? 'Transferindo...' : 'Executar Transferência Segura'}</span>
              </button>
            </form>
          )}

          {/* FORM: RETIRADA / BAIXA */}
          {activeSubTab === 'withdraw' && (
            <form onSubmit={handleWithdrawSubmit} className="space-y-4 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Quantidade a Retirar *
                  </label>
                  {currentSelectedStock && (
                    <button
                      type="button"
                      onClick={() => setWithdrawQty(currentSelectedStock.quantity)}
                      className="text-xs font-bold text-amber-700 hover:underline"
                    >
                      Retirar Tudo ({currentSelectedStock.quantity})
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawQty((q) => Math.max(1, q - 1))}
                    className="w-11 h-11 bg-slate-100 text-slate-700 font-black text-lg rounded-xl border border-slate-200"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={currentSelectedStock?.quantity || 9999}
                    value={withdrawQty}
                    onChange={(e) =>
                      setWithdrawQty(
                        Math.min(
                          currentSelectedStock?.quantity || 9999,
                          Math.max(1, parseInt(e.target.value, 10) || 1)
                        )
                      )
                    }
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl py-2 text-center text-xl font-black text-amber-900 focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setWithdrawQty((q) =>
                        Math.min(currentSelectedStock?.quantity || 9999, q + 1)
                      )
                    }
                    className="w-11 h-11 bg-slate-100 text-slate-700 font-black text-lg rounded-xl border border-slate-200"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Motivo da Retirada (Opcional)
                </label>
                <input
                  type="text"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="Ex: Expedição para cliente, Venda balcão, Amostra..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-sm py-3.5 rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                <MinusCircle className="w-4 h-4" />
                <span>{isSubmitting ? 'Retirando...' : 'Confirmar Retirada'}</span>
              </button>
            </form>
          )}

          {/* FORM: AJUSTE MANUAL */}
          {activeSubTab === 'adjust' && (
            <form onSubmit={handleAdjustSubmit} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nova Quantidade Real Conferida *
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setAdjustNewQty((q) => Math.max(0, q - 1))}
                    className="w-11 h-11 bg-slate-100 text-slate-700 font-black text-lg rounded-xl border border-slate-200"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={adjustNewQty}
                    onChange={(e) => setAdjustNewQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl py-2 text-center text-xl font-black text-purple-900 focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setAdjustNewQty((q) => q + 1)}
                    className="w-11 h-11 bg-slate-100 text-slate-700 font-black text-lg rounded-xl border border-slate-200"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Motivo do Ajuste * (Obrigatório)
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ex: Contagem de inventário físico, Avaria identificada..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-purple-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  O motivo será gravado de forma permanente no histórico de auditoria.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-sm py-3.5 rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                <Sliders className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando...' : 'Gravar Ajuste Manual'}</span>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
