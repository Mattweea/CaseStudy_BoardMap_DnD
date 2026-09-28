import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../database/connection.mjs';
import { migrate } from '../database/migrator.mjs';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';
import { SceneRepository } from '../server/scene-repository.mjs';
import { ScenePersistenceConflictError, SceneService } from '../server/scene-service.mjs';

async function withRepository(run) {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-scene-service-'));
  const db = openDatabase({ path: join(directory, 'test.sqlite') });
  try {
    await migrate(db);
    db.prepare('INSERT INTO campaigns (id, name, owner_user_id) VALUES (?, ?, ?)')
      .run('campaign-test', 'Test', 'master-user');
    const repository = new SceneRepository(db);
    repository.createAndActivate({
      id: 'scene-a', campaignId: 'campaign-test', name: 'Originale',
      document: createDefaultSceneDocument(),
    });
    await run(repository);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test('service reports a stale write and keeps its prior in-memory projection', () => withRepository((repository) => {
  const first = new SceneService({ repository, campaignId: 'campaign-test' });
  const stale = new SceneService({ repository, campaignId: 'campaign-test' });
  first.load();
  stale.load();

  const changed = first.getScene('scene-a').document;
  changed.board.isFullyLit = true;
  first.updateScene({ id: 'scene-a', expectedVersion: 1, name: 'Nuova', document: changed, sortOrder: 0 });

  assert.throws(
    () => stale.updateScene({
      id: 'scene-a', expectedVersion: 1, name: 'Obsoleta',
      document: stale.getScene('scene-a').document, sortOrder: 0,
    }),
    (error) => error instanceof ScenePersistenceConflictError
      && error.statusCode === 409
      && error.currentScene.version === 2,
  );
  assert.equal(stale.getScene('scene-a').version, 1);
  assert.equal(stale.getScene('scene-a').name, 'Originale');
}));

test('service projects a mutation only after persistence succeeds', () => withRepository((repository) => {
  const failingRepository = {
    findByCampaign: (...args) => repository.findByCampaign(...args),
    findActiveByCampaign: (...args) => repository.findActiveByCampaign(...args),
    findById: (...args) => repository.findById(...args),
    saveVersion: () => { throw new Error('disk full'); },
  };
  const service = new SceneService({ repository: failingRepository, campaignId: 'campaign-test' });
  service.load();
  const candidate = service.getScene('scene-a').document;
  candidate.board.isFullyLit = true;

  assert.throws(
    () => service.updateScene({
      id: 'scene-a', expectedVersion: 1, name: 'Non salvata', document: candidate, sortOrder: 0,
    }),
    /disk full/,
  );
  assert.equal(service.getScene('scene-a').name, 'Originale');
  assert.equal(service.getScene('scene-a').document.board.isFullyLit, false);
  assert.equal(repository.findById('scene-a').version, 1);
}));

test('drawing history is per scene, command-only, and survives metadata edits without persisting itself', () => withRepository((repository) => {
  const service = new SceneService({ repository, campaignId: 'campaign-test' });
  service.load();
  service.createScene({ id: 'scene-b', name: 'Seconda', sortOrder: 1, document: createDefaultSceneDocument() });
  const stroke = (id) => ({ id, points: [{ x: 1, y: 2 }], color: '#ff8a3d', widthCells: 0.12 });

  const first = service.addDrawing({ id: 'scene-a', expectedVersion: 1, drawing: stroke('a-1') });
  const second = service.addDrawing({ id: 'scene-b', expectedVersion: 1, drawing: stroke('b-1') });
  assert.deepEqual(service.getDrawingHistoryState('scene-a'), { canUndo: true, canRedo: false });
  assert.deepEqual(service.getDrawingHistoryState('scene-b'), { canUndo: true, canRedo: false });

  const renamed = service.updateScene({ id: 'scene-a', expectedVersion: first.version, name: 'Rinominata',
    document: first.document, sortOrder: first.sortOrder });
  assert.deepEqual(service.getDrawingHistoryState('scene-a'), { canUndo: true, canRedo: false });
  const undone = service.replayDrawing({ id: 'scene-a', expectedVersion: renamed.version, direction: 'undo' });
  assert.deepEqual(undone.document.drawings, []);
  assert.equal(undone.name, 'Rinominata');
  assert.deepEqual(service.getScene('scene-b').document.drawings, [stroke('b-1')]);
  assert.deepEqual(service.getDrawingHistoryState('scene-a'), { canUndo: false, canRedo: true });
  const redone = service.replayDrawing({ id: 'scene-a', expectedVersion: undone.version, direction: 'redo' });
  assert.deepEqual(redone.document.drawings, [stroke('a-1')]);
  assert.deepEqual(service.getDrawingHistoryState('scene-a'), { canUndo: true, canRedo: false });

  const restarted = new SceneService({ repository, campaignId: 'campaign-test' });
  restarted.load();
  assert.deepEqual(restarted.getScene('scene-a').document.drawings, [stroke('a-1')]);
  assert.deepEqual(restarted.getDrawingHistoryState('scene-a'), { canUndo: false, canRedo: false });
  assert.deepEqual(restarted.getScene('scene-b').document.drawings, second.document.drawings);
}));

test('drawing history restores erased ordering, clears redo after a new gesture and caps undo at 40', () => withRepository((repository) => {
  const service = new SceneService({ repository, campaignId: 'campaign-test' });
  service.load();
  const stroke = (index) => ({ id: `stroke-${index}`, points: [{ x: index, y: 1 }], color: '#ff8a3d', widthCells: 0.12 });
  let version = 1;
  for (let index = 0; index < 3; index += 1) {
    version = service.addDrawing({ id: 'scene-a', expectedVersion: version, drawing: stroke(index) }).version;
  }
  version = service.eraseDrawings({ id: 'scene-a', expectedVersion: version, ids: ['stroke-0', 'stroke-2'] }).version;
  const restored = service.replayDrawing({ id: 'scene-a', expectedVersion: version, direction: 'undo' });
  assert.deepEqual(restored.document.drawings, [stroke(0), stroke(1), stroke(2)]);
  version = restored.version;
  version = service.replayDrawing({ id: 'scene-a', expectedVersion: version, direction: 'redo' }).version;
  assert.deepEqual(service.getScene('scene-a').document.drawings, [stroke(1)]);
  version = service.replayDrawing({ id: 'scene-a', expectedVersion: version, direction: 'undo' }).version;
  version = service.addDrawing({ id: 'scene-a', expectedVersion: version, drawing: stroke(3) }).version;
  assert.deepEqual(service.getDrawingHistoryState('scene-a'), { canUndo: true, canRedo: false });

  for (let index = 4; index <= 44; index += 1) {
    version = service.addDrawing({ id: 'scene-a', expectedVersion: version, drawing: stroke(index) }).version;
  }
  for (let index = 0; index < 40; index += 1) {
    version = service.replayDrawing({ id: 'scene-a', expectedVersion: version, direction: 'undo' }).version;
  }
  assert.deepEqual(service.getDrawingHistoryState('scene-a'), { canUndo: false, canRedo: true });
  assert.deepEqual(service.getScene('scene-a').document.drawings.map((drawing) => drawing.id), ['stroke-0', 'stroke-1', 'stroke-2', 'stroke-3', 'stroke-4']);
  assert.throws(() => service.replayDrawing({ id: 'scene-a', expectedVersion: version, direction: 'undo' }),
    (error) => error.statusCode === 409 && error.currentScene.version === version);
}));

test('drawing history rejects stale and failed writes without recording them, and clears on external drawing replacement', () => withRepository((repository) => {
  const service = new SceneService({ repository, campaignId: 'campaign-test' });
  service.load();
  const drawing = { id: 'stroke', points: [{ x: 1, y: 1 }], color: '#ff8a3d', widthCells: 0.12 };
  const added = service.addDrawing({ id: 'scene-a', expectedVersion: 1, drawing });
  assert.throws(() => service.addDrawing({ id: 'scene-a', expectedVersion: 1, drawing: { ...drawing, id: 'stale' } }),
    (error) => error instanceof ScenePersistenceConflictError && error.currentScene.version === added.version);
  assert.deepEqual(service.getDrawingHistoryState('scene-a'), { canUndo: true, canRedo: false });

  const replaced = service.updateScene({ id: 'scene-a', expectedVersion: added.version, name: added.name,
    document: { ...added.document, drawings: [] }, sortOrder: added.sortOrder });
  assert.deepEqual(replaced.document.drawings, []);
  assert.deepEqual(service.getDrawingHistoryState('scene-a'), { canUndo: false, canRedo: false });

  const failing = new SceneService({ repository: {
    findByCampaign: (...args) => repository.findByCampaign(...args),
    findActiveByCampaign: (...args) => repository.findActiveByCampaign(...args),
    findById: (...args) => repository.findById(...args),
    saveVersion: () => { throw new Error('disk full'); },
  }, campaignId: 'campaign-test' });
  failing.load();
  assert.throws(() => failing.addDrawing({ id: 'scene-a', expectedVersion: replaced.version, drawing }), /disk full/);
  assert.deepEqual(failing.getDrawingHistoryState('scene-a'), { canUndo: false, canRedo: false });
  assert.equal(repository.findById('scene-a').version, replaced.version);
}));

test('a failed undo does not consume drawing history or change the persisted scene', () => withRepository((repository) => {
  const service = new SceneService({ repository, campaignId: 'campaign-test' });
  service.load();
  const added = service.addDrawing({ id: 'scene-a', expectedVersion: 1,
    drawing: { id: 'stroke', points: [{ x: 1, y: 1 }], color: '#ff8a3d', widthCells: 0.12 } });
  const saveVersion = repository.saveVersion.bind(repository);
  repository.saveVersion = () => { throw new Error('disk full'); };
  try {
    assert.throws(() => service.replayDrawing({ id: 'scene-a', expectedVersion: added.version, direction: 'undo' }), /disk full/);
  } finally {
    repository.saveVersion = saveVersion;
  }
  assert.deepEqual(service.getDrawingHistoryState('scene-a'), { canUndo: true, canRedo: false });
  assert.deepEqual(service.getScene('scene-a').document.drawings, added.document.drawings);
  assert.equal(repository.findById('scene-a').version, added.version);
  const undone = service.replayDrawing({ id: 'scene-a', expectedVersion: added.version, direction: 'undo' });
  assert.deepEqual(undone.document.drawings, []);
}));

test('scene element writes remain persisted, isolated and reject failed storage without projection', () => withRepository((repository) => {
  const service = new SceneService({ repository, campaignId: 'campaign-test' });
  service.load();
  service.createScene({ id: 'scene-b', name: 'Seconda', sortOrder: 1, document: createDefaultSceneDocument() });
  const element = { id: 'table-1', kind: 'table', position: { x: 2, y: 3 }, widthCells: 2, heightCells: 1, rotation: 0,
    blocksMovement: false, blocksVision: true };
  const added = service.addElement({ id: 'scene-b', expectedVersion: 1, element });
  assert.deepEqual(added.document.elements, [element]);
  assert.deepEqual(service.getActiveScene().document.elements, []);
  assert.throws(() => service.addElement({ id: 'scene-b', expectedVersion: 1, element: { ...element, id: 'stale' } }),
    (error) => error instanceof ScenePersistenceConflictError && error.currentScene.version === 2);
  const restarted = new SceneService({ repository, campaignId: 'campaign-test' });
  restarted.load();
  assert.deepEqual(restarted.getScene('scene-b').document.elements, [element]);
  const originalSave = repository.saveVersion.bind(repository);
  repository.saveVersion = () => { throw new Error('disk full'); };
  try {
    assert.throws(() => service.removeElement({ id: 'scene-b', elementId: element.id, expectedVersion: 2 }), /disk full/);
  } finally {
    repository.saveVersion = originalSave;
  }
  assert.deepEqual(service.getScene('scene-b').document.elements, [element]);
  assert.deepEqual(repository.findById('scene-b').document.elements, [element]);
}));
