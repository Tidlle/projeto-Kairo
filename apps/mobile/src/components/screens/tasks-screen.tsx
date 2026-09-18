import { topPriorityTasks, type Priority, type Task, type TaskStatus } from '@kairo/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateTimeField } from '@/components/kairo/date-time-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb } from '@/db/client';
import { useAllTasks } from '@/db/hooks';
import { createTask, cycleTaskStatus, deleteTask } from '@/db/queries';
import { cancelTaskReminder, syncTaskReminder } from '@/notifications';

const PRIORITY_COLOR: Record<Priority, string> = {
  high: '#e03131',
  medium: '#f08c00',
  low: '#2f9e44',
  none: '#868e96',
};

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high'];
const PRIORITY_LABEL: Record<Priority, string> = { none: 'sem', low: 'baixa', medium: 'média', high: 'alta' };

const STATUS_MARK: Record<Task['status'], string> = { todo: '○', doing: '◐', done: '✓', canceled: '×' };

/** Duplicado de propósito — mesmo motivo de PRIORITY_COLOR estar em duas telas: o cycle
 * precisa decidir aqui, antes do banco confirmar, se cancela ou reagenda o lembrete. */
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = { todo: 'doing', doing: 'done', done: 'todo', canceled: 'todo' };

function defaultDueDate(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

/**
 * CRUD de tarefas — real, lê e escreve no SQLite.
 * Vive fora de `app/` pelo mesmo motivo de `hoje-screen.tsx`: dentro de
 * `app/` o Expo Router carrega toda variante de plataforma via
 * require.context, ignorando `.web.tsx` (github.com/expo/expo/issues/37752).
 */
export default function TasksScreen() {
  const db = useDb();
  const allTasks = useAllTasks(db);
  const theme = useTheme();

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('none');
  const [hasDueDate, setHasDueDate] = useState(false);
  const [dueDate, setDueDate] = useState(defaultDueDate);

  const active = useMemo(
    () => topPriorityTasks(allTasks, allTasks.length),
    [allTasks],
  );
  const done = useMemo(() => allTasks.filter((t) => t.status === 'done'), [allTasks]);

  async function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed) return;
    const dueAt = hasDueDate ? dueDate : null;
    const id = await createTask(db, { title: trimmed, priority, dueAt });
    if (dueAt) await syncTaskReminder({ id, title: trimmed, dueAt });
    setTitle('');
    setPriority('none');
    setHasDueDate(false);
    setDueDate(defaultDueDate());
  }

  async function handleCycle(task: Task) {
    const nextStatus = NEXT_STATUS[task.status];
    await cycleTaskStatus(db, task.id, task.status);
    if (nextStatus === 'done' || nextStatus === 'canceled') {
      await cancelTaskReminder(task.id);
    } else if (task.dueAt) {
      await syncTaskReminder({ id: task.id, title: task.title, dueAt: task.dueAt });
    }
  }

  function handleDelete(task: Task) {
    Alert.alert('Apagar tarefa', `Apagar "${task.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(db, task.id);
          await cancelTaskReminder(task.id);
        },
      },
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
              Tarefas
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.addCard}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Nova tarefa…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <View style={styles.dueRow}>
              <ThemedText type="small">Prazo com lembrete</ThemedText>
              <Switch value={hasDueDate} onValueChange={setHasDueDate} />
            </View>
            {hasDueDate && <DateTimeField value={dueDate} onChange={setDueDate} />}

            <View style={styles.chipRow}>
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[
                    styles.chip,
                    { borderColor: PRIORITY_COLOR[p] },
                    priority === p && { backgroundColor: PRIORITY_COLOR[p] },
                  ]}>
                  <ThemedText type="small" themeColor={priority === p ? 'background' : 'text'}>
                    {PRIORITY_LABEL[p]}
                  </ThemedText>
                </Pressable>
              ))}
              <Pressable
                onPress={handleAdd}
                disabled={!title.trim()}
                style={[styles.addButton, !title.trim() && styles.addButtonDisabled]}>
                <ThemedText type="smallBold" themeColor="background">
                  Adicionar
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {active.length === 0 && done.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Nenhuma tarefa ainda.
              </ThemedText>
            )}

            {active.map((task) => (
              <TaskRow key={task.id} task={task} onCycle={() => handleCycle(task)} onDelete={() => handleDelete(task)} />
            ))}

            {done.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.doneLabel}>
                CONCLUÍDAS
              </ThemedText>
            )}
            {done.map((task) => (
              <TaskRow key={task.id} task={task} onCycle={() => handleCycle(task)} onDelete={() => handleDelete(task)} />
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const dueFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function TaskRow({ task, onCycle, onDelete }: { task: Task; onCycle: () => void; onDelete: () => void }) {
  const done = task.status === 'done';
  return (
    <View style={styles.row}>
      <Pressable onPress={onCycle} style={styles.statusPressable} hitSlop={8}>
        <ThemedText style={{ color: PRIORITY_COLOR[task.priority] }}>{STATUS_MARK[task.status]}</ThemedText>
        <View style={styles.taskTextGroup}>
          <ThemedText style={[styles.rowTitle, done && styles.rowTitleDone]} themeColor={done ? 'textSecondary' : 'text'}>
            {task.title}
          </ThemedText>
          {task.dueAt && (
            <ThemedText type="small" themeColor="textSecondary">
              {dueFmt.format(task.dueAt)}
            </ThemedText>
          )}
        </View>
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8}>
        <ThemedText type="small" themeColor="textSecondary">
          apagar
        </ThemedText>
      </Pressable>
    </View>
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
  dueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  chip: { paddingVertical: Spacing.half, paddingHorizontal: Spacing.two, borderRadius: Spacing.three, borderWidth: 1 },
  addButton: { marginLeft: 'auto', backgroundColor: '#3c87f7', paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  addButtonDisabled: { opacity: 0.4 },
  list: { flex: 1 },
  empty: { paddingVertical: Spacing.four, textAlign: 'center' },
  doneLabel: { textTransform: 'uppercase', marginTop: Spacing.three, marginBottom: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.two, gap: Spacing.two },
  statusPressable: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 1 },
  taskTextGroup: { flexShrink: 1, gap: 2 },
  rowTitle: { flexShrink: 1 },
  rowTitleDone: { textDecorationLine: 'line-through' },
});
