import assert from 'node:assert/strict';
import test from 'node:test';

process.env.BATTLE_MAP_TEST_MODE = '1';
const { __testing } = await import('../server/index.mjs');

const MASTER = { id: 'master-user', username: 'master', displayName: 'Master', role: 'master' };
const PLAYER = { id: 'player-ilthar', username: 'ilthar', displayName: 'Ilthar', role: 'adventurer' };
const OTHER_PLAYER = { id: 'player-thalendir', username: 'thalendir', displayName: 'Thalendir', role: 'adventurer' };

const usersById = new Map([MASTER, PLAYER, OTHER_PLAYER].map((user) => [user.id, user]));
__testing.setUserRepository({ findById: (id) => usersById.get(id) ?? null });

function sessionHeaders(user) {
  return { cookie: `battle_map_session=${__testing.createSession(user)}` };
}

function fakeClient(user) {
  const rawChunks = [];
  return {
    user,
    write: (chunk) => rawChunks.push(chunk),
    events: () =>
      rawChunks.map((chunk) => {
        const [eventLine, dataLine] = chunk.trim().split('\n');
        return { event: eventLine.replace('event: ', ''), data: JSON.parse(dataLine.replace('data: ', '')) };
      }),
  };
}

test('a ping is rejected for an invalid position and never changes shared state', async () => {
  __testing.setBattleMapState({ tokens: [] });
  const before = __testing.getBattleMapVersion();

  const response = await __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/ping',
    headers: sessionHeaders(PLAYER),
    payload: { position: { x: -1, y: 0 } },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(__testing.getBattleMapVersion(), before);
});

test('a ping is broadcast to connected clients with the session author, never the one the client declares', async () => {
  __testing.setBattleMapState({ tokens: [] });
  const before = __testing.getBattleMapVersion();
  const listener = fakeClient(OTHER_PLAYER);
  __testing.streamClients.add(listener);

  try {
    const response = await __testing.app.inject({
      method: 'POST',
      url: '/api/battle-map/ping',
      headers: sessionHeaders(PLAYER),
      payload: { position: { x: 2, y: 3 }, authorUserId: MASTER.id },
    });
    assert.equal(response.statusCode, 200);

    const [event] = listener.events();
    assert.equal(event.event, 'ephemeral-ping');
    assert.deepEqual(event.data.position, { x: 2, y: 3 });
    assert.equal(event.data.authorUserId, PLAYER.id);
    assert.equal(__testing.getBattleMapVersion(), before);
    assert.equal('ping' in __testing.getBattleMapState(), false);
  } finally {
    __testing.streamClients.delete(listener);
  }
});

test('an invalid template payload is rejected without broadcasting anything', async () => {
  __testing.setBattleMapState({ tokens: [] });
  const listener = fakeClient(OTHER_PLAYER);
  __testing.streamClients.add(listener);

  try {
    const cases = [
      { id: 'tpl-1', phase: 'update', shape: 'hexagon', origin: { x: 0, y: 0 }, target: { x: 1, y: 1 }, color: '#fff' },
      { id: 'tpl-1', phase: 'update', shape: 'circle', origin: { x: -1, y: 0 }, target: { x: 1, y: 1 }, color: '#fff' },
      { id: '', phase: 'update', shape: 'circle', origin: { x: 0, y: 0 }, target: { x: 1, y: 1 }, color: '#fff' },
      { id: 'tpl-1', phase: 'update', shape: 'circle', origin: { x: 0, y: 0 }, target: { x: 1, y: 1 }, color: '' },
    ];

    for (const payload of cases) {
      const response = await __testing.app.inject({
        method: 'POST',
        url: '/api/battle-map/template',
        headers: sessionHeaders(PLAYER),
        payload,
      });
      assert.equal(response.statusCode, 400, JSON.stringify(payload));
    }

    assert.equal(listener.events().length, 0);
  } finally {
    __testing.streamClients.delete(listener);
  }
});

test('a template update is attributed to the session author and does not touch shared state', async () => {
  __testing.setBattleMapState({ tokens: [] });
  const before = __testing.getBattleMapVersion();
  const listener = fakeClient(OTHER_PLAYER);
  __testing.streamClients.add(listener);

  try {
    const response = await __testing.app.inject({
      method: 'POST',
      url: '/api/battle-map/template',
      headers: sessionHeaders(PLAYER),
      payload: {
        id: 'tpl-1',
        phase: 'update',
        shape: 'cone',
        origin: { x: 0, y: 0 },
        target: { x: 3, y: 0 },
        color: '#ff8800',
        authorUserId: MASTER.id,
      },
    });
    assert.equal(response.statusCode, 200);

    const [event] = listener.events();
    assert.equal(event.event, 'ephemeral-template');
    assert.equal(event.data.authorUserId, PLAYER.id);
    assert.equal(event.data.shape, 'cone');
    assert.equal(__testing.getBattleMapVersion(), before);

    const endResponse = await __testing.app.inject({
      method: 'POST',
      url: '/api/battle-map/template',
      headers: sessionHeaders(PLAYER),
      payload: { id: 'tpl-1', phase: 'end' },
    });
    assert.equal(endResponse.statusCode, 200);
    const events = listener.events();
    assert.equal(events[1].event, 'ephemeral-template-end');
    assert.equal(events[1].data.id, 'tpl-1');
  } finally {
    __testing.streamClients.delete(listener);
  }
});

test('a template originating on a token invisible to the recipient is not delivered to them', async () => {
  const invisibleToken = {
    id: 'hidden-1',
    name: 'Ombra',
    type: 'player',
    size: 'medium',
    position: { x: 0, y: 0 },
    color: '#000',
    initiativeModifier: 0,
    ownerUserId: OTHER_PLAYER.id,
    isInvisible: true,
    conditions: [],
  };
  __testing.setBattleMapState({ tokens: [invisibleToken] });
  const blindListener = fakeClient(PLAYER);
  const ownerListener = fakeClient(OTHER_PLAYER);
  const masterListener = fakeClient(MASTER);
  __testing.streamClients.add(blindListener);
  __testing.streamClients.add(ownerListener);
  __testing.streamClients.add(masterListener);

  try {
    const response = await __testing.app.inject({
      method: 'POST',
      url: '/api/battle-map/template',
      headers: sessionHeaders(OTHER_PLAYER),
      payload: {
        id: 'tpl-hidden',
        phase: 'update',
        shape: 'circle',
        origin: { x: 0, y: 0 },
        target: { x: 2, y: 0 },
        color: '#ff0000',
      },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(blindListener.events().length, 0);
    assert.equal(ownerListener.events().length, 1);
    assert.equal(masterListener.events().length, 1);
  } finally {
    __testing.streamClients.delete(blindListener);
    __testing.streamClients.delete(ownerListener);
    __testing.streamClients.delete(masterListener);
  }
});

test('a client connecting fresh finds no trace of a past ping or template in its snapshot', async () => {
  __testing.setBattleMapState({ tokens: [] });
  await __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/ping',
    headers: sessionHeaders(PLAYER),
    payload: { position: { x: 1, y: 1 } },
  });
  await __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/template',
    headers: sessionHeaders(PLAYER),
    payload: { id: 'tpl-gone', phase: 'update', shape: 'line', origin: { x: 0, y: 0 }, target: { x: 1, y: 0 }, color: '#fff' },
  });

  const state = await __testing.app.inject({
    method: 'GET',
    url: '/api/battle-map/state',
    headers: sessionHeaders(OTHER_PLAYER),
  });
  const serialized = JSON.stringify(state.json());
  assert.equal(serialized.includes('ping'), false);
  assert.equal(serialized.includes('tpl-gone'), false);
});
