import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Package,
  MapPin,
  ArrowRight,
  Layers,
  PlusCircle,
  ArrowLeftRight,
  MinusCircle,
  Trash2,
  Filter,
  ArrowUpDown,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import { Product, Pallet, PalletStock } from '../types';
import { normalizeText } from '../utils/normalize';
import { getExpirationInfo } from '../utils/date';
import { withdrawStock } from '../services/palletService';
import { DeleteProductModal } from './DeleteProductModal';
import { QuickWithdrawModal } from './QuickWithdrawModal';
import { User } from 'firebase/auth';

interface SearchTabProps {
  products: Product[];
  pallets: Pallet[];
  palletStock: PalletStock[];
  currentUser: User | null;
  onSelectPallet: (pallet: Pallet) => void;
  onGoToIntakeWithProduct?: (productName: string) => void;
  onGoToTransferWithStock?: (stock: PalletStock) => void;
  onGoToWithdrawWithStock?: (stock: PalletStock) => void;
}

type StockFilter = 'all' | 'in_stock' | 'out_of_stock';
type SortOption = 'name_asc' | 'qty_desc' | 'qty_asc' | 'recent';

export const SearchTab: React.FC<SearchTabProps> = ({
  products,
  pallets,
  palletStock,
  currentUser,
  onSelectPallet,
  onGoToIntakeWithProduct,
  onGoToTransferWithStock,
  onGoToWithdrawWithStock,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [selectedPalletFilter, setSelectedPalletFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');

  // Deletion modal state
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Quick direct baixa state
  const [stockToWithdraw, setStockToWithdraw] = useState<PalletStock | null>(null);
  const [subtractingStockId, setSubtractingStockId] = useState<string | null>(null);

  const handleQuickSubtractOne = async (stock: PalletStock) => {
    const qty = Number(stock.quantity) || 0;
    if (qty < 1 || subtractingStockId === stock.id) return;

    setSubtractingStockId(stock.id);
    try {
      await withdrawStock({
        stockId: stock.id,
        quantityToWithdraw: 1,
        reason: `Subtração rápida (-1) ao retirar do Pallet ${stock.palletCode}`,
        userEmail: currentUser?.email || 'Operador',
        userId: currentUser?.uid || '',
      });
      const remaining = qty - 1;
      setNotification(
        remaining <= 0
          ? `-1 ${stock.unit} de "${stock.productName}". Zerado e removido do Pallet ${stock.palletCode}.`
          : `-1 ${stock.unit} de "${stock.productName}" no ${stock.palletCode}. Restam ${remaining} ${stock.unit}.`
      );
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification(err.message || 'Erro ao subtrair item do pallet.');
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setSubtractingStockId(null);
    }
  };

  // Map pallets by ID and Code for quick location retrieval
  const palletMap = useMemo(() => {
    const map = new Map<string, Pallet>();
    for (const p of pallets) {
      map.set(p.id, p);
      map.set(p.code.toUpperCase(), p);
    }
    return map;
  }, [pallets]);

  // Filter and group results with multi-attribute search (product name, barcode, and pallet code!)
  const searchResults = useMemo(() => {
    const query = normalizeText(searchTerm);
    const queryTokens = query.split(/\s+/).filter(Boolean);

    // Filter matching products
    const matchingProducts = products.filter((prod) => {
      // Find all active stocks for this product
      const productStocks = palletStock.filter(
        (s) => s.productId === prod.id && (Number(s.quantity) || 0) > 0
      );

      // Check pallet filter if set
      if (selectedPalletFilter !== 'all') {
        const isInSelectedPallet = productStocks.some(
          (s) => s.palletId === selectedPalletFilter || s.palletCode === selectedPalletFilter
        );
        if (!isInSelectedPallet) return false;
      }

      // Check stock status filter
      if (stockFilter === 'in_stock' && productStocks.length === 0) return false;
      if (stockFilter === 'out_of_stock' && productStocks.length > 0) return false;

      // If no search term, keep
      if (queryTokens.length === 0) return true;

      // Multi-token match across product name, barcode and pallet codes where it's stored
      const normName = normalizeText(prod.name);
      const normCode = normalizeText(prod.code || '');
      const palletsContained = productStocks
        .map((s) => `${normalizeText(s.palletCode)} ${normalizeText(palletMap.get(s.palletId)?.location || '')}`)
        .join(' ');

      const fullSearchCorpus = `${normName} ${normCode} ${palletsContained}`;

      // All tokens must match somewhere in the corpus
      return queryTokens.every((token) => fullSearchCorpus.includes(token));
    });

    // Calculate totals and format result list
    const mapped = matchingProducts.map((prod) => {
      let stocks = palletStock.filter(
        (s) => s.productId === prod.id && (Number(s.quantity) || 0) > 0
      );

      if (selectedPalletFilter !== 'all') {
        stocks = stocks.filter(
          (s) => s.palletId === selectedPalletFilter || s.palletCode === selectedPalletFilter
        );
      }

      // Calculate totals per unit and overall quantity
      const totalsByUnit: Record<string, number> = {};
      let totalNumericQty = 0;
      stocks.forEach((s) => {
        const qtyNum = Number(s.quantity) || 0;
        totalsByUnit[s.unit] = (totalsByUnit[s.unit] || 0) + qtyNum;
        totalNumericQty += qtyNum;
      });

      return {
        product: prod,
        stocks,
        totalsByUnit,
        totalNumericQty,
        totalPalletsCount: stocks.length,
      };
    });

    // Apply sorting
    mapped.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return a.product.name.localeCompare(b.product.name, 'pt-BR');
      }
      if (sortBy === 'qty_desc') {
        return b.totalNumericQty - a.totalNumericQty;
      }
      if (sortBy === 'qty_asc') {
        return a.totalNumericQty - b.totalNumericQty;
      }
      if (sortBy === 'recent') {
        const dateA = a.product.createdAt ? new Date(a.product.createdAt).getTime() : 0;
        const dateB = b.product.createdAt ? new Date(b.product.createdAt).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });

    return mapped;
  }, [searchTerm, stockFilter, selectedPalletFilter, sortBy, products, palletStock, palletMap]);

  // Frequent quick search tags
  const quickTags = useMemo(() => {
    return products.slice(0, 4).map((p) => p.name);
  }, [products]);

  // Helper to highlight matching text
  const renderHighlighted = (text: string) => {
    if (!searchTerm.trim()) return text;
    const tokens = searchTerm.trim().split(/\s+/).filter(Boolean);
    const regex = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-amber-200 text-slate-900 rounded px-0.5 font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3.5 bg-emerald-50 border-2 border-emerald-500 rounded-2xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-700 hover:text-emerald-950 text-xs underline ml-2"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Prominent Search Bar */}
      <div className="bg-white p-4 rounded-2xl border-2 border-emerald-500 shadow-sm transition-all focus-within:ring-4 focus-within:ring-emerald-100 focus-within:border-emerald-600">
        <label className="block text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Search className="w-4 h-4 text-emerald-600" />
            Localizador Rápido de Produtos
          </span>
          <span className="text-[11px] text-slate-400 font-normal">
            Busca por nome ou pallet
          </span>
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='Ex: "ketchup", "P01", "açúcar"...'
            className="w-full text-base sm:text-lg font-medium text-slate-800 placeholder-slate-400 pr-10 py-1.5 focus:outline-none"
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-0 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
              title="Limpar busca"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        {quickTags.length > 0 && !searchTerm && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium py-1">Sugestões:</span>
            {quickTags.map((name) => (
              <button
                key={name}
                onClick={() => setSearchTerm(name)}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 transition"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Filters & Sorting Controls */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Status Chips */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 mr-0.5 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              Status:
            </span>
            <button
              onClick={() => setStockFilter('all')}
              className={`text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 rounded-lg transition active:scale-95 ${
                stockFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({products.length})
            </button>
            <button
              onClick={() => setStockFilter('in_stock')}
              className={`text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 rounded-lg transition active:scale-95 ${
                stockFilter === 'in_stock'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Com Estoque
            </button>
            <button
              onClick={() => setStockFilter('out_of_stock')}
              className={`text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 rounded-lg transition active:scale-95 ${
                stockFilter === 'out_of_stock'
                  ? 'bg-amber-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Sem Estoque
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 sm:ml-auto">
            <span className="text-[11px] sm:text-xs text-slate-400 font-bold flex items-center gap-0.5 shrink-0">
              <ArrowUpDown className="w-3 h-3" />
              Ordem:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-[11px] sm:text-xs font-bold bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full sm:w-auto"
            >
              <option value="name_asc">Nome (A-Z)</option>
              <option value="qty_desc">Maior Estoque</option>
              <option value="qty_asc">Menor Estoque</option>
              <option value="recent">Mais Recentes</option>
            </select>
          </div>
        </div>

        {/* Pallet Filter Selector */}
        {pallets.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-500 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              Filtrar por Pallet:
            </span>
            <select
              value={selectedPalletFilter}
              onChange={(e) => setSelectedPalletFilter(e.target.value)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 flex-1 max-w-xs"
            >
              <option value="all">Todos os pallets do armazém</option>
              {pallets.map((p) => (
                <option key={p.id} value={p.id}>
                  Pallet {p.code} {p.location ? `(${p.location})` : ''}
                </option>
              ))}
            </select>

            {selectedPalletFilter !== 'all' && (
              <button
                onClick={() => setSelectedPalletFilter('all')}
                className="text-[11px] text-emerald-700 hover:underline font-bold"
              >
                Limpar filtro
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-slate-700">
          {searchTerm || selectedPalletFilter !== 'all' || stockFilter !== 'all' ? (
            <span>
              Resultados encontrados: <span className="text-emerald-700 font-extrabold">{searchResults.length}</span>
            </span>
          ) : (
            <span>Catálogo Geral de Produtos ({products.length})</span>
          )}
        </h2>
      </div>

      {/* Results List */}
      {searchResults.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Nenhum produto encontrado
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `Não encontramos itens com o termo "${searchTerm}". Verifique a digitação ou filtros.`
              : 'Nenhum produto corresponde aos filtros aplicados.'}
          </p>
          {onGoToIntakeWithProduct && searchTerm && (
            <button
              onClick={() => onGoToIntakeWithProduct(searchTerm)}
              className="mt-4 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              Dar Entrada de "{searchTerm}"
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {searchResults.map(({ product, stocks, totalsByUnit, totalPalletsCount }) => {
            const hasStock = stocks.length > 0;

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 p-4 shadow-sm transition-all relative group"
              >
                {/* Product Header */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="pr-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {renderHighlighted(product.name)}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {(() => {
                        const prodExp = getExpirationInfo(product.expirationDate);
                        if (prodExp.status === 'none') return null;
                        return (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                              prodExp.status === 'expired'
                                ? 'text-red-700'
                                : prodExp.status === 'expiring_soon'
                                ? 'text-amber-700'
                                : 'text-slate-600'
                            }`}
                          >
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>
                              Val: {prodExp.formattedDate}
                              {(prodExp.status === 'expired' || prodExp.status === 'expiring_soon') &&
                                ` · ${prodExp.statusLabel}`}
                            </span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Stock Totals Badge */}
                  <div className="text-right shrink-0">
                    {hasStock ? (
                      <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-xl text-xs font-bold">
                        <span className="text-emerald-700 block text-[10px] font-semibold uppercase">
                          Saldo Geral
                        </span>
                        {Object.entries(totalsByUnit).map(([unit, qty]) => (
                          <span key={unit} className="block text-sm">
                            {qty} {unit}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-block bg-slate-100 text-slate-500 text-xs px-2.5 py-1 rounded-lg font-medium">
                        Sem estoque
                      </span>
                    )}
                  </div>
                </div>

                {/* Pallets Breakdown */}
                <div className="mt-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>
                      Armazenado em {totalPalletsCount} {totalPalletsCount === 1 ? 'pallet' : 'pallets'}:
                    </span>
                    <span className="text-[11px] text-emerald-600 font-semibold">
                      Toque no pallet para abrir
                    </span>
                  </div>

                  {hasStock ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {stocks.map((stock) => {
                        const palletObj =
                          palletMap.get(stock.palletId) ||
                          palletMap.get(stock.palletCode.toUpperCase());
                        const location = palletObj?.location || 'Sem localização cadastrada';
                        const stockExp = getExpirationInfo(stock.expirationDate);
                        const isSubtracting = subtractingStockId === stock.id;

                        return (
                          <div
                            key={stock.id}
                            className="flex items-center justify-between gap-2 bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded-xl p-2.5 transition"
                          >
                            {/* Pallet Clickable Button */}
                            <button
                              onClick={() => {
                                if (palletObj) {
                                  onSelectPallet(palletObj);
                                } else {
                                  onSelectPallet({
                                    id: stock.palletId,
                                    code: stock.palletCode,
                                    location: 'Localização indisponível',
                                  });
                                }
                              }}
                              className="flex items-start space-x-2 text-left flex-1 min-w-0"
                              title={`Abrir todos os produtos do Pallet ${stock.palletCode}`}
                            >
                              <div className="bg-emerald-700 text-white font-mono font-black text-sm px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1 group-hover:bg-emerald-800 transition shrink-0">
                                <Layers className="w-3.5 h-3.5 text-emerald-200" />
                                {stock.palletCode}
                              </div>
                              <div className="min-w-0">
                                <span className="font-extrabold text-slate-900 text-sm block tabular-nums">
                                  {stock.quantity} {stock.unit}
                                </span>
                                <span className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  {location}
                                </span>
                                {stockExp.status !== 'none' && (
                                  <span
                                    className={`text-[11px] font-bold flex items-center gap-1 mt-0.5 ${
                                      stockExp.status === 'expired'
                                        ? 'text-red-700'
                                        : stockExp.status === 'expiring_soon'
                                        ? 'text-amber-700'
                                        : 'text-slate-600'
                                    }`}
                                  >
                                    <Calendar className="w-3 h-3 shrink-0" />
                                    <span className="truncate">
                                      Val: {stockExp.formattedDate}
                                      {(stockExp.status === 'expired' || stockExp.status === 'expiring_soon') &&
                                        ` · ${stockExp.statusLabel}`}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* Quick Actions: Subtrair -1, Baixa Direta e Transferência */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={isSubtracting}
                                onClick={() => handleQuickSubtractOne(stock)}
                                className="min-h-[36px] min-w-[38px] px-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-black text-xs rounded-lg shadow-2xs transition active:scale-95 disabled:opacity-50 tabular-nums"
                                title={`Subtrair 1 ${stock.unit} do Pallet ${stock.palletCode}`}
                              >
                                {isSubtracting ? '...' : '-1'}
                              </button>

                              <button
                                type="button"
                                onClick={() => setStockToWithdraw(stock)}
                                className="min-h-[36px] inline-flex items-center gap-1 text-[11px] font-black text-amber-900 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 py-1.5 px-2 rounded-lg border border-amber-300 transition active:scale-95 shadow-2xs"
                                title={`Dar baixa em ${stock.productName} no Pallet ${stock.palletCode}`}
                              >
                                <MinusCircle className="w-3.5 h-3.5 text-amber-700" />
                                <span>Baixa</span>
                              </button>

                              {onGoToTransferWithStock && (
                                <button
                                  type="button"
                                  onClick={() => onGoToTransferWithStock(stock)}
                                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-emerald-700 hover:bg-white rounded-lg transition active:scale-95"
                                  title="Transferir para outro pallet"
                                >
                                  <ArrowLeftRight className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-xl text-center text-xs text-slate-500">
                      Este produto não está alocado em nenhum pallet no momento.
                    </div>
                  )}
                </div>

                {/* Card Actions: Dar Entrada + Excluir Produto */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Delete product button */}
                  <button
                    onClick={() => setProductToDelete(product)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 text-xs font-bold text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 sm:border-transparent px-2.5 py-2 rounded-xl transition active:scale-95"
                    title={`Excluir "${product.name}" do catálogo`}
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Excluir</span>
                  </button>

                  {/* Quick Intake button */}
                  {onGoToIntakeWithProduct && (
                    <button
                      onClick={() => onGoToIntakeWithProduct(product.name)}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-3 py-2 rounded-xl transition active:scale-95 shadow-2xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
                      <span>Dar Entrada</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {productToDelete && (
        <DeleteProductModal
          product={productToDelete}
          stocks={palletStock}
          currentUser={currentUser}
          onClose={() => setProductToDelete(null)}
          onSuccess={(prodName) => {
            setNotification(`Produto "${prodName}" foi excluído com sucesso.`);
            setTimeout(() => setNotification(null), 5000);
          }}
        />
      )}

      {/* Quick Direct Stock Withdrawal Modal */}
      {stockToWithdraw && (
        <QuickWithdrawModal
          stock={stockToWithdraw}
          currentUser={currentUser}
          onClose={() => setStockToWithdraw(null)}
          onSuccess={(qty, remaining, unit, prodName) => {
            setStockToWithdraw(null);
            setNotification(
              remaining === 0
                ? `Baixa de ${qty} ${unit} concluída. "${prodName}" zerado e retirado da contagem.`
                : `Baixa de ${qty} ${unit} concluída. Saldo restante: ${remaining} ${unit}.`
            );
            setTimeout(() => setNotification(null), 5000);
          }}
        />
      )}
    </div>
  );
};
