import type { CalendarEvent, Goal, Habit, Priority, Task, TaskStatus } from '@kairo/core';

import { events, goals, habits, tasks } from './schema';

/**
 * Linha do banco → tipo de domínio. Puro, sem I/O nem React — compartilhado
 * por `hooks.ts` (nativo, `useLiveQuery`) e `hooks.web.ts` (Tauri, live query
 * própria) para as duas implementações nunca divergirem silenciosamente.
 */

type TaskRow = typeof tasks.$inferSelect;
type HabitRow = typeof habits.$inferSelect;
type GoalRow = typeof goals.$inferSelect;
type EventRow = typeof events.$inferSelect;

export const toDomainTask = (t: TaskRow): Task => ({
  id: t.id,
  title: t.title,
  status: t.status as TaskStatus,
  priority: t.priority as Priority,
  dueAt: t.dueAt ? new Date(t.dueAt) : null,
  estimatedCostCents: t.estimatedCostCents,
});

export const toDomainHabit = (h: HabitRow, doneTodayIds: Set<string>): Habit => ({
  id: h.id,
  name: h.name,
  frequency: h.frequency as Habit['frequency'],
  targetPerPeriod: h.targetPerPeriod,
  currentStreak: h.currentStreak,
  doneToday: doneTodayIds.has(h.id),
});

export const toDomainGoal = (g: GoalRow): Goal => ({
  id: g.id,
  name: g.name,
  targetCents: g.targetCents,
  savedCents: g.savedCents,
  monthlyContributionCents: g.monthlyContributionCents,
  status: g.status as Goal['status'],
});

export const toDomainEvent = (e: EventRow): CalendarEvent => ({
  id: e.id,
  title: e.title,
  location: e.location,
  startsAt: new Date(e.startsAt),
  endsAt: new Date(e.endsAt),
  allDay: e.allDay,
  taskId: e.taskId,
});
