import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';

process.env.BATTLE_MAP_TEST_MODE = '1';
const { __testing } = await import('../server/index.mjs');

const MASTER = { id: 'master-user', username: 'master', displayName: 'Master', role: 'master' };
const PLAYER_ONE = { id: 'player-one', username: 'one', displayName: 'One', role: 'adventurer' };
const PLAYER_TWO = { id: 'player-two', username: 'two', displayName: 'Two', role: 'adventurer' };
const users = new Map([MASTER, PLAYER_ONE, PLAYER_TWO].map((user) => [user.id, user]));
__testing.setUserRepository({ findById: (id) => users.get(id) ?? null });

function sessionHeaders(user) {
  return { cookie: `battle_map_session=${__testing.createSession(user)}` };
}

function makeScene(id, name, version, marker) {
  const document = createDefaultSceneDocument();
  document.elements = [{ id: `element-${marker}`, kind: 'rock', position: { x: 1, y: 1 }, widthCells: 1, heightCells: 1,
    rotation: 0, blocksMovement: true, blocksVision: false }];
  return { id, name, version, document };
}

function fakeClient(user) {
  const chunks = [];
  return {
    user,
    write: (chunk) => chunks.push(chunk),
    snapshots: () => chunks
      .filter((chunk) => chunk.startsWith('data: '))
      .map((chunk) => JSON.parse(chunk.slice(6))),
  };
}

test('HTTP and SSE provide Master catalog summaries while two Players receive only the active scene', async () => {
  const active = makeScene('scene-active', 'Attiva', 3, 'ACTIVE-ASSET');
  const inactive = makeScene('scene-secret', 'Preparazione segreta', 9, 'INACTIVE-ASSET-MARKER');
  active.document.drawings = [{ id: 'visible-stroke', color: '#ffffff', widthCells: 0.12, points: [{ x: 1.25, y: 2.5 }] }];
  active.document.encounters = [{ id: 'encounter-active', name: 'PRIVATE-ACTIVE-ENCOUNTER', kind: 'narrative', description: '' }];
  inactive.document.drawings = [{ id: 'secret-stroke', color: '#ffffff', widthCells: 0.12, points: [{ x: 4, y: 5 }] }];
  __testing.setSceneService({
    getActiveScene: () => structuredClone(active),
    getCatalog: () => structuredClone([active, inactive]),
  });
  __testing.setBattleMapState({ tokens: [], sharedNotes: '' });

  const [masterResponse, firstResponse, secondResponse] = await Promise.all([
    __testing.app.inject({ method: 'GET', url: '/api/battle-map/state', headers: sessionHeaders(MASTER) }),
    __testing.app.inject({ method: 'GET', url: '/api/battle-map/state', headers: sessionHeaders(PLAYER_ONE) }),
    __testing.app.inject({ method: 'GET', url: '/api/battle-map/state', headers: sessionHeaders(PLAYER_TWO) }),
  ]);

  assert.equal(masterResponse.statusCode, 200);
  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 200);
  assert.equal(masterResponse.json().state.sceneCatalog.length, 2);
  for (const response of [firstResponse, secondResponse]) {
    assert.equal(response.json().state.activeSceneId, 'scene-active');
    assert.equal(response.json().state.activeSceneVersion, 3);
    assert.deepEqual(response.json().state.activeSceneDrawings, active.document.drawings);
    assert.deepEqual(response.json().state.activeSceneElements, active.document.elements);
    assert.equal('sceneCatalog' in response.json().state, false);
    assert.equal(JSON.stringify(response.json()).includes('Preparazione segreta'), false);
    assert.equal(JSON.stringify(response.json()).includes('secret-stroke'), false);
    assert.equal(JSON.stringify(response.json()).includes('PRIVATE-ACTIVE-ENCOUNTER'), false);
  }
  assert.equal(JSON.stringify(masterResponse.json()).includes('INACTIVE-ASSET-MARKER'), false);

  const clients = [fakeClient(MASTER), fakeClient(PLAYER_ONE), fakeClient(PLAYER_TWO)];
  clients.forEach((client) => __testing.streamClients.add(client));
  try {
    const masterState = masterResponse.json().state;
    const mutation = await __testing.app.inject({
      method: 'PUT',
      url: '/api/battle-map/state',
      headers: sessionHeaders(MASTER),
      payload: { baseVersion: 1, state: { ...masterState, sharedNotes: 'broadcast' } },
    });
    assert.equal(mutation.statusCode, 200);

    assert.equal(clients[0].snapshots()[0].state.sceneCatalog.length, 2);
    for (const client of clients.slice(1)) {
      const snapshot = client.snapshots()[0];
      assert.equal(snapshot.state.activeSceneId, 'scene-active');
      assert.deepEqual(snapshot.state.activeSceneDrawings, active.document.drawings);
      assert.deepEqual(snapshot.state.activeSceneElements, active.document.elements);
      assert.equal('sceneCatalog' in snapshot.state, false);
      assert.equal(JSON.stringify(snapshot).includes('Preparazione segreta'), false);
      assert.equal(JSON.stringify(snapshot).includes('secret-stroke'), false);
      assert.equal(JSON.stringify(snapshot).includes('PRIVATE-ACTIVE-ENCOUNTER'), false);
    }
  } finally {
    clients.forEach((client) => __testing.streamClients.delete(client));
    __testing.setSceneService(null);
  }
});

test('an installed scene transition broadcasts the new projection to Master and two Players without reconnecting', () => {
  const previous = makeScene('scene-old', 'Vecchia', 1, 'OLD');
  const target = makeScene('scene-new', 'Nuova', 2, 'NEW');
  let active = previous;
  const service = {
    getActiveScene: () => structuredClone(active),
    getCatalog: () => structuredClone([previous, target]),
  };
  __testing.setSceneService(service);
  __testing.setBattleMapState({
    sessionMode: 'combat', isRoundStarted: false,
    initiatives: [{ tokenId: 'old-token', value: 10 }], activeTurnTokenId: 'old-token',
    movementUsedByTokenId: { 'old-token': 2 }, tokens: [],
  });
  const prepared = __testing.prepareActiveSceneTransition(target);
  assert.equal(prepared.status, 200);

  const clients = [fakeClient(MASTER), fakeClient(PLAYER_ONE), fakeClient(PLAYER_TWO)];
  clients.forEach((client) => __testing.streamClients.add(client));
  try {
    active = target;
    __testing.installPreparedSceneTransition(target, prepared);
    for (const client of clients) {
      const snapshots = client.snapshots();
      assert.equal(snapshots.length, 1);
      assert.equal(snapshots[0].state.activeSceneId, target.id);
      assert.equal(snapshots[0].state.activeSceneVersion, target.version);
      assert.deepEqual(snapshots[0].state.activeSceneElements, target.document.elements);
      assert.deepEqual(snapshots[0].state.initiatives, []);
      assert.equal(snapshots[0].state.activeTurnTokenId, null);
    }
  } finally {
    clients.forEach((client) => __testing.streamClients.delete(client));
    __testing.setSceneService(null);
  }
});

test('scene switches keep live tokens in their own scene and restore them on return', async () => {
  const first = makeScene('scene-one', 'Prima', 1, 'ONE');
  const second = makeScene('scene-two', 'Seconda', 1, 'TWO');
  let active = first;
  __testing.setSceneService({ getActiveScene: () => structuredClone(active), getCatalog: () => [first, second] });
  const firstToken = { id: 'token-one', name: 'Uno', type: 'player', size: 'medium', position: { x: 2, y: 2 }, color: '#ffffff' };
  try {
    __testing.setBattleMapState({ tokens: [firstToken] });
    const toSecond = __testing.prepareActiveSceneTransition(second);
    assert.equal(toSecond.status, 200);
    active = second;
    __testing.installPreparedSceneTransition(second, toSecond);
    assert.deepEqual(__testing.getBattleMapState().tokens, []);

    const duplicate = await __testing.app.inject({
      method: 'PUT', url: '/api/battle-map/state', headers: sessionHeaders(MASTER),
      payload: { baseVersion: __testing.getBattleMapVersion(), state: { ...__testing.getBattleMapState(), tokens: [firstToken] } },
    });
    assert.equal(duplicate.statusCode, 409);
    assert.deepEqual(__testing.getBattleMapState().tokens, []);

    const secondToken = { id: 'token-two', name: 'Due', type: 'enemy', size: 'medium', position: { x: 4, y: 4 }, color: '#ff0000' };
    const mutation = await __testing.app.inject({
      method: 'PUT', url: '/api/battle-map/state', headers: sessionHeaders(MASTER),
      payload: { baseVersion: __testing.getBattleMapVersion(), state: { ...__testing.getBattleMapState(), tokens: [secondToken] } },
    });
    assert.equal(mutation.statusCode, 200);
    const toFirst = __testing.prepareActiveSceneTransition(first);
    active = first;
    __testing.installPreparedSceneTransition(first, toFirst);
    assert.deepEqual(__testing.getBattleMapState().tokens.map((token) => token.id), ['token-one']);
    const again = __testing.prepareActiveSceneTransition(second);
    active = second;
    __testing.installPreparedSceneTransition(second, again);
    assert.deepEqual(__testing.getBattleMapState().tokens.map((token) => token.id), ['token-two']);
  } finally {
    __testing.setSceneService(null);
  }
});
