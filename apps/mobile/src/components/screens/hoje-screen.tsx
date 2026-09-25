import { eventsForDay, formatBRL, goalProgressPct, monthsToGoal, needsAttention, streakLabel, type Priority } from '@kairo/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/kairo/progress-bar';
import { SectionCard } from '@/components/kairo/section-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb } from '@/db/client';
import { useAllEvents, useDailyBrief } from '@/db/hooks';
import { toggleHabitToday } from '@/db/queries';
import { getSyncConfig } from '@/db/sync-config';
import { syncRoutine } from '@/db/sync';

// "média" usa o azul antigo da marca, de propósito: o laranja colidia
// visualmente com o novo acento âmbar (a mesma cor não pode significar
// "prioridade média" E "isso é clicável/é a marca" ao mesmo tempo).
const PRIORITY_COLOR: Record<Priority, string> = {
  high: '#e03131',
  medium: '#3c87f7',
  low: '#2f9e44',
  none: '#868e96',
};

function greeting(hour: number): string {
  if (hour < 5) return 'Boa madrugada';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

const dateLabel = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date());

/**
 * Implementação real da tela "Hoje" — lê e escreve no SQLite local.
 *
 * Vive aqui, fora de `app/`, de propósito: dentro de `app/` o Expo Router
 * carrega TODAS as variantes de plataforma de um arquivo via `require.context`
 * (bug conhecido: github.com/expo/expo/issues/37752 — `.web.tsx` é ignorado
 * nas rotas). Fora de `app/`, a resolução por plataforma do Metro funciona
 * normalmente — mesmo mecanismo já usado em `app-tabs.tsx`/`app-tabs.web.tsx`.
 * `app/index.tsx` só reexporta esta ou a versão `.web` deste arquivo.
 */
const eventTimeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function HojeScreen() {
  const db = useDb();
  const brief = useDailyBrief(db);
  const tasks = brief.topTasks; // já filtradas e ordenadas em useDailyBrief
  const alerts = needsAttention(brief.staleConnections);
  const goal = brief.mainGoal;
  const monthsLeft = goal ? monthsToGoal(goal) : null;
  const todaysEvents = eventsForDay(useAllEvents(db), new Date());

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const syncConfig = getSyncConfig();

  async function handleSync() {
    if (!syncConfig || syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setSyncMessage(null);
    const outcome = await syncRoutine(db, syncConfig);
    if (outcome.ok) {
      setSyncStatus('done');
      setSyncMessage(`${outcome.pushed} enviado(s), ${outcome.pulled} recebido(s)`);
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
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <View style={styles.headerText}>
                  <ThemedText type="title" style={styles.greeting}>
                    {greeting(new Date().getHours())}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.date}>
                    {dateLabel}
                  </ThemedText>
                </View>
                {syncConfig && (
                  <Pressable
                    onPress={handleSync}
                    disabled={syncStatus === 'syncing'}
                    style={styles.syncButton}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {syncStatus === 'syncing' ? 'Sincronizando…' : 'Sincronizar'}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              {syncMessage && (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={syncStatus === 'error' ? styles.syncError : undefined}>
                  {syncStatus === 'error' ? `Falha ao sincronizar: ${syncMessage}` : syncMessage}
                </ThemedText>
              )}
            </View>

            {alerts.length > 0 && (
              <SectionCard title="Precisa de atenção">
                {alerts.map((a) => (
                  <ThemedText key={a.connectorName} type="small">
                    ⚠ {a.connectorName} — {a.daysSinceSync} dias sem sincronizar
                  </ThemedText>
                ))}
              </SectionCard>
            )}

            <SectionCard title="Saldo">
              <ThemedText type="money">{formatBRL(brief.balanceCents)}</ThemedText>
            </SectionCard>

            {brief.dueToday.length > 0 && (
              <SectionCard title="Vence hoje">
                {brief.dueToday.map((item, i) => (
                  <View key={i} style={styles.row}>
                    <ThemedText>{item.label}</ThemedText>
                    <ThemedText themeColor="textSecondary">{formatBRL(item.amountCents)}</ThemedText>
                  </View>
                ))}
              </SectionCard>
            )}

            <SectionCard title="Agenda" actionLabel="ver agenda" onPressAction={() => router.push('/agenda')}>
              {todaysEvents.length === 0 && (
                <ThemedText themeColor="textSecondary">Nada marcado para hoje.</ThemedText>
              )}
              {todaysEvents.map((event) => (
                <View key={event.id} style={styles.row}>
                  <ThemedText style={styles.taskTitle}>{event.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {event.allDay ? 'dia inteiro' : eventTimeFmt.format(event.startsAt)}
                  </ThemedText>
                </View>
              ))}
            </SectionCard>

            <SectionCard title="Prioridades" actionLabel="ver todas" onPressAction={() => router.push('/tasks')}>
              {tasks.length === 0 && (
                <ThemedText themeColor="textSecondary">Nada pendente — bom sinal.</ThemedText>
              )}
              {tasks.map((task) => (
                <View key={task.id} style={styles.row}>
                  <View style={styles.taskLabel}>
                    <View style={[styles.dot, { backgroundColor: PRIORITY_COLOR[task.priority] }]} />
                    <ThemedText style={styles.taskTitle}>{task.title}</ThemedText>
                  </View>
                  {task.estimatedCostCents != null && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatBRL(task.estimatedCostCents)}
                    </ThemedText>
                  )}
                </View>
              ))}
            </SectionCard>

            <SectionCard title="Hábitos" actionLabel="ver todos" onPressAction={() => router.push('/habits')}>
              {brief.habits.map((habit) => (
                <Pressable
                  key={habit.id}
                  style={styles.row}
                  onPress={() => toggleHabitToday(db, habit.id, habit.currentStreak)}>
                  <ThemedText style={styles.taskTitle}>
                    {habit.doneToday ? '✓ ' : '· '}
                    {habit.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {streakLabel(habit.currentStreak)}
                  </ThemedText>
                </Pressable>
              ))}
            </SectionCard>

            {goal && (
              <SectionCard title="Meta principal" actionLabel="editar" onPressAction={() => router.push('/goals')}>
                <ThemedText type="smallBold">{goal.name}</ThemedText>
                <ProgressBar percent={goalProgressPct(goal)} />
                <View style={styles.row}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatBRL(goal.savedCents)} de {formatBRL(goal.targetCents)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {goalProgressPct(goal)}%
                  </ThemedText>
                </View>
                {monthsLeft != null && monthsLeft > 0 && (
                  <ThemedText type="small">
                    No ritmo atual, faltam <ThemedText type="smallBold">{monthsLeft} meses</ThemedText>
                  </ThemedText>
                )}
              </SectionCard>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    // Na web, a barra de abas flutuante (app-tabs.web.tsx) é `position: absolute`
    // por cima do conteúdo — sem esse respiro extra ela cobre a saudação.
    paddingTop: Platform.select({ web: Spacing.six, default: Spacing.four }),
    paddingBottom: Spacing.six,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.half,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  headerText: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  greeting: {
    fontSize: 32,
    lineHeight: 38,
  },
  date: {
    textTransform: 'capitalize',
  },
  syncButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  syncError: {
    color: '#e03131',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  taskLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  taskTitle: {
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
