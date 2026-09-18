import { isNewer, type SyncPullResult, type SyncPushPayload } from '@kairo/core';
import { gt, sql } from 'drizzle-orm';

import type { Db } from './client';
import { events, goals, habitLogs, habits, syncState, tasks } from './schema';

/**
 * Sincronização de rotina — I/O puro, sem React, testável em Node
 * (better-sqlite3) — mesmo motivo de `queries.ts`.
 *
 * Fala com a Edge Function `sync-routine`, nunca direto com o Postgres:
 * o app não guarda nenhuma credencial de banco, só um segredo leve que
 * identifica o cliente (ver o comentário de confiança em `syncRoutine`).
 */

const TABLES = ['tasks', 'habits', 'habitLogs', 'goals', 'events'] as const;
type TableName = (typeof TABLES)[number];

async function getWatermarks(db: Db): Promise<Record<TableName, { pushed: string | null; pulled: string | null }>> {
  const rows = await db.select().from(syncState);
  const byName = new Map(rows.map((r) => [r.tableName, r]));

  return Object.fromEntries(
    TABLES.map((t) => [t, { pushed: byName.get(t)?.lastPushedAt ?? null, pulled: byName.get(t)?.lastPulledAt ?? null }]),
  ) as Record<TableName, { pushed: string | null; pulled: string | null }>;
}

async function setWatermark(db: Db, table: TableName, field: 'lastPushedAt' | 'lastPulledAt', value: string) {
  await db
    .insert(syncState)
    .values({ tableName: table, [field]: value })
    .onConflictDoUpdate({ target: syncState.tableName, set: { [field]: value } });
}

/** Linhas locais mudadas desde o último push — o que esta sincronização vai enviar. */
export async function getPushPayload(db: Db): Promise<SyncPushPayload> {
  const wm = await getWatermarks(db);

  const taskRows = await db.select().from(tasks).where(wm.tasks.pushed ? gt(tasks.updatedAt, wm.tasks.pushed) : undefined);
  const habitRows = await db.select().from(habits).where(wm.habits.pushed ? gt(habits.updatedAt, wm.habits.pushed) : undefined);
  const habitLogRows = await db
    .select()
    .from(habitLogs)
    .where(wm.habitLogs.pushed ? gt(habitLogs.updatedAt, wm.habitLogs.pushed) : undefined);
  const goalRows = await db.select().from(goals).where(wm.goals.pushed ? gt(goals.updatedAt, wm.goals.pushed) : undefined);
  const eventRows = await db
    .select()
    .from(events)
    .where(wm.events.pushed ? gt(events.updatedAt, wm.events.pushed) : undefined);

  return { tasks: taskRows, habits: habitRows, habitLogs: habitLogRows, goals: goalRows, events: eventRows };
}

/**
 * Grava o que veio do servidor, respeitando LWW: só tenta a escrita se a
 * linha recebida for mais nova pela checagem em memória (`isNewer`, pura,
 * testada isoladamente em packages/core) — evita uma volta ao banco para
 * quem nem precisa. O `setWhere` repete a MESMA checagem dentro do próprio
 * SQLite, atomicamente: cinto e suspensório contra a janela entre o
 * `select` de comparação e o `insert`, mesmo padrão do lado Postgres em
 * `packages/db/src/routine-sync.ts`.
 */
export async function applyPulled(db: Db, pulled: SyncPullResult): Promise<void> {
  const localTasks = new Map((await db.select().from(tasks)).map((t) => [t.id, t]));
  for (const row of pulled.tasks) {
    if (!isNewer(row, localTasks.get(row.id))) continue;
    await db
      .insert(tasks)
      .values(row)
      .onConflictDoUpdate({
        target: tasks.id,
        set: {
          title: row.title,
          status: row.status,
          priority: row.priority,
          dueAt: row.dueAt,
          estimatedCostCents: row.estimatedCostCents,
          updatedAt: row.updatedAt,
        },
        setWhere: sql`excluded.updated_at > ${tasks.updatedAt}`,
      });
  }

  const localHabits = new Map((await db.select().from(habits)).map((h) => [h.id, h]));
  for (const row of pulled.habits) {
    if (!isNewer(row, localHabits.get(row.id))) continue;
    await db
      .insert(habits)
      .values(row)
      .onConflictDoUpdate({
        target: habits.id,
        set: {
          name: row.name,
          frequency: row.frequency,
          targetPerPeriod: row.targetPerPeriod,
          currentStreak: row.currentStreak,
          bestStreak: row.bestStreak,
          updatedAt: row.updatedAt,
        },
        setWhere: sql`excluded.updated_at > ${habits.updatedAt}`,
      });
  }

  const localHabitLogs = new Map((await db.select().from(habitLogs)).map((l) => [l.id, l]));
  for (const row of pulled.habitLogs) {
    if (!isNewer(row, localHabitLogs.get(row.id))) continue;
    await db
      .insert(habitLogs)
      .values(row)
      .onConflictDoUpdate({
        target: habitLogs.id,
        set: { date: row.date, updatedAt: row.updatedAt },
        setWhere: sql`excluded.updated_at > ${habitLogs.updatedAt}`,
      });
  }

  const localGoals = new Map((await db.select().from(goals)).map((g) => [g.id, g]));
  for (const row of pulled.goals) {
    if (!isNewer(row, localGoals.get(row.id))) continue;
    await db
      .insert(goals)
      .values(row)
      .onConflictDoUpdate({
        target: goals.id,
        set: {
          name: row.name,
          targetCents: row.targetCents,
          savedCents: row.savedCents,
          monthlyContributionCents: row.monthlyContributionCents,
          status: row.status,
          updatedAt: row.updatedAt,
        },
        setWhere: sql`excluded.updated_at > ${goals.updatedAt}`,
      });
  }

  const localEvents = new Map((await db.select().from(events)).map((e) => [e.id, e]));
  for (const row of pulled.events) {
    if (!isNewer(row, localEvents.get(row.id))) continue;
    await db
      .insert(events)
      .values(row)
      .onConflictDoUpdate({
        target: events.id,
        set: {
          title: row.title,
          location: row.location,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          allDay: row.allDay,
          taskId: row.taskId,
          updatedAt: row.updatedAt,
        },
        setWhere: sql`excluded.updated_at > ${events.updatedAt}`,
      });
  }
}

export type SyncOutcome = { ok: true; pushed: number; pulled: number } | { ok: false; error: string };

export type SyncConfig = {
  /** URL completa da Edge Function, ex.: https://<ref>.supabase.co/functions/v1/sync-routine */
  functionUrl: string;
  /**
   * Não é um segredo forte — viaja dentro do bundle do app, então qualquer
   * pessoa com o binário consegue extraí-lo. Funciona como um portão contra
   * descoberta casual do endpoint, não como prova de identidade. Por isso a
   * Edge Function usa um segredo PRÓPRIO (`MOBILE_SYNC_SECRET`), diferente
   * do `SYNC_SECRET` server-to-server do cron do Pluggy — vazamento aqui
   * expõe só rotina (tarefas/hábitos/metas), nunca o sync financeiro.
   */
  secret: string;
};

/** Sincroniza de verdade: lê o que mudou local, manda, aplica o que voltou, avança os marcadores. */
export async function syncRoutine(db: Db, config: SyncConfig): Promise<SyncOutcome> {
  try {
    const wm = await getWatermarks(db);
    const push = await getPushPayload(db);

    const res = await fetch(config.functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-secret': config.secret },
      body: JSON.stringify({
        push,
        pullSince: {
          tasks: wm.tasks.pulled,
          habits: wm.habits.pulled,
          habitLogs: wm.habitLogs.pulled,
          goals: wm.goals.pulled,
          events: wm.events.pulled,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 300)}` };
    }

    const { pulled, serverTime } = (await res.json()) as { pulled: SyncPullResult; serverTime: string };
    await applyPulled(db, pulled);

    for (const t of TABLES) {
      await setWatermark(db, t, 'lastPushedAt', serverTime);
      await setWatermark(db, t, 'lastPulledAt', serverTime);
    }

    const pushedCount =
      push.tasks.length + push.habits.length + push.habitLogs.length + push.goals.length + push.events.length;
    const pulledCount =
      pulled.tasks.length + pulled.habits.length + pulled.habitLogs.length + pulled.goals.length + pulled.events.length;
    return { ok: true, pushed: pushedCount, pulled: pulledCount };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
