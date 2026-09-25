/**
 * Schema SQLite local — apps/mobile.
 *
 * Deliberadamente separado de `packages/db/schema.ts` (Postgres/Supabase):
 * são dialetos diferentes do Drizzle (`sqlite-core` vs `pg-core`), sem forma
 * de compartilhar um único arquivo entre os dois. O que É compartilhado são
 * os NOMES — mesmos campos, mesmos valores de enum (aqui como `text` com
 * union type em TypeScript, já que SQLite não tem enum nativo) — para que
 * a futura sincronização local↔Supabase seja tradução direta, não redesenho.
 *
 * Escopo desta primeira versão: só o necessário para a tela "Hoje" ter dados
 * de verdade. Contas/transações completas (com Pluggy) continuam vivendo no
 * Postgres — aqui é só o suficiente para mostrar saldo.
 */

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * UUID v4 em JS puro, sem depender do global `crypto` — achado num dispositivo
 * físico de verdade (Expo Go, Android): o Hermes (motor JS do React Native)
 * não tem `crypto` global por padrão, diferente de Node, navegador ou do
 * webview do Tauri (as três plataformas onde este mesmo `schema.ts` também
 * roda, e onde o bug nunca apareceu — nenhum teste automatizado roda em
 * Hermes de verdade, só o dispositivo físico pegou isso). Não precisa ser
 * criptograficamente seguro: é só a chave primária de uma linha local, não
 * segredo — `Math.random()` basta, e funciona identicamente nas quatro
 * plataformas sem nenhuma dependência nova.
 */
export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const id = () => text('id').primaryKey().$defaultFn(randomUUID);

/**
 * ISO 8601 completo (`toISOString()`), NUNCA o `current_timestamp` nativo do
 * SQLite. Achado corrigindo a sincronização: o padrão do SQLite grava
 * `"2026-09-03 22:14:00"` (espaço, sem "Z"); `updateTask`/`updateHabit`/
 * `updateGoal` já gravavam `new Date().toISOString()` — dois formatos
 * diferentes no mesmo campo. Comparação de `updated_at` é a base inteira da
 * sincronização; um `default` inconsistente quebraria isso silenciosamente,
 * do mesmo jeito que o bug de fuso horário (UTC vs. local) quebrou o seed.
 */
const isoNow = () => new Date().toISOString();
const timestamps = {
  createdAt: text('created_at').notNull().$defaultFn(isoNow),
  updatedAt: text('updated_at').notNull().$defaultFn(isoNow),
};

export const accounts = sqliteTable('accounts', {
  id: id(),
  name: text('name').notNull(),
  balanceCents: integer('balance_cents').notNull().default(0),
  ...timestamps,
});

export const goals = sqliteTable('goals', {
  id: id(),
  name: text('name').notNull(),
  targetCents: integer('target_cents').notNull(),
  savedCents: integer('saved_cents').notNull().default(0),
  monthlyContributionCents: integer('monthly_contribution_cents'),
  /** 'active' | 'achieved' | 'paused' | 'abandoned' — ver packages/core/src/domain.ts */
  status: text('status').notNull().default('active'),
  ...timestamps,
});

export const tasks = sqliteTable('tasks', {
  id: id(),
  title: text('title').notNull(),
  /** 'todo' | 'doing' | 'done' | 'canceled' */
  status: text('status').notNull().default('todo'),
  /** 'none' | 'low' | 'medium' | 'high' */
  priority: text('priority').notNull().default('none'),
  /** ISO 8601. SQLite não tem tipo data nativo — texto ordenável basta aqui. */
  dueAt: text('due_at'),
  estimatedCostCents: integer('estimated_cost_cents'),
  ...timestamps,
});

export const habits = sqliteTable('habits', {
  id: id(),
  name: text('name').notNull(),
  /** 'daily' | 'weekly' | 'times_per_week' | 'monthly' */
  frequency: text('frequency').notNull().default('daily'),
  targetPerPeriod: integer('target_per_period').notNull().default(1),
  currentStreak: integer('current_streak').notNull().default(0),
  bestStreak: integer('best_streak').notNull().default(0),
  ...timestamps,
});

/**
 * Um registro por dia em que o hábito foi feito. `doneToday` na tela nunca é
 * um campo solto no hábito — é derivado daqui, igual ao schema do Postgres
 * (habit_logs). Evita o hábito clássico de UI mentir sobre "hoje" depois
 * da virada da meia-noite.
 */
export const habitLogs = sqliteTable('habit_logs', {
  id: id(),
  habitId: text('habit_id')
    .notNull()
    .references(() => habits.id, { onDelete: 'cascade' }),
  /** YYYY-MM-DD, sempre no fuso local do dispositivo. */
  date: text('date').notNull(),
  ...timestamps,
});

/**
 * Agenda local. Campos espelham `packages/db/schema.ts` (Postgres já tem
 * `events` completo, incluindo `recurrenceRule`/`origin`/`externalId` para a
 * futura sincronização com Google Calendar) — aqui só o necessário para a
 * Fase 2: criar, ver e apagar compromissos, e disparar lembrete local.
 * `taskId` é opcional: um evento pode nascer solto ou vinculado a uma tarefa.
 */
export const events = sqliteTable('events', {
  id: id(),
  title: text('title').notNull(),
  location: text('location'),
  /** ISO 8601 completo — evento tem hora, não só data. */
  startsAt: text('starts_at').notNull(),
  endsAt: text('ends_at').notNull(),
  allDay: integer('all_day', { mode: 'boolean' }).notNull().default(false),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  ...timestamps,
});

/**
 * Vencimentos financeiros do dia (fatura, assinatura). Conceito só local por
 * enquanto — quando `packages/db` tiver `subscriptions` sincronizada, isto
 * vira derivado, não fonte.
 */
export const dueItems = sqliteTable('due_items', {
  id: id(),
  label: text('label').notNull(),
  amountCents: integer('amount_cents').notNull(),
  /** YYYY-MM-DD */
  dueDate: text('due_date').notNull(),
  ...timestamps,
});

/**
 * Marcadores da sincronização com o Supabase — um registro por tabela
 * sincronizada. `lastPushedAt`/`lastPulledAt` guardam o relógio do
 * SERVIDOR (devolvido pela Edge Function a cada chamada), não o do
 * dispositivo — mesma lição do bug de fuso horário: nunca confiar no
 * relógio local para algo que precisa concordar entre duas máquinas.
 */
export const syncState = sqliteTable('sync_state', {
  tableName: text('table_name').primaryKey(),
  lastPushedAt: text('last_pushed_at'),
  lastPulledAt: text('last_pulled_at'),
});

/**
 * Espelho SÓ-LEITURA de `packages/db/schema.ts` (Postgres) — alimenta o
 * dashboard financeiro. Diferente de toda outra tabela deste arquivo:
 * `id`/`updatedAt` vêm do servidor tal qual (sem `$defaultFn`), porque estas
 * duas tabelas nunca são criadas nem editadas pelo app — só a sincronização
 * `finance-sync.ts` escreve aqui, via `sync-finance` (pull-only, sem push).
 * Sem `createdAt`: nunca há uso para "quando o dispositivo viu isto
 * primeiro" num espelho. Reduzido às colunas que o dashboard usa — ver
 * `packages/core/src/finance-sync-protocol.ts` para o motivo de cada uma.
 */
export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id'),
    amountCents: integer('amount_cents').notNull(),
    /** YYYY-MM-DD */
    date: text('date').notNull(),
    /** 'POSTED' | 'PENDING' */
    status: text('status').notNull(),
    categoryId: text('category_id'),
    isInternalTransfer: integer('is_internal_transfer', { mode: 'boolean' }).notNull().default(false),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('transactions_date_idx').on(t.date), index('transactions_category_idx').on(t.categoryId)],
);

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
  name: text('name').notNull(),
  icon: text('icon'),
  color: text('color'),
  isIncome: integer('is_income', { mode: 'boolean' }).notNull().default(false),
  isTransfer: integer('is_transfer', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
