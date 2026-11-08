import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Pallet, PalletStock, Movement, UnitType } from '../types';
import { normalizeText, formatPalletCode } from '../utils/normalize';

const PRODUCTS_COL = 'products';
const PALLETS_COL = 'pallets';
const PALLET_STOCK_COL = 'palletStock';
const MOVEMENTS_COL = 'movements';

/**
 * Cadastra ou obtém produto existente pelo nome
 */
export async function getOrCreateProduct(
  name: string,
  code?: string
): Promise<Product> {
  const trimmedName = name.trim();
  const normalized = normalizeText(trimmedName);
  const trimmedCode = code?.trim() || '';

  try {
    const q = query(collection(db, PRODUCTS_COL), where('normalizedName', '==', normalized));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const docItem = snap.docs[0];
      const prod = { id: docItem.id, ...(docItem.data() as Omit<Product, 'id'>) };
      // Se não tinha código antes e agora foi informado, atualiza
      if (trimmedCode && !prod.code) {
        await updateDoc(doc(db, PRODUCTS_COL, prod.id), {
          code: trimmedCode,
          updatedAt: new Date().toISOString(),
        });
        prod.code = trimmedCode;
      }
      return prod;
    }

    // Criar novo produto
    const newDocRef = doc(collection(db, PRODUCTS_COL));
    const newProduct: Product = {
      id: newDocRef.id,
      name: trimmedName,
      code: trimmedCode,
      normalizedName: normalized,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(newDocRef, newProduct);
    return newProduct;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, PRODUCTS_COL);
  }
}

/**
 * Cadastra um novo pallet com identificador único
 */
export async function createPallet(
  rawCode: string,
  location?: string
): Promise<Pallet> {
  const code = formatPalletCode(rawCode);
  if (!code) {
    throw new Error('O código do pallet é obrigatório.');
  }

  try {
    // Verificar se já existe pallet com esse código
    const q = query(collection(db, PALLETS_COL), where('code', '==', code));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error(`O pallet ${code} já está cadastrado no sistema.`);
    }

    const docRef = doc(collection(db, PALLETS_COL));
    const newPallet: Pallet = {
      id: docRef.id,
      code,
      location: location?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, newPallet);
    return newPallet;
  } catch (err) {
    if (err instanceof Error && err.message.includes('já está cadastrado')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, PALLETS_COL);
  }
}

/**
 * Atualiza a localização física de um pallet
 */
export async function updatePalletLocation(
  palletId: string,
  newLocation: string
): Promise<void> {
  try {
    const docRef = doc(db, PALLETS_COL, palletId);
    await updateDoc(docRef, {
      location: newLocation.trim(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${PALLETS_COL}/${palletId}`);
  }
}

/**
 * Sugere o próximo código sequencial de pallet (Ex: P01 -> P02 -> P03)
 */
export function suggestNextPalletCode(pallets: Pallet[]): string {
  let highestNum = 0;
  for (const p of pallets) {
    const match = p.code.match(/^P?(\d+)$/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > highestNum) highestNum = n;
    }
  }
  const next = highestNum + 1;
  return `P${next < 10 ? '0' : ''}${next}`;
}

/**
 * Entrada de produtos:
 * - Se já existir no pallet um registro do mesmo produto e unidade, somar a quantidade em vez de duplicar.
 * - Registra movimentação do tipo ENTRADA.
 */
export async function registerProductIntake(params: {
  productName: string;
  productCode?: string;
  palletId: string;
  palletCode: string;
  quantity: number;
  unit: UnitType;
  userEmail?: string;
  userId?: string;
}): Promise<void> {
  const { productName, productCode, palletId, palletCode, quantity, unit, userEmail, userId } = params;

  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('A quantidade deve ser um número inteiro positivo maior que zero.');
  }

  // 1. Obter ou cadastrar produto
  const product = await getOrCreateProduct(productName, productCode);

  try {
    // 2. Verificar se já existe estoque desse produto e unidade nesse pallet
    const q = query(
      collection(db, PALLET_STOCK_COL),
      where('palletId', '==', palletId),
      where('productId', '==', product.id),
      where('unit', '==', unit)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      // Já existe: SOMAR a quantidade
      const existingDoc = snap.docs[0];
      const currentQty = existingDoc.data().quantity || 0;
      const newQty = currentQty + quantity;

      await updateDoc(doc(db, PALLET_STOCK_COL, existingDoc.id), {
        quantity: newQty,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Não existe: criar novo registro
      const newStockRef = doc(collection(db, PALLET_STOCK_COL));
      const newStock: PalletStock = {
        id: newStockRef.id,
        palletId,
        palletCode,
        productId: product.id,
        productName: product.name,
        productCode: product.code || '',
        normalizedProductName: product.normalizedName,
        quantity,
        unit,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(newStockRef, newStock);
    }

    // 3. Registrar movimentação de ENTRADA
    const movementRef = doc(collection(db, MOVEMENTS_COL));
    const movement: Movement = {
      id: movementRef.id,
      type: 'ENTRADA',
      productId: product.id,
      productName: product.name,
      productCode: product.code || '',
      destinationPalletId: palletId,
      destinationPalletCode: palletCode,
      quantity,
      unit,
      userEmail: userEmail || 'Operador',
      userId: userId || '',
      createdAt: new Date().toISOString(),
    };
    await setDoc(movementRef, movement);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, PALLET_STOCK_COL);
  }
}

/**
 * Retirada de produtos do pallet
 * Impede quantidades negativas e saídas superiores ao saldo disponível.
 */
export async function withdrawStock(params: {
  stockId: string;
  quantityToWithdraw: number;
  reason?: string;
  userEmail?: string;
  userId?: string;
}): Promise<void> {
  const { stockId, quantityToWithdraw, reason, userEmail, userId } = params;

  if (quantityToWithdraw <= 0 || !Number.isInteger(quantityToWithdraw)) {
    throw new Error('A quantidade a retirar deve ser um número inteiro positivo.');
  }

  try {
    await runTransaction(db, async (transaction) => {
      const stockRef = doc(db, PALLET_STOCK_COL, stockId);
      const stockSnap = await transaction.get(stockRef);

      if (!stockSnap.exists()) {
        throw new Error('Registro de estoque não encontrado no pallet.');
      }

      const stockData = stockSnap.data() as PalletStock;
      const currentQty = stockData.quantity;

      if (quantityToWithdraw > currentQty) {
        throw new Error(
          `Saldo insuficiente! O pallet possui apenas ${currentQty} ${stockData.unit}.`
        );
      }

      const remainingQty = currentQty - quantityToWithdraw;

      if (remainingQty === 0) {
        // Se zerar o estoque no pallet, removemos o registro do pallet para mantê-lo limpo
        transaction.delete(stockRef);
      } else {
        transaction.update(stockRef, {
          quantity: remainingQty,
          updatedAt: new Date().toISOString(),
        });
      }

      // Registrar histórico de movimentação
      const movementRef = doc(collection(db, MOVEMENTS_COL));
      const movement: Movement = {
        id: movementRef.id,
        type: 'RETIRADA',
        productId: stockData.productId,
        productName: stockData.productName,
        productCode: stockData.productCode || '',
        originPalletId: stockData.palletId,
        originPalletCode: stockData.palletCode,
        quantity: quantityToWithdraw,
        unit: stockData.unit,
        reason: reason?.trim() || 'Retirada operacional',
        userEmail: userEmail || 'Operador',
        userId: userId || '',
        createdAt: new Date().toISOString(),
      };
      transaction.set(movementRef, movement);
    });
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Saldo insuficiente') || err.message.includes('Registro de estoque'))) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, PALLET_STOCK_COL);
  }
}

/**
 * Transferência entre pallets
 * Atualiza os saldos de origem e destino em uma única operação segura e atômica.
 * Impede transferências superiores ao saldo disponível.
 */
export async function transferStock(params: {
  originStockId: string;
  destinationPalletId: string;
  destinationPalletCode: string;
  quantityToTransfer: number;
  reason?: string;
  userEmail?: string;
  userId?: string;
}): Promise<void> {
  const {
    originStockId,
    destinationPalletId,
    destinationPalletCode,
    quantityToTransfer,
    reason,
    userEmail,
    userId,
  } = params;

  if (quantityToTransfer <= 0 || !Number.isInteger(quantityToTransfer)) {
    throw new Error('A quantidade para transferência deve ser um número inteiro positivo.');
  }

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Ler registro de estoque de origem
      const originRef = doc(db, PALLET_STOCK_COL, originStockId);
      const originSnap = await transaction.get(originRef);

      if (!originSnap.exists()) {
        throw new Error('O item de origem não foi encontrado no pallet.');
      }

      const originData = originSnap.data() as PalletStock;

      if (originData.palletId === destinationPalletId) {
        throw new Error('O pallet de destino deve ser diferente do pallet de origem.');
      }

      if (quantityToTransfer > originData.quantity) {
        throw new Error(
          `Saldo insuficiente para transferência! O pallet ${originData.palletCode} possui apenas ${originData.quantity} ${originData.unit}.`
        );
      }

      // 2. Atualizar estoque de origem
      const originRemaining = originData.quantity - quantityToTransfer;
      if (originRemaining === 0) {
        transaction.delete(originRef);
      } else {
        transaction.update(originRef, {
          quantity: originRemaining,
          updatedAt: new Date().toISOString(),
        });
      }

      // 3. Procurar estoque do mesmo produto/unidade no pallet de destino
      // Em transação Firestore, buscas via query devem ser feitas antes ou usar docId previsível
      // Para manter 100% atômico e sem conflito, usamos um id determinístico baseado em palletId_productId_unit
      // Mas para compatibilidade com registros existentes, vamos verificar se existe registro de destino
      // Vamos usar uma abordagem segura:
      const destDocId = `${destinationPalletId}_${originData.productId}_${originData.unit}`;
      const destRef = doc(db, PALLET_STOCK_COL, destDocId);
      const destSnap = await transaction.get(destRef);

      if (destSnap.exists()) {
        const destCurrentQty = destSnap.data().quantity || 0;
        transaction.update(destRef, {
          quantity: destCurrentQty + quantityToTransfer,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Criar no destino
        const newDestStock: PalletStock = {
          id: destDocId,
          palletId: destinationPalletId,
          palletCode: destinationPalletCode,
          productId: originData.productId,
          productName: originData.productName,
          productCode: originData.productCode || '',
          normalizedProductName: originData.normalizedProductName,
          quantity: quantityToTransfer,
          unit: originData.unit,
          updatedAt: new Date().toISOString(),
        };
        transaction.set(destRef, newDestStock);
      }

      // 4. Registrar movimentação de TRANSFERÊNCIA
      const movementRef = doc(collection(db, MOVEMENTS_COL));
      const movement: Movement = {
        id: movementRef.id,
        type: 'TRANSFERENCIA',
        productId: originData.productId,
        productName: originData.productName,
        productCode: originData.productCode || '',
        originPalletId: originData.palletId,
        originPalletCode: originData.palletCode,
        destinationPalletId,
        destinationPalletCode,
        quantity: quantityToTransfer,
        unit: originData.unit,
        reason: reason?.trim() || 'Transferência entre pallets',
        userEmail: userEmail || 'Operador',
        userId: userId || '',
        createdAt: new Date().toISOString(),
      };
      transaction.set(movementRef, movement);
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('Saldo insuficiente') ||
        err.message.includes('destino deve ser diferente') ||
        err.message.includes('origem não foi encontrado'))
    ) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, PALLET_STOCK_COL);
  }
}

/**
 * Ajuste manual de quantidade com registro obrigatório de motivo
 */
export async function adjustStock(params: {
  stockId: string;
  newQuantity: number;
  reason: string;
  userEmail?: string;
  userId?: string;
}): Promise<void> {
  const { stockId, newQuantity, reason, userEmail, userId } = params;

  if (newQuantity < 0 || !Number.isInteger(newQuantity)) {
    throw new Error('A nova quantidade não pode ser negativa e deve ser um número inteiro.');
  }

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error('É obrigatório informar o motivo do ajuste manual (ex: Contagem de inventário, Avaria).');
  }

  try {
    await runTransaction(db, async (transaction) => {
      const stockRef = doc(db, PALLET_STOCK_COL, stockId);
      const stockSnap = await transaction.get(stockRef);

      if (!stockSnap.exists()) {
        throw new Error('Item de estoque não encontrado.');
      }

      const stockData = stockSnap.data() as PalletStock;
      const oldQty = stockData.quantity;
      const diff = newQuantity - oldQty;

      if (diff === 0) {
        throw new Error('A nova quantidade informada é idêntica à quantidade atual.');
      }

      if (newQuantity === 0) {
        transaction.delete(stockRef);
      } else {
        transaction.update(stockRef, {
          quantity: newQuantity,
          updatedAt: new Date().toISOString(),
        });
      }

      // Registrar histórico de AJUSTE
      const movementRef = doc(collection(db, MOVEMENTS_COL));
      const movement: Movement = {
        id: movementRef.id,
        type: 'AJUSTE',
        productId: stockData.productId,
        productName: stockData.productName,
        productCode: stockData.productCode || '',
        originPalletId: stockData.palletId,
        originPalletCode: stockData.palletCode,
        quantity: Math.abs(diff),
        unit: stockData.unit,
        reason: `${trimmedReason} (Alterado de ${oldQty} para ${newQuantity} ${stockData.unit})`,
        userEmail: userEmail || 'Operador',
        userId: userId || '',
        createdAt: new Date().toISOString(),
      };
      transaction.set(movementRef, movement);
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('A nova quantidade') ||
        err.message.includes('idêntica à quantidade') ||
        err.message.includes('obrigatório informar o motivo'))
    ) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, PALLET_STOCK_COL);
  }
}

/**
 * Excluir pallet vazio
 * Bloqueia exclusão se o pallet possuir saldo ativo.
 */
export async function deletePallet(palletId: string, palletCode: string): Promise<void> {
  try {
    const q = query(collection(db, PALLET_STOCK_COL), where('palletId', '==', palletId));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const hasStock = snap.docs.some((d) => d.data().quantity > 0);
      if (hasStock) {
        throw new Error(
          `O pallet ${palletCode} não pode ser excluído pois ainda contém produtos armazenados. Transfira ou retire os produtos antes.`
        );
      }
    }

    await deleteDoc(doc(db, PALLETS_COL, palletId));
  } catch (err) {
    if (err instanceof Error && err.message.includes('não pode ser excluído')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.DELETE, `${PALLETS_COL}/${palletId}`);
  }
}

/**
 * Popula dados iniciais de demonstração (se o banco estiver vazio),
 * incluindo o exemplo exato citado no prompt:
 * "Ketchup Predilecta - Pallet P01: 12 caixas / Pallet P02: 5 caixas"
 */
export async function seedDemoDataIfEmpty(): Promise<boolean> {
  try {
    const palletsSnap = await getDocs(collection(db, PALLETS_COL));
    if (!palletsSnap.empty) {
      return false; // Já possui dados
    }

    console.log('Iniciando carga de dados demonstrativos do Sistema Pallet Fácil...');

    // 1. Criar Pallets
    const p01Ref = doc(collection(db, PALLETS_COL));
    const p01: Pallet = {
      id: p01Ref.id,
      code: 'P01',
      location: 'Rua 01 - Nível Térreo (Doca)',
      createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(p01Ref, p01);

    const p02Ref = doc(collection(db, PALLETS_COL));
    const p02: Pallet = {
      id: p02Ref.id,
      code: 'P02',
      location: 'Rua 02 - Prédio B (Nível 2)',
      createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(p02Ref, p02);

    const p03Ref = doc(collection(db, PALLETS_COL));
    const p03: Pallet = {
      id: p03Ref.id,
      code: 'P03',
      location: 'Corredor Central - Nível 1',
      createdAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(p03Ref, p03);

    // 2. Criar Produtos
    const prodKetchupRef = doc(collection(db, PRODUCTS_COL));
    const prodKetchup: Product = {
      id: prodKetchupRef.id,
      name: 'Ketchup Predilecta',
      code: '789123456001',
      normalizedName: normalizeText('Ketchup Predilecta'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(prodKetchupRef, prodKetchup);

    const prodMaioneseRef = doc(collection(db, PRODUCTS_COL));
    const prodMaionese: Product = {
      id: prodMaioneseRef.id,
      name: "Maionese Hellmann's 500g",
      code: '789123456002',
      normalizedName: normalizeText("Maionese Hellmann's 500g"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(prodMaioneseRef, prodMaionese);

    const prodMolhoRef = doc(collection(db, PRODUCTS_COL));
    const prodMolho: Product = {
      id: prodMolhoRef.id,
      name: 'Molho de Tomate Pomarola Tradicional',
      code: '789123456003',
      normalizedName: normalizeText('Molho de Tomate Pomarola Tradicional'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(prodMolhoRef, prodMolho);

    const prodAcucarRef = doc(collection(db, PRODUCTS_COL));
    const prodAcucar: Product = {
      id: prodAcucarRef.id,
      name: 'Açúcar Cristal União 1kg',
      code: '789123456004',
      normalizedName: normalizeText('Açúcar Cristal União 1kg'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(prodAcucarRef, prodAcucar);

    // 3. Criar Estoque por Pallet:
    // P01 tem 12 caixas de Ketchup e 20 caixas de Maionese (mostrando múltiplos produtos no mesmo pallet)
    const stock1Ref = doc(collection(db, PALLET_STOCK_COL));
    const stock1: PalletStock = {
      id: stock1Ref.id,
      palletId: p01.id,
      palletCode: p01.code,
      productId: prodKetchup.id,
      productName: prodKetchup.name,
      productCode: prodKetchup.code,
      normalizedProductName: prodKetchup.normalizedName,
      quantity: 12,
      unit: 'caixas',
      updatedAt: new Date().toISOString(),
    };
    await setDoc(stock1Ref, stock1);

    const stock2Ref = doc(collection(db, PALLET_STOCK_COL));
    const stock2: PalletStock = {
      id: stock2Ref.id,
      palletId: p01.id,
      palletCode: p01.code,
      productId: prodMaionese.id,
      productName: prodMaionese.name,
      productCode: prodMaionese.code,
      normalizedProductName: prodMaionese.normalizedName,
      quantity: 20,
      unit: 'caixas',
      updatedAt: new Date().toISOString(),
    };
    await setDoc(stock2Ref, stock2);

    // P02 tem 5 caixas de Ketchup e 15 caixas de Molho
    const stock3Ref = doc(collection(db, PALLET_STOCK_COL));
    const stock3: PalletStock = {
      id: stock3Ref.id,
      palletId: p02.id,
      palletCode: p02.code,
      productId: prodKetchup.id,
      productName: prodKetchup.name,
      productCode: prodKetchup.code,
      normalizedProductName: prodKetchup.normalizedName,
      quantity: 5,
      unit: 'caixas',
      updatedAt: new Date().toISOString(),
    };
    await setDoc(stock3Ref, stock3);

    const stock4Ref = doc(collection(db, PALLET_STOCK_COL));
    const stock4: PalletStock = {
      id: stock4Ref.id,
      palletId: p02.id,
      palletCode: p02.code,
      productId: prodMolho.id,
      productName: prodMolho.name,
      productCode: prodMolho.code,
      normalizedProductName: prodMolho.normalizedName,
      quantity: 15,
      unit: 'caixas',
      updatedAt: new Date().toISOString(),
    };
    await setDoc(stock4Ref, stock4);

    // P03 tem 50 unidades de Açúcar Cristal
    const stock5Ref = doc(collection(db, PALLET_STOCK_COL));
    const stock5: PalletStock = {
      id: stock5Ref.id,
      palletId: p03.id,
      palletCode: p03.code,
      productId: prodAcucar.id,
      productName: prodAcucar.name,
      productCode: prodAcucar.code,
      normalizedProductName: prodAcucar.normalizedName,
      quantity: 50,
      unit: 'unidades',
      updatedAt: new Date().toISOString(),
    };
    await setDoc(stock5Ref, stock5);

    // 4. Histórico inicial
    const m1Ref = doc(collection(db, MOVEMENTS_COL));
    await setDoc(m1Ref, {
      id: m1Ref.id,
      type: 'ENTRADA',
      productId: prodKetchup.id,
      productName: prodKetchup.name,
      productCode: prodKetchup.code,
      destinationPalletId: p01.id,
      destinationPalletCode: p01.code,
      quantity: 12,
      unit: 'caixas',
      userEmail: 'sistema@palletfacil.com',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    });

    const m2Ref = doc(collection(db, MOVEMENTS_COL));
    await setDoc(m2Ref, {
      id: m2Ref.id,
      type: 'ENTRADA',
      productId: prodKetchup.id,
      productName: prodKetchup.name,
      productCode: prodKetchup.code,
      destinationPalletId: p02.id,
      destinationPalletCode: p02.code,
      quantity: 5,
      unit: 'caixas',
      userEmail: 'sistema@palletfacil.com',
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    });

    return true;
  } catch (err) {
    console.error('Erro ao popular dados demonstrativos:', err);
    return false;
  }
}
