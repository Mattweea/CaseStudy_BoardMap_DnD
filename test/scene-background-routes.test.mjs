import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Fastify from 'fastify';
import { openDatabase } from '../database/connection.mjs';
import { migrate } from '../database/migrator.mjs';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';
import { MAX_SCENE_BACKGROUND_BYTES, SceneBackgroundStorage } from '../server/scene-background-storage.mjs';
import { SceneRepository } from '../server/scene-repository.mjs';
import { registerSceneRoutes } from '../server/scene-routes.mjs';
import { SceneService } from '../server/scene-service.mjs';

const MASTER = { id: 'master-user', role: 'master' };
const PLAYER = { id: 'player-user', role: 'adventurer' };
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

async function createApp() {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-scene-background-routes-'));
  const db = openDatabase({ path: join(directory, 'test.sqlite') });
  await migrate(db);
  db.prepare('INSERT INTO campaigns (id, name, owner_user_id) VALUES (?, ?, ?)').run('campaign-test', 'Test', MASTER.id);
  const repository = new SceneRepository(db);
  repository.createAndActivate({ id: 'scene-active', campaignId: 'campaign-test', name: 'Attiva', document: createDefaultSceneDocument(), sortOrder: 0 });
  repository.create({ id: 'scene-secret', campaignId: 'campaign-test', name: 'Segreta', document: createDefaultSceneDocument(), sortOrder: 1 });
  const service = new SceneService({ repository, campaignId: 'campaign-test' });
  service.load();
  const storage = new SceneBackgroundStorage(join(directory, 'assets'));
  await storage.initialize();
  const refreshed = [];
  const app = Fastify();
  registerSceneRoutes(app, {
    service, backgroundStorage: storage,
    getUser: (request) => ({ master: MASTER, player: PLAYER })[request.headers['x-test-user']] ?? null,
    onActiveSceneUpdated: (scene) => refreshed.push(scene.id),
  });
  return { app, service, storage, refreshed, close: async () => { await app.close(); db.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test('only the Master can upload or clear a scene background and active changes refresh projection', async () => {
  const { app, service, refreshed, close } = await createApp();
  try {
    const url = '/api/scenes/scene-active/background';
    assert.equal((await app.inject({ method: 'PUT', url, headers: { 'content-type': 'image/png', 'x-scene-base-version': '1' }, payload: png })).statusCode, 401);
    assert.equal((await app.inject({ method: 'PUT', url, headers: { 'x-test-user': 'player', 'content-type': 'image/png', 'x-scene-base-version': '1' }, payload: png })).statusCode, 403);
    const uploaded = await app.inject({ method: 'PUT', url, headers: { 'x-test-user': 'master', 'content-type': 'image/png', 'x-scene-base-version': '1' }, payload: png });
    assert.equal(uploaded.statusCode, 200);
    assert.equal(uploaded.json().document.background.kind, 'image');
    assert.equal(uploaded.json().version, 2);
    assert.deepEqual(refreshed, ['scene-active']);
    const invalid = await app.inject({ method: 'PUT', url, headers: { 'x-test-user': 'master', 'content-type': 'image/jpeg', 'x-scene-base-version': '2' }, payload: png });
    assert.equal(invalid.statusCode, 400);
    assert.equal(service.getScene('scene-active').version, 2);
    const truncated = await app.inject({ method: 'PUT', url, headers: { 'x-test-user': 'master', 'content-type': 'image/png', 'x-scene-base-version': '2' }, payload: Buffer.alloc(MAX_SCENE_BACKGROUND_BYTES + 1) });
    assert.equal(truncated.statusCode, 413);
    assert.equal(service.getScene('scene-active').version, 2);
    const cleared = await app.inject({ method: 'DELETE', url, headers: { 'x-test-user': 'master', 'x-scene-base-version': '2' } });
    assert.equal(cleared.statusCode, 200);
    assert.equal(cleared.json().document.background.kind, 'blank');
  } finally { await close(); }
});

test('authenticated serving allows Players only the active asset and uses private ETag caching', async () => {
  const { app, close } = await createApp();
  const uploadHeaders = { 'x-test-user': 'master', 'content-type': 'image/png', 'x-scene-base-version': '1' };
  try {
    await app.inject({ method: 'PUT', url: '/api/scenes/scene-active/background', headers: uploadHeaders, payload: png });
    await app.inject({ method: 'PUT', url: '/api/scenes/scene-secret/background', headers: uploadHeaders, payload: png });
    const active = await app.inject({ method: 'GET', url: '/api/scenes/scene-active/background', headers: { 'x-test-user': 'player' } });
    assert.equal(active.statusCode, 200);
    assert.equal(active.headers['cache-control'], 'private, max-age=3600');
    assert.equal(active.headers['content-type'], 'image/png');
    assert.deepEqual(active.rawPayload, png);
    const cached = await app.inject({ method: 'GET', url: '/api/scenes/scene-active/background', headers: { 'x-test-user': 'player', 'if-none-match': active.headers.etag } });
    assert.equal(cached.statusCode, 304);
    assert.equal((await app.inject({ method: 'GET', url: '/api/scenes/scene-secret/background', headers: { 'x-test-user': 'player' } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'GET', url: '/api/scenes/scene-secret/background', headers: { 'x-test-user': 'master' } })).statusCode, 200);
  } finally { await close(); }
});

test('a persistence failure removes the newly staged asset and preserves the previous scene', async () => {
  const { service, storage, close } = await createApp();
  try {
    service.repository.saveVersion = () => { throw new Error('database unavailable'); };
    await assert.rejects(service.replaceBackground({ id: 'scene-active', expectedVersion: 1, buffer: png, mediaType: 'image/png', storage }), /database unavailable/);
    assert.equal(service.getScene('scene-active').document.background.kind, 'blank');
    assert.deepEqual(readdirSync(storage.root), []);
  } finally { await close(); }
});
