/**
 * Banco local embarcado (PGlite).
 *
 * Postgres de verdade compilado para WASM, persistido em disco — mesmo motor,
 * mesmo SQL, mesmas migrações do Supabase. Sem Docker, sem servidor, sem conta.
 *
 * Para uso pessoal isso é frequentemente o suficiente: um único usuário, um
 * único dispositivo. O Supabase passa a fazer falta quando você quiser
 * sincronizar celular e desktop — aí o mesmo schema sobe para lá sem alteração.
 */

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import fs from 'node:fs';
import path from 'node:path';

import * as schema from '../schema.ts';
import type { Db } from './client.ts';

export type LocalDb = { db: Db; close: () => Promise<void>; dataDir: string };

/** Abre (ou cria) o banco local e aplica as migrações pendentes. */
export async function openLocalDb(dataDir = 'data/kairo'): Promise<LocalDb> {
  const resolved = path.resolve(process.cwd(), dataDir);
  // PGlite não cria diretório aninhado: sem isto, ENOENT no primeiro uso.
  fs.mkdirSync(resolved, { recursive: true });

  const client = new PGlite(resolved);
  const db = drizzle(client, { schema }) as Db;

  await applyMigrations(client);

  return {
    db,
    dataDir: resolved,
    close: () => client.close(),
  };
}

/**
 * Aplica as migrações do Drizzle, registrando o que já rodou.
 * Idempotente: reabrir o banco não reaplica nada.
 */
async function applyMigrations(client: PGlite) {
  await client.exec(`
    create table if not exists _kairo_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const dir = path.resolve(process.cwd(), 'packages/db/migrations');
  if (!fs.existsSync(dir)) throw new Error(`migrações não encontradas em ${dir}`);

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const applied = new Set(
    (
      (await client.query<{ name: string }>('select name from _kairo_migrations')).rows ?? []
    ).map((r) => r.name),
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await client.exec(trimmed);
    }
    await client.query('insert into _kairo_migrations (name) values ($1)', [file]);
  }
}
