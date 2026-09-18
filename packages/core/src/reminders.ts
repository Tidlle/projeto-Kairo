/**
 * Cálculo de QUANDO notificar — puro, sem tocar `expo-notifications` (módulo
 * nativo, sem equivalente testável em Node, diferente de Postgres/SQLite que
 * têm PGlite/better-sqlite3 como substitutos reais). A chamada de verdade à
 * API nativa fica isolada em `apps/mobile/src/notifications.ts`, fina o
 * bastante para não esconder lógica que valesse a pena testar aqui.
 */

/** Tarefa com prazo notifica no próprio instante do prazo — sem antecedência. */
export function taskReminderAt(dueAt: Date): Date {
  return dueAt;
}

/** Evento notifica `minutesBefore` antes do início (padrão: 15 minutos). */
export function eventReminderAt(startsAt: Date, minutesBefore = 15): Date {
  return new Date(startsAt.getTime() - minutesBefore * 60_000);
}

/** Só vale agendar se o instante calculado ainda está no futuro. */
export function shouldScheduleReminder(reminderAt: Date, now: Date = new Date()): boolean {
  return reminderAt.getTime() > now.getTime();
}
