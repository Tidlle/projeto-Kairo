/**
 * Espelho financeiro (transações e categorias) — lado Postgres.
 *
 * Só pull: diferente de `routine-sync.ts`, não há push nem resolução de
 * conflito aqui — transações e categorias nunca são editadas pelo cliente,
 * então o servidor é sempre a única fonte da verdade. `pullFinance` devolve
 * tudo que mudou desde o watermark, sem limite de janela de data (espelho
 * completo, decisão consciente — ver PLANO.md).
 */

import type { FinancePullSince, SyncCategoryRow, SyncTransactionRow } from '../../core/src/finance-sync-protocol.ts';
import { and, eq, gt } from 'drizzle-orm';
import { categories, transactions } from '../schema.ts';
import type { Db } from './client.ts';

export type PulledFinance = {
  transactions: SyncTransactionRow[];
  categories: SyncCategoryRow[];
};

const toIso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d);

export async function pullFinance(db: Db, userId: string, since: FinancePullSince): Promise<PulledFinance> {
  const transactionRows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        since.transactions ? gt(transactions.updatedAt, new Date(since.transactions)) : undefined,
      ),
    );

  const categoryRows = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.userId, userId), since.categories ? gt(categories.updatedAt, new Date(since.categories)) : undefined),
    );

  return {
    transactions: transactionRows.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      amountCents: t.amountCents,
      date: t.date,
      status: t.status,
      categoryId: t.categoryId,
      isInternalTransfer: t.isInternalTransfer,
      updatedAt: toIso(t.updatedAt),
    })),
    categories: categoryRows.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      name: c.name,
      icon: c.icon,
      color: c.color,
      isIncome: c.isIncome,
      isTransfer: c.isTransfer,
      sortOrder: c.sortOrder,
      updatedAt: toIso(c.updatedAt),
    })),
  };
}
