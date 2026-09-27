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
  document.elements = [{ id: `element-${id}`, kind: marker, position: { x: 1, y: 1 } }];
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
    assert.equal('sceneCatalog' in response.json().state, false);
    assert.equal(JSON.stringify(response.json()).includes('Preparazione segreta'), false);
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
      assert.equal('sceneCatalog' in snapshot.state, false);
      assert.equal(JSON.stringify(snapshot).includes('Preparazione segreta'), false);
    }
  } finally {
    clients.forEach((client) => __testing.streamClients.delete(client));
    __testing.setSceneService(null);
  }
});
