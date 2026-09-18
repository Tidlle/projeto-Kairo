import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { eventReminderAt, shouldScheduleReminder, taskReminderAt } from '../src/reminders.ts';

describe('taskReminderAt', () => {
  it('notifica no próprio instante do prazo', () => {
    const dueAt = new Date('2026-09-10T09:00:00');
    assert.equal(taskReminderAt(dueAt).getTime(), dueAt.getTime());
  });
});

describe('eventReminderAt', () => {
  it('padrão: 15 minutos antes do início', () => {
    const startsAt = new Date('2026-09-10T09:00:00');
    assert.equal(eventReminderAt(startsAt).getTime(), new Date('2026-09-10T08:45:00').getTime());
  });

  it('aceita antecedência customizada', () => {
    const startsAt = new Date('2026-09-10T09:00:00');
    assert.equal(eventReminderAt(startsAt, 60).getTime(), new Date('2026-09-10T08:00:00').getTime());
  });
});

describe('shouldScheduleReminder', () => {
  it('agenda quando o lembrete está no futuro', () => {
    const now = new Date('2026-09-10T08:00:00');
    assert.equal(shouldScheduleReminder(new Date('2026-09-10T08:01:00'), now), true);
  });

  it('não agenda quando o lembrete já passou', () => {
    const now = new Date('2026-09-10T08:00:00');
    assert.equal(shouldScheduleReminder(new Date('2026-09-10T07:59:00'), now), false);
  });

  it('não agenda no instante exato de agora', () => {
    const now = new Date('2026-09-10T08:00:00');
    assert.equal(shouldScheduleReminder(new Date('2026-09-10T08:00:00'), now), false);
  });
});
