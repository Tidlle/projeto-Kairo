/**
 * Cliente HTTP do Pluggy.
 *
 * Só `fetch` — sem dependências — para rodar igual em Node, Deno (Edge Function)
 * e Bun. A apiKey dura ~2h; como cada execução do sync é curta, autenticamos
 * uma vez por execução e não guardamos nada.
 */

import type { PluggyAccount, PluggyItem, PluggyTransaction } from './types.ts';

const BASE_URL = 'https://api.pluggy.ai';

export class PluggyError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(`Pluggy HTTP ${status} em ${path}: ${body.slice(0, 300)}`);
    this.name = 'PluggyError';
  }
}

export type PluggyClient = ReturnType<typeof createPluggyClient>;

export function createPluggyClient(apiKey: string) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey, ...init.headers },
    });
    const text = await res.text();
    if (!res.ok) throw new PluggyError(res.status, path, text);
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  return {
    getItem: (itemId: string) => request<PluggyItem>(`/items/${itemId}`),

    /** Dispara nova coleta usando as credenciais já armazenadas. */
    syncItem: (itemId: string) =>
      request<PluggyItem>(`/items/${itemId}`, { method: 'PATCH', body: '{}' }),

    listAccounts: (itemId: string) =>
      request<{ results: PluggyAccount[] }>(`/accounts?itemId=${itemId}`).then(
        (r) => r.results ?? [],
      ),

    /**
     * Transações via /v2 (cursor). O /transactions por página está depreciado
     * e sai em 31/12/2026.
     */
    async listTransactions(accountId: string, dateFrom?: string, dateTo?: string) {
      const all: PluggyTransaction[] = [];
      let after: string | undefined;

      do {
        const qs = new URLSearchParams({ accountId });
        if (dateFrom) qs.set('dateFrom', dateFrom);
        if (dateTo) qs.set('dateTo', dateTo);
        if (after) qs.set('after', after);

        const page = await request<{ results: PluggyTransaction[]; next: string | null }>(
          `/v2/transactions?${qs}`,
        );
        all.push(...(page.results ?? []));
        after = page.next ? extractCursor(page.next) : undefined;
      } while (after);

      return all;
    },
  };
}

/** `next` pode vir como query string completa ou como o cursor cru. */
export function extractCursor(next: string): string | undefined {
  if (!next.includes('=')) return next || undefined;
  const qs = new URLSearchParams(next.replace(/^[^?]*\??/, ''));
  return qs.get('after') ?? undefined;
}

/** POST /auth — troca clientId/clientSecret pela apiKey de curta duração. */
export async function authenticate(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  const text = await res.text();
  if (!res.ok) throw new PluggyError(res.status, '/auth', text);
  return (JSON.parse(text) as { apiKey: string }).apiKey;
}
