import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  eventsForDay,
  goalProgressPct,
  monthsToGoal,
  needsAttention,
  pickMainGoal,
  streakLabel,
  topPriorityTasks,
  type CalendarEvent,
  type ConnectionHealth,
  type Goal,
  type Task,
} from '../src/domain.ts';

const task = (over: Partial<Task>): Task => ({
  id: 'x',
  title: 'Tarefa',
  status: 'todo',
  priority: 'none',
  dueAt: null,
  estimatedCostCents: null,
  ...over,
});

describe('topPriorityTasks', () => {
  it('ordena por prioridade, alta primeiro', () => {
    const tasks = [task({ id: 'a', priority: 'low' }), task({ id: 'b', priority: 'high' })];
    assert.deepEqual(
      topPriorityTasks(tasks).map((t) => t.id),
      ['b', 'a'],
    );
  });

  it('empate de prioridade desempata por prazo mais próximo', () => {
    const tasks = [
      task({ id: 'longe', priority: 'medium', dueAt: new Date('2026-09-10') }),
      task({ id: 'perto', priority: 'medium', dueAt: new Date('2026-08-27') }),
    ];
    assert.deepEqual(
      topPriorityTasks(tasks).map((t) => t.id),
      ['perto', 'longe'],
    );
  });

  it('tarefa sem prazo fica depois de quem tem prazo, na mesma prioridade', () => {
    const tasks = [
      task({ id: 'sem-prazo', priority: 'high', dueAt: null }),
      task({ id: 'com-prazo', priority: 'high', dueAt: new Date('2026-08-30') }),
    ];
    assert.deepEqual(
      topPriorityTasks(tasks).map((t) => t.id),
      ['com-prazo', 'sem-prazo'],
    );
  });

  it('exclui tarefas concluídas ou canceladas', () => {
    const tasks = [task({ id: 'feita', status: 'done' }), task({ id: 'a-fazer', status: 'todo' })];
    assert.deepEqual(
      topPriorityTasks(tasks).map((t) => t.id),
      ['a-fazer'],
    );
  });

  it('respeita o limite', () => {
    const tasks = [task({ id: '1' }), task({ id: '2' }), task({ id: '3' }), task({ id: '4' })];
    assert.equal(topPriorityTasks(tasks, 2).length, 2);
  });
});

describe('goalProgressPct', () => {
  it('calcula a porcentagem simples', () => {
    assert.equal(goalProgressPct({ targetCents: 80_000_00, savedCents: 35_000_00 }), 44);
  });

  it('nunca passa de 100 mesmo se guardou mais que a meta', () => {
    assert.equal(goalProgressPct({ targetCents: 1000, savedCents: 5000 }), 100);
  });

  it('meta com alvo zero não divide por zero', () => {
    assert.equal(goalProgressPct({ targetCents: 0, savedCents: 500 }), 0);
  });
});

describe('monthsToGoal', () => {
  it('projeta os meses restantes no ritmo atual — caso real do TrilhaIA', () => {
    // R$ 800 mil de meta, R$ 350 mil guardados, R$ 5 mil/mês → 90 meses
    const goal = { targetCents: 800_000_00, savedCents: 350_000_00, monthlyContributionCents: 5_000_00 };
    assert.equal(monthsToGoal(goal), 90);
  });

  it('retorna null sem aporte definido', () => {
    assert.equal(monthsToGoal({ targetCents: 1000, savedCents: 0, monthlyContributionCents: null }), null);
  });

  it('retorna 0 quando a meta já foi atingida', () => {
    assert.equal(monthsToGoal({ targetCents: 1000, savedCents: 1000, monthlyContributionCents: 100 }), 0);
  });
});

describe('streakLabel', () => {
  it('singular em 1 dia', () => {
    assert.equal(streakLabel(1), '1 dia seguido');
  });

  it('plural para mais de um dia', () => {
    assert.equal(streakLabel(5), '5 dias seguidos');
  });

  it('convite a começar quando o streak é zero', () => {
    assert.equal(streakLabel(0), 'comece hoje');
  });
});

describe('pickMainGoal', () => {
  const goal = (over: Partial<Goal>): Goal => ({
    id: 'g',
    name: 'Meta',
    targetCents: 1000,
    savedCents: 0,
    monthlyContributionCents: null,
    status: 'active',
    ...over,
  });

  it('escolhe a primeira meta ativa', () => {
    const goals = [goal({ id: 'pausada', status: 'paused' }), goal({ id: 'ativa', status: 'active' })];
    assert.equal(pickMainGoal(goals)?.id, 'ativa');
  });

  it('retorna null sem nenhuma meta ativa', () => {
    assert.equal(pickMainGoal([goal({ status: 'achieved' })]), null);
  });

  it('retorna null com lista vazia', () => {
    assert.equal(pickMainGoal([]), null);
  });
});

describe('needsAttention', () => {
  const conn = (over: Partial<ConnectionHealth>): ConnectionHealth => ({
    connectorName: 'Banco',
    status: 'UPDATED',
    daysSinceSync: 0,
    ...over,
  });

  it('sinaliza status diferente de UPDATED', () => {
    const result = needsAttention([conn({ status: 'LOGIN_ERROR' })]);
    assert.equal(result.length, 1);
  });

  it('sinaliza mais de 3 dias sem sync mesmo com status UPDATED', () => {
    const result = needsAttention([conn({ daysSinceSync: 4 })]);
    assert.equal(result.length, 1);
  });

  it('não sinaliza conexão saudável', () => {
    const result = needsAttention([conn({ daysSinceSync: 1 })]);
    assert.equal(result.length, 0);
  });
});

describe('eventsForDay', () => {
  const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
    id: 'e',
    title: 'Evento',
    location: null,
    startsAt: new Date('2026-09-04T10:00:00'),
    endsAt: new Date('2026-09-04T11:00:00'),
    allDay: false,
    taskId: null,
    ...over,
  });

  it('inclui evento que começa e termina dentro do dia', () => {
    const result = eventsForDay([event({ id: 'a' })], new Date('2026-09-04T00:00:00'));
    assert.deepEqual(result.map((e) => e.id), ['a']);
  });

  it('exclui evento de outro dia', () => {
    const result = eventsForDay(
      [event({ id: 'a', startsAt: new Date('2026-09-05T10:00:00'), endsAt: new Date('2026-09-05T11:00:00') })],
      new Date('2026-09-04T00:00:00'),
    );
    assert.equal(result.length, 0);
  });

  it('inclui evento que atravessa a meia-noite, no dia anterior e no seguinte', () => {
    const overnight = event({
      id: 'noturno',
      startsAt: new Date('2026-09-04T23:00:00'),
      endsAt: new Date('2026-09-05T01:00:00'),
    });
    assert.equal(eventsForDay([overnight], new Date('2026-09-04T00:00:00')).length, 1);
    assert.equal(eventsForDay([overnight], new Date('2026-09-05T00:00:00')).length, 1);
  });

  it('ordena dia inteiro primeiro, depois por horário de início', () => {
    const result = eventsForDay(
      [
        event({ id: 'tarde', startsAt: new Date('2026-09-04T15:00:00'), endsAt: new Date('2026-09-04T16:00:00') }),
        event({ id: 'inteiro', allDay: true, startsAt: new Date('2026-09-04T00:00:00'), endsAt: new Date('2026-09-05T00:00:00') }),
        event({ id: 'manha', startsAt: new Date('2026-09-04T08:00:00'), endsAt: new Date('2026-09-04T09:00:00') }),
      ],
      new Date('2026-09-04T00:00:00'),
    );
    assert.deepEqual(result.map((e) => e.id), ['inteiro', 'manha', 'tarde']);
  });

  it('não inclui evento que termina exatamente no início do dia', () => {
    const result = eventsForDay(
      [event({ id: 'a', startsAt: new Date('2026-09-03T23:00:00'), endsAt: new Date('2026-09-04T00:00:00') })],
      new Date('2026-09-04T00:00:00'),
    );
    assert.equal(result.length, 0);
  });
});
