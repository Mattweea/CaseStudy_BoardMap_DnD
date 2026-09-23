import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUPPORTED_DICE,
  advantageProbability,
  criticalProbability,
  disadvantageProbability,
  resolveDiceRoll,
  rollUniformDie,
  singleDieModel,
  successProbability,
  sumDiceModel,
} from '../shared/dice-engine.mjs';

function queueUint32(values) {
  const queue = [...values];
  return () => {
    const value = queue.shift();
    if (value === undefined) throw new Error('uint32 queue exhausted');
    return value;
  };
}

function deterministicUint32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
}

test('rejection sampling drops the incomplete uint32 tail and supports every die', () => {
  const d100Limit = 0x1_0000_0000 - (0x1_0000_0000 % 100);
  assert.equal(rollUniformDie(100, queueUint32([d100Limit, 99])), 100);

  for (const sides of SUPPORTED_DICE) {
    assert.equal(rollUniformDie(sides, queueUint32([0])), 1);
    assert.equal(rollUniformDie(sides, queueUint32([sides - 1])), sides);
  }
});

test('the engine generates independent dice and coherent additive aggregates', () => {
  const result = resolveDiceRoll({
    groups: [
      { label: 'Danno', count: 2, sides: 6, modifier: 1 },
      { label: 'Fuoco', count: 1, sides: 4, modifier: 2 },
    ],
  }, { nextUint32: queueUint32([1, 5, 2]) });

  assert.deepEqual(result.rolls, [2, 6]);
  assert.deepEqual(result.keptRolls, [2, 6]);
  assert.equal(result.total, 9);
  assert.deepEqual(result.dice.map(({ value, disposition }) => [value, disposition]), [
    [2, 'kept'], [6, 'kept'], [3, 'kept'],
  ]);
  assert.equal(new Set(result.dice.map((die) => die.id)).size, 3);
  assert.notEqual(result.groups[0].groupId, result.groups[1].groupId);
});

test('advantage and disadvantage keep by index, including ties', () => {
  const advantage = resolveDiceRoll({ groups: [{ count: 1, sides: 20, modifier: 3 }], mode: 'advantage' }, {
    nextUint32: queueUint32([6, 15]),
  });
  assert.deepEqual(advantage.rolls, [7, 16]);
  assert.deepEqual(advantage.keptRolls, [16]);
  assert.deepEqual(advantage.dice.map((die) => die.disposition), ['discarded', 'kept']);
  assert.equal(advantage.total, 19);

  const tiedDisadvantage = resolveDiceRoll({ groups: [{ count: 1, sides: 20 }], mode: 'disadvantage' }, {
    nextUint32: queueUint32([8, 8]),
  });
  assert.deepEqual(tiedDisadvantage.keptRolls, [9]);
  assert.deepEqual(tiedDisadvantage.dice.map((die) => die.disposition), ['kept', 'discarded']);
});

test('unresolved d20 pairs preserve the first legacy result without claiming a selection', () => {
  const result = resolveDiceRoll({ groups: [{ count: 1, sides: 20, modifier: 4 }], mode: 'unresolved' }, {
    nextUint32: queueUint32([4, 17]),
  });
  assert.deepEqual(result.rolls, [5, 18]);
  assert.deepEqual(result.keptRolls, [5]);
  assert.equal(result.total, 9);
  assert.deepEqual(result.dice.map((die) => die.disposition), ['unresolved', 'unresolved']);
});

test('d100 remains one logical die', () => {
  const result = resolveDiceRoll({ groups: [{ count: 1, sides: 100 }] }, { nextUint32: queueUint32([99]) });
  assert.equal(result.dice.length, 1);
  assert.deepEqual(result.dice[0], {
    id: 'die-1', sides: 100, value: 100, groupId: 'group-1', disposition: 'kept',
  });
});

test('probability models expose exact means, variances, tails and boundary clamping', () => {
  assert.deepEqual(singleDieModel(20), { probability: 0.05, mean: 10.5, variance: 33.25 });
  assert.deepEqual(sumDiceModel(2, 6), { mean: 7, variance: 70 / 12 });
  assert.equal(successProbability(15, 5), 0.55);
  assert.equal(successProbability(50, 0), 0);
  assert.equal(successProbability(-5, 0), 1);
  assert.ok(Math.abs(successProbability(15, 5, 'advantage') - (1 - 0.45 ** 2)) < Number.EPSILON);
  assert.equal(successProbability(15, 5, 'disadvantage'), 0.55 ** 2);
  assert.equal(criticalProbability(20), 0.05);
  assert.equal(criticalProbability(25), 0);
  assert.equal(criticalProbability(0), 1);
});

const CHI_SQUARE_0001 = new Map([
  [3, 16.266], [5, 20.515], [7, 24.322], [9, 27.877], [11, 31.264], [19, 43.820], [99, 148.230],
]);

function sampleDistribution({ sides, probabilityFor, seed }) {
  const sampleSize = 200_000;
  const nextUint32 = deterministicUint32(seed);
  const counts = Array(sides).fill(0);
  let sum = 0;
  let squareSum = 0;
  for (let index = 0; index < sampleSize; index += 1) {
    const value = probabilityFor
      ? resolveDiceRoll({ groups: [{ count: 1, sides: 20 }], mode: probabilityFor === advantageProbability ? 'advantage' : 'disadvantage' }, { nextUint32 }).keptRolls[0]
      : rollUniformDie(sides, nextUint32);
    counts[value - 1] += 1;
    sum += value;
    squareSum += value ** 2;
  }
  return { sampleSize, counts, mean: sum / sampleSize, variance: squareSum / sampleSize - (sum / sampleSize) ** 2 };
}

function assertDistribution({ sides, probabilityFor, expectedMean, expectedVariance, seed }) {
  const sample = sampleDistribution({ sides, probabilityFor, seed });
  assert.ok(sample.counts.every((count) => count > 0), `d${sides} must cover every face`);
  const standardError = Math.sqrt(expectedVariance / sample.sampleSize);
  assert.ok(Math.abs(sample.mean - expectedMean) <= 5 * standardError);
  assert.ok(Math.abs(sample.variance - expectedVariance) / expectedVariance <= 0.02);

  const probability = probabilityFor ?? (() => 1 / sides);
  const chiSquare = sample.counts.reduce((sum, observed, index) => {
    const expected = sample.sampleSize * probability(index + 1);
    return sum + ((observed - expected) ** 2) / expected;
  }, 0);
  assert.ok(chiSquare < CHI_SQUARE_0001.get(sides - 1), `chi-square ${chiSquare} for ${sides} faces`);
}

test('fixed 200,000-sample suites match every uniform die and the closed d20 selection models', () => {
  SUPPORTED_DICE.forEach((sides, index) => {
    const model = singleDieModel(sides);
    assertDistribution({ sides, expectedMean: model.mean, expectedVariance: model.variance, seed: 100 + index });
  });

  assertDistribution({
    sides: 20, probabilityFor: advantageProbability, expectedMean: 13.825,
    expectedVariance: 22.194375, seed: 801,
  });
  assertDistribution({
    sides: 20, probabilityFor: disadvantageProbability, expectedMean: 7.175,
    expectedVariance: 22.194375, seed: 802,
  });
});
