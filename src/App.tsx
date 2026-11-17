import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  db,
  loginWithGoogle,
  loginWithGoogleRedirect,
  checkRedirectResult,
  parseAuthError,
  ParsedAuthError,
  testConnection,
  handleFirestoreError,
  OperationType,
  resolvedFirebaseConfig,
} from './firebase';
import { Product, Pallet, PalletStock, Movement, DeletedPallet, TabType } from './types';
import { seedDemoDataIfEmpty, cleanupAndConsolidatePalletStock } from './services/palletService';

import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { SearchTab } from './components/SearchTab';
import { PalletsTab } from './components/PalletsTab';
import { IntakeTab } from './components/IntakeTab';
import { MovementTab } from './components/MovementTab';
import { HistoryTab } from './components/HistoryTab';
import { PalletDetailModal } from './components/PalletDetailModal';
import { AuthErrorBanner } from './components/AuthErrorBanner';
import { PWAInstallButton } from './components/PWAInstallButton';
import { Warehouse, LogIn, RefreshCw, Smartphone, Globe } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<ParsedAuthError | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('pesquisar');

  // Real-time Firestore state
  const [products, setProducts] = useState<Product[]>([]);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [palletStock, setPalletStock] = useState<PalletStock[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [deletedPallets, setDeletedPallets] = useState<DeletedPallet[]>([]);

  // Selected pallet for detail modal
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);

  // Pre-fill parameters for tab transitions
  const [intakeProductPrefill, setIntakeProductPrefill] = useState<{
    name: string;
    palletId?: string;
  }>({ name: '', palletId: '' });

  const [movementStockPrefill, setMovementStockPrefill] = useState<{
    stock: PalletStock | null;
    action: 'transfer' | 'withdraw' | 'adjust';
  }>({ stock: null, action: 'transfer' });

  // 1. Check Connection, Process Redirect and Monitor Auth state
  useEffect(() => {
    testConnection();

    // Check if user just returned from a Google Redirect login flow
    checkRedirectResult()
      .then((res) => {
        if (res?.user) {
          setCurrentUser(res.user);
          setAuthError(null);
        }
      })
      .catch((err) => {
        console.error('Redirect result catch:', err);
        setAuthError(parseAuthError(err));
      });

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        setAuthError(null);
        // Seed realistic demo data if collection is empty & clean up any zero/corrupted records
        try {
          await seedDemoDataIfEmpty();
          await cleanupAndConsolidatePalletStock();
        } catch (err) {
          console.error('Init stock check error:', err);
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
      setDeletedPallets([]);
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

    // Listener: DeletedPallets (Lixeira de paletes excluídos)
    const unsubDeletedPallets = onSnapshot(
      collection(db, 'deletedPallets'),
      (snap) => {
        const list: DeletedPallet[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DeletedPallet, 'id'>),
        }));
        setDeletedPallets(list);
      },
      (error) => console.warn('Deleted pallets listener:', error)
    );

    return () => {
      unsubProducts();
      unsubPallets();
      unsubStock();
      unsubMovements();
      unsubDeletedPallets();
    };
  }, [currentUser]);

  // Keep selectedPallet updated if its data changes
  useEffect(() => {
    if (selectedPallet) {
      const updated = pallets.find((p) => p.id === selectedPallet.id);
      if (updated) setSelectedPallet(updated);
    }
  }, [pallets, selectedPallet]);

  // Handlers for authentication
  const handleLoginPopup = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Login Popup Error:', err);
      const parsed = parseAuthError(err);
      setAuthError(parsed);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLoginRedirect = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      await loginWithGoogleRedirect();
    } catch (err: any) {
      console.error('Login Redirect Error:', err);
      const parsed = parseAuthError(err);
      setAuthError(parsed);
      setIsAuthenticating(false);
    }
  };

  // Handlers for cross-tab actions
  const handleGoToIntakeWithProduct = (productName: string) => {
    setIntakeProductPrefill({ name: productName, palletId: '' });
    setActiveTab('entrada');
  };

  const handleAddProductToPallet = (pallet: Pallet) => {
    setIntakeProductPrefill({ name: '', palletId: pallet.id });
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

  // Compute summary stats with safe numeric parsing
  const totalItemsCount = palletStock.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);

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
        onLoginClick={handleLoginPopup}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-5 space-y-3.5">
        <PWAInstallButton variant="banner" />

        {!currentUser ? (
          // Welcome / Sign-in required screen for multi-user security
          <div className="my-6 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-center max-w-lg mx-auto space-y-5">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Warehouse className="w-8 h-8 text-emerald-700" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                SISTEMA PALLET FÁCIL
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Endereçamento logístico por pallets em tempo real. Identifique o operador para
                gravar movimentações e garantir a segurança do estoque.
              </p>
            </div>

            {/* Diagnostic Alert Banner if an Auth Error Occurred */}
            {authError && (
              <AuthErrorBanner
                error={authError}
                onRetryPopup={handleLoginPopup}
                onRetryRedirect={handleLoginRedirect}
                onDismiss={() => setAuthError(null)}
                isRetrying={isAuthenticating}
              />
            )}

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-left text-xs text-emerald-900 space-y-1.5">
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

            <div className="space-y-2.5">
              <button
                onClick={handleLoginPopup}
                disabled={isAuthenticating}
                className="w-full bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-black text-base py-3.5 px-6 rounded-2xl shadow-md transition flex items-center justify-center gap-2.5 disabled:opacity-70"
              >
                {isAuthenticating ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                <span>{isAuthenticating ? 'Abrindo login do Google...' : 'Entrar com Google'}</span>
              </button>

              <button
                onClick={handleLoginRedirect}
                disabled={isAuthenticating}
                className="w-full text-xs font-bold text-slate-600 hover:text-emerald-800 bg-slate-50 hover:bg-slate-100 py-2.5 px-4 rounded-xl border border-slate-200 transition flex items-center justify-center gap-1.5"
                title="Use se estiver no celular e a janela de login não abrir"
              >
                <Smartphone className="w-4 h-4 text-slate-400" />
                <span>Problema com janela pop-up? Clique para entrar via Redirecionamento</span>
              </button>
            </div>

            {/* Current Host Indicator */}
            {typeof window !== 'undefined' && window.location.hostname !== 'localhost' && (
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <Globe className="w-3 h-3" />
                <span>
                  Hospedado em: <strong className="font-mono text-slate-600">{window.location.hostname}</strong>
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* View switcher based on bottom nav tab */}
            {activeTab === 'pesquisar' && (
              <SearchTab
                products={products}
                pallets={pallets}
                palletStock={palletStock}
                currentUser={currentUser}
                onSelectPallet={(pallet) => setSelectedPallet(pallet)}
                onGoToIntakeWithProduct={handleGoToIntakeWithProduct}
                onGoToTransferWithStock={handleGoToTransferWithStock}
                onGoToWithdrawWithStock={handleGoToWithdrawWithStock}
              />
            )}

            {activeTab === 'pallets' && (
              <PalletsTab
                pallets={pallets}
                palletStocks={palletStock}
                movements={movements}
                deletedPallets={deletedPallets}
                currentUser={currentUser}
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
                  // Keep the current subtab without forcing back to transfer
                  setMovementStockPrefill((prev) => ({ ...prev, stock: null }));
                }}
              />
            )}

            {activeTab === 'historico' && (
              <HistoryTab
                movements={movements}
                pallets={pallets}
                deletedPallets={deletedPallets}
                currentUser={currentUser}
              />
            )}
          </>
        )}
      </main>

      {/* Pallet Detail Modal (Accessible from anywhere) */}
      {selectedPallet && (
        <PalletDetailModal
          pallet={selectedPallet}
          palletStocks={palletStock}
          currentUser={currentUser}
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
