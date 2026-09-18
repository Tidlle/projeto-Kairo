/**
 * Kairo — inspeção do banco local
 *
 *   npm run inspect
 *
 * Um raio-x rápido do que a sincronização produziu: contagens, totais reais
 * (com transferência interna excluída), top categorias e histórico de sync.
 */

import { openLocalDb } from '../packages/db/src/local.ts';

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

const QUERIES: Array<{ title: string; sql: string }> = [
  {
    title: 'linhas por tabela',
    sql: `select 'transactions' as tabela, count(*)::int as n from transactions
          union all select 'accounts',    count(*)::int from accounts
          union all select 'merchants',   count(*)::int from merchants
          union all select 'categories',  count(*)::int from categories
          union all select 'connections', count(*)::int from connections
          union all select 'sync_runs',   count(*)::int from sync_runs
          order by n desc`,
  },
  {
    title: 'contas',
    sql: `select coalesce(nickname, name) as conta,
                 type as tipo,
                 to_char(balance_cents / 100.0, 'FM999G999D00') as saldo
          from accounts order by balance_cents desc`,
  },
  {
    title: 'totais reais (transferências internas excluídas)',
    sql: `select count(*)::int as transacoes,
                 to_char(sum(amount_cents) filter (where amount_cents > 0) / 100.0, 'FM999G999D00') as entradas,
                 to_char(-sum(amount_cents) filter (where amount_cents < 0) / 100.0, 'FM999G999D00') as saidas,
                 to_char(sum(amount_cents) / 100.0, 'FM999G999D00') as resultado
          from transactions
          where not is_internal_transfer and status = 'POSTED'`,
  },
  {
    title: 'top categorias (gastos)',
    sql: `select c.name as categoria,
                 count(*)::int as n,
                 to_char(sum(-t.amount_cents) / 100.0, 'FM999G999D00') as total
          from transactions t join categories c on c.id = t.category_id
          where t.amount_cents < 0 and not t.is_internal_transfer
          group by 1 order by sum(-t.amount_cents) desc limit 8`,
  },
  {
    title: 'estabelecimentos mais frequentes',
    sql: `select m.display_name as estabelecimento,
                 count(*)::int as compras,
                 to_char(sum(-t.amount_cents) / 100.0, 'FM999G999D00') as total
          from transactions t join merchants m on m.id = t.merchant_id
          where t.amount_cents < 0 and not t.is_internal_transfer
          group by 1 order by 2 desc limit 8`,
  },
  {
    title: 'transferências internas detectadas',
    sql: `select transfer_detected_by as metodo,
                 count(*)::int as pernas,
                 count(distinct transfer_pair_key)::int as pares
          from transactions where is_internal_transfer group by 1`,
  },
  {
    title: 'histórico de sincronização',
    sql: `select status,
                 transactions_inserted as novas,
                 transactions_updated  as atualizadas,
                 round(extract(epoch from (finished_at - started_at))::numeric, 2) as segundos
          from sync_runs order by started_at desc limit 6`,
  },
];

async function main() {
  const { db, close, dataDir } = await openLocalDb();
  console.log(c.bold('\n  Kairo · banco local'));
  console.log(c.dim(`  ${dataDir}`));

  for (const { title, sql } of QUERIES) {
    const result = await (db as unknown as { execute: (q: string) => Promise<unknown> }).execute(sql);
    const rows = (result as { rows?: unknown[] }).rows ?? (result as unknown[]);
    console.log(`\n${c.cyan('— ' + title)}`);
    if (!Array.isArray(rows) || !rows.length) console.log(c.dim('  (vazio)'));
    else console.table(rows);
  }

  await close();
  console.log('');
}

main().catch((err) => {
  process.exitCode = 1;
  console.error('\n✗', err instanceof Error ? err.message : err, '\n');
});
