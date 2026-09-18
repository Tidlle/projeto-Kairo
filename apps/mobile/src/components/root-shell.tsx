import type { ReactNode } from 'react';
import { SQLiteProvider } from 'expo-sqlite';

import { DATABASE_NAME } from '@/db/client';
import { MigrationGate } from '@/db/migration-gate';

/**
 * Provedor do banco local — versão nativa (iOS/Android).
 *
 * Fica fora de `app/` pelo mesmo motivo de `screens/hoje-screen.tsx`: dentro
 * de `app/`, o Expo Router carrega toda variante de plataforma de um arquivo
 * via require.context, ignorando `.web.tsx` (github.com/expo/expo/issues/37752).
 * `app/_layout.tsx` importa só `RootShell` — a escolha desta versão ou de
 * `root-shell.web.tsx` acontece aqui, onde a resolução por plataforma funciona.
 */
export function RootShell({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} useSuspense={false}>
      <MigrationGate>{children}</MigrationGate>
    </SQLiteProvider>
  );
}
