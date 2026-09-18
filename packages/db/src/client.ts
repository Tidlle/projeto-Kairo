/**
 * Conexão com o banco.
 *
 * Dois drivers, mesma API do Drizzle:
 *   · postgres-js  → Supabase / Postgres de verdade (produção e uso local)
 *   · PGlite       → Postgres em WASM, sem servidor (testes)
 *
 * O tipo `Db` é o denominador comum: tudo em `ingest.ts` funciona nos dois.
 */

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '../schema.ts';

/**
 * Tipo agnóstico de driver.
 *
 * Uma UNIÃO dos dois tipos concretos não funcionaria: o TypeScript não resolve
 * chamada de método sobre união de assinaturas, e todo `db.insert(...)` viraria
 * erro. `PgDatabase` é o supertipo que ambos os drivers satisfazem.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Cliente para Postgres real.
 *
 * `prepare: false` é obrigatório atrás do pooler do Supabase (modo transaction):
 * prepared statements não sobrevivem entre transações ali, e o sintoma é um erro
 * intermitente e confuso de "prepared statement already exists".
 */
export function createDb(connectionString: string, opts: { max?: number } = {}): Db {
  const sql = postgres(connectionString, {
    max: opts.max ?? 1,
    prepare: false,
    // O sync é curto; não vale segurar conexão ociosa.
    idle_timeout: 20,
  });
  return drizzlePg(sql, { schema });
}
