/**
 * Orquestrador da sincronização.
 *
 * Pluggy → mapeamento → banco, com registro em `sync_runs`.
 * Sem console.log nem process.exit: quem chama decide como reportar.
 * Isso é o que permite o mesmo código rodar no CLI e na Edge Function.
 */

import { authenticate, createPluggyClient } from '../../core/src/pluggy/client.ts';
import { mapAccount, mapTransactions } from '../../core/src/pluggy/map.ts';
import type { PluggyAccount, PluggyTransaction } from '../../core/src/pluggy/types.ts';
import type { Db } from './client.ts';
import {
  countExisting,
  ensureCategories,
  finishSyncRun,
  pairTransfersAcrossAccounts,
  startSyncRun,
  upsertAccounts,
  upsertConnection,
  upsertMerchants,
  upsertTransactions,
} from './ingest.ts';

export type SyncOptions = {
  clientId: string;
  clientSecret: string;
  itemIds: string[];
  userId: string;
  /** Janela em dias. Padrão 90: cobre atraso de lançamento e estorno tardio. */
  days?: number;
  /** Dispara PATCH /items antes de ler. Mais lento; use sob demanda. */
  forceSync?: boolean;
  onProgress?: (message: string) => void;
};

export type ItemResult = {
  itemId: string;
  connector: string;
  status: string;
  accounts: number;
  transactions: number;
  inserted: number;
  updated: number;
  internalTransfers: number;
  error?: string;
};

export type SyncResult = {
  ok: boolean;
  items: ItemResult[];
  totalInserted: number;
  totalUpdated: number;
  durationMs: number;
};

export async function runSync(db: Db, opts: SyncOptions): Promise<SyncResult> {
  const startedAt = Date.now();
  const log = opts.onProgress ?? (() => {});
  const days = opts.days ?? 90;

  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const dateFrom = from.toISOString().slice(0, 10);
  const dateTo = to.toISOString().slice(0, 10);

  log('autenticando no Pluggy');
  const apiKey = await authenticate(opts.clientId, opts.clientSecret);
  const pluggy = createPluggyClient(apiKey);

  log('garantindo categorias');
  const categoryIdByName = await ensureCategories(db, opts.userId);

  const results: ItemResult[] = [];

  for (const itemId of opts.itemIds) {
    // Um item que falha não pode derrubar os outros: cada um é isolado.
    let runId: string | null = null;
    try {
      let item = await pluggy.getItem(itemId);

      if (opts.forceSync) {
        log(`forçando sync de ${item.connector.name}`);
        item = await pluggy.syncItem(itemId);
      }

      const connectionId = await upsertConnection(db, opts.userId, item);
      runId = await startSyncRun(db, opts.userId, connectionId);

      const pluggyAccounts: PluggyAccount[] = await pluggy.listAccounts(itemId);
      const accountIdByExternal = await upsertAccounts(
        db,
        opts.userId,
        connectionId,
        pluggyAccounts.map(mapAccount),
      );

      const txs: PluggyTransaction[] = [];
      for (const account of pluggyAccounts) {
        log(`lendo transações de ${account.name}`);
        txs.push(...(await pluggy.listTransactions(account.id, dateFrom, dateTo)));
      }

      const accountsById = new Map(pluggyAccounts.map((a) => [a.id, a]));
      const rows = mapTransactions(txs, accountsById);

      // Contar ANTES de escrever, senão tudo pareceria atualização.
      const existing = await countExisting(
        db,
        opts.userId,
        rows.map((r) => r.externalId),
      );

      const merchantIdByFingerprint = await upsertMerchants(db, opts.userId, rows);
      const { written } = await upsertTransactions(
        db,
        opts.userId,
        rows,
        accountIdByExternal,
        merchantIdByFingerprint,
        categoryIdByName,
      );

      const inserted = Math.max(0, written - existing);
      const updated = written - inserted;

      await finishSyncRun(db, runId, { status: 'success', inserted, updated });

      results.push({
        itemId,
        connector: item.connector.name,
        status: item.status,
        accounts: pluggyAccounts.length,
        transactions: rows.length,
        inserted,
        updated,
        internalTransfers: rows.filter((r) => r.isInternalTransfer).length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (runId) await finishSyncRun(db, runId, { status: 'error', error: message });
      results.push({
        itemId,
        connector: '(desconhecido)',
        status: 'ERROR',
        accounts: 0,
        transactions: 0,
        inserted: 0,
        updated: 0,
        internalTransfers: 0,
        error: message,
      });
    }
  }

  /**
   * Passada final, depois de todos os items gravados: casa transferências
   * entre contas de conexões DIFERENTES. Em memória isso é impossível, porque
   * cada item é processado isoladamente (para que a falha de um não derrube
   * os outros).
   */
  if (results.some((r) => !r.error)) {
    log('casando transferências entre contas');
    await pairTransfersAcrossAccounts(db, opts.userId);
  }

  return {
    ok: results.every((r) => !r.error),
    items: results,
    totalInserted: results.reduce((s, r) => s + r.inserted, 0),
    totalUpdated: results.reduce((s, r) => s + r.updated, 0),
    durationMs: Date.now() - startedAt,
  };
}
