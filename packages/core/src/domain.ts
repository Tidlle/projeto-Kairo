/**
 * Tipos e cálculos puros do domínio "rotina" — tarefas, hábitos, metas.
 *
 * Os campos e enums espelham `packages/db/schema.ts` de propósito (mesmos
 * nomes, mesmos valores possíveis), para que quando a tela "Hoje" passar a
 * ler dados reais (SQLite local ou Supabase), a troca seja só a fonte —
 * nenhum tipo aqui muda. Hoje eles alimentam a tela com dados de exemplo;
 * amanhã alimentam com dados de verdade, sem refatorar a UI.
 */

export type Priority = 'none' | 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'doing' | 'done' | 'canceled';
export type HabitFrequency = 'daily' | 'weekly' | 'times_per_week' | 'monthly';
export type GoalStatus = 'active' | 'achieved' | 'paused' | 'abandoned';
export type ConnectionStatus = 'UPDATED' | 'UPDATING' | 'LOGIN_ERROR' | 'OUTDATED' | 'WAITING_USER_INPUT';

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueAt: Date | null;
  estimatedCostCents: number | null;
};

export type Habit = {
  id: string;
  name: string;
  frequency: HabitFrequency;
  targetPerPeriod: number;
  currentStreak: number;
  doneToday: boolean;
};

export type Goal = {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  monthlyContributionCents: number | null;
  status: GoalStatus;
};

export type ConnectionHealth = {
  connectorName: string;
  status: ConnectionStatus;
  daysSinceSync: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  taskId: string | null;
};

/** Resumo do dia — o view-model que a tela "Hoje" renderiza. */
export type DailyBrief = {
  balanceCents: number;
  dueToday: Array<{ label: string; amountCents: number }>;
  topTasks: Task[];
  habits: Habit[];
  mainGoal: Goal | null;
  staleConnections: ConnectionHealth[];
};

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

/**
 * As tarefas de hoje, na ordem que importa: prioridade primeiro, depois quem
 * vence mais cedo. Tarefas concluídas ou canceladas nunca aparecem aqui —
 * é lista do que fazer, não histórico.
 */
export function topPriorityTasks(tasks: Task[], limit = 3): Task[] {
  return tasks
    .filter((t) => t.status === 'todo' || t.status === 'doing')
    .slice()
    .sort((a, b) => {
      const byPriority = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (byPriority !== 0) return byPriority;
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1; // sem prazo vai depois de quem tem prazo
      if (!b.dueAt) return -1;
      return a.dueAt.getTime() - b.dueAt.getTime();
    })
    .slice(0, limit);
}

/** 0–100, sempre dentro da faixa mesmo se `saved` ultrapassar `target`. */
export function goalProgressPct(goal: Pick<Goal, 'targetCents' | 'savedCents'>): number {
  if (goal.targetCents <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100)));
}

/**
 * Quantos meses faltam no ritmo atual de aporte. `null` quando não dá para
 * calcular (sem aporte definido) ou quando a meta já foi atingida.
 */
export function monthsToGoal(goal: Pick<Goal, 'targetCents' | 'savedCents' | 'monthlyContributionCents'>): number | null {
  const remaining = goal.targetCents - goal.savedCents;
  if (remaining <= 0) return 0;
  if (!goal.monthlyContributionCents || goal.monthlyContributionCents <= 0) return null;
  return Math.ceil(remaining / goal.monthlyContributionCents);
}

/** "5 dias seguidos" / "1 dia seguido" / "comece hoje" — nunca "1 dias". */
export function streakLabel(currentStreak: number): string {
  if (currentStreak <= 0) return 'comece hoje';
  return currentStreak === 1 ? '1 dia seguido' : `${currentStreak} dias seguidos`;
}

/**
 * Qual meta mostrar como "principal" na tela Hoje. Por ora, a primeira ativa —
 * quando houver mais de uma meta ativa ao mesmo tempo, esta é a regra a
 * revisar (ex.: a de maior aporte mensal, ou a que você marcar como favorita).
 */
export function pickMainGoal(goals: Goal[]): Goal | null {
  return goals.find((g) => g.status === 'active') ?? null;
}

/**
 * Conexões que merecem alerta na tela Hoje — espelha a regra de
 * `kairo_conexoes_paradas()` em supabase/migrations: status ruim OU
 * mais de 3 dias sem sincronizar.
 */
export function needsAttention(connections: ConnectionHealth[]): ConnectionHealth[] {
  return connections.filter((c) => c.status !== 'UPDATED' || c.daysSinceSync > 3);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Eventos que tocam um dia de calendário (fuso local), por sobreposição de
 * intervalo — não só `startsAt` cair dentro do dia, para não sumir um evento
 * que atravessa a meia-noite. Dia inteiro primeiro, depois por horário de
 * início.
 */
export function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = startOfDay(day);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  return events
    .filter((e) => e.startsAt < dayEnd && e.endsAt > dayStart)
    .slice()
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startsAt.getTime() - b.startsAt.getTime();
    });
}
