import React from 'react';
import { Warehouse, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { User } from 'firebase/auth';
import { loginWithGoogle, logoutUser } from '../firebase';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentUser: User | null;
  totalPallets: number;
  totalItems: number;
  onLoginClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  totalPallets,
  totalItems,
  onLoginClick,
}) => {
  return (
    <header className="bg-emerald-800 text-white shadow-md sticky top-0 z-30 pt-[max(8px,env(safe-area-inset-top,0px))]">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center space-x-2 min-w-0">
          <div className="bg-emerald-600 p-1.5 sm:p-2 rounded-xl text-white shadow-inner flex items-center justify-center shrink-0">
            <Warehouse className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-xl font-black tracking-tight leading-none text-emerald-50 truncate">
                PALLET FÁCIL
              </h1>
              <span className="hidden sm:inline-block bg-emerald-700 text-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                Logística
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-200 mt-0.5 font-medium truncate hidden xs:block">
              Endereçamento de Estoque
            </p>
          </div>
        </div>

        {/* Stats, iOS/PWA Install & User Info */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          {/* In-App PWA Install Button for iOS & Android */}
          <PWAInstallButton variant="header" />

          {/* Stats Badges */}
          <div className="hidden md:flex items-center gap-3 bg-emerald-900/60 px-3 py-1.5 rounded-lg border border-emerald-700/50 text-xs text-emerald-100">
            <div>
              <span className="text-emerald-300 font-semibold">{totalPallets}</span> pallets
            </div>
            <div className="w-1 h-3 bg-emerald-600 rounded-full" />
            <div>
              <span className="text-emerald-300 font-semibold">{totalItems}</span> itens
            </div>
          </div>

          {currentUser ? (
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <div className="flex items-center space-x-1.5 bg-emerald-900/70 border border-emerald-700/60 py-1 px-2 rounded-full text-xs">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Operador'}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-4 h-4 text-emerald-300" />
                )}
                <span className="hidden sm:inline font-medium text-emerald-100 max-w-[100px] truncate">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </span>
              </div>
              <button
                onClick={() => logoutUser()}
                title="Sair da conta"
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700 active:scale-95 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => (onLoginClick ? onLoginClick() : loginWithGoogle())}
              className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs py-1.5 px-2.5 rounded-lg shadow transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
