import assert from 'node:assert/strict';
import test from 'node:test';
import { CharacterSheetPolicy } from '../server/character-sheet-policy.mjs';
import { CharacterSheetService } from '../server/character-sheet-service.mjs';
import { createInitialCharacterSheetData } from '../server/character-sheet-schema.mjs';
import { rollInitiative } from '../server/initiative-roll.mjs';

process.env.BATTLE_MAP_TEST_MODE = '1';
const { __testing } = await import('../server/index.mjs');

const MASTER = { id: 'master-user', username: 'master', displayName: 'Master', role: 'master' };
const PLAYER = { id: 'player-ilthar', username: 'ilthar', displayName: 'Ilthar', role: 'adventurer' };
const OTHER_PLAYER = { id: 'player-thalendir', username: 'thalendir', displayName: 'Thalendir', role: 'adventurer' };
const usersById = new Map([MASTER, PLAYER, OTHER_PLAYER].map((user) => [user.id, user]));
__testing.setUserRepository({ findById: (id) => usersById.get(id) ?? null });

function sheetData({ name, dex = '14', misc = '', mode = 'normal' }) {
  const data = createInitialCharacterSheetData({ displayName: name });
  data.character.abilities.dexterity.score = dex;
  data.character.initiativeMiscBonus = misc;
  data.character.initiativeRollMode = mode;
  return data;
}

// Servizio reale su un repository in memoria con più schede, come le route lo vedono in produzione.
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
  });
}

// Facce desiderate in ordine; l'ultimo valore alimenta la frazione di spareggio.
function queueRng(faces) {
  const values = [...faces];
  return () => {
    const next = values.shift();
    if (next === undefined) throw new Error('rng queue exhausted');
    return next - 1;
  };
}

function token(id, overrides = {}) {
  return {
    id, name: id, type: 'player', size: 'medium', position: { x: 0, y: 0 }, color: '#2f9e44',
    initiativeModifier: 0, movementCells: 6, conditions: [], ...overrides,
  };
}

const HERO = token('hero', { name: 'Ilthar', ownerUserId: PLAYER.id, position: { x: 0, y: 0 } });
const ALLY = token('ally', { name: 'Thalendir', ownerUserId: OTHER_PLAYER.id, position: { x: 2, y: 0 } });
const GOBLIN = token('goblin', { name: 'Goblin', type: 'enemy', initiativeModifier: 3, position: { x: 4, y: 0 } });
const CHEST = token('chest', { name: 'Forziere', type: 'object', position: { x: 6, y: 0 } });
const STATUE = token('statue', { name: 'Statua', type: 'enemy', excludeFromInitiative: true, position: { x: 8, y: 0 } });

function combatState(overrides = {}) {
  return __testing.normalizeSharedState({
    tokens: [HERO, ALLY, GOBLIN, CHEST, STATUE], sessionMode: 'combat', isRoundStarted: false, ...overrides,
  });
}

// --- 3.2 modulo del tiro ---------------------------------------------------------------------

test('Vantaggio dalla scheda: 7 e 15 con +2 valgono 17, un dado tenuto e uno scartato', () => {
  const service = sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetData({ name: 'Ilthar', mode: 'advantage' }) }]);
  const result = rollInitiative({ user: PLAYER, state: combatState(), service, tokenId: 'hero', nextUint32: queueRng([7, 15, 1]) });
  assert.equal(result.entry.value, 17);
  assert.equal(result.entry.mode, 'advantage');
  assert.equal(result.entry.dexModifier, 2);
  assert.equal(result.entry.source, 'rolled');
  assert.deepEqual(result.log.rolls, [7, 15]);
  assert.equal(result.log.total, 17);
  assert.deepEqual(result.log.dice.map((die) => [die.value, die.disposition]), [[7, 'discarded'], [15, 'kept']]);
  assert.equal(result.log.mode, 'advantage');
  assert.equal(result.log.visibility, 'public');
  assert.equal(result.log.actionLabel, 'Iniziativa');
  assert.equal(result.log.characterName, 'Ilthar');
  assert.deepEqual(result.log.source, { sheetId: 'sheet-hero', target: 'initiative' });
});

test('Svantaggio dalla scheda tiene il minore', () => {
  const service = sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetData({ name: 'Ilthar', mode: 'disadvantage' }) }]);
  const result = rollInitiative({ user: PLAYER, state: combatState(), service, tokenId: 'hero', nextUint32: queueRng([7, 15, 1]) });
  assert.equal(result.entry.value, 9);
  assert.deepEqual(result.log.dice.map((die) => die.disposition), ['kept', 'discarded']);
});

test("la modalità dichiarata dall'Adventurer e i valori del client sono ignorati", () => {
  const service = sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetData({ name: 'Ilthar', mode: 'normal' }) }]);
  const result = rollInitiative({
    user: PLAYER, state: combatState(), service, tokenId: 'hero', requestedMode: 'advantage',
    value: 30, total: 30, modifier: 10, nextUint32: queueRng([11, 1]),
  });
  assert.equal(result.log.rolls.length, 1);
  assert.equal(result.entry.mode, 'normal');
  assert.equal(result.entry.value, 13);
});

test('il Master sceglie la modalità solo per un token senza scheda', () => {
  const service = sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetData({ name: 'Ilthar', mode: 'normal' }) }]);
  const monster = rollInitiative({ user: MASTER, state: combatState(), service, tokenId: 'goblin', requestedMode: 'disadvantage', nextUint32: queueRng([7, 15, 1]) });
  assert.equal(monster.entry.value, 7 + 3);
  assert.equal(monster.entry.dexModifier, 3);
  assert.equal(monster.entry.mode, 'disadvantage');

  const hero = rollInitiative({ user: MASTER, state: combatState(), service, tokenId: 'hero', requestedMode: 'advantage', nextUint32: queueRng([11, 1]) });
  assert.equal(hero.entry.mode, 'normal');
  assert.equal(hero.log.rolls.length, 1);
});

test('il tiro per un mostro è segreto', () => {
  const result = rollInitiative({ user: MASTER, state: combatState(), service: sheetService([]), tokenId: 'goblin', nextUint32: queueRng([11, 1]) });
  assert.equal(result.log.visibility, 'secret');
  assert.equal(result.log.authorUserId, MASTER.id);
  assert.equal(result.log.source, undefined);
});

test('rifiuti: Esplorazione, token inesistente, non creatura, escluso, altrui, secondo tiro', () => {
  const service = sheetService([{ id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetData({ name: 'Ilthar' }) }]);
  const rng = () => 0;
  const exploration = rollInitiative({ user: MASTER, state: __testing.normalizeSharedState({ tokens: [HERO] }), service, tokenId: 'hero', nextUint32: rng });
  assert.match(exploration.error, /Esplorazione/);
  assert.equal(rollInitiative({ user: MASTER, state: combatState(), service, tokenId: 'ghost', nextUint32: rng }).status, 404);
  assert.equal(rollInitiative({ user: MASTER, state: combatState(), service, tokenId: 'chest', nextUint32: rng }).status, 400);
  assert.equal(rollInitiative({ user: MASTER, state: combatState(), service, tokenId: 'statue', nextUint32: rng }).status, 400);
  assert.equal(rollInitiative({ user: PLAYER, state: combatState(), service, tokenId: 'ally', nextUint32: rng }).status, 403);
  assert.equal(rollInitiative({ user: PLAYER, state: combatState(), service, tokenId: 'goblin', nextUint32: rng }).status, 403);
  const withEntry = combatState({ initiatives: [{ tokenId: 'hero', value: 10, source: 'rolled' }] });
  assert.match(rollInitiative({ user: PLAYER, state: withEntry, service, tokenId: 'hero', nextUint32: rng }).error, /già tirato/);
  // Il Master può sostituire la voce esistente.
  assert.ok(rollInitiative({ user: MASTER, state: withEntry, service, tokenId: 'hero', nextUint32: queueRng([5, 1]) }).entry);
});

// --- 3.3 route ----------------------------------------------------------------------------

function sessionHeaders(user) {
  return { cookie: `battle_map_session=${__testing.createSession(user)}` };
}

async function post(user, url, payload = {}) {
  return __testing.app.inject({ method: 'POST', url, headers: sessionHeaders(user), payload });
}

function installSheets() {
  __testing.setCharacterSheetService(sheetService([
    { id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetData({ name: 'Ilthar', mode: 'advantage' }) },
    { id: 'sheet-ally', ownerUserId: OTHER_PLAYER.id, data: sheetData({ name: 'Thalendir', dex: '16', mode: 'normal' }) },
  ]));
}

test('il Master tira per un Player assente con la modalità della sua scheda, in una commit', async () => {
  installSheets();
  __testing.setBattleMapState({ tokens: [HERO, ALLY, GOBLIN], sessionMode: 'combat' });
  const versionBefore = __testing.getBattleMapVersion();
  const response = await post(MASTER, '/api/battle-map/initiative/roll', { tokenId: 'hero', value: 99 });
  assert.equal(response.statusCode, 200);
  const state = __testing.getBattleMapState();
  assert.equal(__testing.getBattleMapVersion(), versionBefore + 1);
  assert.equal(state.initiatives.length, 1);
  assert.equal(state.initiatives[0].mode, 'advantage');
  assert.notEqual(state.initiatives[0].value, 99);
  assert.equal(state.diceLogs[0].total, state.initiatives[0].value);
  assert.equal(state.diceLogs[0].visibility, 'public');
});

test("due richieste consecutive dell'Adventurer producono una voce e un log", async () => {
  installSheets();
  __testing.setBattleMapState({ tokens: [HERO, ALLY, GOBLIN], sessionMode: 'combat' });
  const [first, second] = await Promise.all([
    post(PLAYER, '/api/battle-map/initiative/roll', { tokenId: 'hero' }),
    post(PLAYER, '/api/battle-map/initiative/roll', { tokenId: 'hero' }),
  ]);
  assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 400]);
  const state = __testing.getBattleMapState();
  assert.equal(state.initiatives.length, 1);
  assert.equal(state.diceLogs.length, 1);
});

test('«Tira per tutti» non sovrascrive una voce esistente ed è riservato al Master', async () => {
  installSheets();
  __testing.setBattleMapState({ tokens: [HERO, ALLY, GOBLIN, CHEST, STATUE], sessionMode: 'combat' });
  const own = await post(PLAYER, '/api/battle-map/initiative/roll', { tokenId: 'hero' });
  assert.equal(own.statusCode, 200);
  const heroEntry = __testing.getBattleMapState().initiatives[0];

  assert.equal((await post(PLAYER, '/api/battle-map/initiative/roll-all')).statusCode, 403);
  const versionBefore = __testing.getBattleMapVersion();
  const all = await post(MASTER, '/api/battle-map/initiative/roll-all');
  assert.equal(all.statusCode, 200);
  assert.equal(__testing.getBattleMapVersion(), versionBefore + 1);
  const state = __testing.getBattleMapState();
  assert.deepEqual(new Set(state.initiatives.map((item) => item.tokenId)), new Set(['hero', 'ally', 'goblin']));
  assert.deepEqual(state.initiatives.find((item) => item.tokenId === 'hero'), heroEntry);
  assert.equal(state.diceLogs.length, 3);

  const nothingLeft = await post(MASTER, '/api/battle-map/initiative/roll-all');
  assert.equal(nothingLeft.statusCode, 400);
});

test("il tiro segreto di un mostro non raggiunge l'Adventurer via SSE", async () => {
  installSheets();
  __testing.setBattleMapState({ tokens: [HERO, GOBLIN], sessionMode: 'combat' });
  const writes = [];
  const client = { user: PLAYER, write: (payload) => writes.push(payload) };
  __testing.streamClients.add(client);
  try {
    const response = await post(MASTER, '/api/battle-map/initiative/roll', { tokenId: 'goblin' });
    assert.equal(response.statusCode, 200);
  } finally {
    __testing.streamClients.delete(client);
  }
  const payload = JSON.parse(writes[0].replace(/^data: /, ''));
  assert.equal(payload.state.diceLogs.length, 0);
  assert.equal(payload.state.initiatives.length, 1); // la voce resta soggetta solo alla visibilità del token
  assert.equal(__testing.getBattleMapState().diceLogs.length, 1);
});

test('un tiro in Esplorazione è rifiutato senza voce né log', async () => {
  installSheets();
  __testing.setBattleMapState({ tokens: [HERO, GOBLIN] });
  const response = await post(MASTER, '/api/battle-map/initiative/roll', { tokenId: 'goblin' });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /Esplorazione/);
  assert.equal(__testing.getBattleMapState().diceLogs.length, 0);
  assert.equal((await post(MASTER, '/api/battle-map/initiative/roll-all')).statusCode, 400);
});

// --- 3.4 bersaglio Iniziativa della scheda -------------------------------------------------

test('il bersaglio Iniziativa della scheda scrive il tracker con un valore solo e ignora il segreto', async () => {
  __testing.setCharacterSheetService(sheetService([
    { id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetData({ name: 'Ilthar', mode: 'normal' }) },
  ]));
  __testing.setBattleMapState({ tokens: [HERO, GOBLIN], sessionMode: 'combat' });
  const response = await post(PLAYER, '/api/battle-map/rolls', {
    source: { sheetId: 'sheet-hero', target: 'initiative' }, visibility: 'secret',
  });
  assert.equal(response.statusCode, 200);
  const state = __testing.getBattleMapState();
  assert.equal(state.initiatives.length, 1);
  assert.equal(state.diceLogs[0].rolls.length, 1);
  assert.equal(state.diceLogs[0].dice.length, 1);
  assert.equal(state.diceLogs[0].dice[0].disposition, 'kept');
  assert.equal(state.diceLogs[0].visibility, 'public');
  assert.equal(state.initiatives[0].value, state.diceLogs[0].total);
});

test('il bersaglio Iniziativa è rifiutato in Esplorazione e senza token collegato', async () => {
  __testing.setCharacterSheetService(sheetService([
    { id: 'sheet-hero', ownerUserId: PLAYER.id, data: sheetData({ name: 'Ilthar' }) },
  ]));
  __testing.setBattleMapState({ tokens: [HERO] });
  const exploration = await post(PLAYER, '/api/battle-map/rolls', { source: { sheetId: 'sheet-hero', target: 'initiative' } });
  assert.equal(exploration.statusCode, 400);
  assert.match(exploration.json().message, /Esplorazione/);
  assert.equal(__testing.getBattleMapState().diceLogs.length, 0);

  __testing.setBattleMapState({ tokens: [GOBLIN], sessionMode: 'combat' });
  const noToken = await post(PLAYER, '/api/battle-map/rolls', { source: { sheetId: 'sheet-hero', target: 'initiative' } });
  assert.equal(noToken.statusCode, 400);
  assert.match(noToken.json().message, /token/);
  assert.equal(__testing.getBattleMapState().diceLogs.length, 0);
});
