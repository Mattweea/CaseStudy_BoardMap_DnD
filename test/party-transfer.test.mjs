import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';
import { CHARACTER_PROFILES } from '../server/characters.mjs';
import { planPartyTransfer } from '../server/party-transfer.mjs';

process.env.BATTLE_MAP_TEST_MODE = '1';
const { __testing } = await import('../server/index.mjs');
const MASTER = { id: 'master-user', username: 'master', displayName: 'Master', role: 'master' };
const PLAYER = { id: 'player-ilthar', username: 'ilthar', displayName: 'Ilthar', role: 'adventurer' };
const VESUTH = { id: 'player-vesuth', username: 'vesuth', displayName: 'Vesuth Ronavior', role: 'adventurer' };
const users = new Map([MASTER, PLAYER, VESUTH].map((user) => [user.id, user]));
__testing.setUserRepository({ findById: (id) => users.get(id) ?? null });
const headers = (user) => ({ cookie: `battle_map_session=${__testing.createSession(user)}` });
const footprint = (token) => ({ width: token.widthCells ?? ({ large: 2, huge: 3, gargantuan: 4 }[token.size] ?? 1),
  height: token.heightCells ?? ({ large: 2, huge: 3, gargantuan: 4 }[token.size] ?? 1) });

function scene(id, dimensions = { columns: 10, rows: 10 }) {
  const document = createDefaultSceneDocument();
  document.board.dimensions = dimensions;
  return { id, name: id, version: 1, document };
}

function player(id = 'player-token-ilthar', overrides = {}) {
  return { id, name: 'Ilthar', type: 'player', size: 'medium', position: { x: 1, y: 1 }, color: '#fff',
    ownerUserId: PLAYER.id, characterKey: 'ilthar', isFamiliar: false, ...overrides };
}

test('party layout is deterministic, handles footprints and rejects duplicates or insufficient space', () => {
  const targetScene = scene('target', { columns: 4, rows: 3 });
  targetScene.document.elements = [{ id: 'rock', kind: 'rock', position: { x: 0, y: 0 }, widthCells: 1,
    heightCells: 1, rotation: 0, blocksMovement: true, blocksVision: false }];
  const sourceTokens = [player()];
  const input = { sourceTokens, targetTokens: [], targetScene, anchor: { x: 0, y: 0 },
    profiles: CHARACTER_PROFILES, getTokenFootprint: footprint };
  const first = planPartyTransfer(input);
  assert.deepEqual(first, planPartyTransfer(input));
  assert.notDeepEqual(first.transferred[0].position, { x: 0, y: 0 });
  assert.deepEqual(sourceTokens[0].position, { x: 1, y: 1 });
  assert.throws(() => planPartyTransfer({ ...input, targetTokens: [player()] }), /già nella scena attiva/);
  assert.throws(() => planPartyTransfer({ ...input, targetTokens: [player('another-id')] }), /già nella scena attiva/);
  assert.throws(() => planPartyTransfer({ ...input, sourceTokens: [player(), player('other')] }), /duplicati/);
  assert.throws(() => planPartyTransfer({ ...input, sourceTokens: [player('mismatch', { characterKey: 'ragnar' })] }), /incoerenti/);
  assert.throws(() => planPartyTransfer({ ...input, sourceTokens: [player('wrong-owner', { ownerUserId: 'unknown' })] }), /canoniche/);
  assert.throws(() => planPartyTransfer({ ...input, anchor: { x: 4, y: 0 } }), /fuori/);
  assert.throws(() => planPartyTransfer({ ...input, targetScene: scene('small', { columns: 1, rows: 1 }),
    targetTokens: [{ id: 'block', position: { x: 0, y: 0 }, size: 'medium' }] }), /Spazio insufficiente/);
});

test('party selection retains familiar and vehicle relations and rejects orphan occupants', () => {
  const hero = player('hero', { containedInVehicleId: 'vehicle' });
  const familiar = player('familiar', { isFamiliar: true });
  const vehicle = { id: 'vehicle', name: 'Mezzo', type: 'vehicle', size: 'large', position: { x: 0, y: 0 },
    vehicleOccupantIds: ['hero'] };
  const input = { sourceTokens: [hero, familiar, vehicle], targetTokens: [], targetScene: scene('target'),
    anchor: { x: 3, y: 3 }, profiles: CHARACTER_PROFILES, getTokenFootprint: footprint };
  const plan = planPartyTransfer(input);
  assert.deepEqual(new Set(plan.transferred.map((token) => token.id)), new Set(['hero', 'familiar', 'vehicle']));
  assert.deepEqual(plan.transferred.find((token) => token.id === 'vehicle').vehicleOccupantIds, ['hero']);
  assert.equal(plan.transferred.find((token) => token.id === 'hero').containedInVehicleId, 'vehicle');
  assert.throws(() => planPartyTransfer({ ...input, sourceTokens: [hero, familiar, { ...vehicle,
    vehicleOccupantIds: ['hero', 'missing'] }] }), /estranei o mancanti/);
  assert.throws(() => planPartyTransfer({ ...input, sourceTokens: [hero, familiar, { ...vehicle,
    vehicleOccupantIds: ['hero', 'hero'] }] }), /estranei o mancanti/);
});

test('preview is read-only and commit transfers once; conflicts and injected failures preserve both scenes', async () => {
  const source = scene('source');
  const target = scene('target');
  let active = source;
  __testing.setSceneService({ getActiveScene: () => active, getScene: (id) => ({ source, target })[id] ?? null,
    getCatalog: () => [source, target] });
  try {
    __testing.setBattleMapState({ tokens: [player()] });
    const activation = __testing.prepareActiveSceneTransition(target);
    active = target;
    __testing.installPreparedSceneTransition(target, activation);
    assert.deepEqual(__testing.getBattleMapState().tokens, []);
    __testing.ensureCharacterTokenForUser(PLAYER);
    assert.deepEqual(__testing.getBattleMapState().tokens, []);
    const payload = { sourceSceneId: source.id, sourceVersion: 1, targetVersion: 1, anchor: { x: 2, y: 2 } };
    const preview = await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transfer/preview',
      headers: headers(MASTER), payload });
    assert.equal(preview.statusCode, 200);
    assert.equal(preview.json().placements.length, 1);
    assert.deepEqual(__testing.getBattleMapState().tokens, []);
    assert.equal((await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transfer/commit',
      headers: headers(PLAYER), payload: { ...payload, stateVersion: preview.json().stateVersion } })).statusCode, 403);
    const changed = await __testing.app.inject({ method: 'PUT', url: '/api/battle-map/state', headers: headers(MASTER),
      payload: { baseVersion: preview.json().stateVersion,
        state: { ...__testing.getBattleMapState(), sharedNotes: 'modificato dopo la preview' } } });
    assert.equal(changed.statusCode, 200);
    assert.equal((await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transfer/commit',
      headers: headers(MASTER), payload: { ...payload, stateVersion: preview.json().stateVersion } })).statusCode, 409);
    const refreshed = await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transfer/preview',
      headers: headers(MASTER), payload });
    assert.equal(refreshed.statusCode, 200);
    source.version = 2;
    assert.equal((await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transfer/commit',
      headers: headers(MASTER), payload: { ...payload, stateVersion: refreshed.json().stateVersion } })).statusCode, 409);
    source.version = 1;
    target.version = 2;
    assert.equal((await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transfer/commit',
      headers: headers(MASTER), payload: { ...payload, stateVersion: refreshed.json().stateVersion } })).statusCode, 409);
    target.version = 1;
    const startRound = await __testing.app.inject({ method: 'PUT', url: '/api/battle-map/state', headers: headers(MASTER),
      payload: { baseVersion: refreshed.json().stateVersion,
        state: { ...__testing.getBattleMapState(), sessionMode: 'combat', isRoundStarted: true } } });
    assert.equal(startRound.statusCode, 200);
    assert.equal((await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transfer/preview',
      headers: headers(MASTER), payload })).statusCode, 409);
    const endRound = await __testing.app.inject({ method: 'PUT', url: '/api/battle-map/state', headers: headers(MASTER),
      payload: { baseVersion: startRound.json().version,
        state: { ...__testing.getBattleMapState(), sessionMode: 'exploration', isRoundStarted: false } } });
    assert.equal(endRound.statusCode, 200);
    const ready = await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transfer/preview',
      headers: headers(MASTER), payload });
    assert.equal(ready.statusCode, 200);
    __testing.setPartyTransferBeforePublish(() => { throw new Error('injected'); });
    const failure = await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transfer/commit',
      headers: headers(MASTER), payload: { ...payload, stateVersion: ready.json().stateVersion } });
    assert.equal(failure.statusCode, 500);
    assert.deepEqual(__testing.getBattleMapState().tokens, []);
    assert.equal((await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transfer/preview',
      headers: headers(MASTER), payload })).json().placements.length, 1);
    __testing.setPartyTransferBeforePublish(null);
    const clients = [MASTER, PLAYER, { ...PLAYER, id: 'player-thalendir', username: 'thalendir' }]
      .map((user) => ({ user, writes: [], write(chunk) { this.writes.push(chunk); } }));
    clients.forEach((client) => __testing.streamClients.add(client));
    const commit = await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transfer/commit',
      headers: headers(MASTER), payload: { ...payload, stateVersion: ready.json().stateVersion } });
    assert.equal(commit.statusCode, 200);
    assert.deepEqual(__testing.getBattleMapState().tokens.map((token) => token.id), ['player-token-ilthar']);
    for (const client of clients) {
      const snapshots = client.writes.filter((chunk) => chunk.startsWith('data: ')).map((chunk) => JSON.parse(chunk.slice(6)));
      assert.equal(snapshots.length, 1);
      assert.equal(snapshots[0].state.activeSceneId, target.id);
      assert.deepEqual(snapshots[0].state.tokens.map((token) => token.id), ['player-token-ilthar']);
    }
    clients.forEach((client) => __testing.streamClients.delete(client));
    const undo = await __testing.app.inject({ method: 'POST', url: '/api/battle-map/undo', headers: headers(MASTER), payload: {} });
    assert.equal(undo.statusCode, 400);
    const back = __testing.prepareActiveSceneTransition(source);
    active = source;
    __testing.installPreparedSceneTransition(source, back);
    assert.deepEqual(__testing.getBattleMapState().tokens, []);
  } finally {
    __testing.setPartyTransferBeforePublish(null);
    __testing.setSceneService(null);
  }
});

test('selected destination previews and activates with party in one broadcast, preserving both scenes on failure', async () => {
  const source = scene('source');
  const target = scene('target');
  let active = source;
  let failPersistence = false;
  const sceneService = {
    getActiveScene: () => active,
    getScene: (id) => ({ source, target })[id] ?? null,
    getCatalog: () => [source, target],
    activateScene: ({ id, expectedVersion }) => {
      if (failPersistence) throw new Error('storage failure');
      const next = sceneService.getScene(id);
      if (next.version !== expectedVersion) throw new Error('stale scene');
      active = next;
      return next;
    },
  };
  __testing.setSceneService(sceneService);
  try {
    const vesuth = player('player-token-vesuth', { name: VESUTH.displayName, ownerUserId: VESUTH.id,
      characterKey: 'vesuth' });
    const enemy = { id: 'enemy', name: 'Nemico', type: 'enemy', size: 'medium', position: { x: 7, y: 7 }, color: '#000' };
    __testing.setBattleMapState({ tokens: [vesuth, enemy] });
    const payload = { targetSceneId: target.id, sourceVersion: source.version, targetVersion: target.version,
      anchor: { x: 3, y: 3 } };
    const preview = await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transition/preview',
      headers: headers(MASTER), payload });
    assert.equal(preview.statusCode, 200);
    assert.deepEqual(preview.json().placements.map((placement) => placement.tokenId), [vesuth.id]);
    assert.equal(active.id, source.id);
    assert.deepEqual(__testing.getBattleMapState().tokens.map((token) => token.id), [vesuth.id, enemy.id]);
    assert.equal((await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transition/preview',
      headers: headers(PLAYER), payload })).statusCode, 403);
    assert.equal((await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transition/commit',
      headers: headers(PLAYER), payload: { ...payload, stateVersion: preview.json().stateVersion } })).statusCode, 403);
    for (const stale of [{ sourceVersion: 0 }, { targetVersion: 0 },
      { stateVersion: preview.json().stateVersion + 1 }]) {
      assert.equal((await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transition/commit',
        headers: headers(MASTER), payload: { ...payload, stateVersion: preview.json().stateVersion, ...stale } })).statusCode, 409);
      assert.equal(active.id, source.id);
    }
    __testing.getBattleMapState().isRoundStarted = true;
    assert.equal((await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transition/commit',
      headers: headers(MASTER), payload: { ...payload, stateVersion: preview.json().stateVersion } })).statusCode, 409);
    __testing.getBattleMapState().isRoundStarted = false;
    __testing.setPartyTransferBeforePublish(() => { throw new Error('injected'); });
    assert.equal((await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transition/commit',
      headers: headers(MASTER), payload: { ...payload, stateVersion: preview.json().stateVersion } })).statusCode, 500);
    __testing.setPartyTransferBeforePublish(null);
    failPersistence = true;
    assert.equal((await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transition/commit',
      headers: headers(MASTER), payload: { ...payload, stateVersion: preview.json().stateVersion } })).statusCode, 500);
    failPersistence = false;
    assert.equal(active.id, source.id);
    assert.deepEqual(__testing.getBattleMapState().tokens.map((token) => token.id), [vesuth.id, enemy.id]);
    const clients = [MASTER, PLAYER, VESUTH].map((user) => ({ user, writes: [], write(chunk) { this.writes.push(chunk); } }));
    clients.forEach((client) => __testing.streamClients.add(client));
    const commit = await __testing.app.inject({ method: 'POST', url: '/api/scenes/party-transition/commit',
      headers: headers(MASTER), payload: { ...payload, stateVersion: preview.json().stateVersion } });
    assert.equal(commit.statusCode, 200);
    assert.equal(active.id, target.id);
    assert.equal(__testing.getBattleMapState().activeSceneId, target.id);
    assert.deepEqual(__testing.getBattleMapState().tokens.map((token) => token.id), [vesuth.id]);
    for (const client of clients) {
      const snapshots = client.writes.filter((chunk) => chunk.startsWith('data: '))
        .map((chunk) => JSON.parse(chunk.slice(6)));
      assert.equal(snapshots.length, 1);
      assert.equal(snapshots[0].state.activeSceneId, target.id);
      assert.deepEqual(snapshots[0].state.tokens.map((token) => token.id), [vesuth.id]);
    }
    clients.forEach((client) => __testing.streamClients.delete(client));
    const back = __testing.prepareActiveSceneTransition(source);
    active = source;
    __testing.installPreparedSceneTransition(source, back);
    assert.deepEqual(__testing.getBattleMapState().tokens.map((token) => token.id), [enemy.id]);
  } finally {
    __testing.setPartyTransferBeforePublish(null);
    __testing.setSceneService(null);
  }
});
