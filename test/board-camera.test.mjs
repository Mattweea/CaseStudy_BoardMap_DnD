import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraFollowingPosition, clampCamera, resolveFollowTokenId, walkingTokenPosition } from '../src/utils/boardCamera.ts';
import { SCENE_LIMITS } from '../shared/scene-model.mjs';

const dimensions = { columns: 100, rows: 100 };
const viewport = { columns: 10, rows: 8 };
const footprint = { width: 1, height: 1 };
const follow = (camera, position, size = footprint, visible = viewport, board = dimensions) =>
  cameraFollowingPosition(camera, position, size, visible, board);

test('camera stays still for a fully visible token, including an exact boundary', () => {
  const camera = { x: 10, y: 10 };
  assert.equal(follow(camera, { x: 19, y: 17 }), camera);
  assert.equal(follow(camera, { x: 12, y: 12 }), camera);
});

test('camera follows all four edges by the minimum whole-cell correction', () => {
  const camera = { x: 10, y: 10 };
  assert.deepEqual(follow(camera, { x: 20, y: 12 }), { x: 11, y: 10 });
  assert.deepEqual(follow(camera, { x: 9, y: 12 }), { x: 9, y: 10 });
  assert.deepEqual(follow(camera, { x: 12, y: 18 }), { x: 10, y: 11 });
  assert.deepEqual(follow(camera, { x: 12, y: 9 }), { x: 10, y: 9 });
});

test('partial cells and the full footprint count as visible bounds, not overscan', () => {
  assert.deepEqual(follow({ x: 0, y: 0 }, { x: 8.6, y: 7.6 }, footprint,
    { columns: 9.5, rows: 8.5 }), { x: 1, y: 1 });
  assert.deepEqual(follow({ x: 0, y: 0 }, { x: 9, y: 7 }, { width: 2, height: 2 }), { x: 1, y: 1 });
});

test('the last cell can be reached even when the viewport has partial cells', () => {
  const visible = { columns: 10.5, rows: 8.5 };
  assert.deepEqual(follow({ x: 0, y: 0 }, { x: 99, y: 99 }, footprint, visible), { x: 90, y: 92 });
  assert.deepEqual(clampCamera({ x: 100, y: 100 }, dimensions, visible), { x: 90, y: 92 });
});

test('oversized tokens keep their centre visible without alternating between edges', () => {
  const size = { width: 12, height: 10 };
  const next = follow({ x: 0, y: 0 }, { x: 20, y: 20 }, size);
  assert.deepEqual(next, { x: 21, y: 21 });
  assert.equal(follow(next, { x: 20, y: 20 }, size), next);
});

test('unlimited boards keep a nonnegative origin and respect the coordinate safety limit', () => {
  const unlimited = { columns: 0, rows: 0 };
  assert.deepEqual(follow({ x: 5, y: 5 }, { x: 0, y: 0 }, footprint, viewport, unlimited), { x: 0, y: 0 });
  assert.deepEqual(follow({ x: 0, y: 0 }, { x: 500, y: 600 }, footprint, viewport, unlimited), { x: 491, y: 593 });
  const bounded = clampCamera({ x: Infinity, y: Infinity }, unlimited, viewport);
  assert.equal(bounded.x, SCENE_LIMITS.maxCoordinateMagnitude - viewport.columns);
  assert.equal(bounded.y, SCENE_LIMITS.maxCoordinateMagnitude - viewport.rows);
});

test('an unmeasured viewport never triggers a camera correction', () => {
  const camera = { x: 5, y: 5 };
  assert.equal(follow(camera, { x: 50, y: 50 }, footprint, { columns: 0, rows: 0 }), camera);
});

test('Player follows only the canonical PG; Master follows only one selected non-familiar PG', () => {
  const tokens = [{ id: 'pg', type: 'player' }, { id: 'other', type: 'player' },
    { id: 'familiar', type: 'player', isFamiliar: true }, { id: 'enemy', type: 'enemy' }];
  assert.equal(resolveFollowTokenId(tokens, false, ['other'], 'pg'), 'pg');
  assert.equal(resolveFollowTokenId(tokens, true, ['other'], null), 'other');
  for (const selection of [[], ['pg', 'other'], ['familiar'], ['enemy'], ['missing']]) {
    assert.equal(resolveFollowTokenId(tokens, true, selection, null), null);
  }
  assert.equal(resolveFollowTokenId(tokens, false, [], 'missing'), null);
});

test('a passenger uses the same interpolated position as its vehicle plus the seat offset', () => {
  const pg = { id: 'pg', type: 'player', position: { x: 21, y: 31 }, containedInVehicleId: 'vehicle' };
  const vehicle = { id: 'vehicle', type: 'vehicle', position: { x: 20, y: 30 }, vehicleOccupantIds: ['pg'] };
  const positions = { vehicle: { x: 10.5, y: 12.5 } };
  assert.deepEqual(walkingTokenPosition(pg, [pg, vehicle], positions), { x: 11.5, y: 13.5 });
  assert.equal(walkingTokenPosition(pg, [pg, vehicle], {}), undefined);
  assert.deepEqual(walkingTokenPosition(pg, [pg, vehicle], { pg: { x: 3, y: 4 }, ...positions }), { x: 3, y: 4 });
});
