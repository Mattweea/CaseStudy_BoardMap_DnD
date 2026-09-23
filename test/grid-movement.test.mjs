import assert from 'node:assert/strict';
import test from 'node:test';
import { cellsToUnit, decomposeSegment, isValidCellsValue, pathCost } from '../shared/grid-movement.mjs';

test('decomposeSegment on an orthogonal segment covers the axis difference exactly', () => {
  const steps = decomposeSegment({ x: 0, y: 0 }, { x: 3, y: 0 });
  assert.deepEqual(steps, [
    { x: 1, y: 0, diagonal: false },
    { x: 2, y: 0, diagonal: false },
    { x: 3, y: 0, diagonal: false },
  ]);
});

test('decomposeSegment on a pure diagonal segment covers the axis difference exactly', () => {
  const steps = decomposeSegment({ x: 0, y: 0 }, { x: 3, y: 3 });
  assert.deepEqual(steps, [
    { x: 1, y: 1, diagonal: true },
    { x: 2, y: 2, diagonal: true },
    { x: 3, y: 3, diagonal: true },
  ]);
});

test('decomposeSegment on an oblique segment uses diagonals then residual orthogonal steps', () => {
  const steps = decomposeSegment({ x: 0, y: 0 }, { x: 5, y: 2 });
  assert.deepEqual(steps, [
    { x: 1, y: 1, diagonal: true },
    { x: 2, y: 2, diagonal: true },
    { x: 3, y: 2, diagonal: false },
    { x: 4, y: 2, diagonal: false },
    { x: 5, y: 2, diagonal: false },
  ]);
});

test('decomposeSegment on an equal from/to segment returns no steps', () => {
  assert.deepEqual(decomposeSegment({ x: 2, y: 2 }, { x: 2, y: 2 }), []);
});

test('pathCost on an L-shaped path costs the sum of both segments with either rule', () => {
  const waypoints = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }];
  assert.equal(pathCost(waypoints, { rule: 'standard' }).cells, 6);
  assert.equal(pathCost(waypoints, { rule: 'alternating' }).cells, 6);
});

test('pathCost on three diagonal steps costs 3 with standard and 4 with alternating', () => {
  const waypoints = [{ x: 0, y: 0 }, { x: 3, y: 3 }];
  assert.equal(pathCost(waypoints, { rule: 'standard' }).cells, 3);
  assert.equal(pathCost(waypoints, { rule: 'alternating' }).cells, 4);
});

test('pathCost on an empty or single-point path costs 0', () => {
  assert.equal(pathCost([], {}).cells, 0);
  assert.equal(pathCost([{ x: 1, y: 1 }], {}).cells, 0);
  assert.equal(pathCost(undefined, {}).cells, 0);
});

test('pathCost alternating parity continues across two calls the same as a single call', () => {
  const waypoints = [{ x: 0, y: 0 }, { x: 3, y: 3 }];
  const singleCall = pathCost(waypoints, { rule: 'alternating', diagonalParity: 0 });

  const firstLeg = pathCost([{ x: 0, y: 0 }, { x: 1, y: 1 }], { rule: 'alternating', diagonalParity: 0 });
  const secondLeg = pathCost([{ x: 1, y: 1 }, { x: 3, y: 3 }], {
    rule: 'alternating',
    diagonalParity: firstLeg.nextDiagonalParity,
  });

  assert.equal(firstLeg.cells + secondLeg.cells, singleCall.cells);
  assert.equal(secondLeg.nextDiagonalParity, singleCall.nextDiagonalParity);
});

test('cellsToUnit converts cells with the per-cell unit value', () => {
  assert.equal(cellsToUnit(6, 1.5), 9);
});

test('cellsToUnit rejects a non-positive or non-numeric per-cell value', () => {
  assert.equal(cellsToUnit(6, 0), null);
  assert.equal(cellsToUnit(6, -1.5), null);
  assert.equal(cellsToUnit(6, Number.NaN), null);
  assert.equal(cellsToUnit(6, 'abc'), null);
});

test('isValidCellsValue accepts only positive finite numbers', () => {
  assert.equal(isValidCellsValue(1.5), true);
  assert.equal(isValidCellsValue(0), false);
  assert.equal(isValidCellsValue(-2), false);
  assert.equal(isValidCellsValue('1.5'), false);
  assert.equal(isValidCellsValue(Number.NaN), false);
});
