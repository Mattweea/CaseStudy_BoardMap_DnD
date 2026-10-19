import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import Fastify from 'fastify';
import { openDatabase } from '../database/connection.mjs';
import { migrate } from '../database/migrator.mjs';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';
import { SceneRepository } from '../server/scene-repository.mjs';
import { SceneService } from '../server/scene-service.mjs';
import { registerSceneRoutes } from '../server/scene-routes.mjs';

process.env.BATTLE_MAP_TEST_MODE = '1';
const { __testing } = await import('../server/index.mjs');
const MASTER = { id: 'master-user', role: 'master', username: 'master', displayName: 'Master' };
const PLAYER = { id: 'player', role: 'adventurer', username: 'player', displayName: 'Player' };

async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-encounter-persistence-'));
  const path = join(directory, 'test.sqlite');
  const db = openDatabase({ path });
  const app = Fastify();
  const chunks = [], client = { user: MASTER, write: (chunk) => chunks.push(chunk) };
  t.after(async () => {
    __testing.streamClients.delete(client); await app.close();
    if (db.open) db.close();
    __testing.setSceneService(null); rmSync(directory, { recursive: true, force: true });
  });
  await migrate(db);
  db.prepare('INSERT INTO campaigns (id,name,owner_user_id) VALUES (?,?,?)').run('campaign', 'Test', MASTER.id);
  const repository = new SceneRepository(db);
  repository.createAndActivate({ id: 'scene', campaignId: 'campaign', name: 'Ingresso', document: createDefaultSceneDocument() });
  const service = new SceneService({ repository, campaignId: 'campaign', validateScene: __testing.validateScenePreparation });
  service.load(); __testing.setSceneService(service); __testing.setBattleMapState({ tokens: [] });
  __testing.setUserRepository({ findById: (id) => id === MASTER.id ? MASTER : null });
  __testing.streamClients.add(client);
  registerSceneRoutes(app, { service,
    getUser: (request) => ({ master: MASTER, player: PLAYER })[request.headers['x-user']] ?? null,
    onActiveSceneUpdated: __testing.refreshActiveSceneProjection,
  });
  const request = (method, suffix, payload) => app.inject({ method, url: '/api/scenes/scene' + suffix,
    headers: { 'x-user': 'master' }, payload });
  const write = async (method, suffix, payload) => {
    const version = service.getScene('scene').version, broadcastCount = chunks.length;
    const response = await request(method, suffix, { baseVersion: version, ...payload });
    assert.equal(response.statusCode, method === 'POST' ? 201 : 200, response.body);
    assert.equal(response.json().version, version + 1);
    assert.equal(repository.findById('scene').version, version + 1);
    assert.equal(chunks.length, broadcastCount + 1);
    return response.json();
  };
  return { db, path, repository, service, chunks, request, write };
}

async function prepare(f) {
  let scene = await f.write('POST', '/encounters', { encounter: { name: 'Guardie al portone', kind: 'combat', description: 'Preparazione' } });
  const encounterId = scene.document.encounters[0].id;
  const base = `/encounters/${encounterId}`;
  scene = await f.write('POST', base + '/entities', { entity: { kind: 'monster', name: 'Ogre',
    tokenProperties: { hitPoints: 27, maxHitPoints: 27, movementCells: 6, widthCells: 2, heightCells: 2 } } });
  const monster = scene.document.entityReferences[0].id;
  scene = await f.write('POST', base + '/entities', { entity: { kind: 'npc', name: 'Sentinella',
    tokenProperties: { hitPoints: 9, maxHitPoints: 9, movementCells: 6 } } });
  const npc = scene.document.entityReferences[1].id;
  scene = await f.write('POST', base + '/placements', { placement: { entityReferenceId: monster,
    position: { x: 4, y: 4 }, widthCells: 3, heightCells: 2, isHidden: false } });
  const placementId = scene.document.preparedPlacements[0].id;
  scene = await f.write('POST', base + '/placements', { placement: { entityReferenceId: npc,
    position: { x: 12, y: 6 }, isHidden: true } });
  scene = await f.write('PATCH', base + `/entities/${monster}`, { entity: { kind: 'monster', name: 'Ogre capo',
    tokenProperties: { hitPoints: 31, maxHitPoints: 31, movementCells: 6, widthCells: 2, heightCells: 2 } } });
  scene = await f.write('PATCH', base + `/placements/${placementId}`, { placement: { position: { x: 5, y: 4 }, widthCells: 4 } });
  return { scene, base, monster, npc, placementId };
}

// A separate Node process reopens the database without any memory from the authoring
// process. HTTP route handlers run via app.inject, so no TCP port or live game is used.
const REOPEN = `
import Fastify from 'fastify';
import { openDatabase } from './database/connection.mjs';
import { SceneRepository } from './server/scene-repository.mjs';
import { SceneService } from './server/scene-service.mjs';
import { registerSceneRoutes } from './server/scene-routes.mjs';
import { EncounterPlacementRuntime } from './server/encounter-placement-runtime.mjs';
import { __testing } from './server/index.mjs';
const db = openDatabase();
const service = new SceneService({ repository: new SceneRepository(db), campaignId: 'campaign' });
service.load();
const scene = service.getActiveScene();
const runtime = new EncounterPlacementRuntime();
__testing.setSceneService(service);
__testing.setBattleMapState({ tokens: runtime.project(scene, []) });
const app = Fastify();
registerSceneRoutes(app, { service, getUser: request => ({ role: request.headers['x-role'] }) });
try {
  const master = await app.inject({ method: 'GET', url: '/api/scenes/scene', headers: { 'x-role': 'master' } });
  const player = await app.inject({ method: 'GET', url: '/api/scenes/scene', headers: { 'x-role': 'adventurer' } });
  process.stdout.write(JSON.stringify({ scene: master.json(), masterStatus: master.statusCode,
    playerStatus: player.statusCode, state: __testing.getBattleMapState() }));
} finally { await app.close(); db.close(); }
`;

async function reopen(path) {
  const env = { ...process.env, VTT_DB_PATH: path, BATTLE_MAP_TEST_MODE: '1' };
  delete env.NODE_TEST_CONTEXT;
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), env, timeout: 15000,
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
    child.stdin.on('error', reject);
    child.stdin.end(REOPEN);
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('fresh process recovers authored encounter/entity/placement values without live HP, movement, conditions or rounds', async (t) => {
  const f = await fixture(t), { scene, placementId } = await prepare(f);
  const raw = f.db.prepare('SELECT document_json FROM scenes WHERE id = ?').get('scene').document_json;
  const stored = JSON.parse(raw);
  assert.equal(stored.runtime, undefined); assert.equal(stored.roundNumber, undefined);
  const headers = { cookie: `battle_map_session=${__testing.createSession(MASTER)}` };
  const moved = await __testing.app.inject({ method: 'POST', url: '/api/battle-map/move', headers,
    payload: { tokenId: placementId, x: 18, y: 18 } });
  assert.equal(moved.statusCode, 200, moved.body);
  const live = structuredClone(__testing.getBattleMapState());
  const token = live.tokens.find((candidate) => candidate.id === placementId);
  token.hitPoints = 2; token.conditions = ['prone'];
  Object.assign(live, { sessionMode: 'combat', isRoundStarted: true, roundNumber: 5, activeTurnTokenId: placementId,
    initiatives: [{ tokenId: placementId, value: 15, source: 'manual', dexModifier: 0, tiebreaker: .5 }],
    movementUsedByTokenId: { [placementId]: 4 } });
  const changed = await __testing.app.inject({ method: 'PUT', url: '/api/battle-map/state', headers,
    payload: { baseVersion: __testing.getBattleMapVersion(), state: live } });
  assert.equal(changed.statusCode, 200, changed.body);
  const accepted = __testing.getBattleMapState();
  assert.equal(accepted.roundNumber, 5); assert.equal(accepted.activeTurnTokenId, placementId);
  assert.equal(accepted.movementUsedByTokenId[placementId], 4);
  const liveToken = accepted.tokens.find((candidate) => candidate.id === placementId);
  assert.equal(liveToken.hitPoints, 2); assert.deepEqual(liveToken.position, { x: 18, y: 18 });
  assert.deepEqual(liveToken.conditions, ['prone']);
  assert.equal(f.db.prepare('SELECT document_json FROM scenes WHERE id = ?').get('scene').document_json, raw);
  assert.equal(f.repository.findById('scene').version, scene.version);
  f.db.close();
  const recovered = await reopen(f.path);
  assert.equal(recovered.masterStatus, 200); assert.equal(recovered.playerStatus, 403);
  assert.equal(recovered.scene.version, scene.version);
  assert.deepEqual(recovered.scene.document, scene.document);
  const initial = recovered.state.tokens.find((candidate) => candidate.id === placementId);
  assert.equal(initial.name, 'Ogre capo'); assert.equal(initial.hitPoints, 31); assert.equal(initial.widthCells, 4);
  assert.deepEqual(initial.position, { x: 5, y: 4 }); assert.deepEqual(initial.conditions, []);
  assert.equal(recovered.state.tokens.find((candidate) => candidate.id !== placementId).isInvisible, true);
  assert.equal(recovered.state.sessionMode, 'exploration'); assert.equal(recovered.state.roundNumber, 1);
  assert.equal(recovered.state.activeTurnTokenId, null); assert.deepEqual(recovered.state.movementUsedByTokenId, {});
  const again = await reopen(f.path);
  assert.deepEqual(again.scene.document, recovered.scene.document);
  assert.equal(again.state.tokens.length, 2); // second startup does not duplicate prepared instances
});

test('removed placements and definitions stay removed after reopening without resurrecting tokens', async (t) => {
  const f = await fixture(t), { base, monster, placementId } = await prepare(f);
  await f.write('DELETE', base + `/placements/${placementId}`);
  const scene = await f.write('DELETE', base + `/entities/${monster}`);
  f.db.close();
  const recovered = await reopen(f.path);
  assert.deepEqual(recovered.scene.document, scene.document);
  assert.equal(recovered.scene.document.encounters.length, 1);
  assert.equal(recovered.scene.document.entityReferences.length, 1);
  assert.equal(recovered.state.tokens.length, 1);
  assert.equal(recovered.state.tokens[0].name, 'Sentinella');
  assert.ok(!recovered.state.tokens.some((token) => token.id === placementId));
});

test('competing services and orphan writes cannot overwrite a persisted encounter preparation', async (t) => {
  const f = await fixture(t), { scene, base, placementId } = await prepare(f);
  const otherDb = openDatabase({ path: f.path });
  try {
    const stale = new SceneService({ repository: new SceneRepository(otherDb), campaignId: 'campaign' }); stale.load();
    const updated = await f.write('PATCH', base + `/placements/${placementId}`, { placement: { isHidden: true } });
    assert.throws(() => stale.mutateEncounterPlacement({ id: 'scene', encounterId: scene.document.encounters[0].id,
      placementId, expectedVersion: scene.version, mode: 'update', placement: { position: { x: 20, y: 20 } } }),
    (error) => error.statusCode === 409 && error.currentScene.version === updated.version);
    const invalid = structuredClone(updated.document);
    invalid.preparedPlacements[0].entityReferenceId = 'orphan';
    assert.throws(() => f.repository.saveVersion({ id: 'scene', campaignId: 'campaign', expectedVersion: updated.version,
      name: updated.name, document: invalid, sortOrder: updated.sortOrder }), /references missing entity/);
    assert.deepEqual(f.repository.findById('scene'), f.service.getScene('scene'));
    assert.equal(f.repository.findById('scene').version, updated.version);
  } finally { otherDb.close(); }
});

test('SQLite transaction failure preserves stored document, scene cache, live projection, versions and broadcasts', async (t) => {
  const f = await fixture(t), { base, placementId } = await prepare(f);
  const before = f.repository.findById('scene'), live = structuredClone(__testing.getBattleMapState());
  const version = __testing.getBattleMapVersion(), count = f.chunks.length;
  f.db.exec("CREATE TRIGGER reject_scene_write BEFORE UPDATE ON scenes BEGIN SELECT RAISE(ABORT, 'injected write failure'); END");
  try {
    const response = await f.request('PATCH', base + `/placements/${placementId}`, {
      baseVersion: before.version, placement: { position: { x: 20, y: 20 } },
    });
    assert.equal(response.statusCode, 500);
    assert.deepEqual(f.repository.findById('scene'), before);
    assert.deepEqual(f.service.getScene('scene'), before);
    assert.deepEqual(__testing.getBattleMapState(), live);
    assert.equal(__testing.getBattleMapVersion(), version); assert.equal(f.chunks.length, count);
  } finally { f.db.exec('DROP TRIGGER reject_scene_write'); }
});
