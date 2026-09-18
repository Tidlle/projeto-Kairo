import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import * as schema from './schema';

/** Nome do arquivo do banco local — passado ao <SQLiteProvider> em _layout.tsx. */
export const DATABASE_NAME = 'kairo.db';

/**
 * Tipo agnóstico de driver — mesmo motivo do `Db` em packages/db/src/client.ts:
 * `expo-sqlite` (no app) e `better-sqlite3` (nos testes, packages/db-mobile-test)
 * são drivers "sync" diferentes, mas ambos satisfazem `BaseSQLiteDatabase`.
 * É o que permite testar `queries.ts` num Node normal, sem simulador nem
 * o alvo Web (onde o expo-sqlite ainda é alpha — ver nota no README dos testes).
 */
export type Db = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

/**
 * Instância Drizzle sobre o SQLite da sessão. Só usável dentro de <SQLiteProvider>.
 * Tipo de retorno CONCRETO (não `Db`) de propósito: `useMigrations` (drizzle-orm)
 * exige especificamente `ExpoSQLiteDatabase`, não o tipo genérico. Passar este
 * valor concreto para uma função que pede `Db` continua funcionando — é o
 * genérico recebendo o específico, não o contrário.
 */
export function useDb() {
  const sqlite = useSQLiteContext();
  return useMemo(() => drizzle(sqlite, { schema }), [sqlite]);
}
