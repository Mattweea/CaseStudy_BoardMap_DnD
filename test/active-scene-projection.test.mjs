import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';
import {
  buildSceneStateView,
  installActiveSceneProjection,
} from '../server/active-scene-projection.mjs';
import { pathCost } from '../shared/grid-movement.mjs';

function scene(id, name, version, boardOverrides = {}, marker = id) {
  const document = createDefaultSceneDocument();
  document.board = { ...document.board, ...boardOverrides };
  document.elements = [{ id: `element-${id}`, kind: marker, position: { x: 1, y: 1 } }];
  return { id, name, version, document };
}

test('active scene projection keeps live runtime and adapts board configuration to legacy fields', () => {
  const active = scene('scene-a', 'Sala A', 4, {
    diagonalRule: 'alternating',
    measurementUnit: { label: 'ft', cellsValue: 5 },
    isBackgroundHidden: true,
    isFullyLit: true,
    lightSources: [{ id: 'torch', position: { x: 3, y: 4 }, radiusCells: 6 }],
  });
  const tokens = [{ id: 'live-token', position: { x: 8, y: 9 } }];

  const projected = installActiveSceneProjection({ tokens, sharedNotes: 'live' }, active);

  assert.equal(projected.activeSceneId, 'scene-a');
  assert.equal(projected.activeSceneVersion, 4);
  assert.deepEqual(projected.activeSceneSummary, {
    id: 'scene-a', name: 'Sala A', version: 4, isActive: true,
  });
  assert.equal(projected.diagonalRule, 'alternating');
  assert.deepEqual(projected.measurementUnit, { label: 'ft', cellsValue: 5 });
  assert.deepEqual(projected.boardDimensions, { columns: 30, rows: 30 });
  assert.equal(projected.isBoardBackgroundHidden, true);
  assert.equal(projected.isBoardFullyLit, true);
  assert.equal(projected.lightSources[0].id, 'torch');
  assert.equal(projected.tokens, tokens);
  assert.equal(projected.sharedNotes, 'live');
  assert.equal('elements' in projected, false);
});

test('legacy state without activeSceneId receives the persisted active identity and safe projection', () => {
  const active = scene('initial-scene', 'Scena iniziale', 1);
  const projected = installActiveSceneProjection({ tokens: [] }, active);

  assert.equal(projected.activeSceneId, 'initial-scene');
  assert.equal(projected.activeSceneVersion, 1);
  assert.deepEqual(projected.measurementUnit, { label: 'm', cellsValue: 1.5 });
  assert.deepEqual(projected.lightSources, []);
});

test('active image background exposes only its authenticated scene URL', () => {
  const active = scene('scene-image', 'Con sfondo', 2);
  active.document.background = {
    kind: 'image', assetId: 'asset-1', mediaType: 'image/png', byteLength: 12,
    etag: 'b'.repeat(64), updatedAt: '2026-09-28T10:00:00.000Z',
  };
  const projected = installActiveSceneProjection({ tokens: [] }, active);
  assert.equal(projected.activeSceneBackground.kind, 'image');
  assert.equal(projected.activeSceneBackground.url, `/api/scenes/${active.id}/background?v=${'b'.repeat(64)}`);
  assert.equal('fileName' in projected.activeSceneBackground, false);
});

test('scene scale switches atomically and image calibration does not alter cell distance', () => {
  const metric = scene('metric', 'Metrica', 1, { measurementUnit: { label: 'm', cellsValue: 1.5 }, dimensions: { columns: 30, rows: 30 } });
  const imperial = scene('imperial', 'Imperiale', 1, { measurementUnit: { label: 'ft', cellsValue: 5 }, dimensions: { columns: 48, rows: 36 } });
  imperial.document.background = {
    kind: 'image', assetId: 'asset-grid', mediaType: 'image/png', byteLength: 12,
    etag: 'c'.repeat(64), updatedAt: '2026-09-28T10:00:00.000Z', scale: 3, offsetX: 120, offsetY: -20,
  };
  const metricProjection = installActiveSceneProjection({}, metric);
  const imperialProjection = installActiveSceneProjection({}, imperial);
  assert.deepEqual(metricProjection.measurementUnit, { label: 'm', cellsValue: 1.5 });
  assert.deepEqual(imperialProjection.measurementUnit, { label: 'ft', cellsValue: 5 });
  assert.deepEqual(imperialProjection.boardDimensions, { columns: 48, rows: 36 });
  assert.equal(pathCost([{ x: 0, y: 0 }, { x: 3, y: 3 }], { rule: imperialProjection.diagonalRule }).cells, 3);
});

test('role views expose only summaries to the Master and only active identity to a Player', () => {
  const active = scene('scene-a', 'Sala A', 2, {}, 'active-asset');
  const inactive = scene('scene-b', 'Sala B', 7, {}, 'INACTIVE-ASSET-MARKER');
  const service = {
    getActiveScene: () => structuredClone(active),
    getCatalog: () => structuredClone([active, inactive]),
  };
  const state = installActiveSceneProjection({ tokens: [] }, active);

  const master = buildSceneStateView(state, { role: 'master' }, service);
  const player = buildSceneStateView(state, { role: 'adventurer' }, service);

  assert.deepEqual(master.sceneCatalog, [
    { id: 'scene-a', name: 'Sala A', version: 2, isActive: true },
    { id: 'scene-b', name: 'Sala B', version: 7, isActive: false },
  ]);
  assert.equal('sceneCatalog' in player, false);
  assert.equal(player.activeSceneId, 'scene-a');
  assert.equal(JSON.stringify(master).includes('INACTIVE-ASSET-MARKER'), false);
  assert.equal(JSON.stringify(player).includes('Sala B'), false);
});
