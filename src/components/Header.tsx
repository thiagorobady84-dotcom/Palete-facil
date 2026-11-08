import React from 'react';
import { Package, Warehouse, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { User } from 'firebase/auth';
import { loginWithGoogle, logoutUser } from '../firebase';

interface HeaderProps {
  currentUser: User | null;
  totalPallets: number;
  totalItems: number;
}

export const Header: React.FC<HeaderProps> = ({ currentUser, totalPallets, totalItems }) => {
  return (
    <header className="bg-emerald-800 text-white shadow-md sticky top-0 z-30">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-inner flex items-center justify-center">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-black tracking-tight leading-none text-emerald-50">
                PALLET FÁCIL
              </h1>
              <span className="bg-emerald-700 text-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                Logística
              </span>
            </div>
            <p className="text-xs text-emerald-200 mt-0.5 font-medium">
              Endereçamento de Estoque
            </p>
          </div>
        </div>

        {/* Stats & User Info */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center gap-3 bg-emerald-900/60 px-3 py-1.5 rounded-lg border border-emerald-700/50 text-xs text-emerald-100">
            <div>
              <span className="text-emerald-300 font-semibold">{totalPallets}</span> pallets
            </div>
            <div className="w-1 h-3 bg-emerald-600 rounded-full" />
            <div>
              <span className="text-emerald-300 font-semibold">{totalItems}</span> itens
            </div>
          </div>

          {currentUser ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 bg-emerald-900/70 border border-emerald-700/60 py-1 px-2.5 rounded-full text-xs">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Operador'}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <UserIcon className="w-4 h-4 text-emerald-300" />
                )}
                <span className="hidden md:inline font-medium text-emerald-100 max-w-[120px] truncate">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </span>
              </div>
              <button
                onClick={() => logoutUser()}
                title="Sair"
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => loginWithGoogle()}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs py-1.5 px-3 rounded-lg shadow transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
