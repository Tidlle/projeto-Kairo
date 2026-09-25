import type { FinanceSyncConfig } from './finance-sync';
import type { SyncConfig } from './sync';

/**
 * Lidas via `EXPO_PUBLIC_*` (convenção do Expo para valores expostos ao
 * bundle do cliente) — ver o comentário de confiança em `SyncConfig`
 * (sync.ts) sobre por que este segredo não precisa, e não deve, ser forte.
 */
export function getSyncConfig(): SyncConfig | null {
  const functionUrl = process.env.EXPO_PUBLIC_SYNC_FUNCTION_URL;
  const secret = process.env.EXPO_PUBLIC_MOBILE_SYNC_SECRET;
  if (!functionUrl || !secret) return null;
  return { functionUrl, secret };
}

/** Mesmo segredo de `getSyncConfig()`, URL própria — `sync-finance` é uma função separada. */
export function getFinanceSyncConfig(): FinanceSyncConfig | null {
  const functionUrl = process.env.EXPO_PUBLIC_FINANCE_SYNC_FUNCTION_URL;
  const secret = process.env.EXPO_PUBLIC_MOBILE_SYNC_SECRET;
  if (!functionUrl || !secret) return null;
  return { functionUrl, secret };
}
