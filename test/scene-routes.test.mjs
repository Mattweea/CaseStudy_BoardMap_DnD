import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Fastify from 'fastify';
import { openDatabase } from '../database/connection.mjs';
import { migrate } from '../database/migrator.mjs';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';
import { SceneRepository } from '../server/scene-repository.mjs';
import { registerSceneRoutes } from '../server/scene-routes.mjs';
import { SceneService } from '../server/scene-service.mjs';

const MASTER = { id: 'master-user', role: 'master' };
const PLAYER = { id: 'player-ilthar', role: 'adventurer' };

async function createApp({ onActiveSceneUpdated = null, getRuntimeTokens = () => [] } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-scene-routes-'));
  const db = openDatabase({ path: join(directory, 'test.sqlite') });
  await migrate(db);
  db.prepare('INSERT INTO campaigns (id, name, owner_user_id) VALUES (?, ?, ?)')
    .run('campaign-test', 'Test', MASTER.id);
  const repository = new SceneRepository(db);
  repository.createAndActivate({
    id: 'scene-initial', campaignId: 'campaign-test', name: 'Ingresso',
    document: createDefaultSceneDocument(),
  });
  const service = new SceneService({ repository, campaignId: 'campaign-test' });
  service.load();
  const app = Fastify();
  registerSceneRoutes(app, {
    service,
    getUser: (request) => ({ master: MASTER, player: PLAYER })[request.headers['x-test-user']] ?? null,
    onActiveSceneUpdated,
    getRuntimeTokens,
  });
  return {
    app,
    repository,
    service,
    close: async () => {
      await app.close();
      db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('scene catalog routes enforce authentication and master authorization', async () => {
  const { app, close } = await createApp();
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/scenes' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/api/scenes', headers: { 'x-test-user': 'player' } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'GET', url: '/api/scenes/scene-initial', headers: { 'x-test-user': 'player' } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/api/scenes', headers: { 'x-test-user': 'player' }, payload: { name: 'Vietata' } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'PATCH', url: '/api/scenes/scene-initial', headers: { 'x-test-user': 'player' }, payload: { baseVersion: 1, name: 'Vietata' } })).statusCode, 403);
  } finally {
    await close();
  }
});

test('Master drawing gestures persist once each; invalid, stale and unauthorized writes do not commit', async () => {
  const refreshed = [];
  const { app, service, close } = await createApp({ onActiveSceneUpdated: (scene) => refreshed.push(scene.version) });
  const url = '/api/scenes/scene-initial/drawings';
  const headers = { 'x-test-user': 'master' };
  const drawing = { id: 'stroke-1', color: '#ff8a3d', widthCells: 0.12,
    points: [{ x: 1.25, y: 2.5 }, { x: 3, y: 4.75 }] };
  try {
    assert.equal((await app.inject({ method: 'POST', url, payload: { baseVersion: 1, drawing } })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url, headers: { 'x-test-user': 'player' }, payload: { baseVersion: 1, drawing } })).statusCode, 403);
    const invalid = await app.inject({ method: 'POST', url, headers, payload: {
      baseVersion: 1, drawing: { ...drawing, points: [{ x: -1, y: 0 }] },
    } });
    assert.equal(invalid.statusCode, 400);
    const tooManyPoints = await app.inject({ method: 'POST', url, headers, payload: {
      baseVersion: 1,
      drawing: { ...drawing, points: Array.from({ length: 20001 }, () => ({ x: 1, y: 1 })) },
    } });
    assert.equal(tooManyPoints.statusCode, 400);
    assert.equal(service.getScene('scene-initial').version, 1);
    const added = await app.inject({ method: 'POST', url, headers, payload: { baseVersion: 1, drawing } });
    assert.equal(added.statusCode, 200);
    assert.equal(added.json().version, 2);
    assert.deepEqual(added.json().document.drawings, [drawing]);
    assert.deepEqual(refreshed, [2]);
    const stale = await app.inject({ method: 'POST', url, headers, payload: { baseVersion: 1, drawing: { ...drawing, id: 'stroke-2' } } });
    assert.equal(stale.statusCode, 409);
    assert.equal(stale.json().currentScene.version, 2);
    const missing = await app.inject({ method: 'DELETE', url, headers, payload: { baseVersion: 2, ids: ['not-here'] } });
    assert.equal(missing.statusCode, 409);
    assert.equal(service.getScene('scene-initial').version, 2);
    const erased = await app.inject({ method: 'DELETE', url, headers, payload: { baseVersion: 2, ids: ['stroke-1'] } });
    assert.equal(erased.statusCode, 200);
    assert.equal(erased.json().version, 3);
    assert.deepEqual(erased.json().document.drawings, []);
    assert.deepEqual(refreshed, [2, 3]);
  } finally {
    await close();
  }
});

test('drawing an inactive scene changes only its document until activation', async () => {
  const refreshed = [];
  const { app, service, close } = await createApp({ onActiveSceneUpdated: (scene) => refreshed.push(scene.id) });
  const headers = { 'x-test-user': 'master' };
  try {
    const created = await app.inject({ method: 'POST', url: '/api/scenes', headers, payload: { name: 'Mappa preparata' } });
    assert.equal(created.statusCode, 201);
    const sceneId = created.json().id;
    const drawing = { id: 'prepared-stroke', color: '#ff8a3d', widthCells: 0.12, points: [{ x: 2.5, y: 3.75 }] };
    const added = await app.inject({ method: 'POST', url: `/api/scenes/${sceneId}/drawings`, headers,
      payload: { baseVersion: created.json().version, drawing } });
    assert.equal(added.statusCode, 200);
    assert.deepEqual(added.json().document.drawings, [drawing]);
    assert.deepEqual(refreshed, []);
    assert.equal(service.getActiveScene().id, 'scene-initial');
    assert.deepEqual(service.getActiveScene().document.drawings, []);
    const erased = await app.inject({ method: 'DELETE', url: `/api/scenes/${sceneId}/drawings`, headers,
      payload: { baseVersion: added.json().version, ids: [drawing.id] } });
    assert.equal(erased.statusCode, 200);
    assert.deepEqual(erased.json().document.drawings, []);
    assert.deepEqual(refreshed, []);
  } finally {
    await close();
  }
});

test('scene elements are Master-only, versioned, persisted and broadcast only when active', async () => {
  const refreshed = [];
  const { app, service, repository, close } = await createApp({ onActiveSceneUpdated: (scene) => refreshed.push(scene.version) });
  const headers = { 'x-test-user': 'master' };
  const baseUrl = '/api/scenes/scene-initial/elements';
  const element = { id: 'rock-1', kind: 'rock', position: { x: 3, y: 4 }, widthCells: 2, heightCells: 2, rotation: 0,
    blocksMovement: false, blocksVision: false };
  try {
    assert.equal((await app.inject({ method: 'POST', url: baseUrl, payload: { baseVersion: 1, element } })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: baseUrl, headers: { 'x-test-user': 'player' }, payload: { baseVersion: 1, element } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'PATCH', url: `${baseUrl}/rock-1`, headers: { 'x-test-user': 'player' }, payload: { baseVersion: 1, transform: element } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'DELETE', url: `${baseUrl}/rock-1`, headers: { 'x-test-user': 'player' }, payload: { baseVersion: 1 } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: baseUrl, headers, payload: { baseVersion: 1, element: { ...element, kind: 'enemy' } } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'POST', url: baseUrl, headers, payload: { baseVersion: 1, element: { ...element, blocksVision: 'yes' } } })).statusCode, 400);
    const added = await app.inject({ method: 'POST', url: baseUrl, headers, payload: { baseVersion: 1, element: { ...element, hitPoints: 12 } } });
    assert.equal(added.statusCode, 200);
    assert.equal(added.json().version, 2);
    assert.deepEqual(added.json().document.elements, [element]);
    assert.deepEqual(repository.findById('scene-initial').document.elements, [element]);
    assert.deepEqual(refreshed, [2]);
    const stale = await app.inject({ method: 'PATCH', url: `${baseUrl}/rock-1`, headers, payload: { baseVersion: 1, transform: element } });
    assert.equal(stale.statusCode, 409);
    assert.equal(stale.json().currentScene.version, 2);
    const invalidFlag = await app.inject({ method: 'PATCH', url: `${baseUrl}/rock-1`, headers, payload: { baseVersion: 2,
      transform: { position: element.position, widthCells: 2, heightCells: 2, rotation: 0, blocksMovement: 'yes' } } });
    assert.equal(invalidFlag.statusCode, 400);
    assert.equal(service.getScene('scene-initial').version, 2);
    const updated = await app.inject({ method: 'PATCH', url: `${baseUrl}/rock-1`, headers, payload: { baseVersion: 2,
      transform: { position: { x: 5, y: 6 }, widthCells: 3, heightCells: 1, rotation: 90,
        blocksMovement: true, blocksVision: false } } });
    assert.equal(updated.statusCode, 200);
    assert.deepEqual(updated.json().document.elements[0], { ...element, position: { x: 5, y: 6 }, widthCells: 3, heightCells: 1,
      rotation: 90, blocksMovement: true });
    assert.equal((await app.inject({ method: 'DELETE', url: `${baseUrl}/missing`, headers, payload: { baseVersion: 3 } })).statusCode, 409);
    const removed = await app.inject({ method: 'DELETE', url: `${baseUrl}/rock-1`, headers, payload: { baseVersion: 3 } });
    assert.equal(removed.statusCode, 200);
    assert.deepEqual(removed.json().document.elements, []);
    assert.deepEqual(refreshed, [2, 3, 4]);
    assert.deepEqual(service.getDrawingHistoryState('scene-initial'), { canUndo: false, canRedo: false });
  } finally {
    await close();
  }
});

test('inactive-scene elements remain private until that scene is active', async () => {
  const refreshed = [];
  const { app, service, close } = await createApp({ onActiveSceneUpdated: (scene) => refreshed.push(scene.id) });
  const headers = { 'x-test-user': 'master' };
  try {
    const created = await app.inject({ method: 'POST', url: '/api/scenes', headers, payload: { name: 'Riservata' } });
    const sceneId = created.json().id;
    const element = { id: 'crate-secret', kind: 'crate', position: { x: 2, y: 2 }, widthCells: 1, heightCells: 1, rotation: 0,
      blocksMovement: false, blocksVision: true };
    const added = await app.inject({ method: 'POST', url: `/api/scenes/${sceneId}/elements`, headers,
      payload: { baseVersion: 1, element } });
    assert.equal(added.statusCode, 200);
    assert.deepEqual(added.json().document.elements, [element]);
    assert.deepEqual(refreshed, []);
    assert.deepEqual(service.getActiveScene().document.elements, []);
  } finally {
    await close();
  }
});

test('drawing undo and redo are Master-only, versioned and broadcast only for the active scene', async () => {
  const refreshed = [];
  const { app, service, close } = await createApp({ onActiveSceneUpdated: (scene) => refreshed.push(scene.version) });
  const headers = { 'x-test-user': 'master' };
  const url = '/api/scenes/scene-initial/drawings';
  const drawing = { id: 'undo-stroke', color: '#ff8a3d', widthCells: 0.12, points: [{ x: 1, y: 1 }] };
  try {
    const initial = await app.inject({ method: 'GET', url: '/api/scenes/scene-initial', headers });
    assert.deepEqual(initial.json().drawingHistory, { canUndo: false, canRedo: false });
    const added = await app.inject({ method: 'POST', url, headers, payload: { baseVersion: 1, drawing } });
    assert.equal(added.statusCode, 200);
    assert.deepEqual(added.json().drawingHistory, { canUndo: true, canRedo: false });
    assert.equal((await app.inject({ method: 'POST', url: `${url}/undo`, payload: { baseVersion: 2 } })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: `${url}/undo`, headers: { 'x-test-user': 'player' }, payload: { baseVersion: 2 } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: `${url}/redo`, headers: { 'x-test-user': 'player' }, payload: { baseVersion: 2 } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: `${url}/undo`, headers, payload: {} })).statusCode, 400);
    const stale = await app.inject({ method: 'POST', url: `${url}/undo`, headers, payload: { baseVersion: 1 } });
    assert.equal(stale.statusCode, 409);
    assert.deepEqual(stale.json().currentScene.drawingHistory, { canUndo: true, canRedo: false });
    assert.equal(service.getScene('scene-initial').version, 2);

    const undone = await app.inject({ method: 'POST', url: `${url}/undo`, headers, payload: { baseVersion: 2 } });
    assert.equal(undone.statusCode, 200);
    assert.deepEqual(undone.json().document.drawings, []);
    assert.deepEqual(undone.json().drawingHistory, { canUndo: false, canRedo: true });
    const redone = await app.inject({ method: 'POST', url: `${url}/redo`, headers, payload: { baseVersion: 3 } });
    assert.equal(redone.statusCode, 200);
    assert.deepEqual(redone.json().document.drawings, [drawing]);
    assert.deepEqual(redone.json().drawingHistory, { canUndo: true, canRedo: false });
    assert.deepEqual(refreshed, [2, 3, 4]);
    const emptyRedo = await app.inject({ method: 'POST', url: `${url}/redo`, headers, payload: { baseVersion: 4 } });
    assert.equal(emptyRedo.statusCode, 409);
    assert.deepEqual(emptyRedo.json().currentScene.drawingHistory, { canUndo: true, canRedo: false });

    const renamed = await app.inject({ method: 'PATCH', url: '/api/scenes/scene-initial', headers,
      payload: { baseVersion: 4, name: 'Nuovo nome' } });
    assert.equal(renamed.statusCode, 200);
    assert.deepEqual(renamed.json().drawingHistory, { canUndo: true, canRedo: false });
    const secondUndo = await app.inject({ method: 'POST', url: `${url}/undo`, headers, payload: { baseVersion: 5 } });
    assert.equal(secondUndo.statusCode, 200);
    assert.equal(secondUndo.json().name, 'Nuovo nome');
    assert.deepEqual(secondUndo.json().document.drawings, []);
    assert.deepEqual(refreshed, [2, 3, 4, 5, 6]);
  } finally {
    await close();
  }
});

test('inactive-scene undo persists without revealing preparation through active-scene updates', async () => {
  const refreshed = [];
  const { app, service, close } = await createApp({ onActiveSceneUpdated: (scene) => refreshed.push(scene.id) });
  const headers = { 'x-test-user': 'master' };
  const drawing = { id: 'private-stroke', color: '#ff8a3d', widthCells: 0.12, points: [{ x: 1, y: 1 }] };
  try {
    const created = await app.inject({ method: 'POST', url: '/api/scenes', headers, payload: { name: 'Segreta' } });
    const sceneId = created.json().id;
    const added = await app.inject({ method: 'POST', url: `/api/scenes/${sceneId}/drawings`, headers,
      payload: { baseVersion: created.json().version, drawing } });
    assert.equal(added.statusCode, 200);
    const undone = await app.inject({ method: 'POST', url: `/api/scenes/${sceneId}/drawings/undo`, headers,
      payload: { baseVersion: added.json().version } });
    assert.equal(undone.statusCode, 200);
    assert.deepEqual(undone.json().document.drawings, []);
    assert.deepEqual(refreshed, []);
    assert.deepEqual(service.getActiveScene().document.drawings, []);
  } finally {
    await close();
  }
});

test('master persists image calibration in one versioned scene update and stale writes conflict', async () => {
  const { app, service, close } = await createApp();
  const headers = { 'x-test-user': 'master' };
  try {
    const current = service.getScene('scene-initial');
    const blankCalibration = await app.inject({
      method: 'PATCH', url: '/api/scenes/scene-initial', headers,
      payload: {
        baseVersion: current.version,
        backgroundCalibration: { scale: 1, offsetX: 0, offsetY: 0 },
      },
    });
    assert.equal(blankCalibration.statusCode, 400);

    const withImage = service.updateScene({
      id: current.id,
      expectedVersion: current.version,
      name: current.name,
      sortOrder: current.sortOrder,
      document: {
        ...current.document,
        background: {
          kind: 'image',
          assetId: 'managed-map',
          mediaType: 'image/png',
          byteLength: 64,
          etag: 'c'.repeat(64),
          updatedAt: '2026-09-28T10:00:00.000Z',
        },
      },
    });

    const updated = await app.inject({
      method: 'PATCH', url: '/api/scenes/scene-initial', headers,
      payload: {
        baseVersion: withImage.version,
        backgroundCalibration: { scale: 1.5, offsetX: -72, offsetY: 108 },
      },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().version, withImage.version + 1);
    assert.deepEqual(
      {
        scale: updated.json().document.background.scale,
        offsetX: updated.json().document.background.offsetX,
        offsetY: updated.json().document.background.offsetY,
      },
      { scale: 1.5, offsetX: -72, offsetY: 108 },
    );

    const conflict = await app.inject({
      method: 'PATCH', url: '/api/scenes/scene-initial', headers,
      payload: {
        baseVersion: withImage.version,
        backgroundCalibration: { scale: 2, offsetX: 0, offsetY: 0 },
      },
    });
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.json().currentScene.version, withImage.version + 1);
  } finally {
    await close();
  }
});

test('master can list, create, select and update scenes without changing the active scene', async () => {
  const { app, repository, close } = await createApp();
  const headers = { 'x-test-user': 'master' };
  try {
    const listed = await app.inject({ method: 'GET', url: '/api/scenes', headers });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.json().scenes[0].isActive, true);
    assert.equal('document' in listed.json().scenes[0], false);

    const created = await app.inject({ method: 'POST', url: '/api/scenes', headers, payload: { name: 'Cripta' } });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().name, 'Cripta');
    assert.equal(created.json().isActive, false);

    // I nomi non sono identita: scene omonime restano distinguibili tramite ID stabile.
    const duplicate = await app.inject({ method: 'POST', url: '/api/scenes', headers, payload: { name: 'Cripta' } });
    assert.equal(duplicate.statusCode, 201);
    assert.notEqual(duplicate.json().id, created.json().id);

    const selected = await app.inject({ method: 'GET', url: `/api/scenes/${created.json().id}`, headers });
    assert.equal(selected.statusCode, 200);
    assert.equal(selected.json().name, 'Cripta');
    assert.equal(repository.findActiveByCampaign('campaign-test').id, 'scene-initial');

    const updated = await app.inject({
      method: 'PATCH', url: `/api/scenes/${created.json().id}`, headers,
      payload: { baseVersion: 1, name: 'Cripta inferiore' },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().version, 2);
    assert.equal(updated.json().name, 'Cripta inferiore');

    const conflict = await app.inject({
      method: 'PATCH', url: `/api/scenes/${created.json().id}`, headers,
      payload: { baseVersion: 1, name: 'Scrittura obsoleta' },
    });
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.json().currentScene.version, 2);
    assert.equal(conflict.json().currentScene.name, 'Cripta inferiore');
  } finally {
    await close();
  }
});

test('scene catalog rejects malformed payloads and exposes no delete or archive route', async () => {
  const { app, close } = await createApp();
  const headers = { 'x-test-user': 'master' };
  try {
    assert.equal((await app.inject({ method: 'POST', url: '/api/scenes', headers, payload: {} })).statusCode, 400);
    assert.equal((await app.inject({ method: 'POST', url: '/api/scenes', headers, payload: { name: '   ' } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'PATCH', url: '/api/scenes/scene-initial', headers, payload: { baseVersion: 0, name: 'X' } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'GET', url: '/api/scenes/missing', headers })).statusCode, 404);
    assert.equal((await app.inject({ method: 'DELETE', url: '/api/scenes/scene-initial', headers })).statusCode, 404);
    assert.equal((await app.inject({ method: 'POST', url: '/api/scenes/scene-initial/archive', headers, payload: {} })).statusCode, 404);
  } finally {
    await close();
  }
});

test('only an update to the active scene requests a shared projection refresh', async () => {
  const refreshed = [];
  const { app, close } = await createApp({ onActiveSceneUpdated: (scene) => refreshed.push(scene.id) });
  const headers = { 'x-test-user': 'master' };
  try {
    const created = await app.inject({
      method: 'POST', url: '/api/scenes', headers, payload: { name: 'Inattiva' },
    });
    const inactive = created.json();

    const inactiveUpdate = await app.inject({
      method: 'PATCH', url: `/api/scenes/${inactive.id}`, headers,
      payload: { baseVersion: inactive.version, name: 'Inattiva aggiornata' },
    });
    assert.equal(inactiveUpdate.statusCode, 200);
    assert.deepEqual(refreshed, []);

    const activeUpdate = await app.inject({
      method: 'PATCH', url: '/api/scenes/scene-initial', headers,
      payload: { baseVersion: 1, name: 'Ingresso aggiornato' },
    });
    assert.equal(activeUpdate.statusCode, 200);
    assert.deepEqual(refreshed, ['scene-initial']);
  } finally {
    await close();
  }
});

test('master saves unlimited dimensions in a versioned update and rejects mixed or excluding dimensions', async () => {
  const runtimeTokens = [{ id: 'hero', type: 'player', size: 'medium', position: { x: 6, y: 4 } }];
  const { app, service, close } = await createApp({ getRuntimeTokens: () => runtimeTokens });
  const headers = { 'x-test-user': 'master' };
  try {
    const invalid = await app.inject({
      method: 'PATCH', url: '/api/scenes/scene-initial', headers,
      payload: { baseVersion: 1, boardDimensions: { columns: 0, rows: 30 } },
    });
    assert.equal(invalid.statusCode, 400);
    assert.deepEqual(service.getActiveScene().document.board.dimensions, { columns: 30, rows: 30 });

    const finiteShrink = await app.inject({
      method: 'PATCH', url: '/api/scenes/scene-initial', headers,
      payload: { baseVersion: 1, boardDimensions: { columns: 6, rows: 30 } },
    });
    assert.equal(finiteShrink.statusCode, 400);

    const unlimited = await app.inject({
      method: 'PATCH', url: '/api/scenes/scene-initial', headers,
      payload: { baseVersion: 1, boardDimensions: { columns: 0, rows: 0 } },
    });
    assert.equal(unlimited.statusCode, 200);
    assert.deepEqual(unlimited.json().document.board.dimensions, { columns: 0, rows: 0 });
    assert.equal(unlimited.json().version, 2);

    const stale = await app.inject({
      method: 'PATCH', url: '/api/scenes/scene-initial', headers,
      payload: { baseVersion: 1, boardDimensions: { columns: 40, rows: 30 } },
    });
    assert.equal(stale.statusCode, 409);
    assert.deepEqual(service.getActiveScene().document.board.dimensions, { columns: 0, rows: 0 });
  } finally {
    await close();
  }
});
