/**
 * Pluggy → Kairo.
 *
 * Função pura: entra o payload da API, sai a linha pronta para o banco.
 * Nenhuma IO aqui — é isso que permite testar contra o dump real sem rede
 * nem banco, e é onde mora toda a regra que não pode errar.
 */

import { toCents } from '../money.ts';
import { mapCategory } from './categories.ts';
import { bestDisplayName, merchantKey } from './fingerprint.ts';
import { classifyTransfer, pairInternalTransfers } from './transfers.ts';
import type { PluggyAccount, PluggyTransaction, TransactionRow } from './types.ts';

/**
 * Normaliza o sinal para a convenção do Kairo: negativo = saída.
 *
 * Em conta bancária a Pluggy já usa essa convenção. Em CARTÃO DE CRÉDITO ela
 * inverte — `amount` positivo é uma compra nova (aumenta a dívida) e negativo
 * é pagamento da fatura. Normalizar aqui, uma vez, evita que toda query
 * lá na frente precise saber o tipo da conta.
 */
export function normalizeSign(amount: number, accountType: PluggyAccount['type']): number {
  return accountType === 'CREDIT' ? -amount : amount;
}

export function mapTransaction(
  tx: PluggyTransaction,
  account: PluggyAccount,
  pairs: Map<string, string>,
): TransactionRow {
  const amountCents = toCents(normalizeSign(tx.amount, account.type));
  const transfer = classifyTransfer(tx, pairs);
  const category = mapCategory(tx.category);

  return {
    externalId: tx.id,
    source: 'pluggy',
    accountExternalId: tx.accountId,

    amountCents,
    currencyCode: tx.currencyCode || account.currencyCode || 'BRL',
    date: tx.date.slice(0, 10),
    status: tx.status,

    description: bestDisplayName(tx),
    descriptionRaw: tx.descriptionRaw ?? tx.description ?? null,

    merchantFingerprint: merchantKey(tx),
    merchantDisplayName: bestDisplayName(tx),
    merchantCnpj: tx.merchant?.cnpj ?? null,
    merchantCnae: tx.merchant?.cnae ?? null,

    externalCategory: tx.category,
    // Transferência interna vence a categoria da Pluggy: ela não é gasto.
    categoryName: transfer.isInternalTransfer ? 'Transferência interna' : (category?.name ?? null),

    operationType: tx.operationType,
    paymentMethod: tx.paymentData?.paymentMethod ?? null,

    isInternalTransfer: transfer.isInternalTransfer,
    transferPairKey: transfer.transferPairKey,
    transferDetectedBy: transfer.detectedBy,

    raw: tx,
  };
}

/**
 * Mapeia um lote inteiro. O pareamento de transferências precisa enxergar
 * todas as transações de uma vez — por isso é feito aqui, e não por transação.
 */
export function mapTransactions(
  txs: PluggyTransaction[],
  accountsById: Map<string, PluggyAccount>,
): TransactionRow[] {
  const pairs = pairInternalTransfers(txs);
  const rows: TransactionRow[] = [];

  for (const tx of txs) {
    const account = accountsById.get(tx.accountId);
    if (!account) continue; // transação órfã: conta não veio no mesmo lote
    rows.push(mapTransaction(tx, account, pairs));
  }

  return rows;
}

export type AccountRow = {
  externalId: string;
  connectionExternalId: string;
  name: string;
  type: PluggyAccount['type'];
  subtype: string;
  numberMasked: string | null;
  currencyCode: string;
  balanceCents: number;
  creditLimitCents: number | null;
};

export function mapAccount(account: PluggyAccount): AccountRow {
  return {
    externalId: account.id,
    connectionExternalId: account.itemId,
    name: account.marketingName || account.name,
    type: account.type,
    subtype: account.subtype,
    // Só os últimos dígitos: o número completo não tem uso e é dado sensível.
    numberMasked: account.number ? account.number.slice(-4) : null,
    currencyCode: account.currencyCode || 'BRL',
    balanceCents: toCents(account.balance),
    creditLimitCents: account.creditData?.creditLimit != null
      ? toCents(account.creditData.creditLimit)
      : null,
  };
}

/**
 * Totais do período, com transferência interna excluída dos dois lados.
 * É a diferença entre "gastei R$ 14.816" e "gastei R$ 14.816 menos o que só
 * mudei de bolso".
 */
export function summarize(rows: TransactionRow[]) {
  const real = rows.filter((r) => !r.isInternalTransfer && r.status === 'POSTED');

  const income = real.filter((r) => r.amountCents > 0).reduce((s, r) => s + r.amountCents, 0);
  const expense = real.filter((r) => r.amountCents < 0).reduce((s, r) => s + r.amountCents, 0);
  const transfers = rows.filter((r) => r.isInternalTransfer).length;

  return { incomeCents: income, expenseCents: expense, netCents: income + expense, transfers };
}
