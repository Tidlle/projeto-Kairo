/**
 * Kairo — sincronização
 *
 *   npm run sync                     # banco local embarcado (padrão)
 *   npm run sync -- --days=365       # janela maior
 *   npm run sync -- --force          # força coleta nova no Pluggy antes de ler
 *   npm run sync -- --remote         # usa DATABASE_URL (Supabase)
 *
 * Mesmo `runSync` que a Edge Function usa; só muda quem imprime e onde grava.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createDb } from '../packages/db/src/client.ts';
import { openLocalDb } from '../packages/db/src/local.ts';
import { runSync } from '../packages/db/src/sync.ts';

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

function loadEnv() {
  const file = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    const key = m?.[1];
    if (!key) continue;
    const value = (m?.[2] ?? '').trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnv();

  const remote = args.includes('--remote');
  const { PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_ITEM_IDS, DATABASE_URL } = process.env;

  /**
   * Sem KAIRO_USER_ID definido, geramos um uuid determinístico a partir do
   * clientId — para uso pessoal, exigir configuração extra só atrapalha.
   */
  const userId = process.env.KAIRO_USER_ID || derivedUserId(PLUGGY_CLIENT_ID ?? '');

  const required: Record<string, string | undefined> = {
    PLUGGY_CLIENT_ID,
    PLUGGY_CLIENT_SECRET,
    PLUGGY_ITEM_IDS,
    ...(remote ? { DATABASE_URL } : {}),
  };

  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(c.red(`\n✗ Faltam variáveis no .env: ${missing.join(', ')}\n`));
    if (missing.includes('DATABASE_URL')) {
      console.error('  DATABASE_URL: Supabase → Project Settings → Database → Connection string');
      console.error(c.dim('    (ou rode sem --remote para usar o banco local)\n'));
    }
    process.exitCode = 1;
    return;
  }

  console.log(c.bold('\n  Kairo · sincronização\n'));

  const local = remote ? null : await openLocalDb();
  const db = local ? local.db : createDb(DATABASE_URL!);

  console.log(
    c.dim(local ? `    banco local: ${local.dataDir}` : '    banco remoto (DATABASE_URL)'),
  );

  const result = await runSync(db, {
    clientId: PLUGGY_CLIENT_ID!,
    clientSecret: PLUGGY_CLIENT_SECRET!,
    itemIds: PLUGGY_ITEM_IDS!.split(',').map((s) => s.trim()).filter(Boolean),
    userId,
    days: Number(flag('days') ?? 90),
    forceSync: args.includes('--force'),
    onProgress: (m) => console.log(c.dim(`    ${m}`)),
  });

  console.log('');
  for (const item of result.items) {
    if (item.error) {
      console.log(`  ${c.red('✗')} ${item.connector} ${c.dim(item.itemId)}`);
      console.log(`    ${c.red(item.error)}`);
      continue;
    }
    console.log(
      `  ${c.green('✓')} ${c.bold(item.connector)} ${c.dim(`· ${item.accounts} contas`)}\n` +
        `    ${item.inserted} novas · ${item.updated} atualizadas` +
        c.dim(` · ${item.internalTransfers} transferências internas`),
    );
  }

  console.log(
    c.bold(`\n  ${result.totalInserted} novas, ${result.totalUpdated} atualizadas `) +
      c.dim(`em ${(result.durationMs / 1000).toFixed(1)}s\n`),
  );

  await local?.close();
  if (!result.ok) process.exitCode = 1;
}

/**
 * uuid v5-ish derivado do clientId: estável entre execuções, sem exigir que
 * você gere e guarde um id à mão.
 */
function derivedUserId(seed: string): string {
  const hash = createHash('sha1').update(`kairo:${seed}`).digest('hex');
  const v = hash.slice(0, 32).split('');
  v[12] = '5'; // versão
  v[16] = '8'; // variante
  const h = v.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

main().catch((err) => {
  process.exitCode = 1;
  console.error(c.red('\n✗ '), err instanceof Error ? err.message : err, '\n');
});
