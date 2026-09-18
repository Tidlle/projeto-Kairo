/**
 * Testes da camada de escrita contra Postgres DE VERDADE.
 *
 * Usa PGlite (Postgres compilado para WASM), então roda sem Docker, sem
 * servidor e sem rede — mas exercita o SQL real: `on conflict`, `excluded`,
 * índices únicos parciais, tipos. Um mock não pegaria erro de upsert.
 */

import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';

import { mapTransactions } from '../../core/src/pluggy/map.ts';
import type { PluggyAccount, PluggyTransaction } from '../../core/src/pluggy/types.ts';
import * as schema from '../schema.ts';
import type { Db } from '../src/client.ts';
import {
  countExisting,
  ensureCategories,
  upsertAccounts,
  upsertConnection,
  upsertMerchants,
  upsertTransactions,
} from '../src/ingest.ts';

const USER = '00000000-0000-0000-0000-000000000001';

let client: PGlite;
let db: Db;

const account: PluggyAccount = {
  id: 'acc-1',
  itemId: 'item-1',
  type: 'BANK',
  subtype: 'CHECKING_ACCOUNT',
  name: 'Conta Corrente',
  marketingName: null,
  number: '00002009283-4',
  balance: 292.72,
  currencyCode: 'BRL',
  taxNumber: null,
  owner: null,
  bankData: null,
  creditData: null,
};

const item = {
  id: 'item-1',
  status: 'UPDATED',
  executionStatus: 'SUCCESS',
  lastUpdatedAt: '2026-08-26T05:11:24.000Z',
  nextAutoSyncAt: '2026-08-27T14:13:00.000Z',
  consentExpiresAt: null,
  error: null,
  connector: { id: 1, name: 'MeuPluggy', imageUrl: null, isOpenFinance: false },
};

const tx = (over: Partial<PluggyTransaction> = {}): PluggyTransaction => ({
  id: 'tx-1',
  accountId: 'acc-1',
  amount: -100,
  currencyCode: 'BRL',
  date: '2026-08-24T00:00:00.000Z',
  description: 'Compra no débito|CARREFOUR',
  descriptionRaw: 'Compra no débito|CARREFOUR',
  type: 'DEBIT',
  status: 'POSTED',
  category: 'Groceries',
  categoryId: '1',
  balance: null,
  merchant: null,
  paymentData: null,
  operationType: 'CARTAO',
  operationTypeAdditionalInfo: null,
  providerId: null,
  order: 0,
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
  ...over,
});

const accountsById = new Map([['acc-1', account]]);

/** Roda o pipeline inteiro: mapeia e grava. É o que o sync faz de verdade. */
async function ingest(txs: PluggyTransaction[]) {
  const connectionId = await upsertConnection(db, USER, item);
  const accountIds = await upsertAccounts(db, USER, connectionId, [
    {
      externalId: account.id,
      connectionExternalId: account.itemId,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      numberMasked: '83-4',
      currencyCode: 'BRL',
      balanceCents: 29272,
      creditLimitCents: null,
    },
  ]);
  const categoryIds = await ensureCategories(db, USER);
  const rows = mapTransactions(txs, accountsById);
  const merchantIds = await upsertMerchants(db, USER, rows);
  return upsertTransactions(db, USER, rows, accountIds, merchantIds, categoryIds);
}

before(async () => {
  client = new PGlite();
  db = drizzle(client, { schema }) as Db;

  const dir = path.resolve(import.meta.dirname, '../migrations');
  const file = fs.readdirSync(dir).find((f) => f.endsWith('.sql'));
  assert.ok(file, 'migração não encontrada — rode: npm run db:generate');

  const sql = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed) await client.exec(trimmed);
  }
});

/**
 * Cada teste começa com o banco limpo. Sem isso, a ordem de execução vira
 * parte do contrato — e um teste que só passa em terceiro lugar não prova nada.
 */
beforeEach(async () => {
  await client.exec(`
    truncate table transactions, merchants, accounts, connections,
                   categories, sync_runs restart identity cascade;
  `);
});

after(async () => {
  await client?.close();
});

// ─────────────────────────────────────────── testes

describe('camada de escrita', () => {
  it('grava a transação com valor em centavos e categoria resolvida', async () => {
    await ingest([tx()]);

    const rows = await db.select().from(schema.transactions).where(eq(schema.transactions.userId, USER));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.amountCents, -10000);
    assert.equal(rows[0]!.externalCategory, 'Groceries');
    assert.ok(rows[0]!.categoryId, 'categoria "Mercado" deve estar vinculada');
    assert.ok(rows[0]!.merchantId, 'merchant deve estar vinculado');
  });

  it('é idempotente: rodar de novo não duplica', async () => {
    await ingest([tx()]);
    await ingest([tx()]);
    await ingest([tx()]);

    const rows = await db.select().from(schema.transactions).where(eq(schema.transactions.userId, USER));
    assert.equal(rows.length, 1, 'três execuções, uma linha');
  });

  it('atualiza quando o banco corrige o valor', async () => {
    await ingest([tx({ amount: -100 })]);
    await ingest([tx({ amount: -95.5 })]);

    const rows = await db.select().from(schema.transactions).where(eq(schema.transactions.userId, USER));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.amountCents, -9550, 'valor da origem sempre vence');
  });

  it('NÃO sobrescreve a categoria que você travou', async () => {
    await ingest([tx()]);

    // simula: você recategorizou à mão
    const [outra] = await db
      .insert(schema.categories)
      .values({ userId: USER, name: 'Padaria do bairro' })
      .returning({ id: schema.categories.id });

    await db
      .update(schema.transactions)
      .set({ categoryId: outra!.id, categoryLocked: true })
      .where(eq(schema.transactions.userId, USER));

    await ingest([tx()]); // sync roda de novo

    const rows = await db.select().from(schema.transactions).where(eq(schema.transactions.userId, USER));
    assert.equal(rows[0]!.categoryId, outra!.id, 'sua escolha sobreviveu ao sync');
    assert.equal(rows[0]!.categoryLocked, true);
  });

  it('NÃO apaga anotações, tags e vínculos com tarefa', async () => {
    await ingest([tx()]);

    await db
      .update(schema.transactions)
      .set({ notes: 'reembolsar depois', tags: ['trabalho'] })
      .where(eq(schema.transactions.userId, USER));

    await ingest([tx({ amount: -101 })]);

    const rows = await db.select().from(schema.transactions).where(eq(schema.transactions.userId, USER));
    assert.equal(rows[0]!.notes, 'reembolsar depois');
    assert.deepEqual(rows[0]!.tags, ['trabalho']);
    assert.equal(rows[0]!.amountCents, -10100, 'mas o valor foi atualizado');
  });

  it('preserva o apelido da conta e atualiza o saldo', async () => {
    await ingest([tx()]);

    await db
      .update(schema.accounts)
      .set({ nickname: 'Minha conta principal' })
      .where(eq(schema.accounts.userId, USER));

    const connectionId = await upsertConnection(db, USER, item);
    await upsertAccounts(db, USER, connectionId, [
      {
        externalId: 'acc-1',
        connectionExternalId: 'item-1',
        name: 'Conta Corrente',
        type: 'BANK',
        subtype: 'CHECKING_ACCOUNT',
        numberMasked: '83-4',
        currencyCode: 'BRL',
        balanceCents: 50000, // saldo novo
        creditLimitCents: null,
      },
    ]);

    const rows = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, USER));
    assert.equal(rows[0]!.nickname, 'Minha conta principal', 'apelido é seu');
    assert.equal(rows[0]!.balanceCents, 50000, 'saldo é do banco');
  });

  it('não sobrescreve o nome do merchant que você fixou', async () => {
    await ingest([tx()]);

    await db
      .update(schema.merchants)
      .set({ displayName: 'Carrefour Aldeota', isPinned: true })
      .where(eq(schema.merchants.userId, USER));

    await ingest([tx()]);

    const rows = await db.select().from(schema.merchants).where(eq(schema.merchants.userId, USER));
    assert.equal(rows[0]!.displayName, 'Carrefour Aldeota');
  });

  it('grava as duas pernas da transferência interna com a mesma chave', async () => {
    const conta2: PluggyAccount = { ...account, id: 'acc-2' };
    const pix = (id: string, accountId: string, amount: number): PluggyTransaction =>
      tx({
        id,
        accountId,
        amount,
        date: '2026-08-22T00:00:00.000Z',
        category: 'Transfers',
        paymentData: {
          paymentMethod: 'PIX',
          reason: null,
          referenceNumber: null,
          payer: {
            name: 'Eu',
            documentNumber: { type: 'CPF', value: '12345678901' },
            accountNumber: null,
            branchNumber: null,
            routingNumber: null,
            routingNumberISPB: null,
          },
          receiver: {
            name: 'Eu',
            documentNumber: { type: 'CPF', value: '12345678901' },
            accountNumber: null,
            branchNumber: null,
            routingNumber: null,
            routingNumberISPB: null,
          },
        },
      });

    const connectionId = await upsertConnection(db, USER, item);
    const accountIds = await upsertAccounts(db, USER, connectionId, [
      { externalId: 'acc-1', connectionExternalId: 'item-1', name: 'A', type: 'BANK', subtype: 'CHECKING_ACCOUNT', numberMasked: '1', currencyCode: 'BRL', balanceCents: 0, creditLimitCents: null },
      { externalId: 'acc-2', connectionExternalId: 'item-1', name: 'B', type: 'BANK', subtype: 'CHECKING_ACCOUNT', numberMasked: '2', currencyCode: 'BRL', balanceCents: 0, creditLimitCents: null },
    ]);
    const categoryIds = await ensureCategories(db, USER);

    const txs = [pix('out', 'acc-1', -500), pix('in', 'acc-2', 500)];
    const rows = mapTransactions(txs, new Map([['acc-1', account], ['acc-2', conta2]]));
    const merchantIds = await upsertMerchants(db, USER, rows);
    await upsertTransactions(db, USER, rows, accountIds, merchantIds, categoryIds);

    const saved = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.isInternalTransfer, true));

    assert.equal(saved.length, 2);
    assert.equal(saved[0]!.transferPairKey, saved[1]!.transferPairKey, 'mesma chave de par');
    assert.equal(saved[0]!.transferDetectedBy, 'document');
  });

  it('ignora transação de conta desconhecida em vez de gravar vínculo inválido', async () => {
    const connectionId = await upsertConnection(db, USER, item);
    const categoryIds = await ensureCategories(db, USER);
    const rows = mapTransactions([tx({ id: 'orfa' })], accountsById);

    const result = await upsertTransactions(db, USER, rows, new Map(), new Map(), categoryIds);
    assert.equal(result.written, 0);
  });

  it('countExisting funciona com lote grande', async () => {
    // Regressão: `sql\`= any(${array})\`` expandia o array em parâmetros soltos
    // e gerava `any(($1, $2, …))`, que Postgres rejeita. Só quebrava com volume
    // real — com 1 ou 2 transações o bug ficava invisível.
    const muitas = Array.from({ length: 600 }, (_, i) =>
      tx({ id: `tx-${i}`, description: `Compra no débito|LOJA ${i}` }),
    );
    await ingest(muitas);

    const ids = muitas.map((t) => t.id);
    assert.equal(await countExisting(db, USER, ids), 600);

    // ids desconhecidos não contam
    assert.equal(await countExisting(db, USER, ['nao-existe']), 0);
    assert.equal(await countExisting(db, USER, []), 0);
  });

  it('ensureCategories é idempotente', async () => {
    const a = await ensureCategories(db, USER);
    const b = await ensureCategories(db, USER);
    assert.equal(a.size, b.size);

    const rows = await db.select().from(schema.categories).where(eq(schema.categories.userId, USER));
    const names = rows.map((r) => r.name);
    assert.equal(new Set(names).size, names.length, 'nenhuma categoria duplicada');
  });
});
