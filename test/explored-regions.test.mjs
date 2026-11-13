import assert from 'node:assert/strict';
import test from 'node:test';
import { asRegion, clipRegions, mergeRegions } from '../shared/explored-regions.mjs';

const rectangle = (x, y, width, height) => asRegion([
  { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height },
]);

test('nearly coincident wall intersections can be united repeatedly', () => {
  // Reduced from a failed exploration union: four nearly collinear points and a triangle.
  const remembered = [[[
    [11.774106971930191, 7.723770245288524],
    [11.774104856682317, 7.723769186938798],
    [11.773173620951711, 7.723303249545411],
    [11.773171505982486, 7.7233021913351045],
    [11.774106971930191, 7.723770245288524],
  ]]];
  const sight = [[[
    [11.774828476425212, 7.724131245100578],
    [11.772889731659369, 7.723161207490389],
    [10.364756518014508, 5.22932486155976],
    [11.774828476425212, 7.724131245100578],
  ]]];
  const merged = mergeRegions(remembered, sight);
  assert.ok(merged.length);
  assert.deepEqual(mergeRegions(merged, sight), merged);
  assert.deepEqual(mergeRegions(sight, remembered), merged);
  assert.deepEqual(clipRegions(merged, { columns: 30, rows: 30 }), merged);
});

test('repeated exploration preserves holes, disjoint regions and finite board bounds', () => {
  const outer = rectangle(0, 0, 10, 10)[0][0];
  const hole = rectangle(3, 3, 4, 4)[0][0];
  const remembered = [[outer, hole]];
  const expanded = mergeRegions(remembered, rectangle(8, 0, 4, 10), rectangle(20, 20, 1, 1));
  assert.equal(expanded.length, 2);
  assert.deepEqual(expanded[0][1], [...hole].reverse());
  assert.deepEqual(mergeRegions(expanded, remembered), expanded);
  const clipped = clipRegions(expanded, { columns: 11, rows: 10 });
  assert.equal(clipped.length, 1);
  assert.equal(clipped[0].length, 2);
  assert.ok(clipped.flat(2).every(([x, y]) => x >= 0 && x <= 11 && y >= 0 && y <= 10));

  // Another scene's coordinates must not affect snapping on this one.
  const far = rectangle(999_998, 999_998, 1, 1);
  assert.deepEqual(clipRegions(far), far);
  assert.deepEqual(mergeRegions(remembered, rectangle(8, 0, 4, 10), rectangle(20, 20, 1, 1)), expanded);
  assert.deepEqual(mergeRegions([], []), []);
  assert.deepEqual(clipRegions([]), []);
});
