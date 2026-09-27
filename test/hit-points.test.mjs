import assert from 'node:assert/strict';
import test from 'node:test';
import { applyHitPointDelta, hitPointTone, hitPointTransition, parseHitPointInput, readHitPointNumber } from '../shared/hit-points.mjs';

test('HP deltas consume temporary points first and cap healing', () => {
  for (const [current, temporary, maximum, delta, expected] of [
    [12, 5, 20, -8, { current: 9, temporary: 0 }],
    [12, 5, 20, -3, { current: 12, temporary: 2 }],
    [12, 5, 20, -5, { current: 12, temporary: 0 }],
    [12, 0, 20, -30, { current: 0, temporary: 0 }],
    [0, 4, 20, -3, { current: 0, temporary: 1 }],
    [18, 5, 20, 10, { current: 20, temporary: 5 }],
  ]) assert.deepEqual(applyHitPointDelta({ current, temporary, maximum }, delta), expected);
  assert.deepEqual(applyHitPointDelta({ current: 2, temporary: 'abc', maximum: 10 }, -1), { current: 1, temporary: 'abc' });
  assert.deepEqual(applyHitPointDelta({ current: 2, temporary: 0, maximum: '' }, 1), { error: 'missing-maximum' });
  assert.deepEqual(applyHitPointDelta({ current: '', temporary: 0, maximum: 10 }, -1), { error: 'missing-current' });
});

test('input syntax and whole number reading', () => {
  assert.deepEqual(parseHitPointInput('- 8'), { kind: 'delta', value: -8 });
  assert.deepEqual(parseHitPointInput('+8'), { kind: 'delta', value: 8 });
  assert.deepEqual(parseHitPointInput('7'), { kind: 'absolute', value: 7 });
  assert.deepEqual(parseHitPointInput('  '), { kind: 'empty' });
  for (const value of ['2d6', '-0', '-1000', '+1000', '1.5']) assert.deepEqual(parseHitPointInput(value), { kind: 'invalid' });
  assert.equal(readHitPointNumber(' -2 '), -2);
  assert.equal(readHitPointNumber(''), null);
});

test('transitions and meter thresholds', () => {
  assert.equal(hitPointTransition('3', '0'), 'down');
  assert.equal(hitPointTransition('0', '1'), 'up');
  assert.equal(hitPointTransition('0', '0'), null);
  assert.equal(hitPointTransition('abc', '0'), null);
  assert.equal(hitPointTone(0, 100), 'danger');
  assert.equal(hitPointTone(19, 100), 'danger');
  assert.equal(hitPointTone(20, 100), 'warn');
  assert.equal(hitPointTone(50, 100), 'warn');
  assert.equal(hitPointTone(51, 100), 'ok');
});
