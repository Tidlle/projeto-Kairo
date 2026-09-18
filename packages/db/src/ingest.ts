/**
 * Camada de escrita — Pluggy → Postgres.
 *
 * Regra que governa tudo aqui: **rodar duas vezes não pode duplicar nada nem
 * apagar o que você editou à mão.** Isso se traduz em três garantias:
 *
 *   1. Todo upsert usa uma chave natural (`external_id`), não o id gerado.
 *   2. Campos que a origem controla (valor, data, descrição crua) são sempre
 *      sobrescritos; campos que VOCÊ controla (categoria travada, apelido,
 *      anotações, tags) nunca são tocados no update.
 *   3. Cada linha carrega o payload cru, então dá para reprocessar tudo sem
 *      bater na API de novo.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AccountRow } from '../../core/src/pluggy/map.ts';
import type { PluggyItem, TransactionRow } from '../../core/src/pluggy/types.ts';
import { PLUGGY_CATEGORY_MAP } from '../../core/src/pluggy/categories.ts';
import { accounts, categories, connections, merchants, syncRuns, transactions } from '../schema.ts';
import type { Db } from './client.ts';

export type IngestStats = {
  accountsUpserted: number;
  transactionsInserted: number;
  transactionsUpdated: number;
  merchantsCreated: number;
  categoriesCreated: number;
  internalTransfers: number;
};

// ─────────────────────────────────────────── categorias

/**
 * Garante que as categorias do mapa existem e devolve nome → id.
 * Idempotente: `onConflictDoNothing` na chave (user_id, name).
 */
export async function ensureCategories(db: Db, userId: string): Promise<Map<string, string>> {
  const wanted = new Map<string, { isIncome: boolean; isTransfer: boolean; labels: string[] }>();

  for (const [externalLabel, mapping] of Object.entries(PLUGGY_CATEGORY_MAP)) {
    const entry = wanted.get(mapping.name) ?? {
      isIncome: mapping.isIncome ?? false,
      isTransfer: mapping.isTransfer ?? false,
      labels: [],
    };
    entry.labels.push(externalLabel);
    wanted.set(mapping.name, entry);
  }

  const values = [...wanted.entries()].map(([name, meta]) => ({
    userId,
    name,
    isIncome: meta.isIncome,
    isTransfer: meta.isTransfer,
    externalLabels: meta.labels,
  }));

  if (values.length) {
    await db.insert(categories).values(values).onConflictDoNothing();
  }

  const rows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, userId));

  return new Map(rows.map((r) => [r.name, r.id]));
}

// ─────────────────────────────────────────── conexões e contas

export async function upsertConnection(db: Db, userId: string, item: PluggyItem): Promise<string> {
  const values = {
    userId,
    externalId: item.id,
    provider: 'pluggy' as const,
    connectorName: item.connector.name,
    connectorImageUrl: item.connector.imageUrl,
    status: normalizeStatus(item.status),
    executionStatus: item.executionStatus,
    lastSyncedAt: item.lastUpdatedAt ? new Date(item.lastUpdatedAt) : null,
    nextAutoSyncAt: item.nextAutoSyncAt ? new Date(item.nextAutoSyncAt) : null,
    consentExpiresAt: item.consentExpiresAt ? new Date(item.consentExpiresAt) : null,
    lastError: item.error ?? null,
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(connections)
    .values(values)
    .onConflictDoUpdate({
      target: [connections.userId, connections.provider, connections.externalId],
      set: {
        connectorName: values.connectorName,
        status: values.status,
        executionStatus: values.executionStatus,
        lastSyncedAt: values.lastSyncedAt,
        nextAutoSyncAt: values.nextAutoSyncAt,
        consentExpiresAt: values.consentExpiresAt,
        lastError: values.lastError,
        updatedAt: values.updatedAt,
      },
    })
    .returning({ id: connections.id });

  return row!.id;
}

/** Status desconhecido não pode derrubar o sync — cai em OUTDATED. */
const KNOWN_STATUSES = ['UPDATED', 'UPDATING', 'LOGIN_ERROR', 'OUTDATED', 'WAITING_USER_INPUT'] as const;
type ConnStatus = (typeof KNOWN_STATUSES)[number];

function normalizeStatus(status: string): ConnStatus {
  return (KNOWN_STATUSES as readonly string[]).includes(status) ? (status as ConnStatus) : 'OUTDATED';
}

const KNOWN_SUBTYPES = [
  'CHECKING_ACCOUNT',
  'SAVINGS_ACCOUNT',
  'CREDIT_CARD',
  'WALLET',
  'OTHER',
] as const;

/**
 * Contas. O `nickname` que você definir NÃO é sobrescrito — o banco pode mudar
 * o nome comercial, mas o apelido é seu.
 */
export async function upsertAccounts(
  db: Db,
  userId: string,
  connectionId: string,
  rows: AccountRow[],
): Promise<Map<string, string>> {
  if (!rows.length) return new Map();

  const values = rows.map((r) => ({
    userId,
    connectionId,
    externalId: r.externalId,
    name: r.name,
    type: r.type,
    subtype: (KNOWN_SUBTYPES as readonly string[]).includes(r.subtype)
      ? (r.subtype as (typeof KNOWN_SUBTYPES)[number])
      : ('OTHER' as const),
    numberMasked: r.numberMasked,
    currencyCode: r.currencyCode,
    balanceCents: r.balanceCents,
    creditLimitCents: r.creditLimitCents,
    updatedAt: new Date(),
  }));

  const inserted = await db
    .insert(accounts)
    .values(values)
    .onConflictDoUpdate({
      target: [accounts.userId, accounts.externalId],
      set: {
        // saldo e limite vêm do banco: sempre atualizar
        balanceCents: sql`excluded.balance_cents`,
        creditLimitCents: sql`excluded.credit_limit_cents`,
        name: sql`excluded.name`,
        connectionId: sql`excluded.connection_id`,
        updatedAt: new Date(),
        // nickname, archivedAt e includeInNetWorth ficam intactos de propósito
      },
    })
    .returning({ id: accounts.id, externalId: accounts.externalId });

  return new Map(inserted.map((r) => [r.externalId!, r.id]));
}

// ─────────────────────────────────────────── merchants

/**
 * Cache de estabelecimentos. `is_pinned` protege suas correções: se você
 * renomeou ou recategorizou à mão, a sincronização não desfaz.
 */
export async function upsertMerchants(
  db: Db,
  userId: string,
  rows: TransactionRow[],
): Promise<Map<string, string>> {
  const unique = new Map<string, TransactionRow>();
  for (const r of rows) if (!unique.has(r.merchantFingerprint)) unique.set(r.merchantFingerprint, r);
  if (!unique.size) return new Map();

  const values = [...unique.values()].map((r) => ({
    userId,
    fingerprint: r.merchantFingerprint,
    displayName: r.merchantDisplayName,
    cnpj: r.merchantCnpj,
    cnae: r.merchantCnae,
    updatedAt: new Date(),
  }));

  const upserted = await db
    .insert(merchants)
    .values(values)
    .onConflictDoUpdate({
      target: [merchants.userId, merchants.fingerprint],
      set: {
        // Só preenche o que ainda estiver vazio, e nunca sobrescreve o que
        // você fixou. COALESCE mantém o valor existente quando já há um.
        displayName: sql`case when ${merchants.isPinned} then ${merchants.displayName} else excluded.display_name end`,
        cnpj: sql`coalesce(${merchants.cnpj}, excluded.cnpj)`,
        cnae: sql`coalesce(${merchants.cnae}, excluded.cnae)`,
        hitCount: sql`${merchants.hitCount} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: merchants.id, fingerprint: merchants.fingerprint });

  return new Map(upserted.map((r) => [r.fingerprint, r.id]));
}

// ─────────────────────────────────────────── transações

/**
 * O upsert central.
 *
 * Conflito em (user_id, source, external_id): a mesma transação da Pluggy
 * atualiza a linha existente em vez de criar outra. Campos seus — categoria
 * travada, anotações, tags, vínculo com tarefa/meta — ficam intocados.
 */
export async function upsertTransactions(
  db: Db,
  userId: string,
  rows: TransactionRow[],
  accountIdByExternal: Map<string, string>,
  merchantIdByFingerprint: Map<string, string>,
  categoryIdByName: Map<string, string>,
): Promise<{ written: number }> {
  if (!rows.length) return { written: 0 };

  const values = rows.flatMap((r) => {
    const accountId = accountIdByExternal.get(r.accountExternalId);
    if (!accountId) return []; // conta desconhecida: nunca inventar vínculo

    return [
      {
        userId,
        accountId,
        externalId: r.externalId,
        source: r.source,
        amountCents: r.amountCents,
        currencyCode: r.currencyCode,
        date: r.date,
        status: r.status,
        description: r.description,
        descriptionRaw: r.descriptionRaw,
        merchantId: merchantIdByFingerprint.get(r.merchantFingerprint) ?? null,
        categoryId: r.categoryName ? (categoryIdByName.get(r.categoryName) ?? null) : null,
        externalCategory: r.externalCategory,
        operationType: r.operationType,
        paymentMethod: r.paymentMethod,
        isInternalTransfer: r.isInternalTransfer,
        transferPairKey: r.transferPairKey,
        transferDetectedBy: r.transferDetectedBy,
        raw: r.raw,
        updatedAt: new Date(),
      },
    ];
  });

  if (!values.length) return { written: 0 };

  // Lotes: Postgres tem teto de parâmetros por statement (~65k).
  const BATCH = 500;
  let written = 0;

  for (let i = 0; i < values.length; i += BATCH) {
    const chunk = values.slice(i, i + BATCH);
    const result = await db
      .insert(transactions)
      .values(chunk)
      .onConflictDoUpdate({
        target: [transactions.userId, transactions.source, transactions.externalId],
        set: {
          // Campos da origem: sempre refletir o que o banco diz.
          amountCents: sql`excluded.amount_cents`,
          date: sql`excluded.date`,
          status: sql`excluded.status`,
          description: sql`excluded.description`,
          descriptionRaw: sql`excluded.description_raw`,
          merchantId: sql`excluded.merchant_id`,
          externalCategory: sql`excluded.external_category`,
          isInternalTransfer: sql`excluded.is_internal_transfer`,
          transferPairKey: sql`excluded.transfer_pair_key`,
          transferDetectedBy: sql`excluded.transfer_detected_by`,
          raw: sql`excluded.raw`,
          updatedAt: new Date(),
          // Categoria só é sobrescrita se VOCÊ não travou.
          categoryId: sql`case when ${transactions.categoryLocked} then ${transactions.categoryId} else excluded.category_id end`,
          // notes, tags, taskId, goalId, subscriptionId: nunca tocados.
        },
      })
      .returning({ id: transactions.id });

    written += result.length;
  }

  return { written };
}

// ─────────────────────────────────────────── auditoria

/**
 * Casa as duas pernas de transferências entre contas suas, ATRAVÉS de conexões.
 *
 * Por que em SQL, e não no mapeamento: o sync processa um item (banco) por vez,
 * para que a falha de um não derrube os outros. Isso significa que a perna que
 * sai do Santander e a que entra no Nubank nunca caem no mesmo lote — em memória
 * elas são invisíveis uma para a outra. Só depois de tudo gravado o par existe.
 *
 * Critério: mesmo valor absoluto, mesma data, contas diferentes, sinais opostos.
 * Idempotente: reprocessa e chega sempre à mesma chave (ids ordenados).
 */
export async function pairTransfersAcrossAccounts(db: Db, userId: string): Promise<number> {
  const result = await db.execute(sql`
    with pares as (
      -- "a" é sempre a perna negativa e "b" a positiva, então cada par nasce
      -- uma única vez — sem precisar comparar ids (fazer isso descartaria
      -- pares em que a perna positiva tem uuid menor).
      -- DISTINCT ON garante um único parceiro quando há vários candidatos
      -- de mesmo valor e data.
      select distinct on (a.id)
             a.id as a_id, b.id as b_id,
             least(a.id::text, b.id::text) || '~' || greatest(a.id::text, b.id::text) as chave
      from transactions a
      join transactions b
        on  b.user_id      = a.user_id
        and b.date         = a.date
        and b.amount_cents = -a.amount_cents
        and b.account_id  <> a.account_id
      where a.user_id = ${userId}
        and a.amount_cents < 0
        and a.transfer_pair_key is null
        and b.transfer_pair_key is null
      order by a.id, b.id
    )
    update transactions t
       set transfer_pair_key   = p.chave,
           is_internal_transfer = true,
           transfer_detected_by = coalesce(t.transfer_detected_by, 'amount-match')
      from pares p
     where t.id in (p.a_id, p.b_id)
  `);

  return Number((result as { count?: number }).count ?? 0);
}

export async function startSyncRun(db: Db, userId: string, connectionId: string | null) {
  const [row] = await db
    .insert(syncRuns)
    .values({ userId, connectionId, status: 'running' })
    .returning({ id: syncRuns.id });
  return row!.id;
}

export async function finishSyncRun(
  db: Db,
  runId: string,
  outcome: { status: 'success' | 'error'; inserted?: number; updated?: number; error?: string },
) {
  await db
    .update(syncRuns)
    .set({
      status: outcome.status,
      finishedAt: new Date(),
      transactionsInserted: outcome.inserted ?? 0,
      transactionsUpdated: outcome.updated ?? 0,
      error: outcome.error ?? null,
    })
    .where(eq(syncRuns.id, runId));
}

/**
 * Quantas dessas transações já existem — separa inserção de atualização.
 *
 * Usa `inArray`, não `sql\`= any(${array})\``: o template do Drizzle expande o
 * array em parâmetros soltos, e `any(($1, $2, …))` é um construtor de linha,
 * não um array — Postgres rejeita. O erro só aparece com dados de verdade.
 *
 * Fatiado porque Postgres limita ~65k parâmetros por statement.
 */
export async function countExisting(
  db: Db,
  userId: string,
  externalIds: string[],
): Promise<number> {
  if (!externalIds.length) return 0;

  const CHUNK = 1000;
  let total = 0;

  for (let i = 0; i < externalIds.length; i += CHUNK) {
    const rows = await db
      .select({ id: transactions.externalId })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.source, 'pluggy'),
          inArray(transactions.externalId, externalIds.slice(i, i + CHUNK)),
        ),
      );
    total += rows.length;
  }

  return total;
}
