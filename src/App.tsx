import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  db,
  loginWithGoogle,
  testConnection,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { Product, Pallet, PalletStock, Movement, TabType } from './types';
import { seedDemoDataIfEmpty } from './services/palletService';

import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { SearchTab } from './components/SearchTab';
import { PalletsTab } from './components/PalletsTab';
import { IntakeTab } from './components/IntakeTab';
import { MovementTab } from './components/MovementTab';
import { HistoryTab } from './components/HistoryTab';
import { PalletDetailModal } from './components/PalletDetailModal';
import { Warehouse, LogIn, ShieldAlert } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('pesquisar');

  // Real-time Firestore state
  const [products, setProducts] = useState<Product[]>([]);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [palletStock, setPalletStock] = useState<PalletStock[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  // Selected pallet for detail modal
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);

  // Pre-fill parameters for tab transitions
  const [intakeProductPrefill, setIntakeProductPrefill] = useState<{
    name: string;
    code?: string;
    palletId?: string;
  }>({ name: '', code: '', palletId: '' });

  const [movementStockPrefill, setMovementStockPrefill] = useState<{
    stock: PalletStock | null;
    action: 'transfer' | 'withdraw' | 'adjust';
  }>({ stock: null, action: 'transfer' });

  // 1. Check Connection & Auth state
  useEffect(() => {
    testConnection();

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        // Seed realistic demo data if collection is empty
        try {
          await seedDemoDataIfEmpty();
        } catch (err) {
          console.error('Seed error:', err);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Real-time data sync when authenticated
  useEffect(() => {
    if (!currentUser) {
      setProducts([]);
      setPallets([]);
      setPalletStock([]);
      setMovements([]);
      return;
    }

    // Listener: Products
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        const list: Product[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, 'id'>),
        }));
        setProducts(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'products')
    );

    // Listener: Pallets
    const unsubPallets = onSnapshot(
      collection(db, 'pallets'),
      (snap) => {
        const list: Pallet[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Pallet, 'id'>),
        }));
        // Sort pallets by code (P01, P02, P03...)
        list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
        setPallets(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'pallets')
    );

    // Listener: PalletStock
    const unsubStock = onSnapshot(
      collection(db, 'palletStock'),
      (snap) => {
        const list: PalletStock[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PalletStock, 'id'>),
        }));
        setPalletStock(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'palletStock')
    );

    // Listener: Movements (Ordered by createdAt desc)
    const unsubMovements = onSnapshot(
      collection(db, 'movements'),
      (snap) => {
        const list: Movement[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Movement, 'id'>),
        }));
        setMovements(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'movements')
    );

    return () => {
      unsubProducts();
      unsubPallets();
      unsubStock();
      unsubMovements();
    };
  }, [currentUser]);

  // Keep selectedPallet updated if its data changes
  useEffect(() => {
    if (selectedPallet) {
      const updated = pallets.find((p) => p.id === selectedPallet.id);
      if (updated) setSelectedPallet(updated);
    }
  }, [pallets, selectedPallet]);

  // Handlers for cross-tab actions
  const handleGoToIntakeWithProduct = (productName: string, productCode?: string) => {
    setIntakeProductPrefill({ name: productName, code: productCode, palletId: '' });
    setActiveTab('entrada');
  };

  const handleAddProductToPallet = (pallet: Pallet) => {
    setIntakeProductPrefill({ name: '', code: '', palletId: pallet.id });
    setActiveTab('entrada');
  };

  const handleGoToTransferWithStock = (stock: PalletStock) => {
    setMovementStockPrefill({ stock, action: 'transfer' });
    setActiveTab('movimentar');
  };

  const handleGoToWithdrawWithStock = (stock: PalletStock) => {
    setMovementStockPrefill({ stock, action: 'withdraw' });
    setActiveTab('movimentar');
  };

  const handleGoToAdjustWithStock = (stock: PalletStock) => {
    setMovementStockPrefill({ stock, action: 'adjust' });
    setActiveTab('movimentar');
  };

  // Compute summary stats
  const totalItemsCount = palletStock.reduce((acc, s) => acc + s.quantity, 0);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-700">Carregando Sistema Pallet Fácil...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        totalPallets={pallets.length}
        totalItems={totalItemsCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-5">
        {!currentUser ? (
          // Welcome / Sign-in required screen for multi-user security
          <div className="my-8 bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Warehouse className="w-8 h-8 text-emerald-700" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              SISTEMA PALLET FÁCIL
            </h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Endereçamento logístico por pallets em tempo real. Identifique o operador para
              gravar movimentações e garantir a segurança do estoque.
            </p>

            <div className="my-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-left text-xs text-emerald-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                <span>✓</span> Localize qualquer produto e seus respectivos pallets
              </div>
              <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                <span>✓</span> Transferência atômica entre pallets sem divergência
              </div>
              <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                <span>✓</span> Histórico imutável de entradas, retiradas e ajustes
              </div>
            </div>

            <button
              onClick={() => loginWithGoogle()}
              className="w-full bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-black text-base py-3.5 px-6 rounded-2xl shadow-md transition flex items-center justify-center gap-2.5"
            >
              <LogIn className="w-5 h-5" />
              <span>Entrar com Google</span>
            </button>
            <p className="text-[11px] text-slate-400 mt-3">
              Acesso seguro e sincronizado com toda a equipe do armazém.
            </p>
          </div>
        ) : (
          <>
            {/* View switcher based on bottom nav tab */}
            {activeTab === 'pesquisar' && (
              <SearchTab
                products={products}
                pallets={pallets}
                palletStock={palletStock}
                onSelectPallet={(pallet) => setSelectedPallet(pallet)}
                onGoToIntakeWithProduct={handleGoToIntakeWithProduct}
                onGoToTransferWithStock={handleGoToTransferWithStock}
              />
            )}

            {activeTab === 'pallets' && (
              <PalletsTab
                pallets={pallets}
                palletStocks={palletStock}
                onSelectPallet={(pallet) => setSelectedPallet(pallet)}
                onGoToIntake={() => setActiveTab('entrada')}
              />
            )}

            {activeTab === 'entrada' && (
              <IntakeTab
                products={products}
                pallets={pallets}
                currentUser={currentUser}
                initialProductName={intakeProductPrefill.name}
                initialProductCode={intakeProductPrefill.code}
                initialPalletId={intakeProductPrefill.palletId}
                onSuccessIntake={() => {
                  // Keep on tab or navigate as needed
                }}
              />
            )}

            {activeTab === 'movimentar' && (
              <MovementTab
                pallets={pallets}
                palletStocks={palletStock}
                currentUser={currentUser}
                initialStock={movementStockPrefill.stock}
                initialAction={movementStockPrefill.action}
                onSuccessMovement={() => {
                  // Refresh prefill
                  setMovementStockPrefill({ stock: null, action: 'transfer' });
                }}
              />
            )}

            {activeTab === 'historico' && (
              <HistoryTab movements={movements} />
            )}
          </>
        )}
      </main>

      {/* Pallet Detail Modal (Accessible from anywhere) */}
      {selectedPallet && (
        <PalletDetailModal
          pallet={selectedPallet}
          palletStocks={palletStock}
          onClose={() => setSelectedPallet(null)}
          onAddProductToPallet={handleAddProductToPallet}
          onTransferStock={handleGoToTransferWithStock}
          onWithdrawStock={handleGoToWithdrawWithStock}
          onAdjustStock={handleGoToAdjustWithStock}
          onPalletDeleted={() => setSelectedPallet(null)}
        />
      )}

      {/* Fixed Bottom Navigation with large buttons */}
      {currentUser && (
        <BottomNav activeTab={activeTab} onChangeTab={(tab) => setActiveTab(tab)} />
      )}
    </div>
  );
}
