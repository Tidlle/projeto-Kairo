/**
 * Agregações puras do dashboard financeiro — array-in, array-out, sem banco.
 * Operam sobre o formato do espelho local (`SyncTransactionRow`/
 * `SyncCategoryRow`, ver `finance-sync-protocol.ts`), então funcionam igual
 * testadas em Node ou chamadas de dentro de um hook do app.
 *
 * Todas usam `isRealSpend()` (packages/core/src/pluggy/map.ts) para excluir
 * transferência interna e transação ainda `PENDING` — a mesma regra que já
 * vale para o resumo de ingestão, uma única definição para o projeto inteiro.
 */

import { isRealSpend } from './pluggy/map.ts';
import type { SyncCategoryRow, SyncTransactionRow } from './finance-sync-protocol.ts';

/** 'YYYY-MM', inclusive dos dois lados. */
export type MonthRange = { fromMonth: string; toMonth: string };
/** 'YYYY-MM-DD', inclusive dos dois lados. */
export type DateRange = { from: string; to: string };

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Os últimos 12 meses, incluindo o atual — janela padrão do dashboard (barras/média). */
export function defaultDashboardMonthRange(today: Date): MonthRange {
  const toMonth = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;
  const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const fromMonth = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}`;
  return { fromMonth, toMonth };
}

/** Do dia 1 ao último dia do mês de `today` — janela padrão da categoria e do heatmap. */
export function currentMonthRange(today: Date): DateRange {
  const y = today.getFullYear();
  const m = today.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return { from: `${y}-${pad2(m + 1)}-01`, to: `${y}-${pad2(m + 1)}-${pad2(lastDay)}` };
}

function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const [fromY, fromM] = fromMonth.split('-').map(Number);
  const [toY, toM] = toMonth.split('-').map(Number);
  const months: string[] = [];
  let y = fromY ?? 0;
  let m = fromM ?? 1;
  while (y < (toY ?? 0) || (y === toY && m <= (toM ?? 0))) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    const iso = cursor.toISOString().slice(0, 10);
    days.push(iso);
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return days;
}

export type MonthlyTotal = { month: string; incomeCents: number; expenseCents: number };

/** Entradas x saídas por mês, um bucket por mês do período (mesmo sem dado — o gráfico de barras precisa da série contínua). */
export function monthlyIncomeExpense(txs: SyncTransactionRow[], range: MonthRange): MonthlyTotal[] {
  const months = monthsBetween(range.fromMonth, range.toMonth);
  const totals = new Map<string, { incomeCents: number; expenseCents: number }>(
    months.map((month) => [month, { incomeCents: 0, expenseCents: 0 }]),
  );

  for (const tx of txs) {
    if (!isRealSpend(tx)) continue;
    const bucket = totals.get(tx.date.slice(0, 7));
    if (!bucket) continue; // fora do período pedido
    if (tx.amountCents > 0) bucket.incomeCents += tx.amountCents;
    else bucket.expenseCents += tx.amountCents;
  }

  return months.map((month) => {
    const bucket = totals.get(month) ?? { incomeCents: 0, expenseCents: 0 };
    return { month, incomeCents: bucket.incomeCents, expenseCents: bucket.expenseCents };
  });
}

/** Gasto médio mensal (centavos, positivo), só sobre os meses que têm alguma transação — um mês vazio não puxa a média para baixo. */
export function averageMonthlySpend(txs: SyncTransactionRow[], range: MonthRange): number {
  const monthsWithData = monthlyIncomeExpense(txs, range).filter((m) => m.incomeCents !== 0 || m.expenseCents !== 0);
  if (monthsWithData.length === 0) return 0;
  const totalExpense = monthsWithData.reduce((sum, m) => sum + Math.abs(m.expenseCents), 0);
  return Math.round(totalExpense / monthsWithData.length);
}

export type CategoryTotal = { categoryId: string | null; name: string; color: string | null; totalCents: number };

/** Gasto por categoria no período, maior primeiro. Sem categoria vira "Sem categoria" em vez de sumir. */
export function categoryBreakdown(txs: SyncTransactionRow[], categories: SyncCategoryRow[], range: DateRange): CategoryTotal[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const totalsByKey = new Map<string, number>();

  for (const tx of txs) {
    if (!isRealSpend(tx)) continue;
    if (tx.amountCents >= 0) continue; // só despesa — o donut é sobre pra onde o dinheiro vai
    if (tx.date < range.from || tx.date > range.to) continue;

    const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
    if (category?.isIncome || category?.isTransfer) continue;

    const key = tx.categoryId ?? '';
    totalsByKey.set(key, (totalsByKey.get(key) ?? 0) + Math.abs(tx.amountCents));
  }

  return Array.from(totalsByKey.entries())
    .map(([key, totalCents]) => {
      const category = key ? categoryById.get(key) : undefined;
      return {
        categoryId: key || null,
        name: category?.name ?? 'Sem categoria',
        color: category?.color ?? null,
        totalCents,
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents);
}

export type DailyBalance = { date: string; netCents: number };

/** Saldo líquido por dia (entradas + saídas do dia), um ponto por dia do período — a série que alimenta o heatmap. */
export function dailyBalanceSeries(txs: SyncTransactionRow[], range: DateRange): DailyBalance[] {
  const days = daysBetween(range.from, range.to);
  const totals = new Map<string, number>(days.map((d) => [d, 0]));

  for (const tx of txs) {
    if (!isRealSpend(tx)) continue;
    if (tx.date < range.from || tx.date > range.to) continue;
    totals.set(tx.date, (totals.get(tx.date) ?? 0) + tx.amountCents);
  }

  return days.map((date) => ({ date, netCents: totals.get(date) ?? 0 }));
}
