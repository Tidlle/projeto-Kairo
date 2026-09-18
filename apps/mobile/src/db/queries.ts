import type { GoalStatus, HabitFrequency, Priority, TaskStatus } from '@kairo/core';
import { eq, sql } from 'drizzle-orm';

import { emitDbChange } from './change-bus';
import type { Db } from './client';
import { events, goals, habitLogs, habits, tasks } from './schema';

/**
 * Sem nenhum import de React ou expo-sqlite de propósito — só Drizzle puro.
 * É o que permite testar isto em Node normal (better-sqlite3), sem puxar
 * react-native transitivamente. `useDailyBrief` (hook, com `useLiveQuery`)
 * fica em `./hooks.ts`, separado por este exato motivo.
 *
 * Cada mutação chama `emitDbChange()` ao final — sem efeito no alvo nativo
 * (já reativo via `useLiveQuery`), mas é o que faz o alvo Web/Tauri (sem
 * mecanismo de notificação próprio) saber que precisa reconsultar. Ver
 * `change-bus.ts` e `hooks.web.ts`.
 */

/** YYYY-MM-DD no fuso local do dispositivo — nunca UTC, senão "hoje" muda sozinho à noite. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Agora, em ISO — usado para `updated_at`, que o Drizzle só preenche sozinho no insert. */
const nowIso = () => new Date().toISOString();

// ─────────────────────────────────────────── tarefas

export type NewTaskInput = {
  title: string;
  priority?: Priority;
  dueAt?: Date | null;
  estimatedCostCents?: number | null;
};

export async function createTask(db: Db, input: NewTaskInput): Promise<string> {
  const [row] = await db
    .insert(tasks)
    .values({
      title: input.title.trim(),
      priority: input.priority ?? 'none',
      dueAt: input.dueAt ? input.dueAt.toISOString() : null,
      estimatedCostCents: input.estimatedCostCents ?? null,
    })
    .returning({ id: tasks.id });
  emitDbChange();
  return row!.id;
}

export type TaskPatch = Partial<{
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueAt: Date | null;
  estimatedCostCents: number | null;
}>;

export async function updateTask(db: Db, id: string, patch: TaskPatch): Promise<void> {
  const { dueAt, ...rest } = patch;
  await db
    .update(tasks)
    .set({
      ...rest,
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...('dueAt' in patch ? { dueAt: dueAt ? dueAt.toISOString() : null } : {}),
      updatedAt: nowIso(),
    })
    .where(eq(tasks.id, id));
  emitDbChange();
}

/** Ciclo curto de status — usado pelo toque na tela: a faz → fazendo → feita → (volta a fazer). */
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'doing',
  doing: 'done',
  done: 'todo',
  canceled: 'todo',
};

export async function cycleTaskStatus(db: Db, id: string, currentStatus: TaskStatus): Promise<void> {
  await updateTask(db, id, { status: NEXT_STATUS[currentStatus] });
}

export async function deleteTask(db: Db, id: string): Promise<void> {
  await db.delete(tasks).where(eq(tasks.id, id));
  emitDbChange();
}

// ─────────────────────────────────────────── hábitos

export type NewHabitInput = {
  name: string;
  frequency?: HabitFrequency;
  targetPerPeriod?: number;
};

export async function createHabit(db: Db, input: NewHabitInput): Promise<string> {
  const [row] = await db
    .insert(habits)
    .values({
      name: input.name.trim(),
      frequency: input.frequency ?? 'daily',
      targetPerPeriod: input.targetPerPeriod ?? 1,
    })
    .returning({ id: habits.id });
  emitDbChange();
  return row!.id;
}

export type HabitPatch = Partial<{ name: string; frequency: HabitFrequency; targetPerPeriod: number }>;

export async function updateHabit(db: Db, id: string, patch: HabitPatch): Promise<void> {
  await db
    .update(habits)
    .set({
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      updatedAt: nowIso(),
    })
    .where(eq(habits.id, id));
  emitDbChange();
}

/**
 * Apaga o hábito e seu histórico.
 *
 * Exclusão manual dos `habit_logs`, não via `onDelete: 'cascade'` do schema —
 * o SQLite mantém enforcement de chave estrangeira DESLIGADO por padrão
 * (`PRAGMA foreign_keys`), e nem `expo-sqlite` nem `better-sqlite3` a ligam
 * sozinhos. Depender do cascade aqui apagaria o hábito e deixaria os logs
 * órfãos silenciosamente — mais seguro fazer as duas exclusões explícitas.
 */
export async function deleteHabit(db: Db, id: string): Promise<void> {
  await db.delete(habitLogs).where(eq(habitLogs.habitId, id));
  await db.delete(habits).where(eq(habits.id, id));
  emitDbChange();
}

// ─────────────────────────────────────────── metas

export type NewGoalInput = {
  name: string;
  targetCents: number;
  savedCents?: number;
  monthlyContributionCents?: number | null;
};

export async function createGoal(db: Db, input: NewGoalInput): Promise<string> {
  const [row] = await db
    .insert(goals)
    .values({
      name: input.name.trim(),
      targetCents: input.targetCents,
      savedCents: input.savedCents ?? 0,
      monthlyContributionCents: input.monthlyContributionCents ?? null,
    })
    .returning({ id: goals.id });
  emitDbChange();
  return row!.id;
}

export type GoalPatch = Partial<{
  name: string;
  targetCents: number;
  savedCents: number;
  monthlyContributionCents: number | null;
  status: GoalStatus;
}>;

export async function updateGoal(db: Db, id: string, patch: GoalPatch): Promise<void> {
  await db
    .update(goals)
    .set({
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      updatedAt: nowIso(),
    })
    .where(eq(goals.id, id));
  emitDbChange();
}

/**
 * Registra um aporte. Some a `savedCents` e, se o total alcançar a meta e
 * ela ainda estiver `active`, marca como `achieved` sozinho — mesmo espírito
 * de `toggleHabitToday`: a ação do dia a dia (aportar) já reflete no estado
 * que a tela usa para decidir o que mostrar, sem passo manual extra.
 */
export async function contributeToGoal(db: Db, id: string, amountCents: number): Promise<void> {
  const [goal] = await db.select().from(goals).where(eq(goals.id, id)).limit(1);
  if (!goal) return;

  const newSaved = goal.savedCents + amountCents;
  const reachedNow = newSaved >= goal.targetCents && goal.status === 'active';

  await db
    .update(goals)
    .set({
      savedCents: newSaved,
      ...(reachedNow ? { status: 'achieved' as const } : {}),
      updatedAt: nowIso(),
    })
    .where(eq(goals.id, id));
  emitDbChange();
}

export async function deleteGoal(db: Db, id: string): Promise<void> {
  await db.delete(goals).where(eq(goals.id, id));
  emitDbChange();
}

/**
 * Marca/desmarca um hábito como feito hoje.
 *
 * Simplificação assumida: o streak só soma ao marcar e subtrai ao desmarcar
 * no mesmo dia — não recalcula quebras de sequência por dias pulados. Isso
 * é suficiente para a tela hoje; vira um cálculo de verdade (percorrendo
 * habit_logs) quando fizer falta.
 */
export async function toggleHabitToday(db: Db, habitId: string, currentStreak: number) {
  const today = todayIso();

  const existing = await db
    .select({ id: habitLogs.id })
    .from(habitLogs)
    .where(sql`${habitLogs.habitId} = ${habitId} and ${habitLogs.date} = ${today}`)
    .limit(1);

  if (existing.length > 0) {
    await db.delete(habitLogs).where(eq(habitLogs.id, existing[0]!.id));
    await db
      .update(habits)
      .set({ currentStreak: Math.max(0, currentStreak - 1) })
      .where(eq(habits.id, habitId));
  } else {
    await db.insert(habitLogs).values({ habitId, date: today });
    const newStreak = currentStreak + 1;
    await db
      .update(habits)
      .set({
        currentStreak: newStreak,
        bestStreak: sql`max(${habits.bestStreak}, ${newStreak})`,
      })
      .where(eq(habits.id, habitId));
  }
  emitDbChange();
}

// ─────────────────────────────────────────── agenda

export type NewEventInput = {
  title: string;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;
  taskId?: string | null;
};

export async function createEvent(db: Db, input: NewEventInput): Promise<string> {
  const [row] = await db
    .insert(events)
    .values({
      title: input.title.trim(),
      location: input.location?.trim() || null,
      startsAt: input.startsAt.toISOString(),
      endsAt: input.endsAt.toISOString(),
      allDay: input.allDay ?? false,
      taskId: input.taskId ?? null,
    })
    .returning({ id: events.id });
  emitDbChange();
  return row!.id;
}

export type EventPatch = Partial<{
  title: string;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  taskId: string | null;
}>;

export async function updateEvent(db: Db, id: string, patch: EventPatch): Promise<void> {
  const { startsAt, endsAt, ...rest } = patch;
  await db
    .update(events)
    .set({
      ...rest,
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.location !== undefined ? { location: patch.location?.trim() || null } : {}),
      ...(startsAt !== undefined ? { startsAt: startsAt.toISOString() } : {}),
      ...(endsAt !== undefined ? { endsAt: endsAt.toISOString() } : {}),
      updatedAt: nowIso(),
    })
    .where(eq(events.id, id));
  emitDbChange();
}

export async function deleteEvent(db: Db, id: string): Promise<void> {
  await db.delete(events).where(eq(events.id, id));
  emitDbChange();
}
