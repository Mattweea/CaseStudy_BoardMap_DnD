import assert from 'node:assert/strict';
import test from 'node:test';
import { CharacterSheetPolicy } from '../server/character-sheet-policy.mjs';
import { CharacterSheetService } from '../server/character-sheet-service.mjs';
import { createInitialCharacterSheetData } from '../server/character-sheet-schema.mjs';

process.env.BATTLE_MAP_TEST_MODE = '1';
const { __testing } = await import('../server/index.mjs');
const master = { id: 'hp-master', role: 'master', username: 'hp-master', displayName: 'Master' };
const owner = { id: 'hp-owner', role: 'adventurer', username: 'hp-owner', displayName: 'Owner' };
const other = { id: 'hp-other', role: 'adventurer', username: 'hp-other', displayName: 'Other' };
const users = new Map([master, owner, other].map((user) => [user.id, user]));
__testing.setUserRepository({ findById: (id) => users.get(id) ?? null });
const headers = (user) => ({ cookie: `battle_map_session=${__testing.createSession(user)}` });
const hero = (overrides = {}) => ({ id: 'hp-hero', name: 'Hero', type: 'player', size: 'medium', position: { x: 0, y: 0 }, color: '#2f9e44', ownerUserId: owner.id, conditions: [], ...overrides });
const familiar = () => hero({ id: 'hp-familiar', isFamiliar: true, position: { x: 2, y: 0 }, hitPoints: 7, maxHitPoints: 9 });
const enemy = () => ({ id: 'hp-enemy', name: 'Enemy', type: 'enemy', size: 'medium', position: { x: 4, y: 0 }, color: '#c92a2a', hitPoints: 8, maxHitPoints: 10 });

function setup({ current = '12', maximum = '20', temporary = '5' } = {}) {
  const data = createInitialCharacterSheetData();
  data.character.hitPoints = { current, maximum, temporary };
  const record = { id: 'hp-sheet', ownerUserId: owner.id, campaignId: 'local-campaign', version: 1, data, portraitFileName: null, portraitMediaType: null, portraitUpdatedAt: null };
  const events = [];
  const service = new CharacterSheetService({
    repository: {
      findById: (id) => id === record.id ? structuredClone(record) : null,
      findByOwnerCampaign: (userId) => userId === owner.id ? structuredClone(record) : null,
      saveVersion: ({ version, data: next }) => { record.version = version; record.data = structuredClone(next); return structuredClone(record); },
    },
    policy: new CharacterSheetPolicy(),
    schedule: () => null, cancel: () => {},
    emit: (event) => events.push(event),
    projectToken: __testing.projectCharacterSheetToToken,
  });
  __testing.setCharacterSheetService(service);
  __testing.setBattleMapState({ tokens: [hero(), familiar(), enemy(), hero({ id: 'hp-other-hero', ownerUserId: other.id, position: { x: 6, y: 0 }, hitPoints: 6, maxHitPoints: 10 })] });
  return { service, events };
}

const post = (user, tokenId, input) => __testing.app.inject({ method: 'POST', url: '/api/battle-map/token-hit-points', headers: headers(user), payload: { tokenId, input } });

test('token HP endpoint updates the sheet and token with transitions', async () => {
  const { service, events } = setup({ current: '3', temporary: '0' });
  const version = __testing.getBattleMapVersion();
  const down = await post(master, 'hp-hero', '-5');
  assert.equal(down.statusCode, 200);
  assert.equal(service.get(owner, 'hp-sheet').data.character.hitPoints.current, '0');
  assert.equal(down.json().state.tokens[0].hitPoints, 0);
  assert.deepEqual(down.json().state.tokens[0].conditions, ['unconscious', 'prone']);
  assert.equal(__testing.getBattleMapVersion(), version + 1);
  assert.ok(events.some((event) => event.type === 'character-sheet-patch'));
  const stillDown = await post(owner, 'hp-hero', '-3');
  assert.equal(stillDown.statusCode, 200);
  assert.deepEqual(stillDown.json().state.tokens[0].conditions, ['unconscious', 'prone']);
  const up = await post(master, 'hp-hero', '+1');
  assert.equal(up.statusCode, 200);
  assert.deepEqual(up.json().state.tokens[0].conditions, ['prone']);
  assert.equal(up.json().state.tokens[0].hitPoints, 1);
});

test('token HP endpoint checks token type, ownership and input', async () => {
  setup();
  assert.equal((await post(master, 'missing', '-1')).statusCode, 404);
  assert.equal((await post(master, 'hp-familiar', '-1')).statusCode, 400);
  assert.equal((await post(master, 'hp-enemy', '-1')).statusCode, 400);
  assert.equal((await post(other, 'hp-hero', '-1')).statusCode, 403);
  assert.equal((await post(owner, 'hp-hero', '2d6')).statusCode, 400);
  assert.equal((await post(owner, 'hp-other-hero', '-1')).statusCode, 400);
  __testing.setBattleMapState({ tokens: [hero(), hero({ id: 'hp-duplicate', position: { x: 8, y: 0 }, hitPoints: 6, maxHitPoints: 10 })] });
  assert.equal(__testing.getBattleMapState().tokens[1].hitPoints, 6);
  assert.equal((await post(owner, 'hp-duplicate', '-1')).statusCode, 400);
  assert.equal((await post(owner, 'hp-hero', '7')).json().state.tokens[0].hitPoints, 7);
  assert.equal((await post(owner, 'hp-hero', '')).json().state.tokens[0].hitPoints, null);
});

test('normalization derives canonical HP; snapshots hide other tokens HP', async () => {
  setup();
  const state = __testing.getBattleMapState();
  assert.equal(state.tokens[0].hitPoints, 12);
  assert.equal(state.tokens[0].temporaryHitPoints, 5);
  assert.equal(state.tokens[1].hitPoints, 7);
  const resumedSnapshot = __testing.normalizeSharedState(JSON.parse(JSON.stringify({
    ...state,
    tokens: state.tokens.map((token) => token.id === 'hp-hero'
      ? { ...token, hitPoints: 999, maxHitPoints: 999, temporaryHitPoints: 999 }
      : token),
  })));
  assert.deepEqual(
    [resumedSnapshot.tokens[0].hitPoints, resumedSnapshot.tokens[0].maxHitPoints, resumedSnapshot.tokens[0].temporaryHitPoints],
    [12, 20, 5],
  );
  const own = __testing.sanitizeStateForUser(state, owner);
  assert.equal(own.tokens[0].hitPoints, 12);
  assert.equal(own.tokens[1].hitPoints, 7);
  assert.equal(own.tokens[2].hitPoints, null);
  assert.equal(own.tokens[3].hitPoints, null);
  assert.equal(__testing.sanitizeStateForUser(state, master).tokens[2].hitPoints, 8);
  const update = await __testing.app.inject({ method: 'POST', url: '/api/battle-map/token-update', headers: headers(owner), payload: { tokenId: 'hp-hero', updates: { hitPoints: 900 } } });
  assert.equal(update.statusCode, 400);
  assert.equal(__testing.getBattleMapState().tokens[0].hitPoints, 12);
  const httpState = await __testing.app.inject({ method: 'GET', url: '/api/battle-map/state', headers: headers(other) });
  assert.equal(httpState.statusCode, 200);
  assert.equal(httpState.json().state.tokens[0].hitPoints, null);
  const masterCommit = await __testing.app.inject({ method: 'PUT', url: '/api/battle-map/state', headers: headers(master), payload: {
    baseVersion: __testing.getBattleMapVersion(),
    state: { ...__testing.getBattleMapState(), tokens: __testing.getBattleMapState().tokens.map((token) => token.id === 'hp-hero' ? { ...token, hitPoints: 999, maxHitPoints: 999 } : token.id === 'hp-enemy' ? { ...token, hitPoints: 4 } : token) },
  } });
  assert.equal(masterCommit.statusCode, 200);
  assert.equal(masterCommit.json().state.tokens[0].hitPoints, 12);
  assert.equal(masterCommit.json().state.tokens[2].hitPoints, 4);
});

test('SSE snapshots disclose HP only to the token owner and master', async () => {
  setup();
  const deliveries = new Map([[owner.id, []], [other.id, []], [master.id, []]]);
  const clients = [owner, other, master].map((user) => ({ user, write: (chunk) => deliveries.get(user.id).push(chunk) }));
  clients.forEach((client) => __testing.streamClients.add(client));
  try {
    const response = await post(owner, 'hp-hero', '-1');
    assert.equal(response.statusCode, 200);
    for (const user of [owner, other, master]) {
      const snapshots = deliveries.get(user.id).filter((chunk) => chunk.startsWith('data: '));
      assert.ok(snapshots.length > 0);
      const token = JSON.parse(snapshots.at(-1).slice(6)).state.tokens.find((entry) => entry.id === 'hp-hero');
      assert.equal(token.hitPoints, user === other ? null : 12);
    }
  } finally {
    clients.forEach((client) => __testing.streamClients.delete(client));
  }
});
