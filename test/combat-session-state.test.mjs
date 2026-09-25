import assert from 'node:assert/strict';
import test from 'node:test';

process.env.BATTLE_MAP_TEST_MODE = '1';
const { __testing } = await import('../server/index.mjs');

const MASTER = { id: 'master-user', username: 'master', displayName: 'Master', role: 'master' };
const PLAYER = { id: 'player-ilthar', username: 'ilthar', displayName: 'Ilthar', role: 'adventurer' };
const OTHER_PLAYER = { id: 'player-thalendir', username: 'thalendir', displayName: 'Thalendir', role: 'adventurer' };

const usersById = new Map([MASTER, PLAYER, OTHER_PLAYER].map((user) => [user.id, user]));
__testing.setUserRepository({ findById: (id) => usersById.get(id) ?? null });
__testing.setCharacterSheetService(null);

function sessionHeaders(user) {
  return { cookie: `battle_map_session=${__testing.createSession(user)}` };
}

function token(id, overrides = {}) {
  return {
    id,
    name: id,
    type: 'player',
    size: 'medium',
    position: { x: 0, y: 0 },
    color: '#2f9e44',
    initiativeModifier: 0,
    movementCells: 6,
    conditions: [],
    ...overrides,
  };
}

const HERO = token('hero', { ownerUserId: PLAYER.id, position: { x: 0, y: 0 } });
const ALLY = token('ally', { ownerUserId: OTHER_PLAYER.id, position: { x: 2, y: 0 } });
const GOBLIN = token('goblin', { type: 'enemy', initiativeModifier: 2, position: { x: 4, y: 0 } });

function entry(tokenId, value, extra = {}) {
  return { tokenId, value, source: 'manual', dexModifier: 0, tiebreaker: 0.5, ...extra };
}

async function post(user, url, payload = {}) {
  return __testing.app.inject({ method: 'POST', url, headers: sessionHeaders(user), payload });
}

// Stato in combattimento a round avviato: ordine eroe → goblin → alleato.
function roundState(overrides = {}) {
  return {
    tokens: [HERO, ALLY, GOBLIN],
    sessionMode: 'combat',
    isRoundStarted: true,
    initiatives: [entry('hero', 18), entry('goblin', 12), entry('ally', 5)],
    activeTurnTokenId: 'hero',
    roundNumber: 1,
    ...overrides,
  };
}

// --- 1.1 normalizzazione ---------------------------------------------------------------------

test('uno stato vuoto è in Esplorazione, senza fine turno dei giocatori', () => {
  const state = __testing.normalizeSharedState({});
  assert.equal(state.sessionMode, 'exploration');
  assert.equal(state.isRoundStarted, false);
  assert.equal(state.playersCanEndTurn, false);
  assert.deepEqual(state.initiatives, []);
  assert.equal(state.activeTurnTokenId, null);
});

test('uno snapshot legacy senza voci si carica in Esplorazione', () => {
  const state = __testing.normalizeSharedState({ tokens: [HERO], roundNumber: 3 });
  assert.equal(state.sessionMode, 'exploration');
  assert.equal(state.isRoundStarted, false);
});

test('uno snapshot legacy con voci e turno attivo riprende il combattimento a round avviato', () => {
  const legacy = {
    tokens: [HERO, ALLY, GOBLIN],
    initiatives: [
      { tokenId: 'goblin', value: 8, source: 'rolled' },
      { tokenId: 'hero', value: 15, source: 'manual' },
    ],
    activeTurnTokenId: 'hero',
    roundNumber: 4,
    movementUsedByTokenId: { hero: 3 },
  };
  const state = __testing.normalizeSharedState(legacy);
  assert.equal(state.sessionMode, 'combat');
  assert.equal(state.isRoundStarted, true);
  assert.deepEqual(state.initiatives.map((item) => item.tokenId), ['goblin', 'hero']);
  assert.equal(state.activeTurnTokenId, 'hero');
  assert.equal(state.roundNumber, 4);
  assert.equal(state.movementUsedByTokenId.hero, 3);
  // Il server completa Destrezza (dal modificatore del token senza scheda) e frazione.
  assert.equal(state.initiatives[0].dexModifier, 2);
  for (const item of state.initiatives) {
    assert.equal(typeof item.tiebreaker, 'number');
    assert.ok(item.tiebreaker >= 0 && item.tiebreaker < 1);
  }
  // Una seconda normalizzazione non cambia le frazioni: l'ordine resta stabile.
  const again = __testing.normalizeSharedState(state);
  assert.deepEqual(again.initiatives, state.initiatives);
});

test('uno snapshot legacy con voci ma senza turno attivo si carica nella fase di tiro', () => {
  const state = __testing.normalizeSharedState({
    tokens: [HERO],
    initiatives: [{ tokenId: 'hero', value: 10, source: 'manual' }],
  });
  assert.equal(state.sessionMode, 'combat');
  assert.equal(state.isRoundStarted, false);
  assert.equal(state.activeTurnTokenId, null);
});

test("l'Esplorazione svuota voci residue e turno; la fase di tiro non ha un turno attivo", () => {
  const exploration = __testing.normalizeSharedState({
    tokens: [HERO],
    sessionMode: 'exploration',
    isRoundStarted: true,
    initiatives: [entry('hero', 10)],
    activeTurnTokenId: 'hero',
  });
  assert.deepEqual(exploration.initiatives, []);
  assert.equal(exploration.activeTurnTokenId, null);
  assert.equal(exploration.isRoundStarted, false);

  const rollPhase = __testing.normalizeSharedState({
    tokens: [HERO],
    sessionMode: 'combat',
    isRoundStarted: false,
    initiatives: [entry('hero', 10)],
    activeTurnTokenId: 'hero',
  });
  assert.equal(rollPhase.activeTurnTokenId, null);
  assert.equal(rollPhase.initiatives.length, 1);
});

// --- 1.2 sanitizzazione ----------------------------------------------------------------------

test('la frazione di spareggio raggiunge il Master ma non un Adventurer, via HTTP e SSE', async () => {
  __testing.setBattleMapState(roundState());
  const masterView = __testing.sanitizeStateForUser(__testing.getBattleMapState(), MASTER);
  assert.ok(masterView.initiatives.every((item) => typeof item.tiebreaker === 'number'));
  const playerView = __testing.sanitizeStateForUser(__testing.getBattleMapState(), PLAYER);
  assert.ok(playerView.initiatives.every((item) => !('tiebreaker' in item)));
  assert.equal(playerView.initiatives.length, 3);

  const http = await __testing.app.inject({ method: 'GET', url: '/api/battle-map/state', headers: sessionHeaders(PLAYER) });
  assert.ok(http.json().state.initiatives.every((item) => !('tiebreaker' in item)));
  const masterHttp = await __testing.app.inject({ method: 'GET', url: '/api/battle-map/state', headers: sessionHeaders(MASTER) });
  assert.ok(masterHttp.json().state.initiatives.every((item) => typeof item.tiebreaker === 'number'));

  const writes = [];
  const client = { user: PLAYER, write: (payload) => writes.push(payload) };
  const masterClient = { user: MASTER, write: (payload) => writes.push(`master:${payload}`) };
  __testing.streamClients.add(client);
  __testing.streamClients.add(masterClient);
  try {
    await post(MASTER, '/api/battle-map/settings/players-can-end-turn', { enabled: true });
  } finally {
    __testing.streamClients.delete(client);
    __testing.streamClients.delete(masterClient);
  }
  const playerPayload = JSON.parse(writes.find((line) => !line.startsWith('master:')).replace(/^data: /, ''));
  assert.ok(playerPayload.state.initiatives.every((item) => !('tiebreaker' in item)));
  const masterPayload = JSON.parse(writes.find((line) => line.startsWith('master:')).replace(/^master:data: /, ''));
  assert.ok(masterPayload.state.initiatives.every((item) => typeof item.tiebreaker === 'number'));
});

// --- 2.1 ciclo di vita dell'incontro ---------------------------------------------------------

test("un Adventurer non può cambiare modalità né avviare il round", async () => {
  __testing.setBattleMapState({ tokens: [HERO] });
  for (const url of ['/api/battle-map/combat/start', '/api/battle-map/combat/end', '/api/battle-map/combat/round/start']) {
    const response = await post(PLAYER, url);
    assert.equal(response.statusCode, 403, url);
  }
  assert.equal(__testing.getBattleMapState().sessionMode, 'exploration');
});

test("l'ingresso in Combattimento azzera il tracker, apre la fase di tiro e crea un solo annuncio", async () => {
  __testing.setBattleMapState({
    tokens: [HERO, GOBLIN],
    movementUsedByTokenId: { hero: 4 },
    diagonalParityByTokenId: { hero: 1 },
    dashUsedByTokenId: { hero: true },
    extraMovementByTokenId: { hero: 2 },
    roundNumber: 5,
  });
  const versionBefore = __testing.getBattleMapVersion();
  const response = await post(MASTER, '/api/battle-map/combat/start');
  assert.equal(response.statusCode, 200);
  const state = __testing.getBattleMapState();
  assert.equal(state.sessionMode, 'combat');
  assert.equal(state.isRoundStarted, false);
  assert.deepEqual(state.initiatives, []);
  assert.equal(state.activeTurnTokenId, null);
  assert.equal(state.roundNumber, 1);
  assert.deepEqual(state.movementUsedByTokenId, {});
  assert.deepEqual(state.diagonalParityByTokenId, {});
  assert.deepEqual(state.dashUsedByTokenId, {});
  assert.deepEqual(state.extraMovementByTokenId, {});
  assert.equal(state.combatAnnouncement.title, 'Il combattimento ha inizio');
  assert.equal(__testing.getBattleMapVersion(), versionBefore + 1);

  const firstAnnouncementId = state.combatAnnouncement.id;
  const again = await post(MASTER, '/api/battle-map/combat/start');
  assert.equal(again.statusCode, 400);
  assert.equal(__testing.getBattleMapState().combatAnnouncement.id, firstAnnouncementId);

  await post(MASTER, '/api/battle-map/combat/end');
  await post(MASTER, '/api/battle-map/combat/start');
  assert.notEqual(__testing.getBattleMapState().combatAnnouncement.id, firstAnnouncementId);
});

test("il round 1 è rifiutato con ordine vuoto e parte dalla prima voce", async () => {
  __testing.setBattleMapState({ tokens: [HERO, GOBLIN], sessionMode: 'combat' });
  const empty = await post(MASTER, '/api/battle-map/combat/round/start');
  assert.equal(empty.statusCode, 400);
  assert.equal(__testing.getBattleMapState().isRoundStarted, false);

  __testing.setBattleMapState({
    tokens: [HERO, GOBLIN],
    sessionMode: 'combat',
    initiatives: [entry('goblin', 17), entry('hero', 9)],
  });
  const started = await post(MASTER, '/api/battle-map/combat/round/start');
  assert.equal(started.statusCode, 200);
  assert.equal(__testing.getBattleMapState().isRoundStarted, true);
  assert.equal(__testing.getBattleMapState().activeTurnTokenId, 'goblin');
  assert.equal(__testing.getBattleMapState().roundNumber, 1);
});

test("l'uscita dal Combattimento a round avviato torna all'Esplorazione con gli azzeramenti", async () => {
  __testing.setBattleMapState(roundState({ roundNumber: 3, movementUsedByTokenId: { hero: 5 } }));
  const response = await post(MASTER, '/api/battle-map/combat/end');
  assert.equal(response.statusCode, 200);
  const state = __testing.getBattleMapState();
  assert.equal(state.sessionMode, 'exploration');
  assert.deepEqual(state.initiatives, []);
  assert.equal(state.activeTurnTokenId, null);
  assert.equal(state.roundNumber, 1);
  assert.deepEqual(state.movementUsedByTokenId, {});
});

test("il Master annulla l'ingresso in Combattimento con l'undo a snapshot", async () => {
  __testing.setBattleMapState({ tokens: [HERO] });
  await post(MASTER, '/api/battle-map/combat/start');
  assert.equal(__testing.getBattleMapState().sessionMode, 'combat');
  const undo = await post(MASTER, '/api/battle-map/undo');
  assert.equal(undo.statusCode, 200);
  assert.equal(__testing.getBattleMapState().sessionMode, 'exploration');
});

// --- 2.2 avanzamento del turno ---------------------------------------------------------------

test('superare l\'ultima voce incrementa il round e azzera il movimento', async () => {
  __testing.setBattleMapState(roundState({ activeTurnTokenId: 'ally', movementUsedByTokenId: { hero: 4, ally: 2 } }));
  const response = await post(MASTER, '/api/battle-map/turn/advance', { direction: 'next' });
  assert.equal(response.statusCode, 200);
  const state = __testing.getBattleMapState();
  assert.equal(state.activeTurnTokenId, 'hero');
  assert.equal(state.roundNumber, 2);
  assert.deepEqual(state.movementUsedByTokenId, {});
});

test('arretrare dalla prima voce non porta il round sotto 1', async () => {
  __testing.setBattleMapState(roundState());
  const response = await post(MASTER, '/api/battle-map/turn/advance', { direction: 'previous' });
  assert.equal(response.statusCode, 200);
  assert.equal(__testing.getBattleMapState().activeTurnTokenId, 'ally');
  assert.equal(__testing.getBattleMapState().roundNumber, 1);
});

test('nessun avanzamento in Esplorazione o nella fase di tiro', async () => {
  __testing.setBattleMapState({ tokens: [HERO] });
  assert.equal((await post(MASTER, '/api/battle-map/turn/advance', { direction: 'next' })).statusCode, 400);

  __testing.setBattleMapState(roundState({ isRoundStarted: false }));
  const rollPhase = await post(MASTER, '/api/battle-map/turn/advance', { direction: 'next' });
  assert.equal(rollPhase.statusCode, 400);
  assert.equal(__testing.getBattleMapState().activeTurnTokenId, null);
  assert.equal(__testing.getBattleMapState().roundNumber, 1);
});

test("l'Adventurer chiude il proprio turno solo se il Master lo consente", async () => {
  __testing.setBattleMapState(roundState({ playersCanEndTurn: false }));
  const disabled = await post(PLAYER, '/api/battle-map/turn/advance', { direction: 'next' });
  assert.equal(disabled.statusCode, 403);
  assert.equal(__testing.getBattleMapState().activeTurnTokenId, 'hero');

  __testing.setBattleMapState(roundState({ playersCanEndTurn: true }));
  const others = await post(OTHER_PLAYER, '/api/battle-map/turn/advance', { direction: 'next' });
  assert.equal(others.statusCode, 403);
  const backwards = await post(PLAYER, '/api/battle-map/turn/advance', { direction: 'previous' });
  assert.equal(backwards.statusCode, 403);
  assert.equal(__testing.getBattleMapState().activeTurnTokenId, 'hero');

  const ended = await post(PLAYER, '/api/battle-map/turn/advance', { direction: 'next' });
  assert.equal(ended.statusCode, 200);
  assert.equal(__testing.getBattleMapState().activeTurnTokenId, 'goblin');
});

// --- 2.3 impostazione di fine turno ----------------------------------------------------------

test("solo il Master cambia l'impostazione di fine turno, e il nuovo valore è trasmesso", async () => {
  __testing.setBattleMapState({ tokens: [HERO] });
  const denied = await post(PLAYER, '/api/battle-map/settings/players-can-end-turn', { enabled: true });
  assert.equal(denied.statusCode, 403);
  assert.equal(__testing.getBattleMapState().playersCanEndTurn, false);

  const writes = [];
  const client = { user: PLAYER, write: (payload) => writes.push(payload) };
  __testing.streamClients.add(client);
  try {
    const invalid = await post(MASTER, '/api/battle-map/settings/players-can-end-turn', { enabled: 'yes' });
    assert.equal(invalid.statusCode, 400);
    const accepted = await post(MASTER, '/api/battle-map/settings/players-can-end-turn', { enabled: true });
    assert.equal(accepted.statusCode, 200);
  } finally {
    __testing.streamClients.delete(client);
  }
  assert.equal(writes.length, 1);
  assert.equal(JSON.parse(writes[0].replace(/^data: /, '')).state.playersCanEndTurn, true);
});

// --- 2.4 avvisi di turno ---------------------------------------------------------------------

test('nessun avviso di turno nella fase di tiro; a round avviato solo per il Player interessato', async () => {
  __testing.setBattleMapState(roundState({ isRoundStarted: false }));
  assert.equal(__testing.nextSnapshot(PLAYER).state.turnNotice, null);
  assert.equal(__testing.nextSnapshot(OTHER_PLAYER).state.turnNotice, null);

  // ally è ultima, hero primo: con il goblin attivo, ally è "prossimo"; con ally attivo tocca a lui.
  __testing.setBattleMapState(roundState({ activeTurnTokenId: 'goblin' }));
  assert.equal(__testing.nextSnapshot(OTHER_PLAYER).state.turnNotice.kind, 'next');
  assert.equal(__testing.nextSnapshot(PLAYER).state.turnNotice, null);
  assert.equal(__testing.nextSnapshot(MASTER).state.turnNotice, null);

  __testing.setBattleMapState(roundState({ activeTurnTokenId: 'hero' }));
  assert.equal(__testing.nextSnapshot(PLAYER).state.turnNotice.kind, 'turn');
  assert.equal(__testing.nextSnapshot(OTHER_PLAYER).state.turnNotice, null);
});

// --- inserimento manuale del Master --------------------------------------------------------

test('una voce manuale nuova del Master è collocata dal server per valore e Destrezza, senza toccare gli spostamenti', async () => {
  const orc = token('orc', { type: 'enemy', initiativeModifier: 1, position: { x: 6, y: 0 } });
  const elf = token('elf', { type: 'enemy', initiativeModifier: 4, position: { x: 8, y: 0 } });
  // Il Master ha già spostato il goblin (8) sopra l'eroe (18).
  __testing.setBattleMapState({
    tokens: [HERO, GOBLIN, orc, elf],
    sessionMode: 'combat',
    initiatives: [entry('goblin', 8, { tiebreaker: 0.1 }), entry('hero', 18, { tiebreaker: 0.2 })],
  });
  const current = __testing.getBattleMapState();
  // Il client aggiunge in coda due voci manuali a pari valore, senza Destrezza né frazione.
  const response = await __testing.app.inject({
    method: 'PUT',
    url: '/api/battle-map/state',
    headers: sessionHeaders(MASTER),
    payload: {
      baseVersion: __testing.getBattleMapVersion(),
      state: {
        ...current,
        initiatives: [
          ...current.initiatives,
          { tokenId: 'orc', value: 12, source: 'manual' },
          { tokenId: 'elf', value: 12, source: 'manual' },
        ],
      },
    },
  });
  assert.equal(response.statusCode, 200);
  const order = __testing.getBattleMapState().initiatives;
  assert.deepEqual(order.map((item) => item.tokenId), ['elf', 'orc', 'goblin', 'hero']);
  assert.equal(order[0].dexModifier, 4);
  assert.ok(order.every((item) => typeof item.tiebreaker === 'number'));
});
