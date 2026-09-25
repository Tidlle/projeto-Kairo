/**
 * Testes do espelho financeiro (transações/categorias) — lado Postgres —
 * contra PGlite real, mesmo princípio de routine-sync.test.ts.
 *
 * Só pull: não há push a testar aqui — as linhas são semeadas direto no
 * banco, como se já tivessem vindo da ingestão Pluggy (packages/db/src/ingest.ts).
 */

import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { before, beforeEach, describe, it } from 'node:test';
import { drizzle } from 'drizzle-orm/pglite';

import * as schema from '../schema.ts';
import type { Db } from '../src/client.ts';
import { pullFinance } from '../src/finance-sync.ts';

const USER = '00000000-0000-0000-0000-000000000001';
const OTHER_USER = '00000000-0000-0000-0000-000000000002';
const ACCOUNT_ID = '44444444-4444-4444-4444-444444444444';

let client: PGlite;
let db: Db;

function applyMigration() {
  const dir = path.resolve(import.meta.dirname, '../migrations');
  const file = fs.readdirSync(dir).find((f) => f.endsWith('.sql'));
  assert.ok(file, 'migração não encontrada — rode: npm run db:generate');
  const sql = fs.readFileSync(path.join(dir, file!), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed) client.exec(trimmed);
  }
}

before(async () => {
  client = new PGlite();
  db = drizzle(client, { schema }) as unknown as Db;
  await applyMigration();
});

beforeEach(async () => {
  await client.exec('truncate table transactions, categories, accounts restart identity cascade;');
  await db.insert(schema.accounts).values({
    id: ACCOUNT_ID,
    userId: USER,
    name: 'Conta corrente',
    type: 'BANK',
  });
});

describe('pullFinance', () => {
  it('devolve transações e categorias do usuário, no formato do espelho local', async () => {
    await db.insert(schema.categories).values({
      id: '55555555-5555-5555-5555-555555555555',
      userId: USER,
      name: 'Alimentação',
      color: '#E6A94E',
      isIncome: false,
      isTransfer: false,
    });
    await db.insert(schema.transactions).values({
      id: '66666666-6666-6666-6666-666666666666',
      userId: USER,
      accountId: ACCOUNT_ID,
      amountCents: -5000,
      date: '2026-08-15',
      status: 'POSTED',
      categoryId: '55555555-5555-5555-5555-555555555555',
      description: 'Mercado',
    });

    const result = await pullFinance(db, USER, { transactions: null, categories: null });

    assert.equal(result.transactions.length, 1);
    assert.equal(result.categories.length, 1);
    assert.deepEqual(result.transactions[0], {
      id: '66666666-6666-6666-6666-666666666666',
      accountId: ACCOUNT_ID,
      amountCents: -5000,
      date: '2026-08-15',
      status: 'POSTED',
      categoryId: '55555555-5555-5555-5555-555555555555',
      isInternalTransfer: false,
      updatedAt: result.transactions[0]?.updatedAt,
    });
    assert.equal(result.categories[0]?.name, 'Alimentação');
  });

  it('isola por usuário — não devolve linha de outro userId', async () => {
    await db.insert(schema.accounts).values({ id: '77777777-7777-7777-7777-777777777777', userId: OTHER_USER, name: 'Outra conta', type: 'BANK' });
    await db.insert(schema.transactions).values({
      id: '88888888-8888-8888-8888-888888888888',
      userId: OTHER_USER,
      accountId: '77777777-7777-7777-7777-777777777777',
      amountCents: -1000,
      date: '2026-08-15',
      description: 'Não deveria aparecer',
    });

    const result = await pullFinance(db, USER, { transactions: null, categories: null });
    assert.deepEqual(result.transactions, []);
  });

  it('respeita o watermark — só devolve o que mudou depois de `since`', async () => {
    await db.insert(schema.transactions).values({
      id: '99999999-9999-9999-9999-999999999999',
      userId: USER,
      accountId: ACCOUNT_ID,
      amountCents: -2000,
      date: '2026-08-01',
      description: 'Antiga',
    });

    const future = new Date(Date.now() + 60_000).toISOString();
    const result = await pullFinance(db, USER, { transactions: future, categories: null });
    assert.deepEqual(result.transactions, []);
  });
});
