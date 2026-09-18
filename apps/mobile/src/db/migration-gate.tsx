import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import { useDb } from './client';
import migrations from './migrations/migrations'; // gerado pelo drizzle-kit (driver: 'expo')
import { seedIfEmpty } from './seed';

type MigrationGateProps = { children: ReactNode };

/**
 * Segura a árvore de navegação até o banco local estar pronto: migrações
 * aplicadas e, na primeira execução, os dados de exemplo inseridos.
 * Sem isto a tela "Hoje" tentaria ler tabelas que ainda não existem.
 */
export function MigrationGate({ children }: MigrationGateProps) {
  const db = useDb();
  const { success, error } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  useEffect(() => {
    if (!success) return;
    seedIfEmpty(db)
      .then(() => setSeeded(true))
      .catch((e) => setSeedError(e instanceof Error ? e : new Error(String(e))));
  }, [success, db]);

  const failure = error ?? seedError;
  if (failure) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="smallBold">Não consegui preparar o banco local</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {failure.message}
        </ThemedText>
      </ThemedView>
    );
  }

  if (!success || !seeded) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="small" themeColor="textSecondary">
          preparando…
        </ThemedText>
      </ThemedView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
