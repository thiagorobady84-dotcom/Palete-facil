export type UnitType = 'caixas' | 'unidades';

export type MovementType = 'ENTRADA' | 'RETIRADA' | 'TRANSFERENCIA' | 'AJUSTE';

export interface Product {
  id: string;
  name: string;
  code?: string;
  normalizedName: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Pallet {
  id: string;
  code: string; // e.g. "P01", "P02"
  location?: string; // e.g. "Rua A - Nível 2"
  createdAt?: string;
  updatedAt?: string;
}

export interface PalletStock {
  id: string;
  palletId: string;
  palletCode: string;
  productId: string;
  productName: string;
  productCode?: string;
  normalizedProductName: string;
  quantity: number;
  unit: UnitType;
  updatedAt?: string;
}

export interface Movement {
  id: string;
  type: MovementType;
  productId: string;
  productName: string;
  productCode?: string;
  originPalletId?: string;
  originPalletCode?: string;
  destinationPalletId?: string;
  destinationPalletCode?: string;
  quantity: number;
  unit: UnitType;
  reason?: string;
  userId?: string;
  userEmail?: string;
  createdAt: string;
}

export type TabType = 'pesquisar' | 'pallets' | 'entrada' | 'movimentar' | 'historico';
