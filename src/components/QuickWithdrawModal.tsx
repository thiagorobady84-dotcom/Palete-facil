import React, { useState } from 'react';
import {
  MinusCircle,
  X,
  Layers,
  Package,
  AlertCircle,
  CheckCircle,
  Check,
} from 'lucide-react';
import { PalletStock } from '../types';
import { withdrawStock } from '../services/palletService';
import { User } from 'firebase/auth';

interface QuickWithdrawModalProps {
  stock: PalletStock | null;
  currentUser?: User | null;
  onClose: () => void;
  onSuccess?: (withdrawnQty: number, remainingQty: number, unit: string, productName: string) => void;
}

export const QuickWithdrawModal: React.FC<QuickWithdrawModalProps> = ({
  stock,
  currentUser,
  onClose,
  onSuccess,
}) => {
  if (!stock) return null;

  const currentQty = Number(stock.quantity) || 0;
  const [withdrawQty, setWithdrawQty] = useState<number | ''>(1);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedQty = typeof withdrawQty === 'number' ? withdrawQty : parseInt(withdrawQty, 10);
  const validParsedQty = !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 0;
  const remainingQty = Math.max(0, currentQty - validParsedQty);

  const quickReasonChips = ['Expedição', 'Venda balcão', 'Avaria / Vencido', 'Consumo interno', 'Ajuste de inventário'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isNaN(parsedQty) || parsedQty <= 0 || !Number.isInteger(parsedQty)) {
      setErrorMessage('Informe uma quantidade inteira positiva para dar baixa.');
      return;
    }

    if (parsedQty > currentQty) {
      setErrorMessage(`Saldo insuficiente! O pallet possui apenas ${currentQty} ${stock.unit}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await withdrawStock({
        stockId: stock.id,
        quantityToWithdraw: parsedQty,
        reason: reason.trim() || 'Baixa operacional direta',
        userEmail: currentUser?.email || 'Operador',
        userId: currentUser?.uid || '',
      });

      if (onSuccess) {
        onSuccess(parsedQty, remainingQty, stock.unit, stock.productName);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao realizar baixa no item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-amber-600 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-700/80 rounded-2xl border border-amber-500 shadow-inner">
              <MinusCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white tracking-tight">Dar Baixa no Item</h3>
              <p className="text-xs text-amber-100 font-medium">
                Retirada com atualização imediata do estoque
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-amber-200 hover:text-white hover:bg-amber-700 rounded-full transition"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Product and Pallet Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm leading-snug">
                    {stock.productName}
                  </h4>
                </div>
              </div>

              <div className="bg-emerald-700 text-white font-mono font-black text-xs px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1 shrink-0">
                <Layers className="w-3 h-3 text-emerald-200" />
                <span>{stock.palletCode}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                Saldo Atual no Pallet:
              </span>
              <span className="text-sm font-black text-emerald-800">
                {currentQty} {stock.unit}
              </span>
            </div>
          </div>

          {/* Quantity Controls */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Quantidade a Retirar / Dar Baixa *
              </label>
              <button
                type="button"
                onClick={() => setWithdrawQty(currentQty)}
                className="text-xs font-bold text-amber-700 hover:text-amber-900 hover:underline"
              >
                Retirar Tudo ({currentQty})
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  const cur = typeof withdrawQty === 'number' ? withdrawQty : 1;
                  setWithdrawQty(Math.max(1, cur - 1));
                }}
                className="w-12 h-12 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-black text-xl rounded-xl border border-slate-300 transition active:scale-95 flex items-center justify-center shrink-0"
              >
                -
              </button>

              <input
                type="number"
                min="1"
                max={currentQty}
                value={withdrawQty}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setWithdrawQty('');
                  } else {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) {
                      setWithdrawQty(Math.min(currentQty, Math.max(0, parsed)));
                    }
                  }
                }}
                placeholder="Qtd"
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl py-2.5 text-center text-2xl font-black text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                autoFocus
                required
              />

              <button
                type="button"
                onClick={() => {
                  const cur = typeof withdrawQty === 'number' ? withdrawQty : 0;
                  setWithdrawQty(Math.min(currentQty, cur + 1));
                }}
                className="w-12 h-12 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-black text-xl rounded-xl border border-slate-300 transition active:scale-95 flex items-center justify-center shrink-0"
              >
                +
              </button>
            </div>

            {/* Quick buttons */}
            <div className="flex items-center gap-1.5 mt-2">
              {[1, 2, 5, 10].filter((q) => q <= currentQty).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setWithdrawQty(q)}
                  className={`text-xs font-bold py-1.5 px-2.5 rounded-lg border transition active:scale-95 ${
                    withdrawQty === q
                      ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {q}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setWithdrawQty(currentQty)}
                className={`text-xs font-bold py-1.5 px-3 rounded-lg border ml-auto transition active:scale-95 ${
                  withdrawQty === currentQty
                    ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                }`}
              >
                Tudo ({currentQty})
              </button>
            </div>
          </div>

          {/* Real-time Calculation Result Box */}
          <div className={`p-3 rounded-xl border text-xs font-medium transition ${
            remainingQty === 0
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}>
            <div className="flex items-center justify-between">
              <span>Quantidade da baixa:</span>
              <strong>{validParsedQty} {stock.unit}</strong>
            </div>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200/60">
              <span>Saldo final no {stock.palletCode}:</span>
              <strong>
                {remainingQty === 0 ? (
                  <span className="text-amber-700 font-black">0 {stock.unit} (será removido do pallet)</span>
                ) : (
                  <span className="text-emerald-800 font-black">{remainingQty} {stock.unit}</span>
                )}
              </strong>
            </div>
          </div>

          {/* Reason Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Motivo da Baixa (Opcional)
            </label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {quickReasonChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setReason(chip)}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition ${
                    reason === chip
                      ? 'bg-slate-800 text-white border-slate-900'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Expedição para cliente, Venda, Avaria..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-2 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || validParsedQty <= 0}
              className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-black text-sm px-5 py-3 rounded-xl shadow-md transition disabled:opacity-50 text-center active:scale-95"
            >
              <MinusCircle className="w-4 h-4 shrink-0" />
              <span>{isSubmitting ? 'Dando baixa...' : 'Confirmar Baixa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
