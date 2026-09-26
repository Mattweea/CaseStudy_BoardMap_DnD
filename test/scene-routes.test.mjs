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

async function createApp() {
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
  });
  return {
    app,
    repository,
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
