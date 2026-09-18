/**
 * Edge Function `sync-routine` — sincroniza tarefas/hábitos/logs/metas entre
 * o SQLite local do app e o Supabase (Deno).
 *
 * Diferente de `sync/` (cron diário, chamado pelo pg_cron): esta é chamada
 * PELO APP, sob demanda — o usuário abre o Kairo, ele sincroniza.
 *
 * Segredo próprio (`MOBILE_SYNC_SECRET`), não o `SYNC_SECRET` do cron do
 * Pluggy: o segredo do app viaja dentro do bundle do cliente, mais exposto
 * que um segredo servidor-a-servidor — se vazar, o raio de dano fica restrito
 * à rotina (tarefas/hábitos/metas), nunca ao sync financeiro.
 *
 * O service role (nunca exposto ao cliente) é quem fala com o Postgres —
 * o app só troca JSON com esta função, do mesmo jeito que já não fala
 * direto com a Pluggy. Ver PLANO.md § Sincronização SQLite ↔ Supabase.
 *
 * Deploy:
 *   supabase functions deploy sync-routine --use-api --no-verify-jwt \
 *     --import-map supabase/functions/sync-routine/import_map.json
 *   supabase secrets set MOBILE_SYNC_SECRET=... KAIRO_USER_ID=...
 */

import postgres from 'npm:postgres@3.4.9';
import { drizzle } from 'npm:drizzle-orm@0.45.2/postgres-js';

import * as schema from '../../../packages/db/schema.ts';
import { pullRoutine, pushRoutine } from '../../../packages/db/src/routine-sync.ts';
import type { SyncRequest, SyncResponse } from '../../../packages/core/src/sync-protocol.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function isValidRequest(body: unknown): body is SyncRequest {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return typeof b.push === 'object' && b.push !== null && typeof b.pullSince === 'object' && b.pullSince !== null;
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
    return json({ error: 'corpo inválido: esperava { push, pullSince }' }, 400);
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    // O relógio do SERVIDOR vira o próximo `pullSince`/`pushedSince` do
    // cliente — nunca o do dispositivo. Capturado ANTES do push: se uma
    // escrita concorrente (de outro dispositivo) acontecer entre este
    // instante e o fim da consulta de pull, ela é vista na PRÓXIMA
    // sincronização, não perdida — melhor reprocessar de mais uma vez
    // do que arriscar um buraco na janela.
    const serverTime = new Date().toISOString();
    const db = drizzle(sql, { schema }) as never;

    await pushRoutine(db, userId, body.push);
    const pulled = await pullRoutine(db, userId, body.pullSince);

    const response: SyncResponse = { pulled, serverTime };
    return json(response, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('sync-routine falhou:', message);
    return json({ error: message }, 500);
  } finally {
    await sql.end();
  }
});
