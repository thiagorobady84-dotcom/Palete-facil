export type UnitType = 'caixas' | 'unidades';

export type MovementType = 'ENTRADA' | 'RETIRADA' | 'TRANSFERENCIA' | 'AJUSTE';

export interface Product {
  id: string;
  name: string;
  code?: string;
  normalizedName: string;
  expirationDate?: string; // Formato YYYY-MM-DD (opcional)
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
  expirationDate?: string; // Formato YYYY-MM-DD (opcional)
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
  expirationDate?: string; // Formato YYYY-MM-DD (opcional)
  reason?: string;
  userId?: string;
  userEmail?: string;
  createdAt: string;
}

export interface DeletedPalletItem {
  productId?: string;
  productName: string;
  productCode?: string;
  quantity: number;
  unit: UnitType;
  expirationDate?: string;
}

export interface DeletedPallet {
  id: string;
  palletId: string;
  code: string;
  location?: string;
  items: DeletedPalletItem[];
  deletedAt: string;
  deletedByEmail?: string;
  deletedByUserId?: string;
  source?: 'trash' | 'history';
}

export type TabType = 'pesquisar' | 'pallets' | 'entrada' | 'movimentar' | 'historico';
