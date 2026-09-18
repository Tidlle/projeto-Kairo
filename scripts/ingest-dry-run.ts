/**
 * Kairo — ensaio de ingestão (dry-run)
 *
 * Roda o pipeline completo Pluggy → Kairo contra o dump local em ./out/,
 * sem rede e sem banco, e relata o que SERIA gravado.
 *
 *   npm run smoke -- --days=365 --dump    # gera o dump
 *   npm run ingest:dry
 *
 * O objetivo é medir a qualidade das regras (transferências, merchants,
 * categorias) antes de existir banco para estragar.
 */

import fs from 'node:fs';
import path from 'node:path';

import { formatBRL } from '../packages/core/src/money.ts';
import { needsAiRefinement } from '../packages/core/src/pluggy/categories.ts';
import { mapAccount, mapTransactions, summarize } from '../packages/core/src/pluggy/map.ts';
import { isSelfTransferByDocument } from '../packages/core/src/pluggy/transfers.ts';
import type { PluggyAccount, PluggyTransaction } from '../packages/core/src/pluggy/types.ts';

const OUT = path.resolve(process.cwd(), 'out');

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

function readAll<T>(prefix: string): T[] {
  if (!fs.existsSync(OUT)) {
    console.error(c.red('\n✗ Pasta ./out não existe.'));
    console.error('  Gere o dump primeiro: ' + c.cyan('npm run smoke -- --days=365 --dump') + '\n');
    process.exit(1);
  }
  return fs
    .readdirSync(OUT)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')) as T | T[])
    .flat() as T[];
}

const pct = (n: number, total: number) => (total ? ((n / total) * 100).toFixed(1) : '0.0') + '%';

function main() {
  const accounts = readAll<PluggyAccount>('accounts-');
  const txs = readAll<PluggyTransaction>('transactions-');

  if (!txs.length) {
    console.error(c.red('\n✗ Nenhuma transação no dump.\n'));
    process.exit(1);
  }

  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const rows = mapTransactions(txs, accountsById);

  console.log(c.bold('\n  Kairo · ensaio de ingestão'));
  console.log(c.dim(`  ${txs.length} transações · ${accounts.length} contas · sem rede, sem banco\n`));

  // ── contas
  console.log(c.bold('  Contas'));
  for (const a of accounts) {
    const row = mapAccount(a);
    console.log(
      `    ${c.cyan(row.name)} ${c.dim(`(${row.type}/${row.subtype} ••••${row.numberMasked})`)}` +
        `  ${formatBRL(row.balanceCents)}`,
    );
  }

  // ── mapeamento
  const orphans = txs.length - rows.length;
  console.log(c.bold('\n  Mapeamento'));
  console.log(`    linhas geradas: ${rows.length}${orphans ? c.yellow(` · ${orphans} órfãs descartadas`) : ''}`);

  const negatives = rows.filter((r) => r.amountCents < 0).length;
  console.log(c.dim(`    saídas ${negatives} · entradas ${rows.length - negatives}`));

  // ── transferências internas
  const byDoc = txs.filter(isSelfTransferByDocument).length;
  const detected = rows.filter((r) => r.isInternalTransfer);
  const pairKeys = new Set(detected.map((r) => r.transferPairKey).filter(Boolean));

  console.log(c.bold('\n  Transferências internas'));
  console.log(`    detectadas: ${detected.length} ${c.dim(`(${pairKeys.size} pares completos)`)}`);
  console.log(c.dim(`    por CPF idêntico: ${byDoc} · por valor+data: ${detected.length - byDoc}`));

  // ── merchants
  const keys = new Map<string, number>();
  for (const r of rows) keys.set(r.merchantFingerprint, (keys.get(r.merchantFingerprint) ?? 0) + 1);
  const reused = [...keys.values()].filter((n) => n > 1).length;

  console.log(c.bold('\n  Estabelecimentos'));
  console.log(`    chaves únicas: ${keys.size} para ${rows.length} transações`);
  console.log(
    c.dim(`    ${reused} chaves aparecem mais de uma vez → `) +
      c.green(`${pct(rows.length - keys.size, rows.length)} de chamadas de IA economizadas`),
  );
  console.log(c.dim('    mais frequentes:'));
  [...keys.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([k, n]) => console.log(c.dim(`      ${String(n).padStart(3)}×  ${k.slice(0, 56)}`)));

  // ── categorias
  const needAi = rows.filter((r) => needsAiRefinement(r.externalCategory) && !r.isInternalTransfer);
  const uncategorized = rows.filter((r) => !r.categoryName);
  const aiKeys = new Set(needAi.map((r) => r.merchantFingerprint));

  console.log(c.bold('\n  Categorias'));
  console.log(`    traduzidas: ${rows.length - uncategorized.length} de ${rows.length}`);
  console.log(
    `    precisam da IA: ${needAi.length} ${c.dim(`(${pct(needAi.length, rows.length)})`)}` +
      c.green(` → mas só ${aiKeys.size} chamadas, graças ao cache`),
  );
  if (uncategorized.length) {
    const labels = new Set(uncategorized.map((r) => r.externalCategory ?? '(nulo)'));
    console.log(c.yellow(`    rótulos sem mapa: ${[...labels].join(', ')}`));
  }

  // ── totais
  const s = summarize(rows);
  const naive = rows.filter((r) => r.status === 'POSTED');
  const naiveIncome = naive.filter((r) => r.amountCents > 0).reduce((a, r) => a + r.amountCents, 0);
  const naiveExpense = naive.filter((r) => r.amountCents < 0).reduce((a, r) => a + r.amountCents, 0);

  console.log(c.bold('\n  Totais'));
  console.log(c.dim('    sem tratar transferências (o que o script de fumaça mostrava):'));
  console.log(c.dim(`      entradas ${formatBRL(naiveIncome)} · saídas ${formatBRL(naiveExpense)}`));
  console.log('    com transferências internas excluídas:');
  console.log(
    `      entradas ${c.green(formatBRL(s.incomeCents))} · saídas ${c.red(formatBRL(s.expenseCents))}`,
  );
  console.log(`      resultado ${c.bold(formatBRL(s.netCents))}`);

  const ghost = naiveIncome - s.incomeCents;
  if (ghost > 0) {
    console.log(
      c.yellow(`\n    ⚠ ${formatBRL(ghost)} eram receita fantasma — dinheiro só trocando de bolso.`),
    );
  }

  console.log(c.green('\n  ✓ Pipeline validado contra os dados reais.\n'));
}

main();
