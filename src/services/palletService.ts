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
  writeBatch,
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
  code?: string,
  expirationDate?: string
): Promise<Product> {
  const trimmedName = name.trim();
  const normalized = normalizeText(trimmedName);
  const trimmedCode = code?.trim() || '';
  const trimmedExpiry = expirationDate?.trim() || '';

  try {
    const q = query(collection(db, PRODUCTS_COL), where('normalizedName', '==', normalized));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const docItem = snap.docs[0];
      const prod = { id: docItem.id, ...(docItem.data() as Omit<Product, 'id'>) };
      const updates: Partial<Product> = {};

      // Se não tinha código antes e agora foi informado, atualiza
      if (trimmedCode && !prod.code) {
        updates.code = trimmedCode;
        prod.code = trimmedCode;
      }
      // Se foi informada validade, atualiza no cadastro do produto
      if (trimmedExpiry && prod.expirationDate !== trimmedExpiry) {
        updates.expirationDate = trimmedExpiry;
        prod.expirationDate = trimmedExpiry;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date().toISOString();
        await updateDoc(doc(db, PRODUCTS_COL, prod.id), updates);
      }
      return prod;
    }

    // Criar novo produto (validade é opcional)
    const newDocRef = doc(collection(db, PRODUCTS_COL));
    const newProduct: Product = {
      id: newDocRef.id,
      name: trimmedName,
      code: trimmedCode,
      normalizedName: normalized,
      expirationDate: trimmedExpiry,
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
 * Retorna o identificador único e padronizado do registro de estoque por pallet, produto e unidade
 */
export function getPalletStockDocId(palletId: string, productId: string, unit: UnitType): string {
  return `${palletId}_${productId}_${unit}`.replace(/[\/\s]/g, '_');
}

/**
 * Realiza limpeza preventiva e consolidação de registros de estoque:
 * 1. Remove documentos com quantidade <= 0 ou corrompidos.
 * 2. Unifica duplicidades do mesmo produto/unidade no mesmo pallet somando os saldos.
 */
export async function cleanupAndConsolidatePalletStock(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, PALLET_STOCK_COL));
    if (snap.empty) return;

    const groups = new Map<string, Array<{ id: string; data: PalletStock }>>();

    for (const d of snap.docs) {
      const data = d.data() as PalletStock;
      const rawQty = Number(data.quantity);

      // Se a quantidade for <= 0 ou inválida, remove do banco imediatamente
      if (isNaN(rawQty) || rawQty <= 0) {
        await deleteDoc(doc(db, PALLET_STOCK_COL, d.id)).catch(() => {});
        continue;
      }

      const key = `${data.palletId}_${data.productId}_${data.unit}`;
      const list = groups.get(key) || [];
      list.push({ id: d.id, data: { ...data, quantity: rawQty } });
      groups.set(key, list);
    }

    // Se houver mais de um documento para a mesma chave, consolida somando as quantidades
    for (const [, items] of groups.entries()) {
      if (items.length > 1) {
        const totalQty = items.reduce((sum, item) => sum + item.data.quantity, 0);
        const primaryDoc = items[0];

        // Atualiza o documento principal com a soma consolidada
        await updateDoc(doc(db, PALLET_STOCK_COL, primaryDoc.id), {
          quantity: totalQty,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});

        // Deleta os documentos duplicados excedentes
        for (let i = 1; i < items.length; i++) {
          await deleteDoc(doc(db, PALLET_STOCK_COL, items[i].id)).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('Erro na limpeza/consolidação preventiva de estoque:', err);
  }
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
  expirationDate?: string;
  userEmail?: string;
  userId?: string;
}): Promise<void> {
  const { productName, productCode, palletId, palletCode, quantity, unit, expirationDate, userEmail, userId } = params;
  const trimmedExpiry = expirationDate?.trim() || '';

  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('A quantidade deve ser um número inteiro positivo maior que zero.');
  }

  // 1. Obter ou cadastrar produto (validade opcional)
  const product = await getOrCreateProduct(productName, productCode, trimmedExpiry || undefined);

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
      // Já existe: SOMAR a quantidade de todos os registros que possam existir (se houver duplicidade anterior)
      const totalCurrentQty = snap.docs.reduce((sum, d) => sum + (Number(d.data().quantity) || 0), 0);
      const newQty = totalCurrentQty + quantity;
      const primaryDoc = snap.docs[0];
      const existingData = primaryDoc.data() as PalletStock;

      const stockUpdates: Partial<PalletStock> = {
        quantity: newQty,
        updatedAt: new Date().toISOString(),
      };
      if (trimmedExpiry) {
        stockUpdates.expirationDate = trimmedExpiry;
      } else if (existingData.expirationDate) {
        stockUpdates.expirationDate = existingData.expirationDate;
      }

      await updateDoc(doc(db, PALLET_STOCK_COL, primaryDoc.id), stockUpdates);

      // Se havia duplicados legados, deleta os excedentes para evitar furos
      for (let i = 1; i < snap.docs.length; i++) {
        await deleteDoc(doc(db, PALLET_STOCK_COL, snap.docs[i].id)).catch(() => {});
      }
    } else {
      // Não existe: criar novo registro com ID padronizado
      const stockDocId = getPalletStockDocId(palletId, product.id, unit);
      const newStockRef = doc(db, PALLET_STOCK_COL, stockDocId);
      const newStock: PalletStock = {
        id: stockDocId,
        palletId,
        palletCode,
        productId: product.id,
        productName: product.name,
        productCode: product.code || '',
        normalizedProductName: product.normalizedName,
        quantity,
        unit,
        expirationDate: trimmedExpiry,
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
      expirationDate: trimmedExpiry,
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
 * Atualiza ou limpa a data de validade (opcional) de um item no pallet e no catálogo.
 */
export async function updateStockExpirationDate(params: {
  stockId: string;
  productId?: string;
  expirationDate: string;
}): Promise<void> {
  const { stockId, productId, expirationDate } = params;
  const trimmedExpiry = expirationDate.trim();

  try {
    await updateDoc(doc(db, PALLET_STOCK_COL, stockId), {
      expirationDate: trimmedExpiry,
      updatedAt: new Date().toISOString(),
    });

    if (productId) {
      await updateDoc(doc(db, PRODUCTS_COL, productId), {
        expirationDate: trimmedExpiry,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${PALLET_STOCK_COL}/${stockId}`);
  }
}

/**
 * Retirada / Baixa de produtos do pallet
 * Impede quantidades negativas e saídas superiores ao saldo disponível.
 * Remove o documento se o saldo for zerado, garantindo saída imediata da contagem.
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
      const currentQty = Number(stockData.quantity) || 0;

      if (quantityToWithdraw > currentQty) {
        throw new Error(
          `Saldo insuficiente! O pallet possui apenas ${currentQty} ${stockData.unit}.`
        );
      }

      const remainingQty = currentQty - quantityToWithdraw;

      if (remainingQty <= 0) {
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
        expirationDate: stockData.expirationDate || '',
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
      const originCurrentQty = Number(originData.quantity) || 0;

      if (originData.palletId === destinationPalletId) {
        throw new Error('O pallet de destino deve ser diferente do pallet de origem.');
      }

      if (quantityToTransfer > originCurrentQty) {
        throw new Error(
          `Saldo insuficiente para transferência! O pallet ${originData.palletCode} possui apenas ${originCurrentQty} ${originData.unit}.`
        );
      }

      // 2. Atualizar estoque de origem
      const originRemaining = originCurrentQty - quantityToTransfer;
      if (originRemaining <= 0) {
        transaction.delete(originRef);
      } else {
        transaction.update(originRef, {
          quantity: originRemaining,
          updatedAt: new Date().toISOString(),
        });
      }

      // 3. Procurar estoque do mesmo produto/unidade no pallet de destino
      const destDocId = getPalletStockDocId(destinationPalletId, originData.productId, originData.unit);
      const destRef = doc(db, PALLET_STOCK_COL, destDocId);
      const destSnap = await transaction.get(destRef);

      if (destSnap.exists()) {
        const destData = destSnap.data() as PalletStock;
        const destCurrentQty = Number(destData.quantity) || 0;
        const destUpdates: Partial<PalletStock> = {
          quantity: destCurrentQty + quantityToTransfer,
          updatedAt: new Date().toISOString(),
        };
        if (originData.expirationDate && !destData.expirationDate) {
          destUpdates.expirationDate = originData.expirationDate;
        }
        transaction.update(destRef, destUpdates);
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
          expirationDate: originData.expirationDate || '',
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
        expirationDate: originData.expirationDate || '',
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
      const oldQty = Number(stockData.quantity) || 0;
      const diff = newQuantity - oldQty;

      if (diff === 0) {
        throw new Error('A nova quantidade informada é idêntica à quantidade atual.');
      }

      if (newQuantity <= 0) {
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
        expirationDate: stockData.expirationDate || '',
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
 * Excluir o pallet inteiro (esteja vazio ou com produtos) em lote atômico rápido
 * Se possuir produtos armazenados, realiza a baixa com registro no histórico de auditoria
 * para não quebrar a rastreabilidade e remove os saldos e o pallet em uma única operação.
 */
export async function deletePallet(
  palletIdOrParams:
    | string
    | {
        palletId: string;
        palletCode: string;
        reason?: string;
        userEmail?: string;
        userId?: string;
      },
  rawPalletCode?: string,
  rawReason?: string,
  rawUserEmail?: string,
  rawUserId?: string
): Promise<void> {
  const palletId =
    typeof palletIdOrParams === 'string' ? palletIdOrParams : palletIdOrParams.palletId;
  const palletCode =
    typeof palletIdOrParams === 'string' ? rawPalletCode || 'Pallet' : palletIdOrParams.palletCode;
  const reason =
    typeof palletIdOrParams === 'string'
      ? rawReason || `Exclusão do Pallet ${palletCode} por completo`
      : palletIdOrParams.reason || `Exclusão do Pallet ${palletCode} por completo`;
  const userEmail =
    typeof palletIdOrParams === 'string' ? rawUserEmail || 'Operador' : palletIdOrParams.userEmail || 'Operador';
  const userId =
    typeof palletIdOrParams === 'string' ? rawUserId || '' : palletIdOrParams.userId || '';

  try {
    // 1. Localizar todos os itens de estoque deste pallet (por palletId e fallback por palletCode)
    const [snapById, snapByCode] = await Promise.all([
      getDocs(query(collection(db, PALLET_STOCK_COL), where('palletId', '==', palletId))),
      getDocs(query(collection(db, PALLET_STOCK_COL), where('palletCode', '==', palletCode))),
    ]);

    const stockDocsMap = new Map<string, PalletStock>();
    for (const d of snapById.docs) {
      stockDocsMap.set(d.id, d.data() as PalletStock);
    }
    for (const d of snapByCode.docs) {
      if (!stockDocsMap.has(d.id)) {
        stockDocsMap.set(d.id, d.data() as PalletStock);
      }
    }

    // 2. Executar baixas no histórico, remoção de estoques e exclusão do pallet em lote atômico rápido
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();

    for (const [docId, stockData] of stockDocsMap.entries()) {
      const qty = Number(stockData.quantity) || 0;
      if (qty > 0) {
        const movementRef = doc(collection(db, MOVEMENTS_COL));
        const movement: Movement = {
          id: movementRef.id,
          type: 'RETIRADA',
          productId: stockData.productId,
          productName: stockData.productName,
          productCode: stockData.productCode || '',
          originPalletId: palletId,
          originPalletCode: palletCode,
          quantity: qty,
          unit: stockData.unit,
          expirationDate: stockData.expirationDate || '',
          reason: reason.trim(),
          userEmail,
          userId,
          createdAt: nowIso,
        };
        batch.set(movementRef, movement);
      }
      batch.delete(doc(db, PALLET_STOCK_COL, docId));
    }

    batch.delete(doc(db, PALLETS_COL, palletId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${PALLETS_COL}/${palletId}`);
  }
}


/**
 * Excluir produto do catálogo geral
 * Se o produto tiver saldo em pallets, permite exclusão segura registrando
 * a baixa no histórico para manter integridade da auditoria.
 */
export async function deleteProductFromCatalog(params: {
  productId: string;
  productName: string;
  removeActiveStocks?: boolean;
  reason?: string;
  userEmail?: string;
  userId?: string;
}): Promise<void> {
  const { productId, productName, removeActiveStocks = false, reason, userEmail, userId } = params;

  try {
    // 1. Verificar saldos em pallets
    const q = query(collection(db, PALLET_STOCK_COL), where('productId', '==', productId));
    const snap = await getDocs(q);

    const activeStocks = snap.docs.filter((d) => d.data().quantity > 0);

    if (activeStocks.length > 0 && !removeActiveStocks) {
      const palletCodes = activeStocks.map((d) => d.data().palletCode).join(', ');
      throw new Error(
        `O produto "${productName}" ainda possui saldo ativo nos pallets: ${palletCodes}. Confirme a baixa dos saldos para prosseguir com a exclusão.`
      );
    }

    // 2. Se autorizado a remover estoques ativos, registra movimentação de baixa para cada pallet
    for (const docSnap of snap.docs) {
      const stockData = docSnap.data() as PalletStock;
      if (stockData.quantity > 0) {
        // Gravar movimentação de auditoria
        const movementRef = doc(collection(db, MOVEMENTS_COL));
        const movement: Movement = {
          id: movementRef.id,
          type: 'RETIRADA',
          productId: stockData.productId,
          productName: stockData.productName,
          productCode: stockData.productCode || '',
          originPalletId: stockData.palletId,
          originPalletCode: stockData.palletCode,
          quantity: stockData.quantity,
          unit: stockData.unit,
          reason: reason?.trim() || `Exclusão do produto "${productName}" do catálogo`,
          userEmail: userEmail || 'Operador',
          userId: userId || '',
          createdAt: new Date().toISOString(),
        };
        await setDoc(movementRef, movement);
      }
      // Deletar o registro de estoque no pallet
      await deleteDoc(doc(db, PALLET_STOCK_COL, docSnap.id));
    }

    // 3. Deletar o produto do catálogo
    await deleteDoc(doc(db, PRODUCTS_COL, productId));
  } catch (err) {
    if (err instanceof Error && err.message.includes('ainda possui saldo ativo')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.DELETE, `${PRODUCTS_COL}/${productId}`);
  }
}

/**
 * Excluir item de um pallet específico (desalocar ou corrigir lançamento indevido)
 * Preserva o histórico de auditoria gravando a retirada/baixa.
 */
export async function deleteStockItemFromPallet(params: {
  stockId: string;
  reason?: string;
  userEmail?: string;
  userId?: string;
}): Promise<void> {
  const { stockId, reason, userEmail, userId } = params;

  try {
    const stockRef = doc(db, PALLET_STOCK_COL, stockId);
    const snap = await getDoc(stockRef);

    if (!snap.exists()) {
      return; // Já não existe
    }

    const stockData = snap.data() as PalletStock;

    // Se havia quantidade > 0, grava a movimentação para não deixar furo no inventário
    if (stockData.quantity > 0) {
      const movementRef = doc(collection(db, MOVEMENTS_COL));
      const movement: Movement = {
        id: movementRef.id,
        type: 'RETIRADA',
        productId: stockData.productId,
        productName: stockData.productName,
        productCode: stockData.productCode || '',
        originPalletId: stockData.palletId,
        originPalletCode: stockData.palletCode,
        quantity: stockData.quantity,
        unit: stockData.unit,
        reason: reason?.trim() || `Item excluído diretamente do Pallet ${stockData.palletCode}`,
        userEmail: userEmail || 'Operador',
        userId: userId || '',
        createdAt: new Date().toISOString(),
      };
      await setDoc(movementRef, movement);
    }

    // Deleta o registro de estoque do pallet
    await deleteDoc(stockRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${PALLET_STOCK_COL}/${stockId}`);
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
    const stock1Id = getPalletStockDocId(p01.id, prodKetchup.id, 'caixas');
    const stock1Ref = doc(db, PALLET_STOCK_COL, stock1Id);
    const stock1: PalletStock = {
      id: stock1Id,
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

    const stock2Id = getPalletStockDocId(p01.id, prodMaionese.id, 'caixas');
    const stock2Ref = doc(db, PALLET_STOCK_COL, stock2Id);
    const stock2: PalletStock = {
      id: stock2Id,
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
    const stock3Id = getPalletStockDocId(p02.id, prodKetchup.id, 'caixas');
    const stock3Ref = doc(db, PALLET_STOCK_COL, stock3Id);
    const stock3: PalletStock = {
      id: stock3Id,
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

    const stock4Id = getPalletStockDocId(p02.id, prodMolho.id, 'caixas');
    const stock4Ref = doc(db, PALLET_STOCK_COL, stock4Id);
    const stock4: PalletStock = {
      id: stock4Id,
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
    const stock5Id = getPalletStockDocId(p03.id, prodAcucar.id, 'unidades');
    const stock5Ref = doc(db, PALLET_STOCK_COL, stock5Id);
    const stock5: PalletStock = {
      id: stock5Id,
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
