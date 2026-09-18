import { pickMainGoal, topPriorityTasks, type CalendarEvent, type DailyBrief, type Goal, type Habit, type Task } from '@kairo/core';
import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import type { Db } from './client';
import { toDomainEvent, toDomainGoal, toDomainHabit, toDomainTask } from './mappers';
import { todayIso } from './queries';
import { accounts, dueItems, events, goals, habitLogs, habits, tasks } from './schema';

/**
 * Hooks de leitura reativa (`useLiveQuery`, que precisa do runtime do Expo) —
 * por isso ficam aqui, separados de `queries.ts`, que é I/O puro e testável
 * em Node sem puxar react-native transitivamente. Equivalente para o alvo
 * Web/Tauri (sem `useLiveQuery`, que é específico do driver `expo-sqlite`)
 * em `hooks.web.ts`.
 */

/** Ids dos hábitos já marcados hoje — usado tanto pela tela Hoje quanto pela lista completa. */
function useDoneTodayIds(db: Db): Set<string> {
  const today = todayIso();
  const rows = useLiveQuery(db.select().from(habitLogs).where(eq(habitLogs.date, today))).data ?? [];
  return new Set(rows.map((l) => l.habitId));
}

/**
 * Lê tudo que a tela Hoje precisa. A montagem final do `DailyBrief` usa as
 * mesmas funções puras e testadas de `packages/core/src/domain.ts` — esta
 * camada só busca e mapeia linhas.
 */
export function useDailyBrief(db: Db): DailyBrief {
  const today = todayIso();
  const doneTodayIds = useDoneTodayIds(db);

  const accountRows = useLiveQuery(db.select().from(accounts)).data ?? [];
  const dueRows = useLiveQuery(db.select().from(dueItems).where(eq(dueItems.dueDate, today))).data ?? [];
  const taskRows = useLiveQuery(db.select().from(tasks)).data ?? [];
  const habitRows = useLiveQuery(db.select().from(habits)).data ?? [];
  const goalRows = useLiveQuery(db.select().from(goals)).data ?? [];

  return {
    balanceCents: accountRows.reduce((sum, a) => sum + a.balanceCents, 0),
    dueToday: dueRows.map((d) => ({ label: d.label, amountCents: d.amountCents })),
    topTasks: topPriorityTasks(taskRows.map(toDomainTask)),
    habits: habitRows.map((h) => toDomainHabit(h, doneTodayIds)),
    mainGoal: pickMainGoal(goalRows.map(toDomainGoal)),
    staleConnections: [], // conexões vivem no Supabase — entra quando a leitura remota existir
  };
}

/** Todas as tarefas (qualquer status), para a tela de CRUD — não só as 3 prioritárias do Hoje. */
export function useAllTasks(db: Db): Task[] {
  const rows = useLiveQuery(db.select().from(tasks)).data ?? [];
  return rows.map(toDomainTask);
}

/** Todos os hábitos, para a tela de CRUD. */
export function useAllHabits(db: Db): Habit[] {
  const doneTodayIds = useDoneTodayIds(db);
  const rows = useLiveQuery(db.select().from(habits)).data ?? [];
  return rows.map((h) => toDomainHabit(h, doneTodayIds));
}

/** Todas as metas (qualquer status), para a tela de CRUD. */
export function useAllGoals(db: Db): Goal[] {
  const rows = useLiveQuery(db.select().from(goals)).data ?? [];
  return rows.map(toDomainGoal);
}

/**
 * Todos os eventos — o filtro por dia acontece em memória via `eventsForDay`
 * (packages/core), mesmo padrão de `topPriorityTasks` sobre `useAllTasks`:
 * uso pessoal, poucas centenas de linhas no máximo, sem necessidade de
 * empurrar a filtragem de data para SQL.
 */
export function useAllEvents(db: Db): CalendarEvent[] {
  const rows = useLiveQuery(db.select().from(events)).data ?? [];
  return rows.map(toDomainEvent);
}
