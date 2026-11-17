import React, { useState, useEffect, useMemo } from 'react';
import {
  PlusCircle,
  Package,
  Layers,
  CheckCircle,
  AlertCircle,
  Plus,
  Calendar,
  X,
} from 'lucide-react';
import { Product, Pallet, UnitType } from '../types';
import { registerProductIntake, createPallet, suggestNextPalletCode } from '../services/palletService';
import { formatExpirationDate } from '../utils/date';
import { User } from 'firebase/auth';

interface IntakeTabProps {
  products: Product[];
  pallets: Pallet[];
  currentUser: User | null;
  initialProductName?: string;
  initialPalletId?: string;
  onSuccessIntake?: () => void;
}

export const IntakeTab: React.FC<IntakeTabProps> = ({
  products,
  pallets,
  currentUser,
  initialProductName = '',
  initialPalletId = '',
  onSuccessIntake,
}) => {
  const [productName, setProductName] = useState(initialProductName);
  const [selectedPalletId, setSelectedPalletId] = useState(initialPalletId);
  const [quantity, setQuantity] = useState<number | ''>(10);
  const [unit, setUnit] = useState<UnitType>('caixas');
  const [expirationDate, setExpirationDate] = useState('');

  // Quick inline new pallet creation
  const [isCreatingNewPallet, setIsCreatingNewPallet] = useState(false);
  const [newPalletCode, setNewPalletCode] = useState('');
  const [newPalletLocation, setNewPalletLocation] = useState('');

  // Status and feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Autocomplete suggestions for product name
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const matchingProducts = useMemo(() => {
    if (!productName.trim() || productName.length < 2) return [];
    const term = productName.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(term)).slice(0, 5);
  }, [productName, products]);

  // Set initial pallet if none selected
  useEffect(() => {
    if (!selectedPalletId && pallets.length > 0) {
      setSelectedPalletId(pallets[0].id);
    }
  }, [pallets, selectedPalletId]);

  // Update when initial props change
  useEffect(() => {
    if (initialProductName) setProductName(initialProductName);
    if (initialPalletId) setSelectedPalletId(initialPalletId);
  }, [initialProductName, initialPalletId]);

  const handleSelectProductSuggestion = (prod: Product) => {
    setProductName(prod.name);
    if (prod.expirationDate) setExpirationDate(prod.expirationDate);
    setShowProductSuggestions(false);
  };

  const handleOpenInlinePalletCreate = () => {
    const nextCode = suggestNextPalletCode(pallets);
    setNewPalletCode(nextCode);
    setNewPalletLocation('');
    setIsCreatingNewPallet(true);
  };

  const handleQuickCreatePallet = async () => {
    if (!newPalletCode.trim()) return;
    try {
      const created = await createPallet(newPalletCode, newPalletLocation);
      setSelectedPalletId(created.id);
      setIsCreatingNewPallet(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao criar novo pallet.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!productName.trim()) {
      setErrorMessage('Informe o nome do produto.');
      return;
    }

    const parsedQty = typeof quantity === 'number' ? quantity : parseInt(quantity, 10);
    if (!quantity || isNaN(parsedQty) || parsedQty <= 0 || !Number.isInteger(parsedQty)) {
      setErrorMessage('A quantidade deve ser um número inteiro positivo maior que zero.');
      return;
    }

    let targetPalletId = selectedPalletId;
    let targetPallet = pallets.find((p) => p.id === targetPalletId);

    // Se estiver criando pallet novo diretamente
    if (isCreatingNewPallet) {
      if (!newPalletCode.trim()) {
        setErrorMessage('Informe a identificação do novo pallet.');
        return;
      }
      try {
        const created = await createPallet(newPalletCode, newPalletLocation);
        targetPallet = created;
        targetPalletId = created.id;
        setSelectedPalletId(created.id);
        setIsCreatingNewPallet(false);
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao criar pallet.');
        return;
      }
    }

    if (!targetPallet) {
      setErrorMessage('Selecione um pallet de destino válido.');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerProductIntake({
        productName: productName.trim(),
        palletId: targetPallet.id,
        palletCode: targetPallet.code,
        quantity: Number(quantity),
        unit,
        expirationDate: expirationDate.trim() || undefined,
        userEmail: currentUser?.email || 'Operador',
        userId: currentUser?.uid || '',
      });

      const expiryNote = expirationDate.trim()
        ? ` (Validade: ${formatExpirationDate(expirationDate.trim())})`
        : '';

      setSuccessMessage(
        `Entrada confirmada! +${quantity} ${unit} de "${productName.trim()}"${expiryNote} no Pallet ${targetPallet.code}.`
      );

      // Limpar formulário para próxima entrada
      setProductName('');
      setExpirationDate('');
      setQuantity(10);

      if (onSuccessIntake) {
        onSuccessIntake();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao dar entrada no produto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-28">
      {/* Title */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-xl">
            <PlusCircle className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 leading-tight">
              Entrada de Produtos
            </h2>
            <p className="text-xs text-slate-500">
              Recebimento e alocação física por pallet
            </p>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl text-emerald-900 text-sm flex items-start gap-3 shadow-xs animate-in fade-in">
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

      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* 1. Nome do produto com Autocomplete */}
        <div className="relative">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-emerald-600" />
              Nome do Produto *
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Obrigatório</span>
          </label>
          <input
            type="text"
            value={productName}
            onChange={(e) => {
              setProductName(e.target.value);
              setShowProductSuggestions(true);
            }}
            onFocus={() => setShowProductSuggestions(true)}
            placeholder="Ex: Ketchup Predilecta, Arroz Tio João..."
            className="w-full bg-slate-50 border-2 border-[#000000] rounded-xl px-3.5 py-3 text-base font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            required
            autoComplete="off"
          />

          {/* Autocomplete Dropdown */}
          {showProductSuggestions && matchingProducts.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden divide-y divide-slate-100">
              <div className="px-3 py-1 bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                Produtos existentes encontrados:
              </div>
              {matchingProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProductSuggestion(p)}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50 flex items-center justify-between text-sm transition"
                >
                  <span className="font-semibold text-slate-800">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. Data de Validade (Opcional) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              Validade (Opcional)
            </label>
            {expirationDate ? (
              <button
                type="button"
                onClick={() => setExpirationDate('')}
                className="text-xs font-bold text-slate-500 hover:text-red-600 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Sem validade</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">
                Pode deixar em branco
              </span>
            )}
          </div>
          <input
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className="w-full min-h-[44px] bg-slate-50 border-2 border-[#000000] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Se o produto não tiver data de validade, deixe vazio para cadastrar normalmente.
          </p>
        </div>

        {/* 3. Pallet de Destino com Criação Rápida */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              Pallet de Destino *
            </label>
            {!isCreatingNewPallet && (
              <button
                type="button"
                onClick={handleOpenInlinePalletCreate}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Criar Novo Pallet</span>
              </button>
            )}
          </div>

          {isCreatingNewPallet ? (
            <div className="p-3.5 bg-emerald-50/80 border-2 border-emerald-500 rounded-2xl space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-900 uppercase">
                  Cadastrar Novo Pallet Agora
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewPallet(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                >
                  Usar pallet existente
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-0.5">
                    Código (Ex: P04):
                  </span>
                  <input
                    type="text"
                    value={newPalletCode}
                    onChange={(e) => setNewPalletCode(e.target.value.toUpperCase())}
                    placeholder="Ex: P04"
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-1.5 text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-0.5">
                    Localização (opcional):
                  </span>
                  <input
                    type="text"
                    value={newPalletLocation}
                    onChange={(e) => setNewPalletLocation(e.target.value)}
                    placeholder="Ex: Doca 02"
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <select
              value={selectedPalletId}
              onChange={(e) => setSelectedPalletId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-3 text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              required
            >
              {pallets.map((p) => (
                <option key={p.id} value={p.id}>
                  Pallet {p.code} {p.location ? `— ${p.location}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 4. Unidade de Medida */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Unidade de Medida *
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUnit('caixas')}
              className={`py-3 px-4 rounded-xl text-sm font-black border transition flex items-center justify-center gap-2 ${
                unit === 'caixas'
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-500'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>📦 Caixas (cx)</span>
            </button>
            <button
              type="button"
              onClick={() => setUnit('unidades')}
              className={`py-3 px-4 rounded-xl text-sm font-black border transition flex items-center justify-center gap-2 ${
                unit === 'unidades'
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-500'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>🏷️ Unidades (un)</span>
            </button>
          </div>
        </div>

        {/* 5. Quantidade com controles rápidos */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Quantidade a Ingressar *
          </label>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                const current = typeof quantity === 'number' ? quantity : parseInt(quantity, 10) || 0;
                setQuantity(Math.max(1, current - 1));
              }}
              className="w-12 h-12 bg-slate-100 active:bg-slate-200 text-slate-700 font-black text-xl rounded-xl flex items-center justify-center border border-slate-200"
            >
              -
            </button>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="0"
              value={quantity}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setQuantity('');
                } else {
                  const parsed = parseInt(val, 10);
                  setQuantity(isNaN(parsed) ? '' : Math.max(0, parsed));
                }
              }}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl py-2.5 text-center text-2xl font-black text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => {
                const current = typeof quantity === 'number' ? quantity : parseInt(quantity, 10) || 0;
                setQuantity(current + 1);
              }}
              className="w-12 h-12 bg-slate-100 active:bg-slate-200 text-slate-700 font-black text-xl rounded-xl flex items-center justify-center border border-slate-200"
            >
              +
            </button>
          </div>

          {/* Quick Increment & Clear Buttons */}
          <div className="grid grid-cols-5 gap-1.5 mt-2.5">
            {[5, 10, 20, 50].map((inc) => (
              <button
                key={inc}
                type="button"
                onClick={() => {
                  const current = typeof quantity === 'number' ? quantity : parseInt(quantity, 10) || 0;
                  setQuantity(current + inc);
                }}
                className="bg-slate-100 hover:bg-emerald-50 active:bg-emerald-100 text-slate-800 hover:text-emerald-900 text-xs font-black py-2 rounded-xl border border-slate-200 transition text-center active:scale-95"
              >
                +{inc}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setQuantity('')}
              className="bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 font-black text-xs py-2 rounded-xl border border-red-200 transition text-center active:scale-95"
              title="Apagar número para digitar livremente"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Information box */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-500 leading-relaxed">
          💡 Se o pallet já possuir este produto na mesma unidade, a quantidade será somada automaticamente ao saldo atual com segurança.
        </div>

        {/* Big Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-base py-3.5 rounded-2xl shadow-md transition flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-5 h-5" />
          <span>{isSubmitting ? 'Registrando entrada...' : 'Confirmar Entrada no Pallet'}</span>
        </button>
      </form>
    </div>
  );
};
