/**
 * Protocolo de sincronização SQLite local ↔ Supabase, para as tabelas de
 * rotina (tarefas, hábitos, logs de hábito, metas, eventos da agenda).
 *
 * Contas/transações financeiras NÃO entram aqui — essas já sincronizam pelo
 * caminho Pluggy → Postgres (packages/db/src/sync.ts). Este protocolo cobre
 * só o que o usuário cria/edita direto no app: tarefas, hábitos, metas.
 *
 * Formato dos DTOs: os mesmos nomes de campo do domínio (packages/core/src/
 * domain.ts), mas com datas como STRING ISO 8601 — é o que atravessa JSON.
 * `updatedAt` é o campo que decide tudo: linha vence sobre linha por
 * "quem tem o `updatedAt` mais recente" (last-write-wins por linha, não por
 * campo — mais simples que o desenho original do plano, suficiente para um
 * usuário com poucos dispositivos; refinar para LWW por campo é trabalho
 * futuro, não presente).
 */

export type SyncTaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  estimatedCostCents: number | null;
  createdAt: string;
  updatedAt: string;
};

export type SyncHabitRow = {
  id: string;
  name: string;
  frequency: string;
  targetPerPeriod: number;
  currentStreak: number;
  bestStreak: number;
  createdAt: string;
  updatedAt: string;
};

export type SyncHabitLogRow = {
  id: string;
  habitId: string;
  /** YYYY-MM-DD */
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type SyncGoalRow = {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  monthlyContributionCents: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * `taskId` pode apontar para uma tarefa que só existe local ainda — dentro
 * de um mesmo lote de `pushRoutine`, tarefas entram antes de eventos
 * (mesmo motivo de hábitos entrarem antes de seus logs).
 */
export type SyncEventRow = {
  id: string;
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Uma tabela por chave — sempre as cinco, mesmo que vazias. */
export type SyncTables<T> = {
  tasks: T[];
  habits: T[];
  habitLogs: T[];
  goals: T[];
  events: T[];
};

export type SyncPushPayload = {
  tasks: SyncTaskRow[];
  habits: SyncHabitRow[];
  habitLogs: SyncHabitLogRow[];
  goals: SyncGoalRow[];
  events: SyncEventRow[];
};

/**
 * `null` pede tudo (primeira sincronização do dispositivo); uma data ISO
 * pede só o que mudou depois dela.
 */
export type SyncPullSince = {
  tasks: string | null;
  habits: string | null;
  habitLogs: string | null;
  goals: string | null;
  events: string | null;
};

export type SyncPullResult = {
  tasks: SyncTaskRow[];
  habits: SyncHabitRow[];
  habitLogs: SyncHabitLogRow[];
  goals: SyncGoalRow[];
  events: SyncEventRow[];
};

export type SyncRequest = {
  push: SyncPushPayload;
  pullSince: SyncPullSince;
};

export type SyncResponse = {
  pulled: SyncPullResult;
  /**
   * Relógio do SERVIDOR no momento da resposta — vira o próximo `pullSince`.
   * Nunca o relógio do dispositivo: é exatamente o bug que o fuso horário
   * já causou uma vez nesta sessão (ver seed.ts / PLANO.md).
   */
  serverTime: string;
};

/**
 * Decide se uma linha recebida deve sobrescrever a linha local — pura,
 * usada dos dois lados (mobile aplicando o pull, e testável isoladamente
 * sem precisar de banco nenhum).
 */
export function isNewer(incoming: { updatedAt: string }, local: { updatedAt: string } | undefined): boolean {
  if (!local) return true;
  return incoming.updatedAt > local.updatedAt;
}
