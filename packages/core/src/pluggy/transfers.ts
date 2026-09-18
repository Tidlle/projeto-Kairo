/**
 * Detecção de transferência entre contas próprias.
 *
 * Sem isso, mandar R$ 100 do Nubank para o Santander vira R$ 100 de despesa +
 * R$ 100 de receita — receita e despesa fantasma que distorcem todo relatório.
 *
 * Dois métodos, nesta ordem:
 *
 *   1. CPF idêntico nos dois lados do PIX. Determinístico. Nos dados reais
 *      (185 PIX, todos com CPF de pagador e recebedor) acertou 6 de 6.
 *   2. Casamento por valor + data + sinais opostos entre contas suas. Só como
 *      fallback para não-PIX: nos mesmos dados achou apenas 3 de 6, porque
 *      transferência para banco não conectado não tem par visível.
 */

import type { PluggyTransaction } from './types.ts';

/**
 * Método 1 — o CPF do pagador é o mesmo do recebedor.
 * Funciona mesmo quando a conta destino não está conectada no Kairo.
 */
export function isSelfTransferByDocument(tx: PluggyTransaction): boolean {
  const payer = tx.paymentData?.payer?.documentNumber?.value;
  const receiver = tx.paymentData?.receiver?.documentNumber?.value;
  if (!payer || !receiver) return false;
  return normalizeDoc(payer) === normalizeDoc(receiver);
}

const normalizeDoc = (doc: string) => doc.replace(/\D/g, '');

/**
 * Método 2 — casa as duas pernas da mesma transferência entre contas conhecidas.
 * Critério: mesmo valor absoluto, mesma data, contas diferentes, sinais opostos.
 *
 * Retorna um mapa `transactionId → chave do par`. Transações sem par não entram.
 */
export function pairInternalTransfers(txs: PluggyTransaction[]): Map<string, string> {
  const pairs = new Map<string, string>();
  const buckets = new Map<string, PluggyTransaction[]>();

  for (const tx of txs) {
    const key = `${Math.abs(tx.amount).toFixed(2)}|${tx.date.slice(0, 10)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(tx);
    else buckets.set(key, [tx]);
  }

  for (const [key, group] of buckets) {
    if (group.length < 2) continue;

    const used = new Set<string>();
    for (let i = 0; i < group.length; i++) {
      if (used.has(group[i]!.id)) continue;

      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        if (used.has(b.id)) continue;

        const oppositeSigns = Math.sign(a.amount) !== Math.sign(b.amount);
        const differentAccounts = a.accountId !== b.accountId;
        if (!oppositeSigns || !differentAccounts) continue;

        // Chave estável e determinística: não depende da ordem de leitura.
        const pairKey = `${key}|${[a.id, b.id].sort().join('~')}`;
        pairs.set(a.id, pairKey);
        pairs.set(b.id, pairKey);
        used.add(a.id);
        used.add(b.id);
        break;
      }
    }
  }

  return pairs;
}

export type TransferVerdict = {
  isInternalTransfer: boolean;
  transferPairKey: string | null;
  /** Qual método decidiu — útil para auditar e para a UI explicar. */
  detectedBy: 'document' | 'amount-match' | null;
};

export function classifyTransfer(
  tx: PluggyTransaction,
  pairs: Map<string, string>,
): TransferVerdict {
  const pairKey = pairs.get(tx.id) ?? null;

  if (isSelfTransferByDocument(tx)) {
    return { isInternalTransfer: true, transferPairKey: pairKey, detectedBy: 'document' };
  }
  if (pairKey) {
    return { isInternalTransfer: true, transferPairKey: pairKey, detectedBy: 'amount-match' };
  }
  return { isInternalTransfer: false, transferPairKey: null, detectedBy: null };
}
