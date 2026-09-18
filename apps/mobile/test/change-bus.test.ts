import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emitDbChange, onDbChange } from '../src/db/change-bus';

describe('change-bus', () => {
  it('chama os ouvintes inscritos quando o banco muda', () => {
    let calls = 0;
    const unsubscribe = onDbChange(() => calls++);

    emitDbChange();
    emitDbChange();

    assert.equal(calls, 2);
    unsubscribe();
  });

  it('para de chamar depois de cancelar a inscrição', () => {
    let calls = 0;
    const unsubscribe = onDbChange(() => calls++);
    unsubscribe();

    emitDbChange();

    assert.equal(calls, 0);
  });

  it('emitir sem nenhum ouvinte inscrito não lança erro', () => {
    assert.doesNotThrow(() => emitDbChange());
  });

  it('vários ouvintes independentes, cada um cancela sem afetar o outro', () => {
    let a = 0;
    let b = 0;
    const unsubscribeA = onDbChange(() => a++);
    onDbChange(() => b++);

    emitDbChange();
    unsubscribeA();
    emitDbChange();

    assert.equal(a, 1);
    assert.equal(b, 2);
  });
});
