/**
 * Testes do espelho financeiro — lado app — contra SQLite real
 * (better-sqlite3), mesmo padrão de sync.test.ts: servidor `node:http` de
 * verdade em vez de mockar `fetch`. O lado Postgres é validado à parte, em
 * packages/db/test/finance-sync.test.ts.
 */

import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createServer, type Server } from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { Db } from '../src/db/client';
import * as schema from '../src/db/schema';
import { categories, syncState, transactions } from '../src/db/schema';
import { applyFinancePulled, syncFinance, type FinanceSyncConfig } from '../src/db/finance-sync';

let sqlite: Database.Database;
let db: Db;

function applyMigrations() {
  const dir = path.resolve(import.meta.dirname, '../src/db/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  }
}

before(() => {
  sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema }) as unknown as Db;
  applyMigrations();
});

beforeEach(() => {
  sqlite.exec('delete from transactions; delete from categories; delete from sync_state;');
});

describe('applyFinancePulled', () => {
  it('cria linhas que não existem localmente', async () => {
    await applyFinancePulled(db, {
      transactions: [
        {
          id: 't1',
          accountId: 'acc1',
          amountCents: -1000,
          date: '2026-08-15',
          status: 'POSTED',
          categoryId: null,
          isInternalTransfer: false,
          updatedAt: '2026-08-15T10:00:00.000Z',
        },
      ],
      categories: [
        {
          id: 'c1',
          parentId: null,
          name: 'Alimentação',
          icon: null,
          color: '#E6A94E',
          isIncome: false,
          isTransfer: false,
          sortOrder: 0,
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      serverTime: '2026-08-15T10:00:01.000Z',
    });

    const txRows = await db.select().from(transactions);
    const catRows = await db.select().from(categories);
    assert.equal(txRows.length, 1);
    assert.equal(catRows.length, 1);
    assert.equal(txRows[0]?.amountCents, -1000);
  });

  it('sempre sobrescreve com a versão do servidor — sem LWW, é um espelho', async () => {
    await applyFinancePulled(db, {
      transactions: [
        {
          id: 't1',
          accountId: 'acc1',
          amountCents: -1000,
          date: '2026-08-15',
          status: 'POSTED',
          categoryId: null,
          isInternalTransfer: false,
          updatedAt: '2026-08-15T10:00:00.000Z',
        },
      ],
      categories: [],
      serverTime: '2026-08-15T10:00:01.000Z',
    });

    // servidor manda uma versão "mais antiga" na data (categorização corrigida) — mesmo assim vence
    await applyFinancePulled(db, {
      transactions: [
        {
          id: 't1',
          accountId: 'acc1',
          amountCents: -2000,
          date: '2026-08-15',
          status: 'POSTED',
          categoryId: 'c1',
          isInternalTransfer: false,
          updatedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      categories: [],
      serverTime: '2026-08-15T10:00:02.000Z',
    });

    const [row] = await db.select().from(transactions);
    assert.equal(row?.amountCents, -2000);
    assert.equal(row?.categoryId, 'c1');
  });
});

describe('syncFinance — round trip com servidor HTTP real', () => {
  const SECRET = 'segredo-de-teste';
  let server: Server;
  let baseUrl: string;
  let lastRequestBody: unknown;

  before(async () => {
    server = createServer((req, res) => {
      if (req.headers['x-sync-secret'] !== SECRET) {
        res.writeHead(401).end(JSON.stringify({ error: 'não autorizado' }));
        return;
      }
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        lastRequestBody = JSON.parse(raw);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            transactions: [
              {
                id: 't1',
                accountId: 'acc1',
                amountCents: -500,
                date: '2026-08-20',
                status: 'POSTED',
                categoryId: null,
                isInternalTransfer: false,
                updatedAt: '2026-08-20T10:00:00.000Z',
              },
            ],
            categories: [],
            serverTime: new Date().toISOString(),
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const config: () => FinanceSyncConfig = () => ({ functionUrl: baseUrl, secret: SECRET });

  it('pede o watermark certo e aplica o que voltou', async () => {
    const outcome = await syncFinance(db, config());

    assert.equal(outcome.ok, true);
    if (outcome.ok) assert.equal(outcome.pulled, 1);

    const request = lastRequestBody as { pullSince: { transactions: string | null; categories: string | null } };
    assert.equal(request.pullSince.transactions, null, 'primeira sincronização pede tudo');

    const rows = await db.select().from(transactions);
    assert.equal(rows.length, 1);

    const [wm] = await db.select().from(syncState).where(eq(syncState.tableName, 'transactions'));
    assert.match(wm!.lastPulledAt!, /^\d{4}-\d{2}-\d{2}T/, 'watermark deve ser o relógio do servidor, ISO 8601');
  });

  it('segredo errado falha com HTTP 401, não trava a sincronização', async () => {
    const outcome = await syncFinance(db, { functionUrl: baseUrl, secret: 'errado' });
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.match(outcome.error, /401/);
  });

  it('na segunda chamada, o watermark avançado vai no pedido', async () => {
    await syncFinance(db, config());
    await syncFinance(db, config());

    const request = lastRequestBody as { pullSince: { transactions: string | null } };
    assert.notEqual(request.pullSince.transactions, null, 'segunda chamada já tem watermark');
  });
});
