/**
 * Testes da sincronização de rotina — lado Postgres — contra PGlite real,
 * mesmo princípio de ingest.test.ts: `on conflict ... where`, `excluded.*`
 * e o enforcement de tipos são exercitados de verdade, não simulados.
 */

import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { before, beforeEach, describe, it } from 'node:test';
import { drizzle } from 'drizzle-orm/pglite';

import type { SyncEventRow, SyncGoalRow, SyncHabitLogRow, SyncHabitRow, SyncTaskRow } from '../../core/src/sync-protocol.ts';
import * as schema from '../schema.ts';
import type { Db } from '../src/client.ts';
import { pullRoutine, pushEvents, pushGoals, pushHabitLogs, pushHabits, pushRoutine, pushTasks } from '../src/routine-sync.ts';

const USER = '00000000-0000-0000-0000-000000000001';
const OTHER_USER = '00000000-0000-0000-0000-000000000002';

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
  await client.exec('truncate table habit_logs, events, tasks, habits, goals restart identity cascade;');
});

const task = (over: Partial<SyncTaskRow> = {}): SyncTaskRow => ({
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Tarefa',
  status: 'todo',
  priority: 'none',
  dueAt: null,
  estimatedCostCents: null,
  createdAt: '2026-09-03T10:00:00.000Z',
  updatedAt: '2026-09-03T10:00:00.000Z',
  ...over,
});

const habit = (over: Partial<SyncHabitRow> = {}): SyncHabitRow => ({
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Hábito',
  frequency: 'daily',
  targetPerPeriod: 1,
  currentStreak: 0,
  bestStreak: 0,
  createdAt: '2026-09-03T10:00:00.000Z',
  updatedAt: '2026-09-03T10:00:00.000Z',
  ...over,
});

const goal = (over: Partial<SyncGoalRow> = {}): SyncGoalRow => ({
  id: '33333333-3333-3333-3333-333333333333',
  name: 'Meta',
  targetCents: 100000,
  savedCents: 0,
  monthlyContributionCents: null,
  status: 'active',
  createdAt: '2026-09-03T10:00:00.000Z',
  updatedAt: '2026-09-03T10:00:00.000Z',
  ...over,
});

const event = (over: Partial<SyncEventRow> = {}): SyncEventRow => ({
  id: '88888888-8888-8888-8888-888888888888',
  title: 'Evento',
  location: null,
  startsAt: '2026-09-03T14:00:00.000Z',
  endsAt: '2026-09-03T15:00:00.000Z',
  allDay: false,
  taskId: null,
  createdAt: '2026-09-03T10:00:00.000Z',
  updatedAt: '2026-09-03T10:00:00.000Z',
  ...over,
});

describe('pushTasks', () => {
  it('cria uma tarefa nova', async () => {
    await pushTasks(db, USER, [task({ title: 'Revisar orçamento' })]);

    const rows = await db.select().from(schema.tasks);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.title, 'Revisar orçamento');
    assert.equal(rows[0]!.userId, USER);
  });

  it('é idempotente: reenviar a mesma linha não duplica', async () => {
    await pushTasks(db, USER, [task()]);
    await pushTasks(db, USER, [task()]);
    await pushTasks(db, USER, [task()]);

    const rows = await db.select().from(schema.tasks);
    assert.equal(rows.length, 1);
  });

  it('last-write-wins: incoming mais novo sobrescreve', async () => {
    await pushTasks(db, USER, [task({ title: 'Original', updatedAt: '2026-09-03T10:00:00.000Z' })]);
    await pushTasks(db, USER, [task({ title: 'Editada', updatedAt: '2026-09-03T10:00:05.000Z' })]);

    const [row] = await db.select().from(schema.tasks);
    assert.equal(row!.title, 'Editada');
  });

  it('last-write-wins: incoming mais antigo NÃO sobrescreve', async () => {
    await pushTasks(db, USER, [task({ title: 'Mais nova no servidor', updatedAt: '2026-09-03T10:00:05.000Z' })]);
    await pushTasks(db, USER, [task({ title: 'Chegou atrasada', updatedAt: '2026-09-03T10:00:00.000Z' })]);

    const [row] = await db.select().from(schema.tasks);
    assert.equal(row!.title, 'Mais nova no servidor', 'a linha do servidor é mais recente — deve vencer');
  });

  it('valor de enum desconhecido cai num padrão seguro em vez de derrubar a sincronização', async () => {
    await pushTasks(db, USER, [task({ status: 'algo-inventado' as never })]);

    const [row] = await db.select().from(schema.tasks);
    assert.equal(row!.status, 'todo');
  });
});

describe('pushRoutine — ordem entre tabelas', () => {
  it('hábito e seu log no MESMO lote não falham por causa da FK', async () => {
    await pushRoutine(db, USER, {
      tasks: [],
      goals: [],
      habits: [habit()],
      habitLogs: [{ id: '44444444-4444-4444-4444-444444444444', habitId: habit().id, date: '2026-09-03', createdAt: task().createdAt, updatedAt: task().updatedAt }],
      events: [],
    });

    const logs = await db.select().from(schema.habitLogs);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]!.habitId, habit().id);
  });

  it('tarefa e o evento vinculado a ela no MESMO lote não falham por causa da FK', async () => {
    await pushRoutine(db, USER, {
      tasks: [task()],
      goals: [],
      habits: [],
      habitLogs: [],
      events: [event({ taskId: task().id })],
    });

    const rows = await db.select().from(schema.events);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.taskId, task().id);
  });
});

describe('pullRoutine', () => {
  it('só devolve linhas do usuário pedido — isolamento real, não por convenção', async () => {
    await pushTasks(db, USER, [task({ id: '66666666-6666-6666-6666-666666666666', title: 'Minha' })]);
    await pushTasks(db, OTHER_USER, [task({ id: '77777777-7777-7777-7777-777777777777', title: 'De outro usuário' })]);

    const result = await pullRoutine(db, USER, { tasks: null, habits: null, habitLogs: null, goals: null, events: null });
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0]!.title, 'Minha');
  });

  it('since=null traz tudo — primeira sincronização do dispositivo', async () => {
    await pushTasks(db, USER, [task({ id: '66666666-6666-6666-6666-666666666666' }), task({ id: '77777777-7777-7777-7777-777777777777', title: 'Segunda' })]);

    const result = await pullRoutine(db, USER, { tasks: null, habits: null, habitLogs: null, goals: null, events: null });
    assert.equal(result.tasks.length, 2);
  });

  it('since filtra só o que mudou depois — não reenvia tudo toda vez', async () => {
    await pushTasks(db, USER, [task({ id: '66666666-6666-6666-6666-666666666666', updatedAt: '2026-09-03T10:00:00.000Z' })]);
    await pushTasks(db, USER, [task({ id: '77777777-7777-7777-7777-777777777777', updatedAt: '2026-09-03T10:00:10.000Z' })]);

    const result = await pullRoutine(db, USER, {
      tasks: '2026-09-03T10:00:05.000Z',
      habits: null,
      habitLogs: null,
      goals: null,
      events: null,
    });

    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0]!.id, '77777777-7777-7777-7777-777777777777');
  });

  it('round-trip: o que entra por push sai por pull com os mesmos valores', async () => {
    await pushRoutine(db, USER, {
      tasks: [task({ title: 'Ida e volta', priority: 'high', estimatedCostCents: 5000 })],
      habits: [habit({ name: 'Streak', currentStreak: 3 })],
      habitLogs: [],
      goals: [goal({ name: 'Meta real', targetCents: 80_000_000, savedCents: 35_000_000 })],
      events: [event({ title: 'Reunião', location: 'Escritório' })],
    });

    const result = await pullRoutine(db, USER, { tasks: null, habits: null, habitLogs: null, goals: null, events: null });

    assert.equal(result.tasks[0]!.title, 'Ida e volta');
    assert.equal(result.tasks[0]!.priority, 'high');
    assert.equal(result.tasks[0]!.estimatedCostCents, 5000);
    assert.equal(result.habits[0]!.currentStreak, 3);
    assert.equal(result.goals[0]!.savedCents, 35_000_000);
    assert.equal(result.events[0]!.title, 'Reunião');
    assert.equal(result.events[0]!.location, 'Escritório');
  });
});

describe('pushHabits e pushGoals — o mesmo princípio de LWW', () => {
  it('pushHabits não regride o streak com um envio atrasado', async () => {
    await pushHabits(db, USER, [habit({ currentStreak: 5, updatedAt: '2026-09-03T10:00:10.000Z' })]);
    await pushHabits(db, USER, [habit({ currentStreak: 0, updatedAt: '2026-09-03T10:00:00.000Z' })]);

    const [row] = await db.select().from(schema.habits);
    assert.equal(row!.currentStreak, 5);
  });

  it('pushGoals last-write-wins também vale para savedCents', async () => {
    await pushGoals(db, USER, [goal({ savedCents: 500, updatedAt: '2026-09-03T10:00:10.000Z' })]);
    await pushGoals(db, USER, [goal({ savedCents: 100, updatedAt: '2026-09-03T10:00:00.000Z' })]);

    const [row] = await db.select().from(schema.goals);
    assert.equal(row!.savedCents, 500);
  });

  it('pushHabitLogs é idempotente mesmo reenviado várias vezes', async () => {
    await pushHabits(db, USER, [habit()]);
    const log: SyncHabitLogRow = { id: '55555555-5555-5555-5555-555555555555', habitId: habit().id, date: '2026-09-03', createdAt: task().createdAt, updatedAt: task().updatedAt };

    await pushHabitLogs(db, USER, [log]);
    await pushHabitLogs(db, USER, [log]);

    const rows = await db.select().from(schema.habitLogs);
    assert.equal(rows.length, 1);
  });
});

describe('pushEvents', () => {
  it('cria um evento novo, sem vínculo com tarefa', async () => {
    await pushEvents(db, USER, [event({ title: 'Consulta' })]);

    const [row] = await db.select().from(schema.events);
    assert.equal(row!.title, 'Consulta');
    assert.equal(row!.taskId, null);
    assert.equal(row!.userId, USER);
  });

  it('é idempotente: reenviar o mesmo evento não duplica', async () => {
    await pushEvents(db, USER, [event()]);
    await pushEvents(db, USER, [event()]);

    const rows = await db.select().from(schema.events);
    assert.equal(rows.length, 1);
  });

  it('last-write-wins também vale para eventos', async () => {
    await pushEvents(db, USER, [event({ title: 'Original', updatedAt: '2026-09-03T10:00:00.000Z' })]);
    await pushEvents(db, USER, [event({ title: 'Editado', updatedAt: '2026-09-03T10:00:05.000Z' })]);

    const [row] = await db.select().from(schema.events);
    assert.equal(row!.title, 'Editado');
  });

  it('mantém o vínculo com a tarefa quando ela já existe', async () => {
    await pushTasks(db, USER, [task()]);
    await pushEvents(db, USER, [event({ taskId: task().id })]);

    const [row] = await db.select().from(schema.events);
    assert.equal(row!.taskId, task().id);
  });
});
