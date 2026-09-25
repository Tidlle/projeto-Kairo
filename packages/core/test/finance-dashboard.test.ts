import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  averageMonthlySpend,
  categoryBreakdown,
  currentMonthRange,
  dailyBalanceSeries,
  defaultDashboardMonthRange,
  monthlyIncomeExpense,
} from '../src/finance-dashboard.ts';
import type { SyncCategoryRow, SyncTransactionRow } from '../src/finance-sync-protocol.ts';

function tx(overrides: Partial<SyncTransactionRow>): SyncTransactionRow {
  return {
    id: overrides.id ?? 'tx-1',
    accountId: 'acc-1',
    amountCents: -1000,
    date: '2026-08-15',
    status: 'POSTED',
    categoryId: null,
    isInternalTransfer: false,
    updatedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

function category(overrides: Partial<SyncCategoryRow>): SyncCategoryRow {
  return {
    id: overrides.id ?? 'cat-1',
    parentId: null,
    name: 'Categoria',
    icon: null,
    color: '#E6A94E',
    isIncome: false,
    isTransfer: false,
    sortOrder: 0,
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('monthlyIncomeExpense', () => {
  it('soma entrada e saída por mês, com um bucket por mês do período mesmo sem dado', () => {
    const rows = [
      tx({ id: '1', date: '2026-07-05', amountCents: 500_00 }),
      tx({ id: '2', date: '2026-07-20', amountCents: -200_00 }),
      tx({ id: '3', date: '2026-09-01', amountCents: -50_00 }),
    ];
    const result = monthlyIncomeExpense(rows, { fromMonth: '2026-07', toMonth: '2026-09' });

    assert.deepEqual(result, [
      { month: '2026-07', incomeCents: 500_00, expenseCents: -200_00 },
      { month: '2026-08', incomeCents: 0, expenseCents: 0 },
      { month: '2026-09', incomeCents: 0, expenseCents: -50_00 },
    ]);
  });

  it('exclui transferência interna e transação ainda PENDING', () => {
    const rows = [
      tx({ id: '1', date: '2026-08-01', amountCents: 300_00, isInternalTransfer: true }),
      tx({ id: '2', date: '2026-08-02', amountCents: -100_00, status: 'PENDING' }),
    ];
    const result = monthlyIncomeExpense(rows, { fromMonth: '2026-08', toMonth: '2026-08' });

    assert.deepEqual(result, [{ month: '2026-08', incomeCents: 0, expenseCents: 0 }]);
  });

  it('ignora transação fora do período pedido', () => {
    const rows = [tx({ id: '1', date: '2026-01-01', amountCents: -999_00 })];
    const result = monthlyIncomeExpense(rows, { fromMonth: '2026-08', toMonth: '2026-08' });

    assert.deepEqual(result, [{ month: '2026-08', incomeCents: 0, expenseCents: 0 }]);
  });
});

describe('averageMonthlySpend', () => {
  it('divide só pelos meses que têm alguma transação — mês vazio não puxa a média pra baixo', () => {
    const rows = [
      tx({ id: '1', date: '2026-07-10', amountCents: -100_00 }),
      tx({ id: '2', date: '2026-09-10', amountCents: -300_00 }),
      // agosto sem nenhuma transação
    ];
    const avg = averageMonthlySpend(rows, { fromMonth: '2026-07', toMonth: '2026-09' });

    assert.equal(avg, 200_00); // (100 + 300) / 2 meses com dado, não / 3
  });

  it('zero quando não há nenhuma transação no período', () => {
    assert.equal(averageMonthlySpend([], { fromMonth: '2026-07', toMonth: '2026-09' }), 0);
  });
});

describe('categoryBreakdown', () => {
  it('agrupa só despesa por categoria, maior primeiro', () => {
    const categories = [category({ id: 'food', name: 'Alimentação' }), category({ id: 'transport', name: 'Transporte' })];
    const rows = [
      tx({ id: '1', date: '2026-08-05', amountCents: -50_00, categoryId: 'food' }),
      tx({ id: '2', date: '2026-08-06', amountCents: -30_00, categoryId: 'food' }),
      tx({ id: '3', date: '2026-08-07', amountCents: -100_00, categoryId: 'transport' }),
      tx({ id: '4', date: '2026-08-08', amountCents: 500_00, categoryId: 'food' }), // entrada, não conta
    ];

    const result = categoryBreakdown(rows, categories, { from: '2026-08-01', to: '2026-08-31' });

    assert.deepEqual(result, [
      { categoryId: 'transport', name: 'Transporte', color: '#E6A94E', totalCents: 100_00 },
      { categoryId: 'food', name: 'Alimentação', color: '#E6A94E', totalCents: 80_00 },
    ]);
  });

  it('transação sem categoria vira "Sem categoria" em vez de sumir', () => {
    const rows = [tx({ id: '1', date: '2026-08-05', amountCents: -40_00, categoryId: null })];
    const result = categoryBreakdown(rows, [], { from: '2026-08-01', to: '2026-08-31' });

    assert.deepEqual(result, [{ categoryId: null, name: 'Sem categoria', color: null, totalCents: 40_00 }]);
  });

  it('exclui categoria marcada isIncome/isTransfer mesmo se a transação não estiver marcada isInternalTransfer', () => {
    const categories = [category({ id: 'salary', name: 'Salário', isIncome: true })];
    const rows = [tx({ id: '1', date: '2026-08-05', amountCents: -10_00, categoryId: 'salary' })];

    assert.deepEqual(categoryBreakdown(rows, categories, { from: '2026-08-01', to: '2026-08-31' }), []);
  });
});

describe('defaultDashboardMonthRange', () => {
  it('os últimos 12 meses, incluindo o atual', () => {
    assert.deepEqual(defaultDashboardMonthRange(new Date('2026-09-15T12:00:00')), {
      fromMonth: '2025-10',
      toMonth: '2026-09',
    });
  });

  it('atravessa a virada do ano corretamente', () => {
    assert.deepEqual(defaultDashboardMonthRange(new Date('2026-02-01T12:00:00')), {
      fromMonth: '2025-03',
      toMonth: '2026-02',
    });
  });
});

describe('currentMonthRange', () => {
  it('do dia 1 ao último dia do mês', () => {
    assert.deepEqual(currentMonthRange(new Date('2026-02-15T12:00:00')), { from: '2026-02-01', to: '2026-02-28' });
  });

  it('mês de 31 dias', () => {
    assert.deepEqual(currentMonthRange(new Date('2026-01-05T12:00:00')), { from: '2026-01-01', to: '2026-01-31' });
  });
});

describe('dailyBalanceSeries', () => {
  it('um ponto por dia do período, mesmo sem transação naquele dia', () => {
    const rows = [
      tx({ id: '1', date: '2026-08-01', amountCents: 100_00 }),
      tx({ id: '2', date: '2026-08-01', amountCents: -30_00 }),
      tx({ id: '3', date: '2026-08-03', amountCents: -20_00 }),
    ];
    const result = dailyBalanceSeries(rows, { from: '2026-08-01', to: '2026-08-03' });

    assert.deepEqual(result, [
      { date: '2026-08-01', netCents: 70_00 },
      { date: '2026-08-02', netCents: 0 },
      { date: '2026-08-03', netCents: -20_00 },
    ]);
  });
});
