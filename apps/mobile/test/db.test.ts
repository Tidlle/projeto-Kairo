/**
 * Testes da persistência local — schema, migração, seed e escrita —
 * contra SQLite DE VERDADE via `better-sqlite3`, não expo-sqlite.
 *
 * Por quê: `expo-sqlite` só roda dentro do runtime do Expo (nativo ou Web).
 * O suporte a Web da biblioteca é rotulado alpha pela própria documentação
 * da Expo, e travou num bug real do Metro ("Worker chunk not found") ao
 * tentar validar neste ambiente — ver PLANO.md para o relato completo.
 *
 * `schema.ts` usa `drizzle-orm/sqlite-core`, dialect-agnóstico: o mesmo
 * schema, a mesma migração gerada e as mesmas funções de `queries.ts`
 * (que recebem o tipo genérico `Db`) rodam sobre qualquer driver SQLite
 * síncrono. `better-sqlite3` prova a lógica de verdade — migrações,
 * seed, leitura, escrita — sem depender do runtime do Expo.
 */

import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { before, beforeEach, describe, it } from 'node:test';

import type { Db } from '../src/db/client';
import * as schema from '../src/db/schema';
import { seedIfEmpty } from '../src/db/seed';
import {
  contributeToGoal,
  createEvent,
  createGoal,
  createHabit,
  createTask,
  cycleTaskStatus,
  deleteEvent,
  deleteGoal,
  deleteHabit,
  deleteTask,
  todayIso,
  toggleHabitToday,
  updateEvent,
  updateGoal,
  updateHabit,
  updateTask,
} from '../src/db/queries';
import { accounts, dueItems, events, goals, habitLogs, habits, tasks } from '../src/db/schema';

let sqlite: Database.Database;
let db: Db;

/**
 * Aplica TODAS as migrações, em ordem — não só a primeira que aparecer.
 * `fs.readdirSync(...).find(...)` (usado aqui antes) parava no primeiro
 * arquivo (`0000_...sql`) e ignorava `0001`/`0002` em diante; passava
 * despercebido porque os defaults de `created_at`/`updated_at` são
 * `$defaultFn` do lado do Drizzle (JS), não dependem do DDL aplicado, e
 * nada neste arquivo usava `sync_state` (0001) até a tabela `events` (0002)
 * precisar existir para os testes de agenda abaixo.
 */
function applyMigrations() {
  const dir = path.resolve(import.meta.dirname, '../src/db/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(files.length > 0, 'migração não encontrada — rode: cd apps/mobile && npx drizzle-kit generate');
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
  // Sem cascade automático de FK em better-sqlite3 por padrão nesta versão
  // de config — apaga na ordem certa (habit_logs antes de habits, events
  // antes de tasks por causa do task_id opcional).
  sqlite.exec(
    'delete from habit_logs; delete from due_items; delete from events; delete from tasks; delete from habits; delete from goals; delete from accounts;',
  );
});

describe('migração', () => {
  it('cria as 10 tabelas esperadas', () => {
    const rows = sqlite
      .prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%'")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name).sort();
    assert.deepEqual(names, [
      'accounts',
      'categories',
      'due_items',
      'events',
      'goals',
      'habit_logs',
      'habits',
      'sync_state',
      'tasks',
      'transactions',
    ]);
  });
});

describe('randomUUID', () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it('gera no formato UUID v4 — o Postgres rejeita qualquer coisa fora disso na coluna `uuid`', () => {
    for (let i = 0; i < 50; i++) {
      assert.match(schema.randomUUID(), UUID_V4);
    }
  });

  it('nunca repete em uma amostra razoável', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => schema.randomUUID()));
    assert.equal(ids.size, 1000);
  });

  it('as tabelas geram esse mesmo formato como id padrão — não `crypto.randomUUID()`', async () => {
    // Achado testando num Android físico via Expo Go: o Hermes não tem `crypto`
    // global, diferente de Node/navegador/webview do Tauri — nenhum teste
    // automatizado roda em Hermes de verdade, então só o aparelho físico pegou.
    const id = await createTask(db, { title: 'Verificação de id' });
    assert.match(id, UUID_V4);
  });
});

describe('seedIfEmpty', () => {
  it('povoa todas as tabelas na primeira execução', async () => {
    await seedIfEmpty(db);

    assert.equal((await db.select().from(accounts)).length, 1);
    assert.equal((await db.select().from(dueItems)).length, 2);
    assert.equal((await db.select().from(tasks)).length, 4);
    assert.equal((await db.select().from(habits)).length, 3);
    assert.equal((await db.select().from(goals)).length, 1);
  });

  it('é idempotente: não duplica numa segunda chamada', async () => {
    await seedIfEmpty(db);
    await seedIfEmpty(db);
    await seedIfEmpty(db);

    assert.equal((await db.select().from(accounts)).length, 1);
    assert.equal((await db.select().from(tasks)).length, 4);
  });

  it('marca "Cozinhar em vez de pedir" como feito hoje, os outros não', async () => {
    await seedIfEmpty(db);

    const todayLogs = (await db.select().from(habitLogs)).filter((l) => l.date === todayIso());
    assert.equal(todayLogs.length, 1);

    const cozinhar = (await db.select().from(habits)).find((h) => h.name === 'Cozinhar em vez de pedir');
    assert.ok(cozinhar);
    assert.equal(todayLogs[0]!.habitId, cozinhar!.id);
  });

  it('reproduz os números reais da meta — R$800k/R$350k/R$5k/mês', async () => {
    await seedIfEmpty(db);
    const [goal] = await db.select().from(goals);
    assert.equal(goal!.targetCents, 80_000_000);
    assert.equal(goal!.savedCents, 35_000_000);
    assert.equal(goal!.monthlyContributionCents, 500_000);
  });
});

describe('toggleHabitToday', () => {
  it('marca como feito: cria o log e soma o streak', async () => {
    const [habit] = await db.insert(habits).values({ name: 'Teste', currentStreak: 2, bestStreak: 4 }).returning();

    await toggleHabitToday(db, habit!.id, habit!.currentStreak);

    const logs = (await db.select().from(habitLogs)).filter((l) => l.habitId === habit!.id);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]!.date, todayIso());

    const updated = (await db.select().from(habits)).find((h) => h.id === habit!.id)!;
    assert.equal(updated.currentStreak, 3);
  });

  it('desmarca: remove o log e subtrai o streak', async () => {
    const [habit] = await db.insert(habits).values({ name: 'Teste2', currentStreak: 3, bestStreak: 3 }).returning();

    await toggleHabitToday(db, habit!.id, habit!.currentStreak); // marca
    const afterMark = (await db.select().from(habits)).find((h) => h.id === habit!.id)!;
    assert.equal(afterMark.currentStreak, 4);

    await toggleHabitToday(db, habit!.id, afterMark.currentStreak); // desmarca
    const afterUnmark = (await db.select().from(habits)).find((h) => h.id === habit!.id)!;
    assert.equal(afterUnmark.currentStreak, 3);

    const logs = (await db.select().from(habitLogs)).filter((l) => l.habitId === habit!.id);
    assert.equal(logs.length, 0);
  });

  it('nunca deixa o streak negativo', async () => {
    const [habit] = await db.insert(habits).values({ name: 'Teste3', currentStreak: 0, bestStreak: 0 }).returning();

    // desmarca algo que nunca foi marcado — não deve quebrar nem ir a -1
    await toggleHabitToday(db, habit!.id, habit!.currentStreak);
    const afterMark = (await db.select().from(habits)).find((h) => h.id === habit!.id)!;
    assert.equal(afterMark.currentStreak, 1);
  });

  it('atualiza o recorde (bestStreak) quando o streak atual supera', async () => {
    const [habit] = await db.insert(habits).values({ name: 'Teste4', currentStreak: 4, bestStreak: 4 }).returning();

    await toggleHabitToday(db, habit!.id, habit!.currentStreak);

    const updated = (await db.select().from(habits)).find((h) => h.id === habit!.id)!;
    assert.equal(updated.currentStreak, 5);
    assert.equal(updated.bestStreak, 5, 'recorde deve acompanhar quando o streak atual ultrapassa');
  });

  it('NÃO derruba o recorde ao desmarcar', async () => {
    const [habit] = await db.insert(habits).values({ name: 'Teste5', currentStreak: 4, bestStreak: 10 }).returning();

    await toggleHabitToday(db, habit!.id, habit!.currentStreak); // marca: streak 5
    await toggleHabitToday(db, habit!.id, 5); // desmarca: streak volta a 4

    const updated = (await db.select().from(habits)).find((h) => h.id === habit!.id)!;
    assert.equal(updated.currentStreak, 4);
    assert.equal(updated.bestStreak, 10, 'recorde de 10 não pode cair só porque desmarcou hoje');
  });
});

describe('CRUD de tarefas', () => {
  it('cria com valores padrão quando só o título é dado', async () => {
    const id = await createTask(db, { title: '  Lavar o carro  ' });

    const saved = (await db.select().from(tasks)).find((t) => t.id === id)!;

    assert.equal(saved.title, 'Lavar o carro', 'espaços nas pontas são removidos');
    assert.equal(saved.status, 'todo');
    assert.equal(saved.priority, 'none');
    assert.equal(saved.dueAt, null);
  });

  it('cria com prioridade, prazo e custo estimado', async () => {
    const due = new Date('2026-09-01T00:00:00.000Z');
    const id = await createTask(db, { title: 'Revisão do carro', priority: 'high', dueAt: due, estimatedCostCents: 35000 });

    const saved = (await db.select().from(tasks)).find((t) => t.id === id)!;
    assert.equal(saved.priority, 'high');
    assert.equal(saved.dueAt, due.toISOString());
    assert.equal(saved.estimatedCostCents, 35000);
  });

  it('updateTask altera só os campos passados e atualiza updated_at', async () => {
    const id = await createTask(db, { title: 'Original', priority: 'low' });
    const before = (await db.select().from(tasks)).find((t) => t.id === id)!;

    await new Promise((r) => setTimeout(r, 5)); // garante um updated_at diferente
    await updateTask(db, id, { priority: 'high' });

    const after = (await db.select().from(tasks)).find((t) => t.id === id)!;
    assert.equal(after.title, 'Original', 'título não deveria mudar — não foi passado no patch');
    assert.equal(after.priority, 'high');
    assert.notEqual(after.updatedAt, before.updatedAt);
  });

  it('updateTask com dueAt: null limpa o prazo', async () => {
    const id = await createTask(db, { title: 'Com prazo', dueAt: new Date() });
    await updateTask(db, id, { dueAt: null });

    const saved = (await db.select().from(tasks)).find((t) => t.id === id)!;
    assert.equal(saved.dueAt, null);
  });

  it('cycleTaskStatus percorre todo → doing → done → todo', async () => {
    const id = await createTask(db, { title: 'Ciclo' });

    await cycleTaskStatus(db, id, 'todo');
    assert.equal((await db.select().from(tasks)).find((t) => t.id === id)!.status, 'doing');

    await cycleTaskStatus(db, id, 'doing');
    assert.equal((await db.select().from(tasks)).find((t) => t.id === id)!.status, 'done');

    await cycleTaskStatus(db, id, 'done');
    assert.equal((await db.select().from(tasks)).find((t) => t.id === id)!.status, 'todo');
  });

  it('deleteTask remove de fato', async () => {
    const id = await createTask(db, { title: 'Efêmera' });
    await deleteTask(db, id);

    const found = (await db.select().from(tasks)).find((t) => t.id === id);
    assert.equal(found, undefined);
  });
});

describe('CRUD de hábitos', () => {
  it('cria com frequência e meta padrão', async () => {
    const id = await createHabit(db, { name: '  Meditar  ' });

    const saved = (await db.select().from(habits)).find((h) => h.id === id)!;
    assert.equal(saved.name, 'Meditar');
    assert.equal(saved.frequency, 'daily');
    assert.equal(saved.targetPerPeriod, 1);
    assert.equal(saved.currentStreak, 0, 'hábito novo começa sem streak');
  });

  it('cria com frequência explícita', async () => {
    const id = await createHabit(db, { name: 'Revisar contas', frequency: 'weekly', targetPerPeriod: 2 });

    const saved = (await db.select().from(habits)).find((h) => h.id === id)!;
    assert.equal(saved.frequency, 'weekly');
    assert.equal(saved.targetPerPeriod, 2);
  });

  it('updateHabit renomeia sem afetar streak', async () => {
    const id = await createHabit(db, { name: 'Nome velho' });
    await db.update(habits).set({ currentStreak: 7 }).where(eq(habits.id, id));

    await updateHabit(db, id, { name: 'Nome novo' });

    const saved = (await db.select().from(habits)).find((h) => h.id === id)!;
    assert.equal(saved.name, 'Nome novo');
    assert.equal(saved.currentStreak, 7, 'renomear não pode mexer no streak');
  });

  it('deleteHabit apaga o hábito E o histórico — sem depender de cascade do SQLite', async () => {
    const id = await createHabit(db, { name: 'Vai ser apagado' });
    await toggleHabitToday(db, id, 0); // gera um habit_log de verdade

    const logsAntes = (await db.select().from(habitLogs)).filter((l) => l.habitId === id);
    assert.equal(logsAntes.length, 1, 'pré-condição: o log existe antes de apagar');

    await deleteHabit(db, id);

    assert.equal((await db.select().from(habits)).find((h) => h.id === id), undefined);
    const logsDepois = (await db.select().from(habitLogs)).filter((l) => l.habitId === id);
    assert.equal(logsDepois.length, 0, 'log não pode sobrar órfão — o SQLite não faz cascade sozinho');
  });
});

describe('CRUD de metas', () => {
  it('cria com savedCents zero por padrão', async () => {
    const id = await createGoal(db, { name: '  Apartamento  ', targetCents: 80_000_000 });

    const saved = (await db.select().from(goals)).find((g) => g.id === id)!;
    assert.equal(saved.name, 'Apartamento');
    assert.equal(saved.savedCents, 0);
    assert.equal(saved.status, 'active');
    assert.equal(saved.monthlyContributionCents, null);
  });

  it('cria com aporte mensal e valor já guardado', async () => {
    const id = await createGoal(db, {
      name: 'Apartamento em Fortaleza',
      targetCents: 80_000_000,
      savedCents: 35_000_000,
      monthlyContributionCents: 500_000,
    });

    const saved = (await db.select().from(goals)).find((g) => g.id === id)!;
    assert.equal(saved.savedCents, 35_000_000);
    assert.equal(saved.monthlyContributionCents, 500_000);
  });

  it('updateGoal altera só os campos passados', async () => {
    const id = await createGoal(db, { name: 'Original', targetCents: 1000 });
    await updateGoal(db, id, { targetCents: 2000 });

    const saved = (await db.select().from(goals)).find((g) => g.id === id)!;
    assert.equal(saved.name, 'Original', 'nome não deveria mudar — não foi passado no patch');
    assert.equal(saved.targetCents, 2000);
  });

  it('contributeToGoal soma ao valor guardado', async () => {
    const id = await createGoal(db, { name: 'Meta', targetCents: 1000, savedCents: 300 });
    await contributeToGoal(db, id, 200);

    const saved = (await db.select().from(goals)).find((g) => g.id === id)!;
    assert.equal(saved.savedCents, 500);
    assert.equal(saved.status, 'active', 'longe da meta — continua ativa');
  });

  it('contributeToGoal marca como achieved sozinho ao bater a meta', async () => {
    const id = await createGoal(db, { name: 'Quase lá', targetCents: 1000, savedCents: 900 });
    await contributeToGoal(db, id, 150); // passa de 1000

    const saved = (await db.select().from(goals)).find((g) => g.id === id)!;
    assert.equal(saved.savedCents, 1050, 'guarda o valor real, mesmo passando da meta');
    assert.equal(saved.status, 'achieved');
  });

  it('contributeToGoal NÃO reabre uma meta pausada ao aportar', async () => {
    const id = await createGoal(db, { name: 'Pausada', targetCents: 1000, savedCents: 900 });
    await updateGoal(db, id, { status: 'paused' });

    await contributeToGoal(db, id, 200); // ultrapassaria a meta

    const saved = (await db.select().from(goals)).find((g) => g.id === id)!;
    assert.equal(saved.status, 'paused', 'só metas ativas viram achieved automaticamente');
  });

  it('deleteGoal remove de fato', async () => {
    const id = await createGoal(db, { name: 'Efêmera', targetCents: 1000 });
    await deleteGoal(db, id);

    const found = (await db.select().from(goals)).find((g) => g.id === id);
    assert.equal(found, undefined);
  });
});

describe('CRUD de eventos', () => {
  it('cria um evento com horário definido', async () => {
    const startsAt = new Date('2026-09-10T14:00:00.000Z');
    const endsAt = new Date('2026-09-10T15:00:00.000Z');
    const id = await createEvent(db, { title: '  Reunião  ', startsAt, endsAt });

    const saved = (await db.select().from(events)).find((e) => e.id === id)!;
    assert.equal(saved.title, 'Reunião', 'título deve ser aparado, mesmo padrão de createTask/createHabit');
    assert.equal(saved.startsAt, startsAt.toISOString());
    assert.equal(saved.endsAt, endsAt.toISOString());
    assert.equal(saved.allDay, false);
    assert.equal(saved.taskId, null);
  });

  it('cria um evento de dia inteiro, vinculado a uma tarefa', async () => {
    const taskId = await createTask(db, { title: 'Viagem' });
    const id = await createEvent(db, {
      title: 'Fora da cidade',
      startsAt: new Date('2026-09-10T00:00:00.000Z'),
      endsAt: new Date('2026-09-11T00:00:00.000Z'),
      allDay: true,
      taskId,
    });

    const saved = (await db.select().from(events)).find((e) => e.id === id)!;
    assert.equal(saved.allDay, true);
    assert.equal(saved.taskId, taskId);
  });

  it('updateEvent altera só os campos passados', async () => {
    const id = await createEvent(db, {
      title: 'Original',
      location: 'Escritório',
      startsAt: new Date('2026-09-10T14:00:00.000Z'),
      endsAt: new Date('2026-09-10T15:00:00.000Z'),
    });

    await updateEvent(db, id, { location: 'Casa' });

    const saved = (await db.select().from(events)).find((e) => e.id === id)!;
    assert.equal(saved.title, 'Original', 'título não deveria mudar — não foi passado no patch');
    assert.equal(saved.location, 'Casa');
  });

  it('updateEvent aceita limpar o local (string vazia vira null)', async () => {
    const id = await createEvent(db, {
      title: 'Com local',
      location: 'Algum lugar',
      startsAt: new Date('2026-09-10T14:00:00.000Z'),
      endsAt: new Date('2026-09-10T15:00:00.000Z'),
    });

    await updateEvent(db, id, { location: '   ' });

    const saved = (await db.select().from(events)).find((e) => e.id === id)!;
    assert.equal(saved.location, null);
  });

  it('deleteEvent remove de fato, e não apaga a tarefa vinculada', async () => {
    const taskId = await createTask(db, { title: 'Continua existindo' });
    const id = await createEvent(db, {
      title: 'Efêmero',
      startsAt: new Date('2026-09-10T14:00:00.000Z'),
      endsAt: new Date('2026-09-10T15:00:00.000Z'),
      taskId,
    });

    await deleteEvent(db, id);

    const found = (await db.select().from(events)).find((e) => e.id === id);
    assert.equal(found, undefined);

    const task = (await db.select().from(tasks)).find((t) => t.id === taskId);
    assert.ok(task, 'apagar o evento não deveria apagar a tarefa vinculada');
  });
});

describe('formato de updated_at/created_at — base da sincronização', () => {
  const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  it('o valor padrão do INSERT é ISO 8601 completo, não o current_timestamp do SQLite', async () => {
    const id = await createTask(db, { title: 'Verificação de formato' });
    const saved = (await db.select().from(tasks)).find((t) => t.id === id)!;

    assert.match(
      saved.createdAt,
      ISO_8601,
      `formato errado: "${saved.createdAt}" — o SQLite grava "AAAA-MM-DD HH:MM:SS" sem T/Z por padrão, e isso quebra qualquer comparação de data com o que updateTask grava`,
    );
    assert.match(saved.updatedAt, ISO_8601);
  });

  it('o UPDATE grava exatamente o mesmo formato do INSERT', async () => {
    const id = await createTask(db, { title: 'Outra verificação' });
    await updateTask(db, id, { priority: 'high' });
    const saved = (await db.select().from(tasks)).find((t) => t.id === id)!;

    assert.match(saved.updatedAt, ISO_8601);
  });

  it('o mesmo vale para hábitos e metas', async () => {
    const habitId = await createHabit(db, { name: 'Formato' });
    const goalId = await createGoal(db, { name: 'Formato', targetCents: 100 });

    const habit = (await db.select().from(habits)).find((h) => h.id === habitId)!;
    const goal = (await db.select().from(goals)).find((g) => g.id === goalId)!;

    assert.match(habit.createdAt, ISO_8601);
    assert.match(goal.createdAt, ISO_8601);
  });
});
