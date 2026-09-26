import assert from 'node:assert/strict';
import test from 'node:test';
import { CharacterSheetPolicy } from '../server/character-sheet-policy.mjs';
import { CharacterSheetService } from '../server/character-sheet-service.mjs';
import { createAura, createInitialCharacterSheetData } from '../server/character-sheet-schema.mjs';
import { AURA_COLORS } from '../shared/token-auras.mjs';

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

// Servizio reale su un repository in memoria, come le route lo vedono in produzione (stesso
// schema di test/initiative-roll.test.mjs).
function sheetService(sheets) {
  const records = new Map(sheets.map((sheet) => [sheet.id, {
    campaignId: 'local-campaign', version: 1, portraitFileName: null, portraitMediaType: null, portraitUpdatedAt: null, ...sheet,
  }]));
  return new CharacterSheetService({
    repository: {
      findById: (id) => structuredClone(records.get(id) ?? null),
      findByOwnerCampaign: (ownerUserId, campaignId) =>
        structuredClone([...records.values()].find((record) => record.ownerUserId === ownerUserId && record.campaignId === campaignId) ?? null),
      saveVersion: () => null,
    },
    policy: new CharacterSheetPolicy(),
    schedule: () => null,
    cancel: () => {},
    // Come `start()` in produzione: una patch accettata proietta subito sul token (task 1.3).
    projectToken: __testing.projectCharacterSheetToToken,
  });
}

function sheetDataWithAura(displayName, auraOverrides = {}) {
  const data = createInitialCharacterSheetData({ displayName });
  data.character.auras.push(createAura({
    id: 'aura_0001',
    name: 'Aura di protezione',
    description: 'Segreta',
    effect: 'Riduce i danni',
    radiusCells: '2',
    color: AURA_COLORS[1],
    active: true,
    ...auraOverrides,
  }));
  return data;
}

function heroToken(overrides = {}) {
  return {
    id: 'hero',
    name: 'Ilthar',
    type: 'player',
    size: 'medium',
    position: { x: 0, y: 0 },
    color: '#2f9e44',
    initiativeModifier: 0,
    movementCells: 6,
    ownerUserId: PLAYER.id,
    conditions: [],
    exhaustionLevel: 0,
    ...overrides,
  };
}

function familiarToken(overrides = {}) {
  return heroToken({ id: 'familiar', name: 'Gufo', isFamiliar: true, ...overrides });
}

function goblinToken(overrides = {}) {
  return {
    id: 'goblin',
    name: 'Goblin',
    type: 'enemy',
    size: 'small',
    position: { x: 4, y: 0 },
    color: '#c92a2a',
    initiativeModifier: 0,
    conditions: [],
    exhaustionLevel: 0,
    ...overrides,
  };
}

const FAKE_CLIENT_AURA = { id: 'fake-aura', name: 'Falsa', effect: 'Falso', radiusCells: 9, color: AURA_COLORS[0], active: true };

test('a full-state master commit with a fake aura on an enemy and a fake aura on a character discards the enemy aura and keeps only the sheet aura on the character', async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar') }]));
  __testing.setBattleMapState({ tokens: [heroToken(), goblinToken()] });

  const response = await __testing.app.inject({
    method: 'PUT',
    url: '/api/battle-map/state',
    headers: sessionHeaders(MASTER),
    payload: {
      baseVersion: __testing.getBattleMapVersion(),
      state: {
        ...__testing.getBattleMapState(),
        tokens: [
          heroToken({ auras: [FAKE_CLIENT_AURA] }),
          goblinToken({ auras: [FAKE_CLIENT_AURA] }),
        ],
      },
    },
  });
  assert.equal(response.statusCode, 200);

  const state = __testing.getBattleMapState();
  const hero = state.tokens.find((token) => token.id === 'hero');
  const goblin = state.tokens.find((token) => token.id === 'goblin');
  assert.deepEqual(goblin.auras, []);
  assert.deepEqual(hero.auras, [{ id: 'aura_0001', name: 'Aura di protezione', effect: 'Riduce i danni', radiusCells: 2, color: AURA_COLORS[1], active: true }]);
});

test('token-update from an adventurer ignores an auras field while still applying an allowed field', async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar') }]));
  __testing.setBattleMapState({ tokens: [heroToken()] });

  const response = await __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/token-update',
    headers: sessionHeaders(PLAYER),
    payload: { tokenId: 'hero', updates: { hitPoints: 5, auras: [FAKE_CLIENT_AURA] } },
  });
  assert.equal(response.statusCode, 200);

  const hero = __testing.getBattleMapState().tokens.find((token) => token.id === 'hero');
  assert.equal(hero.hitPoints, 5);
  assert.deepEqual(hero.auras, [{ id: 'aura_0001', name: 'Aura di protezione', effect: 'Riduce i danni', radiusCells: 2, color: AURA_COLORS[1], active: true }]);
});

test('a resumed snapshot with legacy-shaped auras on an enemy and a character discards the enemy aura and keeps only the sheet aura on the character', () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar') }]));

  const legacySnapshot = {
    tokens: [
      heroToken({ auras: [{ id: 'legacy-hero-aura', radiusCells: 3, isVisible: true, color: '#ff0000' }] }),
      goblinToken({ auras: [{ id: 'legacy-goblin-aura', radiusCells: 3, isVisible: true, color: '#ff0000' }] }),
    ],
  };
  const normalized = __testing.normalizeSharedState(legacySnapshot);
  const hero = normalized.tokens.find((token) => token.id === 'hero');
  const goblin = normalized.tokens.find((token) => token.id === 'goblin');
  assert.deepEqual(goblin.auras, []);
  assert.deepEqual(hero.auras, [{ id: 'aura_0001', name: 'Aura di protezione', effect: 'Riduce i danni', radiusCells: 2, color: AURA_COLORS[1], active: true }]);
});

test("the master's undo of an unrelated action leaves an already-active aura on, because auras are never part of the undone battle-map snapshot", async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar', { active: true }) }]));
  __testing.setBattleMapState({ tokens: [heroToken(), goblinToken()] });

  // Un'azione qualsiasi del Master che genera un checkpoint di annullamento (spostamento di un
  // token nemico non ha nulla a che fare con l'aura, che resta sempre derivata dalla scheda).
  const move = await __testing.app.inject({
    method: 'PUT',
    url: '/api/battle-map/state',
    headers: sessionHeaders(MASTER),
    payload: {
      baseVersion: __testing.getBattleMapVersion(),
      state: { ...__testing.getBattleMapState(), tokens: [heroToken(), goblinToken({ position: { x: 5, y: 5 } })] },
    },
  });
  assert.equal(move.statusCode, 200);

  const undo = await __testing.app.inject({ method: 'POST', url: '/api/battle-map/undo', headers: sessionHeaders(MASTER) });
  assert.equal(undo.statusCode, 200);

  const hero = __testing.getBattleMapState().tokens.find((token) => token.id === 'hero');
  assert.equal(hero.auras[0].active, true);
});

test('another adventurer receives the aura on the state without its description', async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar') }]));
  __testing.setBattleMapState({ tokens: [heroToken(), goblinToken()] });

  const response = await __testing.app.inject({ method: 'GET', url: '/api/battle-map/state', headers: sessionHeaders(OTHER_PLAYER) });
  assert.equal(response.statusCode, 200);
  const hero = response.json().state.tokens.find((token) => token.id === 'hero');
  assert.equal(hero.auras.length, 1);
  assert.equal('description' in hero.auras[0], false);
  assert.equal(hero.auras[0].effect, 'Riduce i danni');
});

test("a familiar has no auras even though its owner's sheet has an active one", () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar') }]));
  __testing.setBattleMapState({ tokens: [heroToken(), familiarToken()] });

  const familiar = __testing.getBattleMapState().tokens.find((token) => token.id === 'familiar');
  assert.deepEqual(familiar.auras, []);
});

// Task 2.2: POST /api/battle-map/token-auras (design, decisione 4).

async function toggleAura(user, { tokenId = 'hero', auraId = 'aura_0001', active } = {}) {
  return __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/token-auras',
    headers: sessionHeaders(user),
    payload: { tokenId, auraId, active },
  });
}

async function drainPlayerUndo(user) {
  for (let guard = 0; guard < 50; guard += 1) {
    const response = await __testing.app.inject({ method: 'POST', url: '/api/battle-map/undo', headers: sessionHeaders(user) });
    if (response.statusCode !== 200) return;
  }
  throw new Error('Player undo stack did not drain within the test guard.');
}

test("the owner turning an aura on in Exploration updates the sheet and the token, and bumps the map version", async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar', { active: false }) }]));
  __testing.setBattleMapState({ tokens: [heroToken()] });
  const versionBefore = __testing.getBattleMapVersion();

  const response = await toggleAura(PLAYER, { active: true });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().state.tokens.find((token) => token.id === 'hero').auras[0].active, true);
  assert.ok(__testing.getBattleMapVersion() > versionBefore);
});

test('the master can toggle a character aura', async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar', { active: true }) }]));
  __testing.setBattleMapState({ tokens: [heroToken()] });

  const response = await toggleAura(MASTER, { active: false });
  assert.equal(response.statusCode, 200);
  const hero = __testing.getBattleMapState().tokens.find((token) => token.id === 'hero');
  assert.equal(hero.auras[0].active, false);
});

test("another adventurer cannot toggle someone else's aura (403), and the aura stays unchanged", async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar', { active: false }) }]));
  __testing.setBattleMapState({ tokens: [heroToken()] });

  const response = await toggleAura(OTHER_PLAYER, { active: true });
  assert.equal(response.statusCode, 403);
  const hero = __testing.getBattleMapState().tokens.find((token) => token.id === 'hero');
  assert.equal(hero.auras[0].active, false);
});

test('a familiar or an enemy token is rejected with 400 because it has no auras of its own', async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar') }]));
  __testing.setBattleMapState({ tokens: [heroToken(), familiarToken(), goblinToken()] });

  const familiarResponse = await toggleAura(PLAYER, { tokenId: 'familiar', active: true });
  assert.equal(familiarResponse.statusCode, 400);

  const goblinResponse = await toggleAura(MASTER, { tokenId: 'goblin', active: true });
  assert.equal(goblinResponse.statusCode, 400);
});

test('a nonexistent aura is rejected with 404', async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar') }]));
  __testing.setBattleMapState({ tokens: [heroToken()] });

  const response = await toggleAura(PLAYER, { auraId: 'no-such-aura', active: true });
  assert.equal(response.statusCode, 404);
});

test('a non-boolean active value is rejected with 400', async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar') }]));
  __testing.setBattleMapState({ tokens: [heroToken()] });

  const response = await toggleAura(PLAYER, { active: 'yes' });
  assert.equal(response.statusCode, 400);
});

test('requesting the state an aura already has is a no-op: no version bump', async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar', { active: true }) }]));
  __testing.setBattleMapState({ tokens: [heroToken()] });
  const versionBefore = __testing.getBattleMapVersion();

  const response = await toggleAura(PLAYER, { active: true });
  assert.equal(response.statusCode, 200);
  assert.equal(__testing.getBattleMapVersion(), versionBefore);
});

test('an unconscious owner can still turn their aura on, and it stays on', async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar', { active: false }) }]));
  __testing.setBattleMapState({ tokens: [heroToken({ conditions: ['unconscious', 'prone'] })] });

  const response = await toggleAura(PLAYER, { active: true });
  assert.equal(response.statusCode, 200);
  const hero = __testing.getBattleMapState().tokens.find((token) => token.id === 'hero');
  assert.equal(hero.auras[0].active, true);
  assert.ok(hero.conditions.includes('unconscious'));
});

// Task 2.3: sanitizzazione per un proprietario nascosto (design, decisione 5). Nessun codice
// nuovo: la sanitizzazione esistente rimuove il token invisibile e con lui le sue aure.

test("an other adventurer's snapshot has neither the token nor its auras once the master hides its owner, while the master's snapshot keeps both", async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar', { active: true }) }]));
  __testing.setBattleMapState({ tokens: [heroToken({ isInvisible: true }), goblinToken()] });

  const otherResponse = await __testing.app.inject({ method: 'GET', url: '/api/battle-map/state', headers: sessionHeaders(OTHER_PLAYER) });
  assert.equal(otherResponse.statusCode, 200);
  const otherTokens = otherResponse.json().state.tokens;
  assert.equal(otherTokens.some((token) => token.id === 'hero'), false);

  const masterResponse = await __testing.app.inject({ method: 'GET', url: '/api/battle-map/state', headers: sessionHeaders(MASTER) });
  assert.equal(masterResponse.statusCode, 200);
  const masterHero = masterResponse.json().state.tokens.find((token) => token.id === 'hero');
  assert.ok(masterHero);
  assert.equal(masterHero.auras[0].active, true);
});

test('toggling an aura never adds an entry to the undo stack', async () => {
  __testing.setCharacterSheetService(sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetDataWithAura('Ilthar', { active: false }) }]));
  __testing.setBattleMapState({ tokens: [heroToken()] });
  await drainPlayerUndo(PLAYER);

  const response = await toggleAura(PLAYER, { active: true });
  assert.equal(response.statusCode, 200);

  const undo = await __testing.app.inject({ method: 'POST', url: '/api/battle-map/undo', headers: sessionHeaders(PLAYER) });
  assert.equal(undo.statusCode, 400);
});
