/**
 * Edge Function `sync` — sincronização agendada (Deno).
 *
 * Chamada pelo pg_cron uma vez por dia. Não faz nada que o `npm run sync`
 * local não faça: é o mesmo `runSync`, só que hospedado.
 *
 * Deploy:
 *   supabase functions deploy sync
 *   supabase secrets set PLUGGY_CLIENT_ID=... PLUGGY_CLIENT_SECRET=... \
 *                        PLUGGY_ITEM_IDS=... KAIRO_USER_ID=... SYNC_SECRET=...
 *
 * SUPABASE_DB_URL já vem injetada no ambiente da função.
 */

import postgres from 'npm:postgres@3.4.9';
import { drizzle } from 'npm:drizzle-orm@0.45.2/postgres-js';

import * as schema from '../../../packages/db/schema.ts';
import { runSync } from '../../../packages/db/src/sync.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  /**
   * A função é exposta publicamente, então precisa de porteiro próprio.
   * O cron manda o mesmo segredo no header; qualquer outra chamada é recusada
   * antes de tocar no banco ou gastar chamada de API.
   */
  const expected = Deno.env.get('SYNC_SECRET');
  if (!expected || req.headers.get('x-sync-secret') !== expected) {
    return json({ error: 'não autorizado' }, 401);
  }

  const env = (k: string) => Deno.env.get(k) ?? '';
  const databaseUrl = env('SUPABASE_DB_URL') || env('DATABASE_URL');

  const missing = ['PLUGGY_CLIENT_ID', 'PLUGGY_CLIENT_SECRET', 'PLUGGY_ITEM_IDS', 'KAIRO_USER_ID']
    .filter((k) => !env(k))
    .concat(databaseUrl ? [] : ['SUPABASE_DB_URL']);

  if (missing.length) return json({ error: `variáveis ausentes: ${missing.join(', ')}` }, 500);

  // `prepare: false` é obrigatório atrás do pooler em modo transaction.
  const sql = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    const url = new URL(req.url);
    const result = await runSync(drizzle(sql, { schema }) as never, {
      clientId: env('PLUGGY_CLIENT_ID'),
      clientSecret: env('PLUGGY_CLIENT_SECRET'),
      itemIds: env('PLUGGY_ITEM_IDS').split(',').map((s) => s.trim()).filter(Boolean),
      userId: env('KAIRO_USER_ID'),
      days: Number(url.searchParams.get('days') ?? 90),
      forceSync: url.searchParams.get('force') === '1',
      onProgress: (m) => console.log(m),
    });

    // 207 quando parte das conexões falhou: o cron registra, mas não é 500.
    return json(result, result.ok ? 200 : 207);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('sync falhou:', message);
    return json({ error: message }, 500);
  } finally {
    await sql.end();
  }
});
