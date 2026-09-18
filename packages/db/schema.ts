/**
 * Kairo — schema do banco (Postgres / Supabase, via Drizzle ORM)
 *
 * Modelado a partir dos dados REAIS retornados pela API do Meu Pluggy
 * (608 transações, 2 contas, 12 meses) — não a partir da documentação.
 *
 * Convenções:
 *   · Dinheiro em CENTAVOS (bigint). Nunca float: 0.1 + 0.2 !== 0.3.
 *     Sinal do Kairo: negativo = saída, positivo = entrada — sempre,
 *     inclusive em cartão de crédito (a Pluggy inverte lá; normalizamos na ingestão).
 *   · Datas de calendário em `date`; instantes em `timestamptz`.
 *   · `external_id` guarda o id da origem e carrega UNIQUE — é o que torna
 *     a sincronização idempotente.
 */

import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────── enums

export const accountTypeEnum = pgEnum('account_type', ['BANK', 'CREDIT', 'INVESTMENT', 'CASH']);
export const accountSubtypeEnum = pgEnum('account_subtype', [
  'CHECKING_ACCOUNT',
  'SAVINGS_ACCOUNT',
  'CREDIT_CARD',
  'WALLET',
  'OTHER',
]);
export const txSourceEnum = pgEnum('tx_source', ['pluggy', 'ofx', 'manual', 'notification', 'receipt']);
export const txStatusEnum = pgEnum('tx_status', ['POSTED', 'PENDING']);
export const connectionStatusEnum = pgEnum('connection_status', [
  'UPDATED',
  'UPDATING',
  'LOGIN_ERROR',
  'OUTDATED',
  'WAITING_USER_INPUT',
]);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'doing', 'done', 'canceled']);
export const priorityEnum = pgEnum('priority', ['none', 'low', 'medium', 'high']);
export const habitFrequencyEnum = pgEnum('habit_frequency', ['daily', 'weekly', 'times_per_week', 'monthly']);
export const goalStatusEnum = pgEnum('goal_status', ['active', 'achieved', 'paused', 'abandoned']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/** Presente em toda tabela: uso pessoal hoje, mas RLS e sync exigem o dono. */
const ownership = {
  userId: uuid('user_id').notNull(),
};

// ═══════════════════════════════════════════════════ FINANÇAS

/**
 * Uma conexão = um `item` da Pluggy = um banco vinculado.
 * `external_id` é o itemId do Dashboard (NÃO o uuid da URL do Meu Pluggy).
 */
export const connections = pgTable(
  'connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownership,
    externalId: text('external_id').notNull(),
    provider: text('provider').notNull().default('pluggy'),
    connectorName: text('connector_name').notNull(),
    connectorImageUrl: text('connector_image_url'),
    status: connectionStatusEnum('status').notNull().default('UPDATED'),
    executionStatus: text('execution_status'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    nextAutoSyncAt: timestamp('next_auto_sync_at', { withTimezone: true }),
    /** Consentimento Open Finance expira (~12 meses) e precisa ser renovado. */
    consentExpiresAt: timestamp('consent_expires_at', { withTimezone: true }),
    lastError: jsonb('last_error').$type<{ code: string; message: string } | null>(),
    ...timestamps,
  },
  (t) => [uniqueIndex('connections_external_idx').on(t.userId, t.provider, t.externalId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownership,
    connectionId: uuid('connection_id').references(() => connections.id, { onDelete: 'set null' }),
    externalId: text('external_id'),

    name: text('name').notNull(),
    /** Apelido definido por você — a UI prefere este ao `name` do banco. */
    nickname: text('nickname'),
    type: accountTypeEnum('type').notNull(),
    subtype: accountSubtypeEnum('subtype').notNull().default('OTHER'),
    /** Últimos dígitos apenas. Nunca guarde o número completo do cartão. */
    numberMasked: text('number_masked'),
    currencyCode: text('currency_code').notNull().default('BRL'),

    balanceCents: bigint('balance_cents', { mode: 'number' }).notNull().default(0),
    /** Cartão de crédito: limite total e dias de fechamento/vencimento da fatura. */
    creditLimitCents: bigint('credit_limit_cents', { mode: 'number' }),
    statementClosingDay: integer('statement_closing_day'),
    statementDueDay: integer('statement_due_day'),

    /** Conta arquivada some dos painéis mas preserva o histórico. */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    includeInNetWorth: boolean('include_in_net_worth').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('accounts_external_idx').on(t.userId, t.externalId),
    index('accounts_user_idx').on(t.userId),
  ],
);

/**
 * Categorias hierárquicas (1 nível de pai basta).
 * A Pluggy devolve rótulos em inglês e crus — `external_labels` mapeia
 * "Shopping", "Gas stations" etc. para a sua categoria em PT-BR.
 */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownership,
    parentId: uuid('parent_id').references((): any => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    icon: text('icon'),
    color: text('color'),
    /** Categoria de entrada (salário, rendimento) não entra no cálculo de gastos. */
    isIncome: boolean('is_income').notNull().default(false),
    /** Transferência interna: nem entrada nem saída, apenas movimentação. */
    isTransfer: boolean('is_transfer').notNull().default(false),
    externalLabels: text('external_labels').array().notNull().default(sql`'{}'::text[]`),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [unique('categories_name_unique').on(t.userId, t.name)],
);

/**
 * Cache de estabelecimentos.
 * 90% das transações reais vieram com `merchant: null` — este cache é o que
 * evita chamar a IA de novo para a mesma descrição crua.
 */
export const merchants = pgTable(
  'merchants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownership,
    /** Descrição crua normalizada (caixa alta, sem datas/sufixos variáveis). */
    fingerprint: text('fingerprint').notNull(),
    displayName: text('display_name').notNull(),
    cnpj: text('cnpj'),
    cnae: text('cnae'),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    /** true = você corrigiu manualmente; a IA nunca mais sobrescreve. */
    isPinned: boolean('is_pinned').notNull().default(false),
    hitCount: integer('hit_count').notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('merchants_fingerprint_idx').on(t.userId, t.fingerprint)],
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownership,
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),

    /** id da origem — com UNIQUE abaixo, torna o sync idempotente. */
    externalId: text('external_id'),
    source: txSourceEnum('source').notNull().default('manual'),

    /** Sinal do Kairo: negativo = saída. Cartão já normalizado na ingestão. */
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currencyCode: text('currency_code').notNull().default('BRL'),
    date: date('date').notNull(),
    status: txStatusEnum('status').notNull().default('POSTED'),

    description: text('description').notNull(),
    /** Texto original do banco — preservado para reprocessar sem novo fetch. */
    descriptionRaw: text('description_raw'),
    merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),

    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    /** Rótulo cru da Pluggy, guardado para auditar e retreinar as regras. */
    externalCategory: text('external_category'),
    /** null = veio pronto da origem; 0..1 = confiança da IA. */
    aiConfidence: integer('ai_confidence'),
    /** true = você categorizou à mão; nenhuma automação sobrescreve. */
    categoryLocked: boolean('category_locked').notNull().default(false),

    /** CARTAO | PIX | TED | BOLETO | … — vem de `operationType`. */
    operationType: text('operation_type'),
    paymentMethod: text('payment_method'),

    /**
     * Transferência entre contas suas. Detectada quando o CPF do pagador e o do
     * recebedor coincidem (`paymentData.*.documentNumber.value`) — nos dados reais
     * isso acertou 6/6, enquanto casar valor+data pegou só 3.
     * Transação marcada aqui NÃO conta como entrada nem como saída.
     */
    isInternalTransfer: boolean('is_internal_transfer').notNull().default(false),
    /**
     * Une as duas pernas da mesma transferência. Chave textual determinística
     * (valor|data|ids ordenados) — não um uuid: ela é derivada do conteúdo,
     * então as duas pernas chegam à mesma chave sem coordenação.
     */
    transferPairKey: text('transfer_pair_key'),
    /** Como foi detectada: 'document' | 'amount-match'. Serve para auditar. */
    transferDetectedBy: text('transfer_detected_by'),

    /** Ponte com a rotina: a tarefa que originou este gasto. */
    taskId: uuid('task_id'),
    goalId: uuid('goal_id'),
    subscriptionId: uuid('subscription_id'),

    installmentNumber: integer('installment_number'),
    installmentTotal: integer('installment_total'),

    notes: text('notes'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    /** Payload cru da origem — permite reprocessar sem bater na API de novo. */
    raw: jsonb('raw'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('transactions_external_idx').on(t.userId, t.source, t.externalId),
    index('transactions_account_date_idx').on(t.accountId, t.date),
    index('transactions_user_date_idx').on(t.userId, t.date),
    index('transactions_category_idx').on(t.categoryId),
    index('transactions_transfer_pair_idx').on(t.transferPairKey),
  ],
);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ...ownership,
  name: text('name').notNull(),
  merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  /** monthly | yearly | weekly */
  cycle: text('cycle').notNull().default('monthly'),
  nextChargeDate: date('next_charge_date'),
  /** Detectada automaticamente por recorrência vs. cadastrada por você. */
  isAutoDetected: boolean('is_auto_detected').notNull().default(false),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  /** Última vez que você marcou como "usei" — alimenta o alerta de assinatura ociosa. */
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  ...timestamps,
});

export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownership,
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    /** Primeiro dia do mês de referência. */
    month: date('month').notNull(),
    limitCents: bigint('limit_cents', { mode: 'number' }).notNull(),
    rollover: boolean('rollover').notNull().default(false),
    ...timestamps,
  },
  (t) => [unique('budgets_month_unique').on(t.userId, t.categoryId, t.month)],
);

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  ...ownership,
  name: text('name').notNull(),
  category: text('category'),
  targetCents: bigint('target_cents', { mode: 'number' }).notNull(),
  savedCents: bigint('saved_cents', { mode: 'number' }).notNull().default(0),
  monthlyContributionCents: bigint('monthly_contribution_cents', { mode: 'number' }),
  targetDate: date('target_date'),
  coverUrl: text('cover_url'),
  status: goalStatusEnum('status').notNull().default('active'),
  /** Hábito de aporte gerado a partir desta meta — a ponte finanças→rotina. */
  habitId: uuid('habit_id'),
  ...timestamps,
});

export const investments = pgTable(
  'investments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownership,
    connectionId: uuid('connection_id').references(() => connections.id, { onDelete: 'set null' }),
    externalId: text('external_id'),
    name: text('name').notNull(),
    /** FIXED_INCOME | EQUITY | FUND | CRYPTO | … */
    assetClass: text('asset_class').notNull(),
    ticker: text('ticker'),
    quantity: text('quantity'),
    investedCents: bigint('invested_cents', { mode: 'number' }),
    currentValueCents: bigint('current_value_cents', { mode: 'number' }).notNull().default(0),
    dueDate: date('due_date'),
    ...timestamps,
  },
  (t) => [uniqueIndex('investments_external_idx').on(t.userId, t.externalId)],
);

// ═══════════════════════════════════════════════════ ROTINA

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  ...ownership,
  name: text('name').notNull(),
  color: text('color'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...timestamps,
});

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownership,
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id').references((): any => tasks.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),
    notes: text('notes'),
    status: taskStatusEnum('status').notNull().default('todo'),
    priority: priorityEnum('priority').notNull().default('none'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    /** RRULE (RFC 5545) — mesma gramática do calendário. */
    recurrenceRule: text('recurrence_rule'),

    /** Ponte rotina→finanças: alimenta a previsão de caixa. */
    estimatedCostCents: bigint('estimated_cost_cents', { mode: 'number' }),
    /** Preenchido quando a tarefa vira gasto real. */
    transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
    /** Tarefa gerada a partir de um vencimento (fatura, assinatura, aporte). */
    generatedFromSubscriptionId: uuid('generated_from_subscription_id').references(
      () => subscriptions.id,
      { onDelete: 'cascade' },
    ),

    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('tasks_user_due_idx').on(t.userId, t.dueAt),
    index('tasks_status_idx').on(t.userId, t.status),
  ],
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownership,
    title: text('title').notNull(),
    location: text('location'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    recurrenceRule: text('recurrence_rule'),
    /** kairo | google */
    origin: text('origin').notNull().default('kairo'),
    externalId: text('external_id'),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index('events_user_start_idx').on(t.userId, t.startsAt)],
);

export const habits = pgTable('habits', {
  id: uuid('id').primaryKey().defaultRandom(),
  ...ownership,
  name: text('name').notNull(),
  icon: text('icon'),
  color: text('color'),
  frequency: habitFrequencyEnum('frequency').notNull().default('daily'),
  /** Para `times_per_week`: quantas vezes. */
  targetPerPeriod: integer('target_per_period').notNull().default(1),
  currentStreak: integer('current_streak').notNull().default(0),
  bestStreak: integer('best_streak').notNull().default(0),
  /** Hábito nascido de uma meta financeira ("aportar R$ 5.000 dia 5"). */
  goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'cascade' }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...timestamps,
});

export const habitLogs = pgTable(
  'habit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownership,
    habitId: uuid('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    done: boolean('done').notNull().default(true),
    ...timestamps,
  },
  (t) => [unique('habit_logs_unique').on(t.habitId, t.date)],
);

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  ...ownership,
  title: text('title'),
  body: text('body').notNull().default(''),
  pinned: boolean('pinned').notNull().default(false),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  ...timestamps,
});

// ═══════════════════════════════════════════════════ IA E SYNC

export const insights = pgTable(
  'insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownership,
    /** daily_brief | weekly_review | anomaly | cross_domain */
    kind: text('kind').notNull(),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    payload: jsonb('payload'),
    readAt: timestamp('read_at', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('insights_user_kind_idx').on(t.userId, t.kind, t.createdAt)],
);

/** Histórico de sincronizações — para diagnosticar sem depender do terminal. */
export const syncRuns = pgTable('sync_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ...ownership,
  connectionId: uuid('connection_id').references(() => connections.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  /** running | success | error */
  status: text('status').notNull().default('running'),
  transactionsInserted: integer('transactions_inserted').notNull().default(0),
  transactionsUpdated: integer('transactions_updated').notNull().default(0),
  error: text('error'),
});

/** Fila de mutações do cliente offline, drenada quando a rede volta. */
export const syncQueue = pgTable('sync_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  ...ownership,
  tableName: text('table_name').notNull(),
  rowId: uuid('row_id').notNull(),
  /** insert | update | delete */
  operation: text('operation').notNull(),
  payload: jsonb('payload').notNull(),
  clientUpdatedAt: timestamp('client_updated_at', { withTimezone: true }).notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  ...timestamps,
});

// ═══════════════════════════════════════════════════ relações

export const connectionsRelations = relations(connections, ({ many }) => ({
  accounts: many(accounts),
  syncRuns: many(syncRuns),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  connection: one(connections, { fields: [accounts.connectionId], references: [connections.id] }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  merchant: one(merchants, { fields: [transactions.merchantId], references: [merchants.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  transactions: many(transactions),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  transaction: one(transactions, { fields: [tasks.transactionId], references: [transactions.id] }),
  subtasks: many(tasks),
}));

export const goalsRelations = relations(goals, ({ many }) => ({
  habits: many(habits),
}));

export const habitsRelations = relations(habits, ({ one, many }) => ({
  goal: one(goals, { fields: [habits.goalId], references: [goals.id] }),
  logs: many(habitLogs),
}));
