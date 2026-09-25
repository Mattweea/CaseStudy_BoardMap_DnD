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

function heroToken(overrides = {}) {
  return {
    id: 'hero-1',
    name: 'Hero',
    type: 'player',
    size: 'medium',
    position: { x: 0, y: 0 },
    color: '#2f9e44',
    initiativeModifier: 0,
    movementCells: 6,
    ownerUserId: PLAYER.id,
    conditions: [],
    ...overrides,
  };
}

function withActiveTurn(state) {
  return {
    ...state,
    initiatives: [{ tokenId: 'hero-1', value: 10, source: 'manual' }],
    activeTurnTokenId: 'hero-1',
  };
}

async function move(user, body) {
  return __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/move',
    headers: sessionHeaders(user),
    payload: body,
  });
}

test('x/y and waypoints payloads produce the same result on a straight move', async () => {
  __testing.setBattleMapState(withActiveTurn({ tokens: [heroToken()] }));
  const byXY = await move(PLAYER, { tokenId: 'hero-1', x: 3, y: 0 });
  assert.equal(byXY.statusCode, 200);
  assert.deepEqual(byXY.json().state.tokens[0].position, { x: 3, y: 0 });
  assert.equal(byXY.json().state.movementUsedByTokenId['hero-1'], 3);

  __testing.setBattleMapState(withActiveTurn({ tokens: [heroToken()] }));
  const byWaypoints = await move(PLAYER, {
    tokenId: 'hero-1',
    waypoints: [{ x: 0, y: 0 }, { x: 3, y: 0 }],
  });
  assert.equal(byWaypoints.statusCode, 200);
  assert.deepEqual(byWaypoints.json().state.tokens[0].position, { x: 3, y: 0 });
  assert.equal(byWaypoints.json().state.movementUsedByTokenId['hero-1'], 3);
});

test('an invalid waypoints payload is rejected with 400 and leaves the token in place', async () => {
  const cases = [
    { waypoints: [] },
    { waypoints: [{ x: 0, y: 0 }] },
    { waypoints: Array.from({ length: 41 }, (_, index) => ({ x: index, y: 0 })) },
    { waypoints: [{ x: 0, y: 0 }, { x: 1.5, y: 0 }] },
    { waypoints: [{ x: 0, y: 0 }, { x: -1, y: 0 }] },
    { waypoints: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }, // does not start at the token's current position
  ];

  for (const body of cases) {
    __testing.setBattleMapState(withActiveTurn({ tokens: [heroToken()] }));
    const response = await move(PLAYER, { tokenId: 'hero-1', ...body });
    assert.equal(response.statusCode, 400, JSON.stringify(body));
    assert.deepEqual(__testing.getBattleMapState().tokens[0].position, { x: 0, y: 0 });
  }
});

test('an L-shaped path costs 6 cells under both diagonal rules', async () => {
  for (const diagonalRule of ['standard', 'alternating']) {
    __testing.setBattleMapState(withActiveTurn({ tokens: [heroToken()], diagonalRule }));
    const response = await move(PLAYER, {
      tokenId: 'hero-1',
      waypoints: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }],
    });
    assert.equal(response.statusCode, 200, diagonalRule);
    assert.equal(response.json().state.movementUsedByTokenId['hero-1'], 6, diagonalRule);
  }
});

test('three diagonal steps cost 3 with standard and 4 with alternating', async () => {
  __testing.setBattleMapState(withActiveTurn({ tokens: [heroToken()], diagonalRule: 'standard' }));
  const standard = await move(PLAYER, { tokenId: 'hero-1', waypoints: [{ x: 0, y: 0 }, { x: 3, y: 3 }] });
  assert.equal(standard.json().state.movementUsedByTokenId['hero-1'], 3);

  __testing.setBattleMapState(withActiveTurn({ tokens: [heroToken()], diagonalRule: 'alternating' }));
  const alternating = await move(PLAYER, { tokenId: 'hero-1', waypoints: [{ x: 0, y: 0 }, { x: 3, y: 3 }] });
  assert.equal(alternating.json().state.movementUsedByTokenId['hero-1'], 4);
});

test('an obstacle on an intermediate segment blocks the request without a partial move', async () => {
  const obstacle = {
    id: 'crate-1',
    name: 'Cassa',
    type: 'object',
    size: 'medium',
    position: { x: 1, y: 0 },
    color: '#e67700',
    initiativeModifier: 0,
    blocksMovement: true,
    conditions: [],
  };
  __testing.setBattleMapState(withActiveTurn({ tokens: [heroToken(), obstacle] }));
  const response = await move(PLAYER, {
    tokenId: 'hero-1',
    waypoints: [{ x: 0, y: 0 }, { x: 3, y: 0 }],
  });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /blocca il movimento/);
  assert.deepEqual(__testing.getBattleMapState().tokens[0].position, { x: 0, y: 0 });
  assert.equal(__testing.getBattleMapState().movementUsedByTokenId['hero-1'] ?? 0, 0);
});

test('the server ignores any cost declared by the client and charges the recalculated cost', async () => {
  __testing.setBattleMapState(withActiveTurn({ tokens: [heroToken({ movementCells: 2 })] }));
  const response = await move(PLAYER, {
    tokenId: 'hero-1',
    waypoints: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }],
    cost: 1,
  });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /Movimento insufficiente/);
  assert.deepEqual(__testing.getBattleMapState().tokens[0].position, { x: 0, y: 0 });
});

test('the master ignores budget and obstacles when moving a token', async () => {
  const obstacle = {
    id: 'crate-1',
    name: 'Cassa',
    type: 'object',
    size: 'medium',
    position: { x: 1, y: 0 },
    color: '#e67700',
    initiativeModifier: 0,
    blocksMovement: true,
    conditions: [],
  };
  __testing.setBattleMapState(withActiveTurn({ tokens: [heroToken({ movementCells: 1 }), obstacle] }));
  const response = await move(MASTER, {
    tokenId: 'hero-1',
    waypoints: [{ x: 0, y: 0 }, { x: 3, y: 0 }],
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().state.tokens[0].position, { x: 3, y: 0 });
});

test('undoing a move restores position, movement used and diagonal parity, and only for its own author', async () => {
  __testing.setBattleMapState(withActiveTurn({ tokens: [heroToken()], diagonalRule: 'alternating' }));
  const moveResponse = await move(PLAYER, { tokenId: 'hero-1', waypoints: [{ x: 0, y: 0 }, { x: 3, y: 3 }] });
  assert.equal(moveResponse.statusCode, 200);
  assert.equal(moveResponse.json().state.movementUsedByTokenId['hero-1'], 4);
  assert.equal(moveResponse.json().state.diagonalParityByTokenId['hero-1'], 1);

  const otherUndo = await __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/undo',
    headers: sessionHeaders(OTHER_PLAYER),
  });
  assert.equal(otherUndo.statusCode, 400);
  assert.deepEqual(__testing.getBattleMapState().tokens[0].position, { x: 3, y: 3 });

  const undo = await __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/undo',
    headers: sessionHeaders(PLAYER),
  });
  assert.equal(undo.statusCode, 200);
  assert.deepEqual(undo.json().state.tokens[0].position, { x: 0, y: 0 });
  assert.equal(undo.json().state.movementUsedByTokenId['hero-1'] ?? 0, 0);
  assert.equal(undo.json().state.diagonalParityByTokenId['hero-1'] ?? 0, 0);
});

test('a pre-P0.7 snapshot converts its axis usage into movement used, conservatively', async () => {
  __testing.setBattleMapState({
    tokens: [heroToken()],
    initiatives: [{ tokenId: 'hero-1', value: 10, source: 'manual' }],
    activeTurnTokenId: 'hero-1',
    movementAxisUsageByTokenId: { 'hero-1': { horizontal: 5, vertical: 2 } },
  });

  const state = __testing.getBattleMapState();
  assert.equal(state.movementUsedByTokenId['hero-1'], 5);
  assert.equal('movementAxisUsageByTokenId' in state, false);
});

test('movement used already present takes priority over a legacy axis usage conversion', async () => {
  __testing.setBattleMapState({
    tokens: [heroToken()],
    initiatives: [{ tokenId: 'hero-1', value: 10, source: 'manual' }],
    activeTurnTokenId: 'hero-1',
    movementUsedByTokenId: { 'hero-1': 2 },
    movementAxisUsageByTokenId: { 'hero-1': { horizontal: 5, vertical: 5 } },
  });

  assert.equal(__testing.getBattleMapState().movementUsedByTokenId['hero-1'], 2);
});

test('round wrap resets diagonal parity alongside movement used; a mid-round turn does not', async () => {
  __testing.setBattleMapState({
    tokens: [heroToken(), heroToken({ id: 'hero-2', ownerUserId: OTHER_PLAYER.id })],
    initiatives: [
      { tokenId: 'hero-1', value: 10, source: 'manual' },
      { tokenId: 'hero-2', value: 5, source: 'manual' },
    ],
    activeTurnTokenId: 'hero-1',
    roundNumber: 1,
    movementUsedByTokenId: { 'hero-1': 4 },
    diagonalParityByTokenId: { 'hero-1': 1 },
  });

  const midRound = __testing.applyRoundWrapState(__testing.getBattleMapState(), 'next');
  assert.equal(midRound.diagonalParityByTokenId['hero-1'], 1);
  assert.equal(midRound.movementUsedByTokenId['hero-1'], 4);

  const stateAtLastTurn = { ...__testing.getBattleMapState(), activeTurnTokenId: 'hero-2' };
  const wrapped = __testing.applyRoundWrapState(stateAtLastTurn, 'next');
  assert.equal(wrapped.roundNumber, 2);
  assert.deepEqual(wrapped.diagonalParityByTokenId, {});
  assert.deepEqual(wrapped.movementUsedByTokenId, {});
});

test('the master-only settings route rejects non-master callers and invalid values without changing state', async () => {
  __testing.setBattleMapState({ tokens: [] });

  const asPlayer = await __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/settings',
    headers: sessionHeaders(PLAYER),
    payload: { diagonalRule: 'alternating' },
  });
  assert.equal(asPlayer.statusCode, 403);
  assert.equal(__testing.getBattleMapState().diagonalRule, 'standard');

  const zeroCellsValue = await __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/settings',
    headers: sessionHeaders(MASTER),
    payload: { measurementUnit: { label: 'm', cellsValue: 0 } },
  });
  assert.equal(zeroCellsValue.statusCode, 400);
  assert.equal(__testing.getBattleMapState().measurementUnit.cellsValue, 1.5);

  const valid = await __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/settings',
    headers: sessionHeaders(MASTER),
    payload: { diagonalRule: 'alternating', measurementUnit: { label: 'ft', cellsValue: 5 } },
  });
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.json().state.diagonalRule, 'alternating');
  assert.deepEqual(valid.json().state.measurementUnit, { label: 'ft', cellsValue: 5 });
});

function fakeClient(user) {
  const rawChunks = [];
  return {
    user,
    write: (chunk) => rawChunks.push(chunk),
    // Un client reale riceve anche gli snapshot semplici (`data: ...` senza `event:`), che qui
    // vengono scartati: interessano solo gli eventi SSE nominati come token-walk.
    events: () =>
      rawChunks.flatMap((chunk) => {
        const lines = chunk.trim().split('\n');
        const eventLine = lines.find((line) => line.startsWith('event: '));
        const dataLine = lines.find((line) => line.startsWith('data: '));
        if (!eventLine || !dataLine) {
          return [];
        }
        return [{ event: eventLine.replace('event: ', ''), data: JSON.parse(dataLine.replace('data: ', '')) }];
      }),
  };
}

test('a successful move broadcasts the walked path so every client can animate it, filtered by token visibility', async () => {
  const invisibleToken = heroToken({
    id: 'hero-hidden',
    ownerUserId: OTHER_PLAYER.id,
    isInvisible: true,
    position: { x: 5, y: 5 },
  });
  __testing.setBattleMapState(withActiveTurn({ tokens: [heroToken(), invisibleToken] }));

  const bystander = fakeClient(PLAYER);
  const master = fakeClient(MASTER);
  __testing.streamClients.add(bystander);
  __testing.streamClients.add(master);

  try {
    const response = await move(PLAYER, { tokenId: 'hero-1', waypoints: [{ x: 0, y: 0 }, { x: 3, y: 0 }] });
    assert.equal(response.statusCode, 200);

    const ownWalkEvent = bystander.events().find((event) => event.event === 'token-walk');
    assert.ok(ownWalkEvent);
    assert.equal(ownWalkEvent.data.tokenId, 'hero-1');
    assert.deepEqual(ownWalkEvent.data.waypoints, [{ x: 0, y: 0 }, { x: 3, y: 0 }]);

    const hiddenMoveResponse = await move(OTHER_PLAYER, {
      tokenId: 'hero-hidden',
      waypoints: [{ x: 5, y: 5 }, { x: 6, y: 5 }],
    });
    assert.equal(hiddenMoveResponse.statusCode, 200);
    assert.equal(
      bystander.events().filter((event) => event.event === 'token-walk' && event.data.tokenId === 'hero-hidden').length,
      0,
    );
    assert.equal(
      master.events().filter((event) => event.event === 'token-walk' && event.data.tokenId === 'hero-hidden').length,
      1,
    );
  } finally {
    __testing.streamClients.delete(bystander);
    __testing.streamClients.delete(master);
  }
});

// --- P0.8a: il budget dipende dalla modalità di sessione ---------------------------------------

test('in Esplorazione un Adventurer muove 10 caselle con velocità 6 senza addebito', async () => {
  __testing.setBattleMapState({ tokens: [heroToken({ movementCells: 6 })], sessionMode: 'exploration' });
  const response = await move(PLAYER, { tokenId: 'hero-1', waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(__testing.getBattleMapState().tokens[0].position, { x: 10, y: 0 });
  assert.equal(__testing.getBattleMapState().movementUsedByTokenId['hero-1'] ?? 0, 0);
  assert.equal(__testing.getBattleMapState().diagonalParityByTokenId['hero-1'] ?? 0, 0);
});

test("nella fase di tiro l'Adventurer si dispone liberamente, senza addebito", async () => {
  __testing.setBattleMapState({
    tokens: [heroToken({ movementCells: 6 })],
    sessionMode: 'combat',
    isRoundStarted: false,
    initiatives: [{ tokenId: 'hero-1', value: 10, source: 'manual' }],
  });
  const response = await move(PLAYER, { tokenId: 'hero-1', waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(__testing.getBattleMapState().tokens[0].position, { x: 10, y: 0 });
  assert.equal(__testing.getBattleMapState().movementUsedByTokenId['hero-1'] ?? 0, 0);
  __testing.setBattleMapState({ ...__testing.getBattleMapState(), tokens: [heroToken()] });

  const byMaster = await move(MASTER, { tokenId: 'hero-1', waypoints: [{ x: 0, y: 0 }, { x: 12, y: 0 }] });
  assert.equal(byMaster.statusCode, 200);
  assert.deepEqual(__testing.getBattleMapState().tokens[0].position, { x: 12, y: 0 });
});

test('a round avviato il budget si applica e il Master resta libero', async () => {
  __testing.setBattleMapState({
    ...withActiveTurn({ tokens: [heroToken({ movementCells: 6 })] }),
    sessionMode: 'combat',
    isRoundStarted: true,
  });
  const tooFar = await move(PLAYER, { tokenId: 'hero-1', waypoints: [{ x: 0, y: 0 }, { x: 7, y: 0 }] });
  assert.equal(tooFar.statusCode, 400);
  assert.match(tooFar.json().message, /Movimento insufficiente/);
  const within = await move(PLAYER, { tokenId: 'hero-1', waypoints: [{ x: 0, y: 0 }, { x: 6, y: 0 }] });
  assert.equal(within.statusCode, 200);
  assert.equal(__testing.getBattleMapState().movementUsedByTokenId['hero-1'], 6);

  const byMaster = await move(MASTER, { tokenId: 'hero-1', waypoints: [{ x: 6, y: 0 }, { x: 16, y: 0 }] });
  assert.equal(byMaster.statusCode, 200);
});

test('uno snapshot legacy con un incontro in corso mantiene il movimento già addebitato', async () => {
  __testing.setBattleMapState({
    ...withActiveTurn({ tokens: [heroToken({ movementCells: 6 })] }),
    movementUsedByTokenId: { 'hero-1': 5 },
  });
  assert.equal(__testing.getBattleMapState().sessionMode, 'combat');
  const response = await move(PLAYER, { tokenId: 'hero-1', x: 2, y: 0 });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /restano 1 caselle/);
});
