/**
 * Ponto de entrada público do @kairo/core.
 *
 * Regra de ouro do pacote: sem UI, sem rede além de `fetch` puro, sem Node-only
 * (`fs`, `path`, drivers de banco). É por isso que ele roda igual em scripts
 * Node (tsx), na Edge Function (Deno) e agora no app (Metro/React Native) —
 * o mesmo código de negócio, os três lugares.
 */

export { toCents, fromCents, formatBRL } from './money.ts';

export {
  topPriorityTasks,
  goalProgressPct,
  monthsToGoal,
  streakLabel,
  pickMainGoal,
  needsAttention,
  eventsForDay,
  type Task,
  type Habit,
  type Goal,
  type Priority,
  type TaskStatus,
  type HabitFrequency,
  type GoalStatus,
  type ConnectionHealth,
  type ConnectionStatus,
  type DailyBrief,
  type CalendarEvent,
} from './domain.ts';

export { taskReminderAt, eventReminderAt, shouldScheduleReminder } from './reminders.ts';

export {
  PLUGGY_CATEGORY_MAP,
  mapCategory,
  needsAiRefinement,
  type CategoryMapping,
} from './pluggy/categories.ts';

export {
  fingerprint,
  bestDisplayName,
  pixCounterparty,
  merchantKey,
} from './pluggy/fingerprint.ts';

export {
  normalizeSign,
  mapTransaction,
  mapTransactions,
  mapAccount,
  summarize,
  type AccountRow,
} from './pluggy/map.ts';

export {
  isSelfTransferByDocument,
  pairInternalTransfers,
  classifyTransfer,
  type TransferVerdict,
} from './pluggy/transfers.ts';

export type {
  PluggyDocumentNumber,
  PluggyParty,
  PluggyPaymentData,
  PluggyMerchant,
  PluggyTransaction,
  PluggyAccount,
  PluggyItem,
  TransactionRow,
} from './pluggy/types.ts';

export {
  isNewer,
  type SyncTaskRow,
  type SyncHabitRow,
  type SyncHabitLogRow,
  type SyncGoalRow,
  type SyncEventRow,
  type SyncTables,
  type SyncPushPayload,
  type SyncPullSince,
  type SyncPullResult,
  type SyncRequest,
  type SyncResponse,
} from './sync-protocol.ts';

// O cliente HTTP (authenticate/createPluggyClient) fica de fora de propósito:
// ele espera CLIENT_SECRET, que é server-only. O app nunca fala com a Pluggy
// direto — sempre pela sua própria API. Quem precisar dele importa
// '@kairo/core/pluggy/client' explicitamente, não pelo barril.
