import assert from 'node:assert/strict';
import test from 'node:test';
import { collectMovementBlockers, collectVisionBlockers, footprintsOverlap } from '../shared/scene-blockers.mjs';

const footprint = (token) => ({ width: token.widthCells ?? 1, height: token.heightCells ?? 1 });

test('element blockers join existing token obstacles without mixing movement and vision flags', () => {
  const token = { id: 'obstacle', name: 'Muro', position: { x: 0, y: 0 }, widthCells: 2, heightCells: 1,
    groupId: 'wall', blocksMovement: true };
  const movementOnly = { id: 'rock', kind: 'rock', position: { x: 3, y: 2 }, widthCells: 2, heightCells: 2,
    rotation: 90, blocksMovement: true, blocksVision: false };
  const visionOnly = { id: 'table', kind: 'table', position: { x: 6, y: 2 }, widthCells: 2, heightCells: 1,
    rotation: 45, blocksMovement: false, blocksVision: true };
  const movement = collectMovementBlockers([token], [movementOnly, visionOnly], footprint);
  const vision = collectVisionBlockers([token], [movementOnly, visionOnly], footprint);
  assert.deepEqual(movement.map(({ id }) => id), ['obstacle', 'rock']);
  assert.deepEqual(vision.map(({ id }) => id), ['obstacle', 'table']);
  assert.equal(movement[0].groupId, 'wall');
  assert.equal(movement[1].source, 'element');
  assert.equal(footprintsOverlap({ x: 4, y: 3 }, { width: 1, height: 1 }, movement[1]), true);
  assert.equal(footprintsOverlap({ x: 5, y: 3 }, { width: 1, height: 1 }, movement[1]), false);
  assert.equal(footprintsOverlap({ x: 3, y: 4 }, { width: 1, height: 1 }, movement[1]), false);
});

test('resizing changes the blocker footprint while rotation remains presentational', () => {
  const element = { id: 'table', kind: 'table', position: { x: 5, y: 5 }, widthCells: 1, heightCells: 1,
    rotation: 0, blocksMovement: true, blocksVision: true };
  const before = collectMovementBlockers([], [element], footprint)[0];
  assert.equal(footprintsOverlap({ x: 6, y: 5 }, { width: 1, height: 1 }, before), false);
  const after = collectMovementBlockers([], [{ ...element, widthCells: 2, rotation: 90 }], footprint)[0];
  assert.equal(footprintsOverlap({ x: 6, y: 5 }, { width: 1, height: 1 }, after), true);
  assert.deepEqual(collectVisionBlockers([], [{ ...element, rotation: 90 }], footprint)[0].position, element.position);
});
