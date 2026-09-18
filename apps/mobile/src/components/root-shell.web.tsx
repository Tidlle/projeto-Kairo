import { isTauri } from '@tauri-apps/api/core';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SectionCard } from '@/components/kairo/section-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { connectTauriDb, DbProvider, type Db } from '@/db/client.web';
import { seedIfEmpty } from '@/db/seed';
import { applyTauriMigrations } from '@/db/tauri-migrate';

type GateState = { status: 'loading' } | { status: 'ready'; db: Db } | { status: 'error'; message: string };

/**
 * Provedor do banco local — versão Web.
 *
 * A MESMA build Web roda em dois contextos bem diferentes:
 *  - dentro do Tauri (app desktop): abre o SQLite de verdade via
 *    `@tauri-apps/plugin-sql`, aplica migrações e povoa na primeira vez —
 *    o mesmo contrato do `MigrationGate` nativo, só sem `expo-sqlite`;
 *  - num navegador comum (preview de desenvolvimento): não existe SQLite
 *    disponível ali, e não é o alvo real de uso — mostra uma mensagem
 *    explicativa em vez de tentar (e travar) uma conexão que não existe.
 *
 * `isTauri()` (de `@tauri-apps/api/core`) é o que distingue os dois — não dá
 * pra saber isso em tempo de bundle (as duas situações usam o MESMO build
 * Web), só em tempo de execução.
 */
export function RootShell({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ status: 'loading' });
  const runningInTauri = isTauri();

  useEffect(() => {
    if (!runningInTauri) return;
    let cancelled = false;

    (async () => {
      try {
        const { db, sqlite } = await connectTauriDb();
        await applyTauriMigrations(sqlite);
        await seedIfEmpty(db);
        if (!cancelled) setState({ status: 'ready', db });
      } catch (err) {
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runningInTauri]);

  if (!runningInTauri) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.column}>
            <SectionCard title="Abra no app Kairo">
              <ThemedText>
                Esta página é só uma prévia de desenvolvimento. Os dados de verdade vivem no
                app desktop (Windows, via este mesmo build empacotado com Tauri) ou no app
                mobile (Expo Go, iOS/Android) — abra por um dos dois para criar, editar e
                apagar tarefas, hábitos, metas e agenda de verdade.
              </ThemedText>
            </SectionCard>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (state.status === 'error') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.column}>
            <ThemedText type="smallBold">Não consegui preparar o banco local</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {state.message}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (state.status === 'loading') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="small" themeColor="textSecondary">
            preparando…
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return <DbProvider value={state.db}>{children}</DbProvider>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three, paddingHorizontal: Spacing.four },
});
