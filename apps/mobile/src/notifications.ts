import { eventReminderAt, shouldScheduleReminder, taskReminderAt } from '@kairo/core';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Wrapper fino sobre `expo-notifications` — módulo nativo, sem equivalente
 * testável em Node (diferente de Postgres/SQLite, que têm PGlite/better-sqlite3
 * como bancos reais e testáveis). O CÁLCULO de quando notificar é puro e
 * testado em `packages/core/src/reminders.ts`; aqui só a chamada de verdade
 * à API nativa — fina o bastante para não esconder lógica que valesse a
 * pena testar.
 *
 * Chamado a partir das telas (agenda-screen.tsx, tasks-screen.tsx), nunca de
 * `queries.ts` — mesma separação já usada para `useLiveQuery` em `hooks.ts`:
 * `queries.ts` fica puro (I/O de banco só), testável em Node sem o runtime
 * do Expo.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let androidChannelReady = false;

async function ensureAndroidChannel(): Promise<void> {
  if (androidChannelReady || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Lembretes',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  androidChannelReady = true;
}

/** Pede permissão só se ainda não foi concedida — sem repetir o prompt à toa. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

const taskReminderId = (taskId: string) => `task:${taskId}`;
const eventReminderId = (eventId: string) => `event:${eventId}`;

async function schedule(identifier: string, title: string, body: string, at: Date): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  if (!shouldScheduleReminder(at)) return; // prazo/horário já passou — não agenda pro passado

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

export async function cancelTaskReminder(taskId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(taskReminderId(taskId)).catch(() => {});
}

export async function cancelEventReminder(eventId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(eventReminderId(eventId)).catch(() => {});
}

/**
 * Reagenda o lembrete de uma tarefa a partir do prazo atual — chame de novo
 * a cada criação/edição. Sem prazo, cancela (idempotente: cancelar um
 * identificador que não existe não é erro, `expo-notifications` ignora).
 *
 * Erro aqui nunca deve travar o fluxo de quem chamou (criar/editar a
 * tarefa já aconteceu antes) — por isso o `catch` engole e só loga. Vale
 * ainda mais desde que este mesmo código passou a rodar também dentro do
 * Tauri (desktop), onde o comportamento real de `expo-notifications` nunca
 * foi validado fisicamente.
 */
export async function syncTaskReminder(task: { id: string; title: string; dueAt: Date | null }): Promise<void> {
  try {
    if (!task.dueAt) {
      await cancelTaskReminder(task.id);
      return;
    }
    const granted = await ensurePermission();
    if (!granted) return;
    await schedule(taskReminderId(task.id), task.title, 'Prazo agora', taskReminderAt(task.dueAt));
  } catch (err) {
    console.warn('syncTaskReminder falhou (ignorado — não é crítico):', err);
  }
}

/** Reagenda o lembrete de um evento, `minutesBefore` antes do início (padrão: 15). Mesma tolerância a erro de `syncTaskReminder`. */
export async function syncEventReminder(
  event: { id: string; title: string; startsAt: Date; allDay: boolean },
  minutesBefore = 15,
): Promise<void> {
  try {
    if (event.allDay) {
      await cancelEventReminder(event.id); // "dia inteiro" não tem um instante de início para contar antecedência
      return;
    }
    const granted = await ensurePermission();
    if (!granted) return;
    await schedule(
      eventReminderId(event.id),
      event.title,
      `Começa em ${minutesBefore} minutos`,
      eventReminderAt(event.startsAt, minutesBefore),
    );
  } catch (err) {
    console.warn('syncEventReminder falhou (ignorado — não é crítico):', err);
  }
}
