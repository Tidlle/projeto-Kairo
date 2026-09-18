import type Database from '@tauri-apps/plugin-sql';

import migrationsData from './migrations/migrations'; // gerado pelo drizzle-kit (driver: 'expo'); mesmo arquivo usado pelo migrador nativo

/**
 * Aplica as migrações do drizzle-kit contra o plugin SQL do Tauri.
 *
 * Não dá pra usar `drizzle-orm/sqlite-proxy/migrator` pronto: ele exige
 * `migrationsFolder` (um CAMINHO DE ARQUIVO, lido via `fs`) — inexistente
 * dentro de um webview. Em vez disso, reaproveita o MESMO `migrations.js`
 * já gerado para o driver nativo (`expo-sqlite`), que traz o SQL de cada
 * migração embutido como string — exatamente o que os testes deste projeto
 * já fazem manualmente (ver `apps/mobile/test/db.test.ts`).
 *
 * Idempotente via uma tabela de controle própria (`_kairo_migrations`): o
 * rastreamento nativo do Drizzle (`__drizzle_migrations`) só existe porque o
 * migrator oficial o cria, e não estamos usando esse migrator aqui.
 */
export async function applyTauriMigrations(sqlite: Database): Promise<void> {
  await sqlite.execute(
    'create table if not exists _kairo_migrations (tag text primary key, applied_at text not null)',
  );

  const applied = await sqlite.select<{ tag: string }[]>('select tag from _kairo_migrations');
  const appliedTags = new Set(applied.map((r) => r.tag));

  const entries = [...migrationsData.journal.entries].sort((a, b) => a.idx - b.idx);
  for (const entry of entries) {
    if (appliedTags.has(entry.tag)) continue;

    const key = `m${String(entry.idx).padStart(4, '0')}`;
    const migrationSql = (migrationsData.migrations as Record<string, string>)[key];
    for (const statement of migrationSql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await sqlite.execute(trimmed);
    }

    // Tag vem do journal gerado por nós, nunca de entrada do usuário — literal direto é seguro aqui.
    await sqlite.execute(
      `insert into _kairo_migrations (tag, applied_at) values ('${entry.tag.replace(/'/g, "''")}', '${new Date().toISOString()}')`,
    );
  }
}
