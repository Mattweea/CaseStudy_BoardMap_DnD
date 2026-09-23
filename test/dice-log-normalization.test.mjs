import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDiceDetail, normalizeDiceLogDetail } from '../shared/dice-log-normalization.mjs';

const validDice = [
  { id: 'die-1', sides: 20, value: 12, groupId: 'group-1', disposition: 'kept' },
  { id: 'die-2', sides: 20, value: 4, groupId: 'group-1', disposition: 'discarded' },
];

test('legacy logs remain untouched when dice detail is absent', () => {
  assert.deepEqual(normalizeDiceLogDetail({ id: 'legacy', rolls: [12] }), { id: 'legacy', rolls: [12] });
});

test('a wholly valid detail list is preserved', () => {
  assert.deepEqual(normalizeDiceDetail(validDice), validDice);
});

test('one malformed or duplicate die drops the whole additive detail, not the legacy log', () => {
  const malformed = [...validDice, { ...validDice[0], value: 99 }];
  assert.deepEqual(normalizeDiceLogDetail({ id: 'log-1', rolls: [12], dice: malformed }), {
    id: 'log-1', rolls: [12],
  });
  assert.equal(normalizeDiceDetail([{ ...validDice[0] }, { ...validDice[0] }]), undefined);
});
