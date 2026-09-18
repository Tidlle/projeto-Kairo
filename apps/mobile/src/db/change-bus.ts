/**
 * Pub-sub mínimo para "o banco mudou" — substitui `useLiveQuery` (específico
 * do driver `expo-sqlite`) no alvo Web/Tauri, onde a conexão é um proxy
 * assíncrono sem mecanismo de notificação de mudança próprio.
 *
 * Chamado de `queries.ts` depois de toda escrita, incondicionalmente —
 * inofensivo em qualquer outro alvo: nativo já tem sua própria reatividade
 * via `useLiveQuery`, então lá ninguém se inscreve aqui.
 */

const listeners = new Set<() => void>();

export function onDbChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDbChange(): void {
  for (const listener of listeners) listener();
}
