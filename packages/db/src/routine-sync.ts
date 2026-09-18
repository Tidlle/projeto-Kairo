/**
 * Sincronização de rotina (tarefas, hábitos, logs, metas) — lado Postgres.
 *
 * Espelha o espírito de `ingest.ts`: idempotente, testável contra Postgres
 * real (PGlite), sem depender do driver de produção. A diferença de fundo é
 * a direção — `ingest.ts` só recebe (Pluggy → Postgres); aqui há duas mãos,
 * porque o SQLite local é editável pelo usuário e o Postgres também (quando
 * outro dispositivo existir).
 *
 * Resolução de conflito: last-write-wins por LINHA (não por campo). Mais
 * simples que o desenho original do plano (fila de mutações + LWW por
 * campo) — suficiente para um usuário com poucos dispositivos; refinar é
 * trabalho futuro, não presente. A comparação roda dentro do próprio SQL
 * (`on conflict ... where excluded.updated_at > tabela.updated_at`), atômica
 * — sem janela de corrida entre ler e decidir se sobrescreve.
 */

import type {
  SyncEventRow,
  SyncGoalRow,
  SyncHabitLogRow,
  SyncHabitRow,
  SyncPullResult,
  SyncPullSince,
  SyncPushPayload,
  SyncTaskRow,
} from '../../core/src/sync-protocol.ts';
import { and, eq, gt, sql } from 'drizzle-orm';
import { events, goals, habitLogs, habits, tasks } from '../schema.ts';
import type { Db } from './client.ts';

const KNOWN_TASK_STATUS = ['todo', 'doing', 'done', 'canceled'] as const;
const KNOWN_PRIORITY = ['none', 'low', 'medium', 'high'] as const;
const KNOWN_HABIT_FREQUENCY = ['daily', 'weekly', 'times_per_week', 'monthly'] as const;
const KNOWN_GOAL_STATUS = ['active', 'achieved', 'paused', 'abandoned'] as const;

/** Valor fora do enum não pode derrubar a sincronização inteira — cai num padrão seguro. */
function coerce<T extends string>(known: readonly T[], value: string, fallback: T): T {
  return (known as readonly string[]).includes(value) ? (value as T) : fallback;
}

// ─────────────────────────────────────────── push (local → Postgres)

export async function pushTasks(db: Db, userId: string, rows: SyncTaskRow[]): Promise<void> {
  if (!rows.length) return;
  await db
    .insert(tasks)
    .values(
      rows.map((r) => ({
        id: r.id,
        userId,
        title: r.title,
        status: coerce(KNOWN_TASK_STATUS, r.status, 'todo'),
        priority: coerce(KNOWN_PRIORITY, r.priority, 'none'),
        dueAt: r.dueAt ? new Date(r.dueAt) : null,
        estimatedCostCents: r.estimatedCostCents,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    )
    .onConflictDoUpdate({
      target: tasks.id,
      set: {
        title: sql`excluded.title`,
        status: sql`excluded.status`,
        priority: sql`excluded.priority`,
        dueAt: sql`excluded.due_at`,
        estimatedCostCents: sql`excluded.estimated_cost_cents`,
        updatedAt: sql`excluded.updated_at`,
      },
      setWhere: sql`excluded.updated_at > ${tasks.updatedAt}`,
    });
}

export async function pushHabits(db: Db, userId: string, rows: SyncHabitRow[]): Promise<void> {
  if (!rows.length) return;
  await db
    .insert(habits)
    .values(
      rows.map((r) => ({
        id: r.id,
        userId,
        name: r.name,
        frequency: coerce(KNOWN_HABIT_FREQUENCY, r.frequency, 'daily'),
        targetPerPeriod: r.targetPerPeriod,
        currentStreak: r.currentStreak,
        bestStreak: r.bestStreak,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    )
    .onConflictDoUpdate({
      target: habits.id,
      set: {
        name: sql`excluded.name`,
        frequency: sql`excluded.frequency`,
        targetPerPeriod: sql`excluded.target_per_period`,
        currentStreak: sql`excluded.current_streak`,
        bestStreak: sql`excluded.best_streak`,
        updatedAt: sql`excluded.updated_at`,
      },
      setWhere: sql`excluded.updated_at > ${habits.updatedAt}`,
    });
}

export async function pushHabitLogs(db: Db, userId: string, rows: SyncHabitLogRow[]): Promise<void> {
  if (!rows.length) return;
  await db
    .insert(habitLogs)
    .values(
      rows.map((r) => ({
        id: r.id,
        userId,
        habitId: r.habitId,
        date: r.date,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    )
    .onConflictDoUpdate({
      target: habitLogs.id,
      set: { updatedAt: sql`excluded.updated_at` },
      setWhere: sql`excluded.updated_at > ${habitLogs.updatedAt}`,
    });
}

export async function pushGoals(db: Db, userId: string, rows: SyncGoalRow[]): Promise<void> {
  if (!rows.length) return;
  await db
    .insert(goals)
    .values(
      rows.map((r) => ({
        id: r.id,
        userId,
        name: r.name,
        targetCents: r.targetCents,
        savedCents: r.savedCents,
        monthlyContributionCents: r.monthlyContributionCents,
        status: coerce(KNOWN_GOAL_STATUS, r.status, 'active'),
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    )
    .onConflictDoUpdate({
      target: goals.id,
      set: {
        name: sql`excluded.name`,
        targetCents: sql`excluded.target_cents`,
        savedCents: sql`excluded.saved_cents`,
        monthlyContributionCents: sql`excluded.monthly_contribution_cents`,
        status: sql`excluded.status`,
        updatedAt: sql`excluded.updated_at`,
      },
      setWhere: sql`excluded.updated_at > ${goals.updatedAt}`,
    });
}

export async function pushEvents(db: Db, userId: string, rows: SyncEventRow[]): Promise<void> {
  if (!rows.length) return;
  await db
    .insert(events)
    .values(
      rows.map((r) => ({
        id: r.id,
        userId,
        title: r.title,
        location: r.location,
        startsAt: new Date(r.startsAt),
        endsAt: new Date(r.endsAt),
        allDay: r.allDay,
        taskId: r.taskId,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    )
    .onConflictDoUpdate({
      target: events.id,
      set: {
        title: sql`excluded.title`,
        location: sql`excluded.location`,
        startsAt: sql`excluded.starts_at`,
        endsAt: sql`excluded.ends_at`,
        allDay: sql`excluded.all_day`,
        taskId: sql`excluded.task_id`,
        updatedAt: sql`excluded.updated_at`,
      },
      setWhere: sql`excluded.updated_at > ${events.updatedAt}`,
    });
}

export async function pushRoutine(db: Db, userId: string, payload: SyncPushPayload): Promise<void> {
  // Hábitos antes dos logs — habit_logs referencia habits (FK), e um log
  // de um hábito recém-criado no mesmo lote falharia se a ordem fosse trocada.
  // Tarefas antes de eventos, pelo mesmo motivo: um evento vinculado a uma
  // tarefa recém-criada no mesmo lote precisa da tarefa já gravada.
  await pushHabits(db, userId, payload.habits);
  await pushHabitLogs(db, userId, payload.habitLogs);
  await pushTasks(db, userId, payload.tasks);
  await pushEvents(db, userId, payload.events);
  await pushGoals(db, userId, payload.goals);
}

// ─────────────────────────────────────────── pull (Postgres → local)

const toIso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d);

export async function pullRoutine(db: Db, userId: string, since: SyncPullSince): Promise<SyncPullResult> {
  const taskRows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), since.tasks ? gt(tasks.updatedAt, new Date(since.tasks)) : undefined));

  const habitRows = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), since.habits ? gt(habits.updatedAt, new Date(since.habits)) : undefined));

  const habitLogRows = await db
    .select()
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, userId),
        since.habitLogs ? gt(habitLogs.updatedAt, new Date(since.habitLogs)) : undefined,
      ),
    );

  const goalRows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), since.goals ? gt(goals.updatedAt, new Date(since.goals)) : undefined));

  const eventRows = await db
    .select()
    .from(events)
    .where(and(eq(events.userId, userId), since.events ? gt(events.updatedAt, new Date(since.events)) : undefined));

  return {
    tasks: taskRows.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt ? toIso(t.dueAt) : null,
      estimatedCostCents: t.estimatedCostCents,
      createdAt: toIso(t.createdAt),
      updatedAt: toIso(t.updatedAt),
    })),
    habits: habitRows.map((h) => ({
      id: h.id,
      name: h.name,
      frequency: h.frequency,
      targetPerPeriod: h.targetPerPeriod,
      currentStreak: h.currentStreak,
      bestStreak: h.bestStreak,
      createdAt: toIso(h.createdAt),
      updatedAt: toIso(h.updatedAt),
    })),
    habitLogs: habitLogRows.map((l) => ({
      id: l.id,
      habitId: l.habitId,
      date: toIso(l.date).slice(0, 10),
      createdAt: toIso(l.createdAt),
      updatedAt: toIso(l.updatedAt),
    })),
    goals: goalRows.map((g) => ({
      id: g.id,
      name: g.name,
      targetCents: g.targetCents,
      savedCents: g.savedCents,
      monthlyContributionCents: g.monthlyContributionCents,
      status: g.status,
      createdAt: toIso(g.createdAt),
      updatedAt: toIso(g.updatedAt),
    })),
    events: eventRows.map((e) => ({
      id: e.id,
      title: e.title,
      location: e.location,
      startsAt: toIso(e.startsAt),
      endsAt: toIso(e.endsAt),
      allDay: e.allDay,
      taskId: e.taskId,
      createdAt: toIso(e.createdAt),
      updatedAt: toIso(e.updatedAt),
    })),
  };
}
