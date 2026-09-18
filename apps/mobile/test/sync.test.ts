/**
 * Testes da sincronização — lado app — contra SQLite real (better-sqlite3).
 *
 * `syncRoutine` fala HTTP com a Edge Function; em vez de mockar `fetch`,
 * sobe um servidor HTTP de verdade (`node:http`) que imita o contrato real
 * do `sync-routine` (mesmo formato de request/response, mesmo header de
 * segredo) — exercita o fetch, o JSON, os headers de verdade, não uma
 * simulação. O lado Postgres do contrato é validado à parte, contra PGlite,
 * em packages/db/test/routine-sync.test.ts.
 */

import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createServer, type Server } from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import type { Db } from '../src/db/client';
import * as schema from '../src/db/schema';
import { createEvent, createGoal, createHabit, createTask, todayIso, toggleHabitToday } from '../src/db/queries';
import { applyPulled, getPushPayload, syncRoutine, type SyncConfig } from '../src/db/sync';
import { events, goals, habitLogs, habits, syncState, tasks } from '../src/db/schema';

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
  sqlite.exec(
    'delete from habit_logs; delete from events; delete from tasks; delete from habits; delete from goals; delete from sync_state;',
  );
});

describe('getPushPayload', () => {
  it('sem watermark, traz tudo — primeira sincronização', async () => {
    await createTask(db, { title: 'A' });
    await createTask(db, { title: 'B' });

    const payload = await getPushPayload(db);
    assert.equal(payload.tasks.length, 2);
  });

  it('com watermark, traz só o que mudou depois', async () => {
    await createTask(db, { title: 'Antiga' });
    const cutoff = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 5));
    await createTask(db, { title: 'Nova' });

    await db.insert(syncState).values({ tableName: 'tasks', lastPushedAt: cutoff });

    const payload = await getPushPayload(db);
    assert.equal(payload.tasks.length, 1);
    assert.equal(payload.tasks[0]!.title, 'Nova');
  });
});

describe('applyPulled', () => {
  it('cria linhas que não existem localmente', async () => {
    await applyPulled(db, {
      tasks: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          title: 'Vinda do servidor',
          status: 'todo',
          priority: 'none',
          dueAt: null,
          estimatedCostCents: null,
          createdAt: '2026-09-03T10:00:00.000Z',
          updatedAt: '2026-09-03T10:00:00.000Z',
        },
      ],
      habits: [],
      habitLogs: [],
      goals: [],
      events: [],
    });

    const rows = await db.select().from(tasks);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.title, 'Vinda do servidor');
  });

  it('NÃO sobrescreve uma edição local mais nova (LWW)', async () => {
    const id = await createTask(db, { title: 'Editada aqui agora' });
    const [local] = await db.select().from(tasks);

    // "servidor" manda uma versão antiga da mesma tarefa
    await applyPulled(db, {
      tasks: [
        {
          id,
          title: 'Versão velha do servidor',
          status: 'todo',
          priority: 'none',
          dueAt: null,
          estimatedCostCents: null,
          createdAt: local!.createdAt,
          updatedAt: '2000-01-01T00:00:00.000Z', // bem mais antigo
        },
      ],
      habits: [],
      habitLogs: [],
      goals: [],
      events: [],
    });

    const [after1] = await db.select().from(tasks);
    assert.equal(after1!.title, 'Editada aqui agora', 'local é mais novo — não pode ser sobrescrito');
  });

  it('sobrescreve quando a versão recebida é mais nova', async () => {
    const id = await createTask(db, { title: 'Original' });

    await applyPulled(db, {
      tasks: [
        {
          id,
          title: 'Editada em outro dispositivo',
          status: 'doing',
          priority: 'high',
          dueAt: null,
          estimatedCostCents: null,
          createdAt: '2026-09-03T10:00:00.000Z',
          updatedAt: '2099-01-01T00:00:00.000Z', // futuro — garantidamente mais novo
        },
      ],
      habits: [],
      habitLogs: [],
      goals: [],
      events: [],
    });

    const [row] = await db.select().from(tasks);
    assert.equal(row!.title, 'Editada em outro dispositivo');
    assert.equal(row!.status, 'doing');
  });

  it('respeita LWW para eventos também', async () => {
    const id = await createEvent(db, {
      title: 'Editado aqui agora',
      startsAt: new Date('2026-09-03T14:00:00.000Z'),
      endsAt: new Date('2026-09-03T15:00:00.000Z'),
    });
    const [local] = await db.select().from(events);

    await applyPulled(db, {
      tasks: [],
      habits: [],
      habitLogs: [],
      goals: [],
      events: [
        {
          id,
          title: 'Versão velha do servidor',
          location: null,
          startsAt: '2026-09-03T14:00:00.000Z',
          endsAt: '2026-09-03T15:00:00.000Z',
          allDay: false,
          taskId: null,
          createdAt: local!.createdAt,
          updatedAt: '2000-01-01T00:00:00.000Z',
        },
      ],
    });

    const [after1] = await db.select().from(events);
    assert.equal(after1!.title, 'Editado aqui agora', 'local é mais novo — não pode ser sobrescrito');
  });
});

describe('syncRoutine — round trip com servidor HTTP real', () => {
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
        // `new Date().toISOString()`, igual à Edge Function real — nunca um
        // valor fixo. Um `serverTime` no passado (como um teste anterior
        // desta suíte tinha) fica MENOR que o `updatedAt` real das linhas
        // recém-criadas, e a próxima sincronização as reenviaria à toa.
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            pulled: { tasks: [], habits: [], habitLogs: [], goals: [], events: [] },
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

  const config: () => SyncConfig = () => ({ functionUrl: baseUrl, secret: SECRET });

  it('envia as linhas locais e avança os marcadores com o relógio do servidor', async () => {
    await createTask(db, { title: 'Para sincronizar' });

    const outcome = await syncRoutine(db, config());

    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(outcome.pushed, 1);
      assert.equal(outcome.pulled, 0);
    }

    const push = lastRequestBody as { push: { tasks: unknown[] } };
    assert.equal(push.push.tasks.length, 1);

    const [wm] = await db.select().from(syncState).where(eq(syncState.tableName, 'tasks'));
    assert.match(wm!.lastPushedAt!, /^\d{4}-\d{2}-\d{2}T/, 'watermark deve ser o relógio do servidor, ISO 8601');
    assert.equal(wm!.lastPushedAt, wm!.lastPulledAt, 'push e pull avançam juntos nesta sincronização');
  });

  it('segredo errado falha com HTTP 401, não trava a sincronização', async () => {
    const outcome = await syncRoutine(db, { functionUrl: baseUrl, secret: 'errado' });
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.match(outcome.error, /401/);
  });

  it('depois de sincronizar, uma segunda chamada sem mudanças novas envia payload vazio', async () => {
    await createTask(db, { title: 'Primeira' });
    await syncRoutine(db, config());

    const outcome = await syncRoutine(db, config());
    assert.equal(outcome.ok, true);
    if (outcome.ok) assert.equal(outcome.pushed, 0, 'nada mudou desde o watermark — não deveria reenviar');
  });

  it('inclui hábitos, logs, metas e eventos no payload', async () => {
    const habitId = await createHabit(db, { name: 'Hábito' });
    await toggleHabitToday(db, habitId, 0);
    await createGoal(db, { name: 'Meta', targetCents: 1000 });
    await createEvent(db, {
      title: 'Evento',
      startsAt: new Date('2026-09-03T14:00:00.000Z'),
      endsAt: new Date('2026-09-03T15:00:00.000Z'),
    });

    await syncRoutine(db, config());

    const push = lastRequestBody as {
      push: { habits: unknown[]; habitLogs: unknown[]; goals: unknown[]; events: unknown[] };
    };
    assert.equal(push.push.habits.length, 1);
    assert.equal(push.push.habitLogs.length, 1);
    assert.equal(push.push.goals.length, 1);
    assert.equal(push.push.events.length, 1);
  });
});
