import { pickMainGoal, topPriorityTasks, type CalendarEvent, type DailyBrief, type Goal, type Habit, type Task } from '@kairo/core';
import { eq } from 'drizzle-orm';
import { useEffect, useState } from 'react';

import { onDbChange } from './change-bus';
import type { Db } from './client.web';
import { toDomainEvent, toDomainGoal, toDomainHabit, toDomainTask } from './mappers';
import { todayIso } from './queries';
import { accounts, dueItems, events, goals, habitLogs, habits, tasks } from './schema';

/**
 * Equivalente de `hooks.ts` (nativo) para o alvo Web/Tauri — sem `useLiveQuery`,
 * que é específico do driver `expo-sqlite` e não existe para o driver-proxy
 * assíncrono usado aqui (`client.web.ts`). Em vez de reatividade embutida no
 * driver, reconsulta sob demanda: uma vez ao montar, e de novo toda vez que
 * `change-bus.ts` avisa que alguma escrita aconteceu.
 *
 * Refazer TODAS as consultas relevantes a cada mudança (em vez de invalidar
 * só a tabela afetada) é intencional — uso pessoal, poucas centenas de linhas
 * no máximo, mesmo raciocínio de "sem otimização prematura" já usado em
 * `eventsForDay`/`useAllEvents` do lado nativo.
 */
function useLiveProxyQuery<T>(queryFn: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    function run() {
      queryFn().then((result) => {
        if (!cancelled) setData(result);
      });
    }

    run();
    const unsubscribe = onDbChange(run);
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}

async function fetchDoneTodayIds(db: Db): Promise<Set<string>> {
  const today = todayIso();
  const rows = await db.select().from(habitLogs).where(eq(habitLogs.date, today));
  return new Set(rows.map((l) => l.habitId));
}

export function useDailyBrief(db: Db): DailyBrief {
  const today = todayIso();

  const accountRows = useLiveProxyQuery(() => db.select().from(accounts), [db]) ?? [];
  const dueRows = useLiveProxyQuery(() => db.select().from(dueItems).where(eq(dueItems.dueDate, today)), [db]) ?? [];
  const taskRows = useLiveProxyQuery(() => db.select().from(tasks), [db]) ?? [];
  const habitRows = useLiveProxyQuery(() => db.select().from(habits), [db]) ?? [];
  const goalRows = useLiveProxyQuery(() => db.select().from(goals), [db]) ?? [];
  const doneTodayIds = useLiveProxyQuery(() => fetchDoneTodayIds(db), [db]) ?? new Set<string>();

  return {
    balanceCents: accountRows.reduce((sum, a) => sum + a.balanceCents, 0),
    dueToday: dueRows.map((d) => ({ label: d.label, amountCents: d.amountCents })),
    topTasks: topPriorityTasks(taskRows.map(toDomainTask)),
    habits: habitRows.map((h) => toDomainHabit(h, doneTodayIds)),
    mainGoal: pickMainGoal(goalRows.map(toDomainGoal)),
    staleConnections: [],
  };
}

export function useAllTasks(db: Db): Task[] {
  const rows = useLiveProxyQuery(() => db.select().from(tasks), [db]) ?? [];
  return rows.map(toDomainTask);
}

export function useAllHabits(db: Db): Habit[] {
  const habitRows = useLiveProxyQuery(() => db.select().from(habits), [db]) ?? [];
  const doneTodayIds = useLiveProxyQuery(() => fetchDoneTodayIds(db), [db]) ?? new Set<string>();
  return habitRows.map((h) => toDomainHabit(h, doneTodayIds));
}

export function useAllGoals(db: Db): Goal[] {
  const rows = useLiveProxyQuery(() => db.select().from(goals), [db]) ?? [];
  return rows.map(toDomainGoal);
}

export function useAllEvents(db: Db): CalendarEvent[] {
  const rows = useLiveProxyQuery(() => db.select().from(events), [db]) ?? [];
  return rows.map(toDomainEvent);
}
