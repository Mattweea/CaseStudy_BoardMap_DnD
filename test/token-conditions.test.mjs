import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CREATURE_CONDITIONS,
  SPEED_ZERO_CONDITIONS,
  VEHICLE_CONDITIONS,
  conditionCatalogFor,
  effectiveSpeed,
  movementBudget,
  normalizeConditionsForType,
  standUpCost,
} from '../shared/token-conditions.mjs';

test('every speed-zero condition brings a 5-cell creature to 0 and names itself as the reason', () => {
  for (const condition of SPEED_ZERO_CONDITIONS) {
    const result = effectiveSpeed(5, [condition], 0);
    assert.equal(result.cells, 0, `${condition} should zero the speed`);
    assert.equal(result.reason, condition);
  }
});

test('a condition outside the speed-zero list does not reduce speed on its own', () => {
  const result = effectiveSpeed(5, ['poisoned'], 0);
  assert.equal(result.cells, 5);
  assert.equal(result.reason, null);
});

test('exhaustion level 1 does not reduce speed', () => {
  const result = effectiveSpeed(6, [], 1);
  assert.equal(result.cells, 6);
  assert.equal(result.reason, null);
});

test('exhaustion levels 2 to 4 halve the base speed, floored, and name exhaustion', () => {
  for (const level of [2, 3, 4]) {
    const result = effectiveSpeed(5, [], level);
    assert.equal(result.cells, 2, `level ${level} should floor 5/2 to 2`);
    assert.equal(result.reason, 'exhaustion');
  }
});

test('exhaustion level 5 and 6 zero the speed and name exhaustion', () => {
  for (const level of [5, 6]) {
    const result = effectiveSpeed(6, [], level);
    assert.equal(result.cells, 0);
    assert.equal(result.reason, 'exhaustion');
  }
});

test('a speed-zero condition takes precedence over a lower exhaustion halving', () => {
  const result = effectiveSpeed(5, ['grappled'], 3);
  assert.equal(result.cells, 0);
  assert.equal(result.reason, 'grappled');
});

test('standUpCost floors half of the effective speed, with 5 cells costing 2', () => {
  assert.equal(standUpCost(5), 2);
  assert.equal(standUpCost(4), 2);
  assert.equal(standUpCost(0), 0);
});

test('movementBudget is 0 with speed 0 even with dash and extra movement', () => {
  assert.equal(movementBudget({ effectiveCells: 0, dashed: true, extra: 4 }), 0);
  assert.equal(movementBudget({ effectiveCells: 0, dashed: false, extra: 0 }), 0);
});

test('movementBudget applies dash and extra movement normally with a non-zero speed', () => {
  assert.equal(movementBudget({ effectiveCells: 2, dashed: false, extra: 0 }), 2);
  assert.equal(movementBudget({ effectiveCells: 2, dashed: true, extra: 0 }), 4);
  assert.equal(movementBudget({ effectiveCells: 2, dashed: false, extra: 3 }), 5);
});

test('conditionCatalogFor returns the creature catalog for player/enemy, the vehicle catalog for vehicle, and none for object', () => {
  assert.deepEqual(conditionCatalogFor('player'), CREATURE_CONDITIONS);
  assert.deepEqual(conditionCatalogFor('enemy'), CREATURE_CONDITIONS);
  assert.deepEqual(conditionCatalogFor('vehicle'), VEHICLE_CONDITIONS);
  assert.deepEqual(conditionCatalogFor('object'), []);
});

// Task 1.3: normalizzazione di snapshot con condizioni superate o fuori catalogo.

test('a snapshot with dead and prone on a player keeps only prone, with exhaustion 0', () => {
  const result = normalizeConditionsForType('player', ['dead', 'prone'], undefined);
  assert.deepEqual(result.conditions, ['prone']);
  assert.equal(result.exhaustionLevel, 0);
});

test('a full-state commit with an unknown condition string on an enemy discards it', () => {
  const result = normalizeConditionsForType('enemy', ['prone', 'pippo'], 0);
  assert.deepEqual(result.conditions, ['prone']);
});

test('a vehicle-only condition on a player token is discarded', () => {
  const result = normalizeConditionsForType('player', ['overturned', 'prone'], 0);
  assert.deepEqual(result.conditions, ['prone']);
});

test('a vehicle keeps its own catalog and forces exhaustion to 0', () => {
  const result = normalizeConditionsForType('vehicle', ['broken', 'overturned', 'prone'], 4);
  assert.deepEqual(result.conditions, ['broken', 'overturned']);
  assert.equal(result.exhaustionLevel, 0);
});

test('an object never carries conditions or exhaustion', () => {
  const result = normalizeConditionsForType('object', ['broken'], 3);
  assert.deepEqual(result.conditions, []);
  assert.equal(result.exhaustionLevel, 0);
});

test('normalizeConditionsForType deduplicates repeated conditions and clamps exhaustion to 0-6', () => {
  const result = normalizeConditionsForType('player', ['prone', 'prone', 'poisoned'], 9);
  assert.deepEqual(result.conditions, ['prone', 'poisoned']);
  assert.equal(result.exhaustionLevel, 6);

  const negative = normalizeConditionsForType('player', [], -3);
  assert.equal(negative.exhaustionLevel, 0);
});
