import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthoritativeRoll, parseRollFormula } from '../server/authoritative-roll.mjs';

const user = { id: 'player-1', username: 'vesuth', displayName: 'Vesuth' };

function queueUint32(values) {
  const queue = [...values];
  return () => {
    const value = queue.shift();
    if (value === undefined) throw new Error('uint32 queue exhausted');
    return value;
  };
}

const stableMetadata = { createId: () => 'roll-1', now: () => '2026-09-23T10:00:00.000Z' };

test('free rolls use the shared engine for normal, advantage, disadvantage and d100 results', () => {
  const normal = createAuthoritativeRoll(user, { formula: '2d6+1', visibility: 'public' }, {
    ...stableMetadata, nextUint32: queueUint32([1, 5]),
  });
  assert.deepEqual(normal.log.rolls, [2, 6]);
  assert.deepEqual(normal.log.keptRolls, [2, 6]);
  assert.equal(normal.log.total, 9);
  assert.deepEqual(normal.log.dice.map((die) => die.disposition), ['kept', 'kept']);

  const advantage = createAuthoritativeRoll(user, { formula: '1d20', mode: 'advantage', visibility: 'secret' }, {
    ...stableMetadata, nextUint32: queueUint32([6, 15]),
  });
  assert.deepEqual(advantage.log.keptRolls, [16]);
  assert.deepEqual(advantage.log.dice.map((die) => die.disposition), ['discarded', 'kept']);

  const tiedDisadvantage = createAuthoritativeRoll(user, { formula: '1d20', mode: 'disadvantage', visibility: 'public' }, {
    ...stableMetadata, nextUint32: queueUint32([8, 8]),
  });
  assert.deepEqual(tiedDisadvantage.log.dice.map((die) => die.disposition), ['kept', 'discarded']);

  const percentile = createAuthoritativeRoll(user, { formula: '1d100', visibility: 'public' }, {
    ...stableMetadata, nextUint32: queueUint32([99]),
  });
  assert.deepEqual(percentile.log.dice, [
    { id: 'die-1', sides: 100, value: 100, groupId: 'group-1', disposition: 'kept' },
  ]);
});

test('client-proposed outcomes, identities and seeds never enter an authoritative log', () => {
  const result = createAuthoritativeRoll(user, {
    formula: '1d20', visibility: 'public', rolls: [20], keptRolls: [20], total: 999,
    dice: [{ id: 'forged', sides: 20, value: 20, groupId: 'forged', disposition: 'kept' }],
    id: 'forged', authorUserId: 'master-1', seed: 123,
  }, { ...stableMetadata, nextUint32: queueUint32([2]) });

  assert.equal(result.log.id, 'roll-1');
  assert.equal(result.log.authorUserId, 'player-1');
  assert.deepEqual(result.log.rolls, [3]);
  assert.equal(result.log.total, 3);
  assert.equal('seed' in result.log, false);
});

test('formula and mode validation remains compatible', () => {
  assert.ok(parseRollFormula('0d20').error);
  assert.ok(parseRollFormula('21d6').error);
  assert.ok(parseRollFormula('1d3').error);
  assert.ok(parseRollFormula('1d20+1001').error);
  assert.ok(createAuthoritativeRoll(user, { formula: '2d6', mode: 'advantage', visibility: 'public' }).error);
  assert.ok(createAuthoritativeRoll(user, { formula: '1d20' }).error);
});
