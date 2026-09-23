import assert from 'node:assert/strict';
import test from 'node:test';
import { rollDice, rollSingleDie } from '../src/utils/dice.ts';

test('browser dice utilities preserve their public shape while delegating to the shared engine', () => {
  const normal = rollDice(6, 2, 3, 'normal');
  assert.equal(normal.rolls.length, 2);
  assert.deepEqual(normal.keptRolls, normal.rolls);
  assert.equal(normal.total, normal.rolls[0] + normal.rolls[1] + 3);
  assert.equal(normal.label, '2d6+3');

  const advantage = rollDice(20, 1, -1, 'advantage');
  assert.equal(advantage.rolls.length, 2);
  assert.equal(advantage.keptRolls[0], Math.max(...advantage.rolls));
  assert.equal(advantage.total, advantage.keptRolls[0] - 1);

  for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
    const value = rollSingleDie(sides);
    assert.ok(value >= 1 && value <= sides);
  }
});
