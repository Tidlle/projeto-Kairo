import type { FinancePullResult } from '@kairo/core';
import { sql } from 'drizzle-orm';

import type { Db } from './client';
import { categories, syncState, transactions } from './schema';

/**
 * Espelho financeiro — I/O puro, sem React, testável em Node
 * (better-sqlite3) — mesmo espírito de `sync.ts`.
 *
 * Só pull: sem `getPushPayload`, sem `isNewer` — o servidor é sempre a
 * única fonte da verdade pra estas duas tabelas (ver
 * `packages/core/src/finance-sync-protocol.ts`).
 */

const TABLES = ['transactions', 'categories'] as const;
type TableName = (typeof TABLES)[number];

async function getWatermarks(db: Db): Promise<Record<TableName, string | null>> {
  const rows = await db.select().from(syncState).where(sql`${syncState.tableName} in ('transactions', 'categories')`);
  const byName = new Map(rows.map((r) => [r.tableName, r.lastPulledAt]));
  return Object.fromEntries(TABLES.map((t) => [t, byName.get(t) ?? null])) as Record<TableName, string | null>;
}

async function setWatermark(db: Db, table: TableName, value: string) {
  await db
    .insert(syncState)
    .values({ tableName: table, lastPulledAt: value })
    .onConflictDoUpdate({ target: syncState.tableName, set: { lastPulledAt: value } });
}

/** Grava o que veio do servidor. Sem checagem de LWW: o servidor sempre vence. */
export async function applyFinancePulled(db: Db, pulled: FinancePullResult): Promise<void> {
  for (const row of pulled.categories) {
    await db
      .insert(categories)
      .values(row)
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          parentId: row.parentId,
          name: row.name,
          icon: row.icon,
          color: row.color,
          isIncome: row.isIncome,
          isTransfer: row.isTransfer,
          sortOrder: row.sortOrder,
          updatedAt: row.updatedAt,
        },
      });
  }

  for (const row of pulled.transactions) {
    await db
      .insert(transactions)
      .values(row)
      .onConflictDoUpdate({
        target: transactions.id,
        set: {
          accountId: row.accountId,
          amountCents: row.amountCents,
          date: row.date,
          status: row.status,
          categoryId: row.categoryId,
          isInternalTransfer: row.isInternalTransfer,
          updatedAt: row.updatedAt,
        },
      });
  }
}

export type FinanceSyncOutcome = { ok: true; pulled: number } | { ok: false; error: string };

export type FinanceSyncConfig = {
  /** URL completa da Edge Function, ex.: https://<ref>.supabase.co/functions/v1/sync-finance */
  functionUrl: string;
  /** Mesmo segredo de `SyncConfig` (sync.ts) — ver o comentário lá sobre por que é seguro reaproveitar. */
  secret: string;
};

/** Sincroniza de verdade: pede o que mudou desde o último pull, aplica, avança os marcadores. */
export async function syncFinance(db: Db, config: FinanceSyncConfig): Promise<FinanceSyncOutcome> {
  try {
    const wm = await getWatermarks(db);

    const res = await fetch(config.functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-secret': config.secret },
      body: JSON.stringify({
        pullSince: { transactions: wm.transactions, categories: wm.categories },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 300)}` };
    }

    const pulled = (await res.json()) as FinancePullResult;
    await applyFinancePulled(db, pulled);

    for (const t of TABLES) {
      await setWatermark(db, t, pulled.serverTime);
    }

    return { ok: true, pulled: pulled.transactions.length + pulled.categories.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
