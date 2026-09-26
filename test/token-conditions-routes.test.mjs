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
    exhaustionLevel: 0,
    ...overrides,
  };
}

function familiarToken(overrides = {}) {
  return heroToken({
    id: 'familiar-1',
    name: 'Gufo',
    isFamiliar: true,
    ...overrides,
  });
}

function enemyToken(overrides = {}) {
  return {
    id: 'enemy-1',
    name: 'Goblin',
    type: 'enemy',
    size: 'small',
    position: { x: 2, y: 2 },
    color: '#c92a2a',
    initiativeModifier: 0,
    conditions: [],
    exhaustionLevel: 0,
    ...overrides,
  };
}

async function applyCondition(user, body) {
  return __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/token-conditions',
    headers: sessionHeaders(user),
    payload: body,
  });
}

async function tokenUpdate(user, body) {
  return __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/token-update',
    headers: sessionHeaders(user),
    payload: body,
  });
}

async function undo(user) {
  return __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/undo',
    headers: sessionHeaders(user),
  });
}

// --- 2.1 POST /api/battle-map/token-conditions --------------------------------------------------

test('Master e Adventurer modificano lo stesso token quasi insieme: entrambe le condizioni restano', async () => {
  __testing.setBattleMapState({ tokens: [heroToken()] });

  const masterAdd = await applyCondition(MASTER, {
    tokenId: 'hero-1',
    op: { type: 'add', condition: 'grappled' },
  });
  assert.equal(masterAdd.statusCode, 200);

  const playerAdd = await applyCondition(PLAYER, {
    tokenId: 'hero-1',
    op: { type: 'add', condition: 'poisoned' },
  });
  assert.equal(playerAdd.statusCode, 200);

  const finalConditions = __testing.getBattleMapState().tokens[0].conditions;
  assert.ok(finalConditions.includes('grappled'));
  assert.ok(finalConditions.includes('poisoned'));
});

test('un Adventurer non può modificare le condizioni del token di un altro personaggio', async () => {
  __testing.setBattleMapState({ tokens: [heroToken(), heroToken({ id: 'hero-2', ownerUserId: OTHER_PLAYER.id })] });

  const response = await applyCondition(PLAYER, {
    tokenId: 'hero-2',
    op: { type: 'add', condition: 'prone' },
  });
  assert.equal(response.statusCode, 403);
  assert.deepEqual(__testing.getBattleMapState().tokens[1].conditions, []);
});

test('un Adventurer può modificare le condizioni del proprio famiglio', async () => {
  __testing.setBattleMapState({ tokens: [heroToken(), familiarToken()] });

  const response = await applyCondition(PLAYER, {
    tokenId: 'familiar-1',
    op: { type: 'add', condition: 'frightened' },
  });
  assert.equal(response.statusCode, 200);
  assert.ok(__testing.getBattleMapState().tokens[1].conditions.includes('frightened'));
});

test('una condizione fuori catalogo e un livello di Indebolimento 7 sono rifiutati', async () => {
  __testing.setBattleMapState({ tokens: [heroToken()] });

  const badCondition = await applyCondition(PLAYER, {
    tokenId: 'hero-1',
    op: { type: 'add', condition: 'overturned' },
  });
  assert.equal(badCondition.statusCode, 400);
  assert.deepEqual(__testing.getBattleMapState().tokens[0].conditions, []);

  const badLevel = await applyCondition(PLAYER, {
    tokenId: 'hero-1',
    op: { type: 'set-exhaustion', level: 7 },
  });
  assert.equal(badLevel.statusCode, 400);
  assert.equal(__testing.getBattleMapState().tokens[0].exhaustionLevel, 0);
});

test('aggiungere Privo di sensi aggiunge anche Prono nella stessa operazione, e togliere Privo di sensi non toglie Prono', async () => {
  __testing.setBattleMapState({ tokens: [heroToken()] });

  const faint = await applyCondition(PLAYER, {
    tokenId: 'hero-1',
    op: { type: 'add', condition: 'unconscious' },
  });
  assert.equal(faint.statusCode, 200);
  const afterFaint = __testing.getBattleMapState().tokens[0].conditions;
  assert.ok(afterFaint.includes('unconscious'));
  assert.ok(afterFaint.includes('prone'));

  const wake = await applyCondition(MASTER, {
    tokenId: 'hero-1',
    op: { type: 'remove', condition: 'unconscious' },
  });
  assert.equal(wake.statusCode, 200);
  const afterWake = __testing.getBattleMapState().tokens[0].conditions;
  assert.ok(!afterWake.includes('unconscious'));
  assert.ok(afterWake.includes('prone'));
});

test('un token inesistente restituisce 404', async () => {
  __testing.setBattleMapState({ tokens: [] });
  const response = await applyCondition(MASTER, { tokenId: 'ghost', op: { type: 'add', condition: 'prone' } });
  assert.equal(response.statusCode, 404);
});

test('una no-op (aggiungere una condizione già presente) non incrementa la versione', async () => {
  __testing.setBattleMapState({ tokens: [heroToken({ conditions: ['prone'] })] });
  const versionBefore = __testing.getBattleMapVersion();

  const response = await applyCondition(PLAYER, {
    tokenId: 'hero-1',
    op: { type: 'add', condition: 'prone' },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(__testing.getBattleMapVersion(), versionBefore);
});

test('annullamento dopo una modifica del Master conserva Avvelenato aggiunto dal Master', async () => {
  __testing.setBattleMapState({ tokens: [heroToken()] });

  const faint = await applyCondition(PLAYER, { tokenId: 'hero-1', op: { type: 'add', condition: 'unconscious' } });
  assert.equal(faint.statusCode, 200);

  const masterAdd = await applyCondition(MASTER, { tokenId: 'hero-1', op: { type: 'add', condition: 'poisoned' } });
  assert.equal(masterAdd.statusCode, 200);

  const undoResponse = await undo(PLAYER);
  assert.equal(undoResponse.statusCode, 200);
  const conditions = undoResponse.json().state.tokens[0].conditions;
  assert.ok(!conditions.includes('unconscious'));
  assert.ok(!conditions.includes('prone'));
  assert.ok(conditions.includes('poisoned'));
});

test('un commit a stato pieno del Master con una condizione sconosciuta la scarta', async () => {
  __testing.setBattleMapState({ tokens: [enemyToken()] });
  const nextState = __testing.normalizeSharedState({
    ...__testing.getBattleMapState(),
    tokens: [enemyToken({ conditions: ['prone', 'pippo'] })],
  });
  assert.deepEqual(nextState.tokens[0].conditions, ['prone']);
});

// --- 2.2 updateOwnedToken ignora `conditions` ----------------------------------------------------

test("l'invio di un elenco completo di condizioni tramite token-update viene ignorato, ma HP e gli altri campi continuano ad aggiornarsi", async () => {
  __testing.setBattleMapState({ tokens: [heroToken({ conditions: ['prone'], hitPoints: 10, maxHitPoints: 10 })] });

  const response = await tokenUpdate(PLAYER, {
    tokenId: 'hero-1',
    updates: { conditions: ['poisoned', 'stunned'], hitPoints: 5 },
  });
  assert.equal(response.statusCode, 200);
  const token = response.json().state.tokens[0];
  assert.deepEqual(token.conditions, ['prone']);
  assert.equal(token.hitPoints, 5);
});

// --- 2.3 POST /api/battle-map/stand-up -----------------------------------------------------------

function withActiveTurn(state) {
  return {
    ...state,
    initiatives: [{ tokenId: 'hero-1', value: 10, source: 'manual' }],
    activeTurnTokenId: 'hero-1',
  };
}

async function standUp(user, tokenId) {
  return __testing.app.inject({
    method: 'POST',
    url: '/api/battle-map/stand-up',
    headers: sessionHeaders(user),
    payload: { tokenId },
  });
}

test('a round avviato con velocità 5 e nessun movimento usato, alzarsi costa 2 e lascia 3 caselle', async () => {
  __testing.setBattleMapState({
    ...withActiveTurn({ tokens: [heroToken({ movementCells: 5, conditions: ['prone'] })] }),
    sessionMode: 'combat',
    isRoundStarted: true,
  });

  const response = await standUp(PLAYER, 'hero-1');
  assert.equal(response.statusCode, 200);
  const state = response.json().state;
  assert.ok(!state.tokens[0].conditions.includes('prone'));
  assert.equal(state.movementUsedByTokenId['hero-1'], 2);
});

test('con movimento insufficiente (servono 3, restano 2) il comando è rifiutato e il token resta Prono', async () => {
  __testing.setBattleMapState({
    ...withActiveTurn({
      tokens: [heroToken({ movementCells: 6, conditions: ['prone'] })],
      movementUsedByTokenId: { 'hero-1': 4 },
    }),
    sessionMode: 'combat',
    isRoundStarted: true,
  });

  const response = await standUp(PLAYER, 'hero-1');
  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /restano 2/);
  assert.ok(__testing.getBattleMapState().tokens[0].conditions.includes('prone'));
});

test('Privo di sensi rifiuta Alzati citando la condizione', async () => {
  __testing.setBattleMapState({
    ...withActiveTurn({ tokens: [heroToken({ movementCells: 6, conditions: ['prone', 'unconscious'] })] }),
    sessionMode: 'combat',
    isRoundStarted: true,
  });

  const response = await standUp(PLAYER, 'hero-1');
  assert.equal(response.statusCode, 400);
  assert.match(response.json().message, /Privo di sensi/);
});

test('durante la fase di tiro Alzati è rifiutato per un Adventurer', async () => {
  __testing.setBattleMapState({
    tokens: [heroToken({ conditions: ['prone'] })],
    sessionMode: 'combat',
    isRoundStarted: false,
    initiatives: [{ tokenId: 'hero-1', value: 10, source: 'manual' }],
  });

  const response = await standUp(PLAYER, 'hero-1');
  assert.equal(response.statusCode, 400);
});

test('in Esplorazione Alzati toglie Prono senza costo', async () => {
  __testing.setBattleMapState({ tokens: [heroToken({ conditions: ['prone'] })], sessionMode: 'exploration' });

  const response = await standUp(PLAYER, 'hero-1');
  assert.equal(response.statusCode, 200);
  const state = response.json().state;
  assert.ok(!state.tokens[0].conditions.includes('prone'));
  assert.equal(state.movementUsedByTokenId['hero-1'] ?? 0, 0);
});

test('il Master alza un token senza costo, in ogni modalità', async () => {
  __testing.setBattleMapState({
    ...withActiveTurn({ tokens: [heroToken({ conditions: ['prone'] })] }),
    sessionMode: 'combat',
    isRoundStarted: true,
  });

  const response = await standUp(MASTER, 'hero-1');
  assert.equal(response.statusCode, 200);
  const state = response.json().state;
  assert.ok(!state.tokens[0].conditions.includes('prone'));
  assert.equal(state.movementUsedByTokenId['hero-1'] ?? 0, 0);
});

test("l'annullamento di Alzati rimette Prono e restituisce il movimento addebitato", async () => {
  __testing.setBattleMapState({
    ...withActiveTurn({ tokens: [heroToken({ movementCells: 5, conditions: ['prone'] })] }),
    sessionMode: 'combat',
    isRoundStarted: true,
  });

  const standUpResponse = await standUp(PLAYER, 'hero-1');
  assert.equal(standUpResponse.statusCode, 200);
  assert.equal(standUpResponse.json().state.movementUsedByTokenId['hero-1'], 2);

  const undoResponse = await undo(PLAYER);
  assert.equal(undoResponse.statusCode, 200);
  const state = undoResponse.json().state;
  assert.ok(state.tokens[0].conditions.includes('prone'));
  assert.equal(state.movementUsedByTokenId['hero-1'] ?? 0, 0);
});
