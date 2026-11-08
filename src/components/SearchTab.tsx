import React, { useState, useMemo } from 'react';
import { Search, X, Package, MapPin, ArrowRight, Layers, PlusCircle, ArrowLeftRight } from 'lucide-react';
import { Product, Pallet, PalletStock } from '../types';
import { normalizeText } from '../utils/normalize';

interface SearchTabProps {
  products: Product[];
  pallets: Pallet[];
  palletStock: PalletStock[];
  onSelectPallet: (pallet: Pallet) => void;
  onGoToIntakeWithProduct?: (productName: string, productCode?: string) => void;
  onGoToTransferWithStock?: (stock: PalletStock) => void;
}

export const SearchTab: React.FC<SearchTabProps> = ({
  products,
  pallets,
  palletStock,
  onSelectPallet,
  onGoToIntakeWithProduct,
  onGoToTransferWithStock,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Map pallets by ID for quick location retrieval
  const palletMap = useMemo(() => {
    const map = new Map<string, Pallet>();
    for (const p of pallets) {
      map.set(p.id, p);
      map.set(p.code.toUpperCase(), p);
    }
    return map;
  }, [pallets]);

  // Filter and group results
  const searchResults = useMemo(() => {
    const query = normalizeText(searchTerm);

    // If query is empty, show all items or recently active items
    const matchingProducts = query
      ? products.filter((p) => {
          const normName = normalizeText(p.name);
          const normCode = normalizeText(p.code || '');
          return normName.includes(query) || normCode.includes(query);
        })
      : products;

    // For each product, find all pallets containing it with stock > 0
    return matchingProducts.map((prod) => {
      const stocks = palletStock.filter(
        (s) => s.productId === prod.id && s.quantity > 0
      );

      // Calculate totals per unit
      const totalsByUnit: Record<string, number> = {};
      stocks.forEach((s) => {
        totalsByUnit[s.unit] = (totalsByUnit[s.unit] || 0) + s.quantity;
      });

      return {
        product: prod,
        stocks,
        totalsByUnit,
        totalPalletsCount: stocks.length,
      };
    });
  }, [searchTerm, products, palletStock]);

  // Frequent quick search tags
  const quickTags = useMemo(() => {
    return products.slice(0, 4).map((p) => p.name);
  }, [products]);

  return (
    <div className="space-y-4 pb-20">
      {/* Prominent Search Bar */}
      <div className="bg-white p-4 rounded-2xl border-2 border-emerald-500 shadow-sm transition-all focus-within:ring-4 focus-within:ring-emerald-100 focus-within:border-emerald-600">
        <label className="block text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Search className="w-4 h-4 text-emerald-600" />
            Localizador Rápido de Produtos
          </span>
          <span className="text-[11px] text-slate-400 font-normal">
            Ignora acentos e maiúsculas
          </span>
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='Ex: "ketchup", "açúcar", "maionese" ou cód. barras...'
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

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-slate-700">
          {searchTerm ? (
            <span>
              Resultados para <span className="text-emerald-700 font-extrabold">"{searchTerm}"</span> ({searchResults.length})
            </span>
          ) : (
            <span>Catálogo Completo de Produtos ({products.length})</span>
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
            Não encontramos itens com o termo "{searchTerm}". Você pode cadastrar e dar entrada agora mesmo.
          </p>
          {onGoToIntakeWithProduct && (
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
                className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 p-4 shadow-sm transition-all"
              >
                {/* Product Header */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {product.name}
                    </h3>
                    {product.code && (
                      <span className="inline-block text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded mt-1 font-medium">
                        Cód: {product.code}
                      </span>
                    )}
                  </div>

                  {/* Stock Totals Badge */}
                  <div className="text-right">
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
                      <span className="inline-block bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-lg font-medium">
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
                      Clique no pallet para ver tudo nele
                    </span>
                  </div>

                  {hasStock ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {stocks.map((stock) => {
                        const palletObj =
                          palletMap.get(stock.palletId) ||
                          palletMap.get(stock.palletCode.toUpperCase());
                        const location = palletObj?.location || 'Sem localização cadastrada';

                        return (
                          <div
                            key={stock.id}
                            className="flex items-center justify-between bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 rounded-xl p-2.5 transition group"
                          >
                            {/* Pallet Clickable Button */}
                            <button
                              onClick={() => {
                                if (palletObj) {
                                  onSelectPallet(palletObj);
                                } else {
                                  // Fallback pallet representation
                                  onSelectPallet({
                                    id: stock.palletId,
                                    code: stock.palletCode,
                                    location: 'Localização indisponível',
                                  });
                                }
                              }}
                              className="flex items-start space-x-2.5 text-left flex-1 mr-2"
                              title={`Abrir todos os produtos do Pallet ${stock.palletCode}`}
                            >
                              <div className="bg-emerald-700 text-white font-mono font-black text-sm px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1 group-hover:bg-emerald-800 transition">
                                <Layers className="w-3.5 h-3.5 text-emerald-200" />
                                {stock.palletCode}
                              </div>
                              <div className="min-w-0">
                                <span className="font-extrabold text-slate-900 text-sm block">
                                  {stock.quantity} {stock.unit}
                                </span>
                                <span className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  {location}
                                </span>
                              </div>
                            </button>

                            {/* Quick Action to Move/Transfer */}
                            {onGoToTransferWithStock && (
                              <button
                                onClick={() => onGoToTransferWithStock(stock)}
                                className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-white rounded-lg transition"
                                title="Transferir ou Retirar deste pallet"
                              >
                                <ArrowLeftRight className="w-4 h-4" />
                              </button>
                            )}
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

                {/* Card Actions */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
                  {onGoToIntakeWithProduct && (
                    <button
                      onClick={() => onGoToIntakeWithProduct(product.name, product.code)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Dar Entrada deste Produto
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
