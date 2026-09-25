import { formatBRL } from '@kairo/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarChart } from '@/components/kairo/charts/bar-chart';
import { CalendarHeatmap } from '@/components/kairo/charts/calendar-heatmap';
import { DonutChart } from '@/components/kairo/charts/donut-chart';
import { SectionCard } from '@/components/kairo/section-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb } from '@/db/client';
import { syncFinance } from '@/db/finance-sync';
import { useFinanceDashboard } from '@/db/hooks';
import { getFinanceSyncConfig } from '@/db/sync-config';

/**
 * Dashboard financeiro — fecha a Fase 1. Só leitura: lê o espelho local
 * (`transactions`/`categories`, ver `finance-sync.ts`) e mostra as quatro
 * visualizações do plano original. Botão de sincronizar próprio, separado do
 * "Sincronizar" da tela Hoje (que é só de rotina) — ver PLANO.md.
 *
 * Vive fora de `app/` pelo mesmo motivo de `hoje-screen.tsx`
 * (github.com/expo/expo/issues/37752).
 */
export default function DashboardScreen() {
  const db = useDb();
  const data = useFinanceDashboard(db);
  const syncConfig = getFinanceSyncConfig();

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function handleSync() {
    if (!syncConfig || syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setSyncMessage(null);
    const outcome = await syncFinance(db, syncConfig);
    if (outcome.ok) {
      setSyncStatus('done');
      setSyncMessage(`${outcome.pulled} atualizado(s)`);
    } else {
      setSyncStatus('error');
      setSyncMessage(outcome.error);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.column}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <ThemedText type="link">← voltar</ThemedText>
              </Pressable>
              <View style={styles.titleRow}>
                <ThemedText type="title" style={styles.title}>
                  Dashboard
                </ThemedText>
                {syncConfig && (
                  <Pressable onPress={handleSync} disabled={syncStatus === 'syncing'} hitSlop={8}>
                    <ThemedText type="link" themeColor="textSecondary">
                      {syncStatus === 'syncing' ? 'Atualizando…' : 'Atualizar'}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              {syncMessage && (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={syncStatus === 'error' ? styles.syncError : undefined}>
                  {syncStatus === 'error' ? `Falha ao atualizar: ${syncMessage}` : syncMessage}
                </ThemedText>
              )}
            </View>

            {!data.hasAnyTransaction && (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                {syncConfig
                  ? 'Nenhuma transação ainda — toque em "Atualizar" pra trazer do Supabase.'
                  : 'Nenhuma transação local ainda, e a sincronização financeira não está configurada neste build.'}
              </ThemedText>
            )}

            <SectionCard title="Entradas x saídas">
              <BarChart data={data.monthly} />
            </SectionCard>

            <SectionCard title="Gasto médio mensal">
              <ThemedText type="money">{formatBRL(data.averageMonthlyCents)}</ThemedText>
            </SectionCard>

            <SectionCard title="Por categoria (mês atual)">
              <DonutChart data={data.categories} />
            </SectionCard>

            <SectionCard title="Calendário (mês atual)">
              <CalendarHeatmap data={data.daily} />
            </SectionCard>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  scroll: { flex: 1, alignSelf: 'stretch' },
  scrollContent: { alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.six },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  headerRow: { gap: Spacing.half },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, lineHeight: 34 },
  syncError: { color: '#e03131' },
  empty: { paddingVertical: Spacing.two },
});
