import React, { useState, useMemo } from 'react';
import {
  History,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Sliders,
  Search,
  Calendar,
  User as UserIcon,
  Layers,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';
import { Movement, MovementType, Pallet, DeletedPallet } from '../types';
import { normalizeText } from '../utils/normalize';
import { formatExpirationDate } from '../utils/date';
import { getRecoverableDeletedPallets, restoreDeletedPallet } from '../services/palletService';
import { User } from 'firebase/auth';

interface HistoryTabProps {
  movements: Movement[];
  pallets?: Pallet[];
  deletedPallets?: DeletedPallet[];
  currentUser?: User | null;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  movements,
  pallets = [],
  deletedPallets = [],
  currentUser,
}) => {
  const [filterType, setFilterType] = useState<string>('TODOS');
  const [searchText, setSearchText] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreToast, setRestoreToast] = useState<string | null>(null);

  const recoverablePallets = useMemo(() => {
    return getRecoverableDeletedPallets(pallets, movements, deletedPallets);
  }, [pallets, movements, deletedPallets]);

  const handleRestore = async (dp: DeletedPallet) => {
    setRestoringId(dp.id);
    try {
      const restored = await restoreDeletedPallet({
        deletedPallet: dp,
        userEmail: currentUser?.email || 'Operador',
        userId: currentUser?.uid || '',
      });
      setRestoreToast(
        dp.items.length > 0
          ? `Pallet ${restored.code} restaurado com ${dp.items.length} ${dp.items.length === 1 ? 'produto' : 'produtos'}!`
          : `Pallet ${restored.code} restaurado!`
      );
      setTimeout(() => setRestoreToast(null), 5000);
    } catch (err: any) {
      setRestoreToast(err.message || `Erro ao restaurar Pallet ${dp.code}.`);
      setTimeout(() => setRestoreToast(null), 5000);
    } finally {
      setRestoringId(null);
    }
  };

  const filteredMovements = useMemo(() => {
    let list = [...movements];

    if (filterType !== 'TODOS') {
      list = list.filter((m) => m.type === filterType);
    }

    if (searchText.trim()) {
      const q = normalizeText(searchText);
      list = list.filter((m) => {
        const prod = normalizeText(m.productName);
        const orig = normalizeText(m.originPalletCode || '');
        const dest = normalizeText(m.destinationPalletCode || '');
        const reason = normalizeText(m.reason || '');
        const user = normalizeText(m.userEmail || '');
        return (
          prod.includes(q) ||
          orig.includes(q) ||
          dest.includes(q) ||
          reason.includes(q) ||
          user.includes(q)
        );
      });
    }

    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [movements, filterType, searchText]);

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const getBadgeConfig = (type: MovementType) => {
    switch (type) {
      case 'ENTRADA':
        return {
          label: 'Entrada',
          icon: ArrowDownLeft,
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          textColor: 'text-emerald-700',
        };
      case 'RETIRADA':
        return {
          label: 'Retirada',
          icon: ArrowUpRight,
          bg: 'bg-amber-100 text-amber-800 border-amber-300',
          textColor: 'text-amber-700',
        };
      case 'TRANSFERENCIA':
        return {
          label: 'Transferência',
          icon: ArrowLeftRight,
          bg: 'bg-blue-100 text-blue-800 border-blue-300',
          textColor: 'text-blue-700',
        };
      case 'AJUSTE':
        return {
          label: 'Ajuste',
          icon: Sliders,
          bg: 'bg-purple-100 text-purple-800 border-purple-300',
          textColor: 'text-purple-700',
        };
    }
  };

  return (
    <div className="space-y-4 pb-28">
      {restoreToast && (
        <div className="p-3.5 bg-emerald-50 border-2 border-emerald-500 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{restoreToast}</span>
        </div>
      )}

      {recoverablePallets.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
            <h3 className="text-xs sm:text-sm font-black text-amber-950">
              Paletes excluídos recuperáveis ({recoverablePallets.length})
            </h3>
          </div>
          <div className="space-y-1.5">
            {recoverablePallets.slice(0, 5).map((dp) => (
              <div
                key={dp.id}
                className="bg-white border border-amber-200 rounded-xl p-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="font-mono font-black text-xs bg-amber-100 text-amber-950 px-2 py-0.5 rounded mr-2">
                    {dp.code}
                  </span>
                  <span className="text-xs text-slate-700 font-medium">
                    {dp.items.length > 0
                      ? `${dp.items.length} ${dp.items.length === 1 ? 'produto' : 'produtos'}`
                      : 'Pallet vazio'}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={restoringId === dp.id}
                  onClick={() => handleRestore(dp)}
                  className="min-h-[36px] inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3 py-1.5 rounded-lg transition active:scale-95 disabled:opacity-50 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{restoringId === dp.id ? 'Restaurando...' : 'Restaurar'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header and filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-100 text-emerald-800 p-2 rounded-xl">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">
                Histórico de Movimentações
              </h2>
              <p className="text-xs text-slate-500">
                Log permanente de auditoria logística
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            {filteredMovements.length} {filteredMovements.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {/* Search input in history */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar por produto, pallet, operador ou motivo..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: 'ENTRADA', label: 'Entradas' },
            { id: 'RETIRADA', label: 'Retiradas' },
            { id: 'TRANSFERENCIA', label: 'Transferências' },
            { id: 'AJUSTE', label: 'Ajustes' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                filterType === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Movement List */}
      {filteredMovements.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
          <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-700">Nenhuma movimentação encontrada</h3>
          <p className="text-xs text-slate-500 mt-1">
            Nenhum evento registrado com os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredMovements.map((mov) => {
            const badge = getBadgeConfig(mov.type);
            const Icon = badge.icon;

            return (
              <div
                key={mov.id}
                className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs hover:border-emerald-300 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-2.5">
                    <div
                      className={`p-2 rounded-xl border ${badge.bg} shrink-0 mt-0.5`}
                      title={badge.label}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black uppercase ${badge.textColor}`}>
                          {badge.label}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(mov.createdAt)}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm mt-0.5">
                        {mov.productName}
                      </h4>

                      {/* Pallets involved */}
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 font-medium">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        {mov.type === 'ENTRADA' && (
                          <span>
                            Destino: <strong className="font-mono text-emerald-800">{mov.destinationPalletCode}</strong>
                          </span>
                        )}
                        {mov.type === 'RETIRADA' && (
                          <span>
                            Origem: <strong className="font-mono text-amber-800">{mov.originPalletCode}</strong>
                          </span>
                        )}
                        {mov.type === 'TRANSFERENCIA' && (
                          <span>
                            De <strong className="font-mono text-blue-800">{mov.originPalletCode}</strong> para{' '}
                            <strong className="font-mono text-blue-800">{mov.destinationPalletCode}</strong>
                          </span>
                        )}
                        {mov.type === 'AJUSTE' && (
                          <span>
                            Pallet: <strong className="font-mono text-purple-800">{mov.originPalletCode}</strong>
                          </span>
                        )}
                      </div>

                      {/* Optional expiration date */}
                      {mov.expirationDate && (
                        <p className="text-[11px] text-slate-500 font-semibold mt-1">
                          Validade: <span className="text-slate-700">{formatExpirationDate(mov.expirationDate)}</span>
                        </p>
                      )}

                      {/* Reason or observation */}
                      {mov.reason && (
                        <p className="text-xs text-slate-500 italic mt-1 bg-slate-50 px-2 py-1 rounded-md">
                          "{mov.reason}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-slate-900 block">
                      {mov.type === 'RETIRADA' ? '-' : '+'}
                      {mov.quantity}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold block -mt-0.5">
                      {mov.unit}
                    </span>

                    {/* Operator */}
                    {mov.userEmail && (
                      <span className="text-[10px] text-slate-400 block mt-1 truncate max-w-[100px] text-right">
                        {mov.userEmail.split('@')[0]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
