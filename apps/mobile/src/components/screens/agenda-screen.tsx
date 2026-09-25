import { eventsForDay, type CalendarEvent, type Task } from '@kairo/core';
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
import { useAllEvents, useAllTasks } from '@/db/hooks';
import { createEvent, deleteEvent, updateEvent } from '@/db/queries';
import { cancelEventReminder, syncEventReminder } from '@/notifications';

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function roundToNextHour(d: Date): Date {
  const copy = new Date(d);
  copy.setMinutes(0, 0, 0);
  copy.setHours(copy.getHours() + 1);
  return copy;
}

type FormState = {
  editingId: string | null;
  title: string;
  location: string;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
  taskId: string | null;
};

function blankForm(day: Date): FormState {
  const startsAt = roundToNextHour(day.getTime() < Date.now() ? new Date() : day);
  return {
    editingId: null,
    title: '',
    location: '',
    allDay: false,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 60 * 60_000),
    taskId: null,
  };
}

/**
 * Agenda — visão de um dia por vez, com navegação prev/próximo e "hoje".
 * Vive fora de `app/` pelo mesmo motivo de `hoje-screen.tsx`
 * (github.com/expo/expo/issues/37752).
 */
export default function AgendaScreen() {
  const db = useDb();
  const allEvents = useAllEvents(db);
  const allTasks = useAllTasks(db);
  const theme = useTheme();

  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [form, setForm] = useState<FormState>(() => blankForm(startOfDay(new Date())));

  const dayEvents = useMemo(() => eventsForDay(allEvents, selectedDay), [allEvents, selectedDay]);
  const today = useMemo(() => startOfDay(new Date()), []);
  const taskById = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);
  const linkableTasks = useMemo(
    () => allTasks.filter((t) => t.status === 'todo' || t.status === 'doing'),
    [allTasks],
  );

  function resetForm(day = selectedDay) {
    setForm(blankForm(day));
  }

  function startEdit(event: CalendarEvent) {
    setForm({
      editingId: event.id,
      title: event.title,
      location: event.location ?? '',
      allDay: event.allDay,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      taskId: event.taskId,
    });
  }

  async function handleSave() {
    const title = form.title.trim();
    if (!title) return;

    const startsAt = form.allDay ? startOfDay(form.startsAt) : form.startsAt;
    const endsAt = form.allDay ? addDays(startOfDay(form.startsAt), 1) : form.endsAt;

    if (form.editingId) {
      await updateEvent(db, form.editingId, {
        title,
        location: form.location,
        allDay: form.allDay,
        startsAt,
        endsAt,
        taskId: form.taskId,
      });
      await syncEventReminder({ id: form.editingId, title, startsAt, allDay: form.allDay });
    } else {
      const id = await createEvent(db, { title, location: form.location, allDay: form.allDay, startsAt, endsAt, taskId: form.taskId });
      await syncEventReminder({ id, title, startsAt, allDay: form.allDay });
    }
    resetForm();
  }

  function handleDelete(event: CalendarEvent) {
    Alert.alert('Apagar evento', `Apagar "${event.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await deleteEvent(db, event.id);
          await cancelEventReminder(event.id);
          if (form.editingId === event.id) resetForm();
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
              Agenda
            </ThemedText>
          </View>

          <View style={styles.dayNav}>
            <Pressable
              onPress={() => setSelectedDay((d) => addDays(d, -1))}
              hitSlop={8}
              style={styles.dayNavButton}>
              <ThemedText type="link">‹</ThemedText>
            </Pressable>
            <Pressable onPress={() => setSelectedDay(today)} hitSlop={8}>
              <ThemedText type="smallBold" style={styles.dayLabel}>
                {isSameDay(selectedDay, today) ? 'Hoje' : dayFmt.format(selectedDay)}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setSelectedDay((d) => addDays(d, 1))}
              hitSlop={8}
              style={styles.dayNavButton}>
              <ThemedText type="link">›</ThemedText>
            </Pressable>
          </View>

          <ThemedView type="backgroundElement" style={styles.addCard}>
            <TextInput
              value={form.title}
              onChangeText={(title) => setForm((f) => ({ ...f, title }))}
              placeholder="Novo evento…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              returnKeyType="next"
            />
            <TextInput
              value={form.location}
              onChangeText={(location) => setForm((f) => ({ ...f, location }))}
              placeholder="Local (opcional)"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              returnKeyType="done"
            />

            <View style={styles.allDayRow}>
              <ThemedText type="small">Dia inteiro</ThemedText>
              <Switch value={form.allDay} onValueChange={(allDay) => setForm((f) => ({ ...f, allDay }))} />
            </View>

            {!form.allDay && (
              <View style={styles.dtGroup}>
                <ThemedText type="small" themeColor="textSecondary">
                  Início
                </ThemedText>
                <DateTimeField value={form.startsAt} onChange={(startsAt) => setForm((f) => ({ ...f, startsAt }))} />

                <ThemedText type="small" themeColor="textSecondary">
                  Fim
                </ThemedText>
                <DateTimeField value={form.endsAt} onChange={(endsAt) => setForm((f) => ({ ...f, endsAt }))} />
              </View>
            )}

            {linkableTasks.length > 0 && (
              <View style={styles.dtGroup}>
                <ThemedText type="small" themeColor="textSecondary">
                  Vincular a uma tarefa (opcional)
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.taskChipRow}>
                    <Pressable
                      onPress={() => setForm((f) => ({ ...f, taskId: null }))}
                      style={[styles.chip, !form.taskId && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                      <ThemedText type="small" themeColor={!form.taskId ? 'onAccent' : 'text'}>
                        nenhuma
                      </ThemedText>
                    </Pressable>
                    {linkableTasks.map((t) => (
                      <Pressable
                        key={t.id}
                        onPress={() => setForm((f) => ({ ...f, taskId: t.id }))}
                        style={[styles.chip, form.taskId === t.id && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                        <ThemedText type="small" themeColor={form.taskId === t.id ? 'onAccent' : 'text'}>
                          {t.title}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            <View style={styles.chipRow}>
              {form.editingId && (
                <Pressable onPress={() => resetForm()} hitSlop={8}>
                  <ThemedText type="small" themeColor="textSecondary">
                    cancelar edição
                  </ThemedText>
                </Pressable>
              )}
              <Pressable
                onPress={handleSave}
                disabled={!form.title.trim()}
                style={[styles.addButton, { backgroundColor: theme.accent }, !form.title.trim() && styles.addButtonDisabled]}>
                <ThemedText type="smallBold" themeColor="onAccent">
                  {form.editingId ? 'Salvar' : 'Adicionar'}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {dayEvents.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Nada na agenda para este dia.
              </ThemedText>
            )}
            {dayEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                linkedTask={event.taskId ? taskById.get(event.taskId) : undefined}
                onPress={() => startEdit(event)}
                onDelete={() => handleDelete(event)}
              />
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function EventRow({
  event,
  linkedTask,
  onPress,
  onDelete,
}: {
  event: CalendarEvent;
  linkedTask: Task | undefined;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPress} style={styles.rowPressable} hitSlop={8}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.rowTime}>
          {event.allDay ? 'dia inteiro' : `${timeFmt.format(event.startsAt)}–${timeFmt.format(event.endsAt)}`}
        </ThemedText>
        <ThemedText style={styles.rowTitle}>{event.title}</ThemedText>
        {event.location && (
          <ThemedText type="small" themeColor="textSecondary">
            {event.location}
          </ThemedText>
        )}
        {linkedTask && (
          <ThemedText type="small" themeColor="textSecondary">
            ↳ {linkedTask.title}
          </ThemedText>
        )}
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
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  dayNavButton: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  dayLabel: { textTransform: 'capitalize', minWidth: 96, textAlign: 'center' },
  addCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  input: { fontSize: 16, paddingVertical: Spacing.two },
  allDayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dtGroup: { gap: Spacing.one },
  taskChipRow: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#868e96',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center', justifyContent: 'flex-end' },
  addButton: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  addButtonDisabled: { opacity: 0.4 },
  list: { flex: 1 },
  empty: { paddingVertical: Spacing.four, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.two, gap: Spacing.two },
  rowPressable: { flex: 1, gap: 2 },
  rowTime: { textTransform: 'uppercase' },
  rowTitle: { flexShrink: 1 },
});
