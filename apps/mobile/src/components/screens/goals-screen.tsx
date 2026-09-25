import { formatBRL, goalProgressPct, monthsToGoal, type Goal } from '@kairo/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/kairo/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb } from '@/db/client';
import { useAllGoals } from '@/db/hooks';
import { contributeToGoal, createGoal, deleteGoal } from '@/db/queries';

/** Converte "1.234,56" ou "1234.56" ou "1234" em centavos. Vazio/inválido → null. */
function parseBRLToCents(text: string): number | null {
  const normalized = text.trim().replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  if (!normalized || Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

const STATUS_LABEL: Record<Goal['status'], string> = {
  active: 'ativa',
  achieved: 'conquistada',
  paused: 'pausada',
  abandoned: 'abandonada',
};

/**
 * CRUD de metas — real, lê e escreve no SQLite.
 * Vive fora de `app/` pelo mesmo motivo de `hoje-screen.tsx`
 * (github.com/expo/expo/issues/37752).
 */
export default function GoalsScreen() {
  const db = useDb();
  const allGoals = useAllGoals(db);
  const theme = useTheme();

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [monthly, setMonthly] = useState('');

  async function handleAdd() {
    const targetCents = parseBRLToCents(target);
    if (!name.trim() || !targetCents) return;
    await createGoal(db, {
      name: name.trim(),
      targetCents,
      monthlyContributionCents: parseBRLToCents(monthly) ?? undefined,
    });
    setName('');
    setTarget('');
    setMonthly('');
  }

  function handleDelete(goal: Goal) {
    Alert.alert('Apagar meta', `Apagar "${goal.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => deleteGoal(db, goal.id) },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.column}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ThemedText type="link">← voltar</ThemedText>
            </Pressable>
            <ThemedText type="title" style={styles.title}>
              Metas
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.addCard}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nome da meta…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
            />
            <View style={styles.row}>
              <TextInput
                value={target}
                onChangeText={setTarget}
                placeholder="Valor alvo (R$)"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                style={[styles.input, styles.inputHalf, { color: theme.text }]}
              />
              <TextInput
                value={monthly}
                onChangeText={setMonthly}
                placeholder="Aporte/mês (opcional)"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                style={[styles.input, styles.inputHalf, { color: theme.text }]}
              />
            </View>
            <Pressable
              onPress={handleAdd}
              disabled={!name.trim() || !parseBRLToCents(target)}
              style={[styles.addButton, { backgroundColor: theme.accent }, (!name.trim() || !parseBRLToCents(target)) && styles.addButtonDisabled]}>
              <ThemedText type="smallBold" themeColor="onAccent">
                Adicionar
              </ThemedText>
            </Pressable>
          </ThemedView>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {allGoals.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Nenhuma meta ainda.
              </ThemedText>
            )}
            {allGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onDelete={() => handleDelete(goal)} />
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: () => void }) {
  const db = useDb();
  const theme = useTheme();
  const [amount, setAmount] = useState('');
  const monthsLeft = monthsToGoal(goal);

  async function handleContribute() {
    const cents = parseBRLToCents(amount);
    if (!cents) return;
    await contributeToGoal(db, goal.id, cents);
    setAmount('');
  }

  return (
    <ThemedView type="backgroundElement" style={styles.goalCard}>
      <View style={styles.row}>
        <ThemedText type="smallBold" style={styles.goalTitle}>
          {goal.name}
        </ThemedText>
        <Pressable onPress={onDelete} hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            apagar
          </ThemedText>
        </Pressable>
      </View>

      <ProgressBar percent={goalProgressPct(goal)} />

      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          {formatBRL(goal.savedCents)} de {formatBRL(goal.targetCents)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {goalProgressPct(goal)}% · {STATUS_LABEL[goal.status]}
        </ThemedText>
      </View>

      {monthsLeft != null && monthsLeft > 0 && goal.status === 'active' && (
        <ThemedText type="small">
          No ritmo atual, faltam <ThemedText type="smallBold">{monthsLeft} meses</ThemedText>
        </ThemedText>
      )}

      {goal.status === 'active' && (
        <View style={styles.row}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Aportar (R$)…"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            style={[styles.input, styles.contributeInput, { color: theme.text }]}
            onSubmitEditing={handleContribute}
          />
          <Pressable onPress={handleContribute} disabled={!parseBRLToCents(amount)} style={styles.contributeButton}>
            <ThemedText type="small" themeColor="onAccent">
              aportar
            </ThemedText>
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  column: { width: '100%', maxWidth: MaxContentWidth, flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
  headerRow: { paddingTop: Spacing.three, gap: Spacing.two },
  title: { fontSize: 28, lineHeight: 34 },
  addCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  input: { fontSize: 16, paddingVertical: Spacing.two },
  inputHalf: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  addButton: { alignSelf: 'flex-start', paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  addButtonDisabled: { opacity: 0.4 },
  list: { flex: 1 },
  empty: { paddingVertical: Spacing.four, textAlign: 'center' },
  goalCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two, marginBottom: Spacing.two },
  goalTitle: { flexShrink: 1 },
  contributeInput: { flex: 1, paddingVertical: Spacing.one },
  contributeButton: { backgroundColor: '#2f9e44', paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
});
