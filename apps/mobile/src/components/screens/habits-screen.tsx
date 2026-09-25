import { streakLabel, type Habit, type HabitFrequency } from '@kairo/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb } from '@/db/client';
import { useAllHabits } from '@/db/hooks';
import { createHabit, deleteHabit, toggleHabitToday } from '@/db/queries';

const FREQUENCIES: HabitFrequency[] = ['daily', 'weekly', 'times_per_week', 'monthly'];
const FREQUENCY_LABEL: Record<HabitFrequency, string> = {
  daily: 'diário',
  weekly: 'semanal',
  times_per_week: 'x/semana',
  monthly: 'mensal',
};

/**
 * CRUD de hábitos — real, lê e escreve no SQLite.
 * Vive fora de `app/` pelo mesmo motivo de `hoje-screen.tsx`
 * (github.com/expo/expo/issues/37752).
 */
export default function HabitsScreen() {
  const db = useDb();
  const allHabits = useAllHabits(db);
  const theme = useTheme();

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createHabit(db, { name: trimmed, frequency });
    setName('');
    setFrequency('daily');
  }

  function handleDelete(habit: Habit) {
    Alert.alert('Apagar hábito', `Apagar "${habit.name}" e todo o histórico?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => deleteHabit(db, habit.id) },
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
              Hábitos
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.addCard}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Novo hábito…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <View style={styles.chipRow}>
              {FREQUENCIES.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFrequency(f)}
                  style={[styles.chip, frequency === f && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                  <ThemedText type="small" themeColor={frequency === f ? 'onAccent' : 'text'}>
                    {FREQUENCY_LABEL[f]}
                  </ThemedText>
                </Pressable>
              ))}
              <Pressable
                onPress={handleAdd}
                disabled={!name.trim()}
                style={[styles.addButton, { backgroundColor: theme.accent }, !name.trim() && styles.addButtonDisabled]}>
                <ThemedText type="smallBold" themeColor="onAccent">
                  Adicionar
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {allHabits.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Nenhum hábito ainda.
              </ThemedText>
            )}
            {allHabits.map((habit) => (
              <View key={habit.id} style={styles.row}>
                <Pressable
                  onPress={() => toggleHabitToday(db, habit.id, habit.currentStreak)}
                  style={styles.habitPressable}
                  hitSlop={8}>
                  <ThemedText style={styles.rowTitle}>
                    {habit.doneToday ? '✓ ' : '· '}
                    {habit.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {streakLabel(habit.currentStreak)} · {FREQUENCY_LABEL[habit.frequency]}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => handleDelete(habit)} hitSlop={8}>
                  <ThemedText type="small" themeColor="textSecondary">
                    apagar
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  chip: { paddingVertical: Spacing.half, paddingHorizontal: Spacing.two, borderRadius: Spacing.three, borderWidth: 1, borderColor: '#868e96' },
  addButton: { marginLeft: 'auto', paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  addButtonDisabled: { opacity: 0.4 },
  list: { flex: 1 },
  empty: { paddingVertical: Spacing.four, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.two, gap: Spacing.two },
  habitPressable: { flex: 1, gap: 2 },
  rowTitle: { flexShrink: 1 },
});
