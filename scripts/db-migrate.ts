/**
 * Aplica as migrações do Drizzle no banco apontado por DATABASE_URL.
 *   npm run db:migrate
 *
 * Idempotente: registra o que já rodou em `_kairo_migrations`, igual ao banco
 * local (packages/db/src/local.ts). Sem isso, rodar duas vezes falha tentando
 * recriar tipos/tabelas que já existem — foi exatamente o que aconteceu na
 * primeira versão deste script.
 */
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const file = path.resolve(process.cwd(), '.env');
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    const key = m?.[1];
    if (key && !(key in process.env)) {
      process.env[key] = (m?.[2] ?? '').trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('\n✗ DATABASE_URL ausente no .env\n');
  process.exit(1);
}

const dir = path.resolve('packages/db/migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const sql = postgres(url, {
  max: 1,
  prepare: false,
  // "relation already exists, skipping" de um IF NOT EXISTS é ruído, não erro.
  onnotice: () => {},
});

try {
  await sql`
    create table if not exists _kairo_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const applied = new Set(
    (await sql`select name from _kairo_migrations`).map((r) => r.name as string),
  );

  let ranAny = false;

  for (const f of files) {
    if (applied.has(f)) {
      console.log(`  ${f} já aplicada, pulando`);
      continue;
    }

    process.stdout.write(`  aplicando ${f}… `);
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const stmt of content.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed) await sql.unsafe(trimmed);
    }
    await sql`insert into _kairo_migrations (name) values (${f})`;
    console.log('ok');
    ranAny = true;
  }

  console.log(ranAny ? '\n  ✓ schema atualizado\n' : '\n  ✓ schema já estava em dia\n');
} finally {
  await sql.end();
}
