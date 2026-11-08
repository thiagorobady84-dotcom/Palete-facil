import React from 'react';
import { Search, Layers, PlusCircle, ArrowLeftRight, History } from 'lucide-react';
import { TabType } from '../types';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    { id: 'pesquisar' as TabType, label: 'Pesquisar', icon: Search },
    { id: 'pallets' as TabType, label: 'Pallets', icon: Layers },
    { id: 'entrada' as TabType, label: 'Dar entrada', icon: PlusCircle, highlight: true },
    { id: 'movimentar' as TabType, label: 'Movimentar', icon: ArrowLeftRight },
    { id: 'historico' as TabType, label: 'Histórico', icon: History },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] max-w-4xl mx-auto">
      <div className="grid grid-cols-5 gap-1 p-1 sm:p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.highlight) {
            return (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id)}
                className="flex flex-col items-center justify-center py-1 sm:py-1.5 focus:outline-none"
              >
                <div
                  className={`w-12 h-10 sm:w-14 sm:h-11 rounded-2xl flex items-center justify-center transition-all shadow-md ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-emerald-700/30 ring-2 ring-emerald-500 scale-105'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                  }`}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
                </div>
                <span
                  className={`text-[11px] sm:text-xs font-bold mt-1 ${
                    isActive ? 'text-emerald-800' : 'text-slate-700'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 sm:py-2 rounded-xl transition-all ${
                isActive
                  ? 'bg-emerald-50 text-emerald-800 font-bold'
                  : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-50'
              }`}
            >
              <div
                className={`p-1 rounded-lg ${
                  isActive ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span
                className={`text-[11px] sm:text-xs font-medium tracking-tight ${
                  isActive ? 'text-emerald-800 font-bold' : 'text-slate-600'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
