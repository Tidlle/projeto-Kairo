import Database from '@tauri-apps/plugin-sql';
import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { createContext, useContext } from 'react';

import * as schema from './schema';

/** Nome do arquivo do banco local — mesmo nome do nativo, bancos diferentes por dispositivo. */
export const DATABASE_NAME = 'kairo.db';

/**
 * `Db` aqui é `SqliteRemoteDatabase` (resultKind `'async'`), não o `BaseSQLiteDatabase<'sync', ...>`
 * de `client.ts` (nativo) — são dois tipos concretos DIFERENTES, cada um satisfazendo o que
 * `queries.ts` precisa estruturalmente (chamado sempre com `await`, que funciona igual nos dois).
 * `queries.ts` importa `Db` de `./client` (sem sufixo) — o Metro resolve para este arquivo ou
 * para `client.ts` conforme a plataforma, então o MESMO `queries.ts` roda sobre qualquer um dos
 * dois sem precisar saber qual.
 */
export type Db = SqliteRemoteDatabase<typeof schema>;

/**
 * Drizzle (`sqlite-core`) sempre gera `?` como placeholder; o plugin SQL do
 * Tauri (sqlx por baixo, do lado Rust) espera `$1, $2, …` — mesmo para SQLite.
 * Sem esta conversão, todo parâmetro chegaria como literal `?` e o SQLite
 * rejeitaria a instrução.
 */
function toDollarPlaceholders(sqlText: string): string {
  let i = 0;
  return sqlText.replace(/\?/g, () => `$${++i}`);
}

/**
 * Abre a conexão real com o SQLite via `@tauri-apps/plugin-sql` (Rust/rusqlite
 * por baixo, IPC até aqui) e monta o Drizzle por cima via `sqlite-proxy` — o
 * driver genérico para "SQLite que só fala async", já que não existe um
 * `drizzle-orm/tauri-sql` oficial. Chamado uma única vez, em `root-shell.web.tsx`,
 * e só dentro do runtime do Tauri (nunca num navegador comum).
 *
 * Cada linha volta do plugin como OBJETO ({coluna: valor}); o Drizzle exige
 * um ARRAY posicional (`row[índice]`, na mesma ordem das colunas pedidas) —
 * `Object.values()` faz essa conversão. Funciona porque o plugin serializa
 * as colunas na ordem em que vêm do SQLite, não em ordem alfabética.
 */
export async function connectTauriDb(): Promise<{ db: Db; sqlite: Database }> {
  const sqlite = await Database.load(`sqlite:${DATABASE_NAME}`);

  const db = drizzle(async (sqlText, params) => {
    const rows = await sqlite.select<Record<string, unknown>[]>(toDollarPlaceholders(sqlText), params);
    return { rows: rows.map((row) => Object.values(row)) };
  }, { schema });

  return { db, sqlite };
}

const DbContext = createContext<Db | null>(null);
export const DbProvider = DbContext.Provider;

/** Mesmo contrato do `useDb()` nativo: sempre devolve um `Db` de verdade. Só é chamado depois do `<DbProvider>` estar pronto (ver `root-shell.web.tsx`). */
export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) {
    throw new Error('useDb() chamado fora do <DbProvider> — ver components/root-shell.web.tsx');
  }
  return db;
}
