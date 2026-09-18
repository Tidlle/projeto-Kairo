import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isNewer } from '../src/sync-protocol.ts';

describe('isNewer', () => {
  it('linha recebida vence quando não existe versão local', () => {
    assert.equal(isNewer({ updatedAt: '2026-09-03T10:00:00.000Z' }, undefined), true);
  });

  it('linha recebida mais nova vence', () => {
    const local = { updatedAt: '2026-09-03T10:00:00.000Z' };
    const incoming = { updatedAt: '2026-09-03T10:00:01.000Z' };
    assert.equal(isNewer(incoming, local), true);
  });

  it('linha local mais nova vence — recebida é descartada', () => {
    const local = { updatedAt: '2026-09-03T10:00:01.000Z' };
    const incoming = { updatedAt: '2026-09-03T10:00:00.000Z' };
    assert.equal(isNewer(incoming, local), false);
  });

  it('empate não sobrescreve — evita escrita sem necessidade', () => {
    const same = { updatedAt: '2026-09-03T10:00:00.000Z' };
    assert.equal(isNewer(same, same), false);
  });
});
