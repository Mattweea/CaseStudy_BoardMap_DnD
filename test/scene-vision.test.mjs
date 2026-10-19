import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { collectVisionBlockers } from '../shared/scene-blockers.mjs';

const bundled = await build({
  entryPoints: [new URL('../src/utils/vision.ts', import.meta.url).pathname],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const vision = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString('base64')}`);
const footprint = (token) => ({ width: token.widthCells ?? 1, height: token.heightCells ?? 1 });

test('a scene element blocks existing client vision and light only when blocksVision is enabled', () => {
  const source = { id: 'hero', type: 'player', size: 'medium', position: { x: 0, y: 0 }, ownerUserId: 'hero-user' };
  const target = { id: 'enemy', type: 'enemy', size: 'medium', position: { x: 4, y: 0 } };
  const element = { id: 'rock', kind: 'rock', position: { x: 2, y: 0 }, widthCells: 1, heightCells: 1,
    rotation: 90, blocksMovement: true, blocksVision: false };
  const movementOnly = collectVisionBlockers([], [element], footprint);
  const visionBlocker = collectVisionBlockers([], [{ ...element, blocksMovement: false, blocksVision: true }], footprint);
  assert.equal(vision.isTokenInsideVision(source, target, 12, movementOnly), true);
  assert.equal(vision.isTokenInsideVision(source, target, 12, visionBlocker), false);
  assert.equal(vision.isTokenInsideLight({ position: { x: 0, y: 0 }, radiusCells: 12 }, target, visionBlocker), false);
  assert.equal(vision.buildVisibleCellSet(source, 12, visionBlocker, { x: 4, y: 0, columns: 1, rows: 1 }).size, 0);
});

test('existing connected token obstacles keep their group self-occlusion rule', () => {
  const source = { id: 'hero', type: 'player', size: 'medium', position: { x: 0, y: 0 }, ownerUserId: 'hero-user' };
  const target = { id: 'wall-2', type: 'object', size: 'medium', position: { x: 4, y: 0 },
    groupId: 'wall', blocksMovement: true };
  const neighbor = { id: 'wall-1', type: 'object', size: 'medium', position: { x: 2, y: 0 },
    groupId: 'wall', blocksMovement: true };
  const sameGroup = collectVisionBlockers([neighbor, target], [], footprint);
  assert.equal(vision.isTokenInsideVision(source, target, 12, sameGroup), true);
  const unrelated = collectVisionBlockers([{ ...neighbor, groupId: 'other' }, target], [], footprint);
  assert.equal(vision.isTokenInsideVision(source, target, 12, unrelated), false);
});
