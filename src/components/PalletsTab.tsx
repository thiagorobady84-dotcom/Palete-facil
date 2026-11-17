import React, { useState, useMemo } from 'react';
import { Layers, Plus, Search, MapPin, ArrowRight, Check, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Pallet, PalletStock } from '../types';
import { createPallet, suggestNextPalletCode, deletePallet } from '../services/palletService';
import { normalizeText } from '../utils/normalize';
import { getExpirationInfo } from '../utils/date';
import { DeletePalletModal } from './DeletePalletModal';
import { User } from 'firebase/auth';

interface PalletsTabProps {
  pallets: Pallet[];
  palletStocks: PalletStock[];
  currentUser?: User | null;
  onSelectPallet: (pallet: Pallet) => void;
  onGoToIntake: () => void;
}

export const PalletsTab: React.FC<PalletsTabProps> = ({
  pallets,
  palletStocks,
  currentUser,
  onSelectPallet,
  onGoToIntake,
}) => {
  const [filterText, setFilterText] = useState('');
  const [showNewPalletModal, setShowNewPalletModal] = useState(false);
  const [palletToDelete, setPalletToDelete] = useState<Pallet | null>(null);
  const [quickConfirmPalletId, setQuickConfirmPalletId] = useState<string | null>(null);
  const [deletingPalletId, setDeletingPalletId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Group pallet stocks by palletId or palletCode
  const palletStats = useMemo(() => {
    const stats: Record<
      string,
      { count: number; totalVolume: number; products: string[]; hasExpired: boolean; hasExpiringSoon: boolean }
    > = {};

    for (const p of pallets) {
      stats[p.id] = { count: 0, totalVolume: 0, products: [], hasExpired: false, hasExpiringSoon: false };
    }

    for (const s of palletStocks) {
      const qty = Number(s.quantity) || 0;
      if (qty <= 0) continue;
      const matchedPallet = pallets.find((p) => p.id === s.palletId || p.code === s.palletCode);
      const key = matchedPallet?.id || s.palletId;
      if (!stats[key]) {
        stats[key] = { count: 0, totalVolume: 0, products: [], hasExpired: false, hasExpiringSoon: false };
      }
      stats[key].count += 1;
      stats[key].totalVolume += qty;
      if (!stats[key].products.includes(s.productName)) {
        stats[key].products.push(s.productName);
      }
      if (s.expirationDate) {
        const exp = getExpirationInfo(s.expirationDate);
        if (exp.status === 'expired') stats[key].hasExpired = true;
        else if (exp.status === 'expiring_soon') stats[key].hasExpiringSoon = true;
      }
    }
    return stats;
  }, [pallets, palletStocks]);

  // Filtered pallets
  const filteredPallets = useMemo(() => {
    if (!filterText) return pallets;
    const query = normalizeText(filterText);
    return pallets.filter((p) => {
      const codeNorm = normalizeText(p.code);
      const locNorm = normalizeText(p.location || '');
      return codeNorm.includes(query) || locNorm.includes(query);
    });
  }, [pallets, filterText]);

  const handleOpenNewPallet = () => {
    const suggested = suggestNextPalletCode(pallets);
    setNewCode(suggested);
    setNewLocation('');
    setErrorMessage(null);
    setShowNewPalletModal(true);
  };

  const handleCreatePalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) {
      setErrorMessage('Informe a identificação do pallet (Ex: P01, P02).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const created = await createPallet(newCode, newLocation);
      setShowNewPalletModal(false);
      onSelectPallet(created);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao cadastrar pallet.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDeletePallet = async (pallet: Pallet) => {
    setDeletingPalletId(pallet.id);
    try {
      await deletePallet({
        palletId: pallet.id,
        palletCode: pallet.code,
        reason: `Exclusão rápida do Pallet ${pallet.code}`,
        userEmail: currentUser?.email || 'Operador',
        userId: currentUser?.uid || '',
      });
      setQuickConfirmPalletId(null);
      setToastMessage(`Pallet ${pallet.code} excluído com sucesso.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage(err.message || 'Erro ao excluir pallet.');
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setDeletingPalletId(null);
    }
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Top action bar: Search & Add */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtrar pallet (ex: P01, Rua 02)..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>

        <button
          onClick={handleOpenNewPallet}
          className="inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Pallet</span>
        </button>
      </div>

      {/* Pallets Grid */}
      {filteredPallets.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-700">Nenhum pallet encontrado</h3>
          <p className="text-xs text-slate-500 mt-1">
            {filterText
              ? `Nenhum pallet corresponde ao filtro "${filterText}".`
              : 'Nenhum pallet cadastrado ainda no armazém.'}
          </p>
          <button
            onClick={handleOpenNewPallet}
            className="mt-4 inline-flex items-center gap-1.5 bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Pallet Agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPallets.map((pallet) => {
            const stat = palletStats[pallet.id] || {
              count: 0,
              totalVolume: 0,
              products: [],
              hasExpired: false,
              hasExpiringSoon: false,
            };
            const isOccupied = stat.count > 0;
            const isConfirmingQuickDelete = quickConfirmPalletId === pallet.id;
            const isBeingDeleted = deletingPalletId === pallet.id;

            return (
              <div
                key={pallet.id}
                onClick={() => {
                  if (!isConfirmingQuickDelete) onSelectPallet(pallet);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isConfirmingQuickDelete) {
                    e.preventDefault();
                    onSelectPallet(pallet);
                  }
                }}
                className={`bg-white border rounded-2xl p-4 shadow-sm transition text-left group flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isConfirmingQuickDelete
                    ? 'border-red-400 ring-2 ring-red-100'
                    : 'border-slate-200 hover:border-emerald-500 hover:shadow-md'
                }`}
              >
                <div>
                  {/* Card top */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xl text-emerald-900 bg-emerald-100 group-hover:bg-emerald-700 group-hover:text-white px-2.5 py-1 rounded-xl transition tabular-nums">
                        {pallet.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-600 tabular-nums">
                        {isOccupied ? `${stat.count} ${stat.count === 1 ? 'item' : 'itens'}` : 'Vazio'}
                      </span>

                      {/* Botão Exclusão Rápida */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickConfirmPalletId(
                            isConfirmingQuickDelete ? null : pallet.id
                          );
                        }}
                        className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border transition active:scale-95 ${
                          isConfirmingQuickDelete
                            ? 'bg-red-600 text-white border-red-700'
                            : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                        }`}
                        title={`Exclusão rápida do Pallet ${pallet.code}`}
                        aria-label={`Excluir Pallet ${pallet.code}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Inline Delete Confirmation */}
                  {isConfirmingQuickDelete && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl space-y-2"
                    >
                      <p className="text-xs font-bold text-red-900 leading-snug">
                        {isOccupied
                          ? `Excluir ${pallet.code} e dar baixa nos ${stat.totalVolume} itens?`
                          : `Excluir o pallet vazio ${pallet.code}?`}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isBeingDeleted}
                          onClick={() => handleQuickDeletePallet(pallet)}
                          className="flex-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-xs py-2 px-3 rounded-lg transition active:scale-95 disabled:opacity-60"
                        >
                          {isBeingDeleted ? 'Excluindo...' : 'Excluir Agora'}
                        </button>
                        <button
                          type="button"
                          disabled={isBeingDeleted}
                          onClick={() => setQuickConfirmPalletId(null)}
                          className="px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {pallet.location ? pallet.location : 'Sem localização definida'}
                    </span>
                  </div>

                  {/* Expiry alert metadata if applicable */}
                  {(stat.hasExpired || stat.hasExpiringSoon) && (
                    <div
                      className={`mt-1.5 flex items-center gap-1 text-[11px] font-bold ${
                        stat.hasExpired ? 'text-red-700' : 'text-amber-700'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {stat.hasExpired
                          ? 'Contém produto vencido'
                          : 'Contém produto próximo da validade'}
                      </span>
                    </div>
                  )}

                  {/* Products preview */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    {isOccupied ? (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 block">
                          Produtos no pallet ({stat.totalVolume} total):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {stat.products.slice(0, 3).map((name) => (
                            <span
                              key={name}
                              className="bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded-md truncate max-w-[150px]"
                            >
                              {name}
                            </span>
                          ))}
                          {stat.products.length > 3 && (
                            <span className="text-[10px] text-slate-400 font-bold self-center">
                              +{stat.products.length - 3} mais
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">
                        Pronto para receber mercadorias
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer action hint */}
                <div className="mt-3.5 pt-2 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                  <span>Abrir detalhes</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação de Novo Pallet */}
      {showNewPalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">Cadastrar Novo Pallet</h3>
              </div>
              <button
                onClick={() => setShowNewPalletModal(false)}
                className="text-emerald-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePalletSubmit} className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Identificação do Pallet (Ex: P01, P02) *
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="Ex: P04"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Dica: Se digitar apenas o número (ex: 4), o sistema formatará como P04.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Localização Física (Opcional)
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Ex: Rua 03 - Prédio B - Nível 2"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Facilita o endereçamento no armazém.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPalletModal(false)}
                  className="w-full sm:w-auto justify-center px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm transition text-center active:scale-95"
                >
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{isSubmitting ? 'Cadastrando...' : 'Criar Pallet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dedicado para Exclusão do Pallet */}
      {palletToDelete && (
        <DeletePalletModal
          pallet={palletToDelete}
          palletStocks={palletStocks}
          currentUser={currentUser || null}
          onClose={() => setPalletToDelete(null)}
          onSuccess={(code) => {
            setPalletToDelete(null);
            setToastMessage(`Pallet ${code} excluído com sucesso.`);
            setTimeout(() => setToastMessage(null), 4000);
          }}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-fade-in border border-emerald-700">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
