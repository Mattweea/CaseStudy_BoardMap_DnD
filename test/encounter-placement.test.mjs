import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Fastify from 'fastify';
import { openDatabase } from '../database/connection.mjs';
import { migrate } from '../database/migrator.mjs';
import { createDefaultSceneDocument, normalizeSceneDocument } from '../shared/scene-model.mjs';
import { projectEncounterEntityToken } from '../shared/encounter-token.mjs';
import { SceneRepository } from '../server/scene-repository.mjs';
import { SceneService } from '../server/scene-service.mjs';
import { registerSceneRoutes } from '../server/scene-routes.mjs';
import { EncounterPlacementRuntime } from '../server/encounter-placement-runtime.mjs';

process.env.BATTLE_MAP_TEST_MODE = '1';
const { __testing } = await import('../server/index.mjs');
const MASTER = { id: 'master-user', role: 'master' }, PLAYER = { id: 'player', role: 'adventurer' };
const entity = { id: 'ref', entityId: 'definition', encounterId: 'enc', entityType: 'monster', name: 'Goblin',
  tokenProperties: { hitPoints: 7, widthCells: 2, heightCells: 2 } };
const placement = { id: 'instance', encounterId: 'enc', entityReferenceId: 'ref', position: { x: 3, y: 4 } };
function document() {
  return normalizeSceneDocument({ ...createDefaultSceneDocument(),
    encounters: [{ id: 'enc', kind: 'combat', name: 'Imboscata', description: '' }], entityReferences: [entity] });
}

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'vtt-placement-'));
  const db = openDatabase({ path: join(dir, 'test.sqlite') }); await migrate(db);
  db.prepare('INSERT INTO campaigns (id,name,owner_user_id) VALUES (?,?,?)').run('campaign', 'Test', MASTER.id);
  const repository = new SceneRepository(db);
  repository.createAndActivate({ id: 'scene', campaignId: 'campaign', name: 'Scena', document: document() });
  const service = new SceneService({ repository, campaignId: 'campaign', validateScene: __testing.validateScenePreparation });
  service.load(); __testing.setSceneService(service); __testing.setBattleMapState({ tokens: [], sessionMode: 'exploration' });
  const app = Fastify();
  registerSceneRoutes(app, { service,
    getUser: (request) => ({ master: MASTER, player: PLAYER })[request.headers['x-user']] ?? null,
    onActiveSceneUpdated: __testing.refreshActiveSceneProjection,
    prepareSceneActivation: __testing.prepareActiveSceneTransition,
    onSceneActivated: __testing.installPreparedSceneTransition,
  });
  const url = '/api/scenes/scene/encounters/enc/placements';
  return { service, repository, app, url,
    request: (method, suffix = '', body = {}, role = 'master') => app.inject({ method, url: url + suffix,
      headers: role ? { 'x-user': role } : {}, payload: { baseVersion: service.getScene('scene').version, ...body } }),
    close: async () => { await app.close(); db.close(); rmSync(dir, { recursive: true, force: true }); __testing.setSceneService(null); },
  };
}

test('placement validation rejects orphans, mismatched encounters, invalid geometry and privileged fields', () => {
  const config = document();
  for (const invalid of [
    { ...placement, entityReferenceId: 'missing' }, { ...placement, encounterId: 'missing' },
    { ...placement, position: { x: -1, y: 0 } }, { ...placement, position: { x: 29, y: 0 } },
    { ...placement, widthCells: 1.5 }, { ...placement, heightCells: 0 }, { ...placement, isHidden: 'true' },
  ]) assert.throws(() => normalizeSceneDocument({ ...config, preparedPlacements: [invalid] }));
  const normalized = normalizeSceneDocument({ ...config, preparedPlacements: [{ ...placement, widthCells: 3, isHidden: true }] });
  const token = projectEncounterEntityToken({ entity, placement: normalized.preparedPlacements[0] });
  assert.equal(token.widthCells, 3); assert.equal(token.heightCells, 2); assert.equal(token.isInvisible, true);
  assert.equal(token.ownerUserId, null); assert.equal(token.id, placement.id);
});

test('placement create/update/remove is Master-only, versioned, projected once and sanitized per recipient', async () => {
  const f = await fixture(); const chunks = [];
  const client = { user: MASTER, write: (chunk) => chunks.push(chunk) }; __testing.streamClients.add(client);
  try {
    for (const [role, status] of [[null, 401], ['player', 403]]) {
      for (const method of ['POST', 'PATCH', 'DELETE']) {
        const response = await f.request(method, method === 'POST' ? '' : '/missing', { placement }, role);
        assert.equal(response.statusCode, status);
      }
    }
    assert.equal((await f.request('POST', '', { placement: { ...placement, ownerUserId: 'player' } })).statusCode, 400);
    const version = f.service.getScene('scene').version;
    const created = await f.request('POST', '', { placement: { entityReferenceId: 'ref', position: { x: 3, y: 4 }, isHidden: true } });
    assert.equal(created.statusCode, 201);
    const placed = created.json().document.preparedPlacements[0], id = placed.id;
    assert.equal(created.json().version, version + 1);
    assert.equal(chunks.length, 1); assert.equal(__testing.getBattleMapVersion(), 2);
    assert.equal(__testing.nextSnapshot(MASTER).state.tokens[0].id, id);
    assert.equal(__testing.nextSnapshot(PLAYER).state.tokens.length, 0);
    assert.equal(__testing.getBattleMapState().sessionMode, 'exploration');
    const stale = await f.request('PATCH', '/' + id, { baseVersion: version, placement: { position: { x: 8, y: 4 } } });
    assert.equal(stale.statusCode, 409); assert.equal(chunks.length, 1);
    const updated = await f.request('PATCH', '/' + id, { placement: { position: { x: 8, y: 4 }, widthCells: 3, isHidden: false } });
    assert.equal(updated.statusCode, 200); assert.equal(chunks.length, 2);
    const token = __testing.nextSnapshot(PLAYER).state.tokens[0];
    assert.equal(token.id, id); assert.equal(token.widthCells, 3); assert.deepEqual(token.position, { x: 8, y: 4 });
    assert.equal(f.repository.findById('scene').document.preparedPlacements[0].id, id);
    const removed = await f.request('DELETE', '/' + id);
    assert.equal(removed.statusCode, 200); assert.equal(chunks.length, 3);
    assert.deepEqual(__testing.getBattleMapState().tokens, []);
    assert.equal(f.service.getScene('scene').document.entityReferences.length, 1);
  } finally { __testing.streamClients.delete(client); await f.close(); }
});

test('overlap, invalid references, stale writes and SQLite errors leave preparation and live state unchanged', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request('POST', '', { placement: { entityReferenceId: 'ref', position: { x: 3, y: 4 } } })).statusCode, 201);
    const before = structuredClone(__testing.getBattleMapState()), scene = f.service.getScene('scene'), version = __testing.getBattleMapVersion();
    for (const bad of [
      { entityReferenceId: 'ref', position: { x: 3, y: 4 } },
      { entityReferenceId: 'missing', position: { x: 10, y: 4 } },
      { entityReferenceId: 'ref', position: { x: 29, y: 4 } },
    ]) assert.equal((await f.request('POST', '', { placement: bad })).statusCode, 400);
    const save = f.repository.saveVersion;
    f.repository.saveVersion = () => { throw new Error('Injected SQLite failure'); };
    assert.equal((await f.request('POST', '', { placement: { entityReferenceId: 'ref', position: { x: 12, y: 4 } } })).statusCode, 500);
    f.repository.saveVersion = save;
    assert.deepEqual(f.service.getScene('scene'), scene);
    assert.deepEqual(__testing.getBattleMapState(), before); assert.equal(__testing.getBattleMapVersion(), version);
    assert.equal((await f.app.inject({ method: 'DELETE', url: '/api/scenes/scene/encounters/enc', headers: { 'x-user': 'master' }, payload: { baseVersion: scene.version } })).statusCode, 409);
  } finally { await f.close(); }
});

test('preparation reconciliation preserves live changes on unrelated edits and updates only changed initial properties', () => {
  const runtime = new EncounterPlacementRuntime();
  const scene = { id: 'scene', document: normalizeSceneDocument({ ...document(), preparedPlacements: [placement] }) };
  let tokens = runtime.project(scene, []); runtime.remember(scene);
  tokens = [{ ...tokens[0], position: { x: 20, y: 20 }, hitPoints: 1, conditions: ['prone'] }];
  assert.deepEqual(runtime.project(scene, tokens), tokens);
  assert.deepEqual(runtime.project({ ...scene, name: 'Renamed' }, []), []); // no resurrection after live removal
  const edited = structuredClone(scene); edited.document.preparedPlacements[0].isHidden = true;
  const updated = runtime.project(edited, tokens)[0];
  assert.equal(updated.isInvisible, true); assert.equal(updated.hitPoints, 1);
  assert.deepEqual(updated.position, { x: 20, y: 20 }); assert.deepEqual(updated.conditions, ['prone']);
});

test('inactive placements stay private until activation and live changes survive switch away and back', async () => {
  const f = await fixture();
  try {
    const scene = f.service.createScene({ name: 'Segreta', document: document() });
    const created = await f.app.inject({ method: 'POST', url: `/api/scenes/${scene.id}/encounters/enc/placements`,
      headers: { 'x-user': 'master' }, payload: { baseVersion: scene.version, placement: { entityReferenceId: 'ref', position: { x: 6, y: 7 } } } });
    assert.equal(created.statusCode, 201); assert.deepEqual(__testing.getBattleMapState().tokens, []);
    assert.equal(JSON.stringify(__testing.nextSnapshot(PLAYER)).includes('Goblin'), false);
    const activate = async (id) => f.app.inject({ method: 'POST', url: `/api/scenes/${id}/activate`,
      headers: { 'x-user': 'master' }, payload: { baseVersion: f.service.getScene(id).version } });
    assert.equal((await activate(scene.id)).statusCode, 200);
    assert.equal(__testing.getBattleMapState().tokens[0].name, 'Goblin');
    // Simulate live changes to isolate scene-switch reconciliation from movement routing.
    const token = __testing.getBattleMapState().tokens[0]; token.position = { x: 10, y: 10 }; token.hitPoints = 2;
    assert.equal((await activate('scene')).statusCode, 200);
    const inactive = f.service.getScene(scene.id);
    assert.equal((await f.app.inject({ method: 'PATCH', url: `/api/scenes/${scene.id}`, headers: { 'x-user': 'master' },
      payload: { baseVersion: inactive.version, name: 'Sempre segreta' } })).statusCode, 200);
    assert.equal((await activate(scene.id)).statusCode, 200);
    assert.deepEqual(__testing.getBattleMapState().tokens[0].position, { x: 10, y: 10 });
    assert.equal(__testing.getBattleMapState().tokens[0].hitPoints, 2);
    assert.deepEqual(f.service.getScene(scene.id).document.preparedPlacements[0].position, { x: 6, y: 7 });
  } finally { await f.close(); }
});
