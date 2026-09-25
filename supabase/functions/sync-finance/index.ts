/**
 * Edge Function `sync-finance` — espelha transações/categorias do Postgres
 * pro SQLite local do app, sob demanda (o usuário abre o dashboard).
 *
 * Só pull, diferente de `sync-routine`: transações/categorias nunca são
 * editadas pelo cliente, então não há push nem conflito a resolver aqui —
 * só "me dê tudo que mudou desde X".
 *
 * Mesmo segredo de `sync-routine` (`MOBILE_SYNC_SECRET`): o raio de
 * confiança é idêntico (segredo dentro do bundle do cliente), e esta função
 * continua só-leitura, então não há motivo pra um segredo à parte.
 *
 * Deploy:
 *   supabase functions deploy sync-finance --use-api --no-verify-jwt \
 *     --import-map supabase/functions/sync-finance/import_map.json
 */

import postgres from 'npm:postgres@3.4.9';
import { drizzle } from 'npm:drizzle-orm@0.45.2/postgres-js';

import * as schema from '../../../packages/db/schema.ts';
import { pullFinance } from '../../../packages/db/src/finance-sync.ts';
import type { FinancePullRequest, FinancePullResult } from '../../../packages/core/src/finance-sync-protocol.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function isValidRequest(body: unknown): body is FinancePullRequest {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return typeof b.pullSince === 'object' && b.pullSince !== null;
}

Deno.serve(async (req: Request) => {
  const expected = Deno.env.get('MOBILE_SYNC_SECRET');
  if (!expected || req.headers.get('x-sync-secret') !== expected) {
    return json({ error: 'não autorizado' }, 401);
  }

  if (req.method !== 'POST') return json({ error: 'use POST' }, 405);

  const env = (k: string) => Deno.env.get(k) ?? '';
  const databaseUrl = env('SUPABASE_DB_URL') || env('DATABASE_URL');
  const userId = env('KAIRO_USER_ID');

  const missing = ['KAIRO_USER_ID'].filter((k) => !env(k)).concat(databaseUrl ? [] : ['SUPABASE_DB_URL']);
  if (missing.length) return json({ error: `variáveis ausentes: ${missing.join(', ')}` }, 500);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'corpo inválido: esperava JSON' }, 400);
  }
  if (!isValidRequest(body)) {
    return json({ error: 'corpo inválido: esperava { pullSince }' }, 400);
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    // Mesmo cuidado de sync-routine: relógio do SERVIDOR, capturado antes da
    // consulta, nunca o do dispositivo.
    const serverTime = new Date().toISOString();
    const db = drizzle(sql, { schema }) as never;

    const pulled = await pullFinance(db, userId, body.pullSince);

    const response: FinancePullResult = { transactions: pulled.transactions, categories: pulled.categories, serverTime };
    return json(response, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('sync-finance falhou:', message);
    return json({ error: message }, 500);
  } finally {
    await sql.end();
  }
});
