import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { todayIso } from './queries';
import { accounts, dueItems, goals, habitLogs, habits, tasks } from './schema';
import type * as schema from './schema';

/**
 * `'sync' | 'async'`, não só `Db` de `./client` — este arquivo é chamado
 * tanto pelo `MigrationGate` nativo (`client.ts`, resultKind `'sync'`)
 * quanto por `root-shell.web.tsx` (`client.web.ts`, resultKind `'async'`,
 * via o proxy do Tauri). `import type { Db } from './client'` sempre
 * resolveria para a versão nativa aqui — o TypeScript não entende a
 * resolução por plataforma do Metro (`.web.ts`) — por isso o tipo precisa
 * ser genérico o bastante para aceitar os dois, não importado de um lado só.
 */
type Db = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof schema>;

/**
 * Povoa o banco na primeira abertura do app.
 *
 * Os mesmos números do mock anterior (que, por sua vez, reproduzem o
 * exemplo real do vídeo que originou o projeto: R$ 800 mil / R$ 350 mil /
 * R$ 5 mil por mês → 90 meses). A diferença agora é que estes valores vivem
 * no SQLite — sobrevivem a recarregar a tela, o teste real de persistência.
 */
export async function seedIfEmpty(db: Db) {
  const existing = await db.select({ id: accounts.id }).from(accounts).limit(1);
  if (existing.length > 0) return; // já povoado — nunca duplica

  const today = new Date();
  /**
   * `todayIso()` (hora local), nunca `toISOString()` (UTC) — bug real
   * encontrado por teste: em Brasília às 21h, `toISOString()` já devolve o
   * dia seguinte (UTC-3), e o log de hábito ficava gravado com a data errada.
   * O card "Vence hoje" desapareceria silenciosamente pelo mesmo motivo.
   */
  const iso = () => todayIso();
  const plusDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  };

  await db.insert(accounts).values([{ name: 'Conta corrente', balanceCents: 29272 }]);

  await db.insert(dueItems).values([
    { label: 'Fatura do cartão Nubank', amountCents: -48530, dueDate: iso() },
    { label: 'Assinatura — Spotify', amountCents: -2190, dueDate: iso() },
  ]);

  await db.insert(tasks).values([
    {
      title: 'Revisar orçamento de agosto',
      status: 'todo',
      priority: 'high',
      dueAt: plusDays(0).toISOString(),
    },
    {
      title: 'Levar carro para revisão',
      status: 'todo',
      priority: 'medium',
      estimatedCostCents: 35000,
    },
    {
      title: 'Ligar para o contador',
      status: 'doing',
      priority: 'medium',
      dueAt: plusDays(2).toISOString(),
    },
    { title: 'Organizar recibos do mês', status: 'todo', priority: 'low' },
  ]);

  const insertedHabits = await db
    .insert(habits)
    .values([
      { name: 'Cozinhar em vez de pedir', frequency: 'daily', currentStreak: 5, bestStreak: 5 },
      { name: 'Aportar na meta', frequency: 'monthly', currentStreak: 3, bestStreak: 3 },
      { name: 'Revisar gastos da semana', frequency: 'weekly', currentStreak: 0, bestStreak: 2 },
    ])
    .returning({ id: habits.id, name: habits.name });

  // "Cozinhar em vez de pedir" já feito hoje, no exemplo — os outros não.
  const feitoHoje = insertedHabits.find((h) => h.name === 'Cozinhar em vez de pedir');
  if (feitoHoje) {
    await db.insert(habitLogs).values([{ habitId: feitoHoje.id, date: iso() }]);
  }

  await db.insert(goals).values([
    {
      name: 'Apartamento em Fortaleza',
      targetCents: 80_000_000,
      savedCents: 35_000_000,
      monthlyContributionCents: 500_000,
      status: 'active',
    },
  ]);
}
