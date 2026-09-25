/**
 * Protocolo de sincronização SQLite local ↔ Supabase para o espelho
 * financeiro (transações e categorias) que alimenta o dashboard.
 *
 * Diferente de `sync-protocol.ts` (rotina — tarefas/hábitos/metas/agenda),
 * este é PULL-ONLY: transações e categorias nunca são criadas nem editadas
 * pelo cliente, só espelhadas a partir do Postgres (que por sua vez já
 * recebe da Pluggy, num pipeline totalmente separado — ver
 * `packages/db/src/sync.ts`). Sem push, sem `isNewer`/last-write-wins: o
 * servidor é sempre a única fonte da verdade, então uma linha recebida
 * sempre sobrescreve a local.
 *
 * Espelho completo — `since` pede só o que mudou depois da última vez,
 * mas sem limite de janela de data (decisão consciente: centenas de linhas
 * não pesam num SQLite local, e simplifica os dois lados).
 */

export type SyncTransactionRow = {
  id: string;
  accountId: string | null;
  amountCents: number;
  /** YYYY-MM-DD */
  date: string;
  status: string;
  categoryId: string | null;
  isInternalTransfer: boolean;
  updatedAt: string;
};

export type SyncCategoryRow = {
  id: string;
  parentId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  isIncome: boolean;
  isTransfer: boolean;
  sortOrder: number;
  updatedAt: string;
};

/** `null` pede tudo (primeira sincronização do dispositivo). */
export type FinancePullSince = {
  transactions: string | null;
  categories: string | null;
};

export type FinancePullResult = {
  transactions: SyncTransactionRow[];
  categories: SyncCategoryRow[];
  /** Relógio do SERVIDOR — vira o próximo `FinancePullSince`, nunca o do dispositivo. */
  serverTime: string;
};

export type FinancePullRequest = {
  pullSince: FinancePullSince;
};
