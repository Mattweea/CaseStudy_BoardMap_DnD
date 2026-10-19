import assert from 'node:assert/strict';
import test from 'node:test';
import { projectEncounterEntityToken } from '../shared/encounter-token.mjs';
import { insertInitiativeEntry } from '../shared/initiative-order.mjs';
import { rollInitiative } from '../server/initiative-roll.mjs';

process.env.BATTLE_MAP_TEST_MODE = '1';
const { __testing } = await import('../server/index.mjs');

function entity(id, entityType, name) {
  return { id, entityId: `definition-${id}`, entityType, encounterId: 'encounter-1', name };
}

function placement(id, entityReferenceId, position) {
  return { id, entityReferenceId, encounterId: 'encounter-1', position };
}

test('monster and npc projection yields independent canonical enemy tokens without PC ownership', () => {
  const monster = projectEncounterEntityToken({
    entity: entity('monster-ref', 'monster', 'Goblin'),
    placement: placement('placement-monster', 'monster-ref', { x: 3, y: 4 }),
    tokenProperties: { size: 'large', widthCells: 2, heightCells: 3, movementCells: 6,
      initiativeModifier: 2, hitPoints: 11, maxHitPoints: 11, isInvisible: true },
  });
  const npc = projectEncounterEntityToken({
    entity: entity('npc-ref', 'npc', 'Custode'),
    placement: placement('placement-npc', 'npc-ref', { x: 8, y: 4 }),
  });
  assert.equal(monster.id, 'placement-monster');
  assert.deepEqual(monster.position, { x: 3, y: 4 });
  assert.equal(monster.type, 'enemy');
  assert.equal(monster.size, 'large');
  assert.deepEqual([monster.widthCells, monster.heightCells, monster.movementCells], [2, 3, 6]);
  assert.equal(monster.hitPoints, 11);
  assert.equal(monster.isInvisible, true);
  assert.deepEqual(monster.conditions, []);
  assert.equal(monster.ownerUserId, null);
  assert.equal(monster.characterKey, null);
  const normalized = __testing.normalizeSharedState({ tokens: [monster, npc] });
  assert.deepEqual(normalized.tokens.map((token) => token.id), [monster.id, npc.id]);
  assert.deepEqual(normalized.tokens[0].position, monster.position);
  assert.equal(npc.type, 'enemy');
  assert.equal(npc.affiliation, null);
  assert.notEqual(monster.id, npc.id);
  assert.notEqual(monster.color, npc.color);
});

test('adapter rejects mismatched references and privileged token fields', () => {
  const input = { entity: entity('monster-ref', 'monster', 'Goblin'),
    placement: placement('placement-1', 'monster-ref', { x: 1, y: 2 }) };
  assert.throws(() => projectEncounterEntityToken({ ...input,
    placement: { ...input.placement, entityReferenceId: 'other' } }), /stessa entità/);
  assert.throws(() => projectEncounterEntityToken({ ...input,
    tokenProperties: { ownerUserId: 'player' } }), /non supportate/);
  assert.throws(() => projectEncounterEntityToken({ ...input,
    tokenProperties: { widthCells: 1.5 } }), /intere positive/);
  assert.throws(() => projectEncounterEntityToken({ ...input,
    placement: { ...input.placement, position: { x: -1, y: 2 } } }), /coordinate/);
});

test('adapter consumes persisted manual data without a PC sheet or duplicate runtime model', () => {
  const prepared = { ...entity('monster-ref', 'monster', 'Goblin'), tokenProperties: {
    size: 'small', movementCells: 6, initiativeModifier: -1, hitPoints: 7, maxHitPoints: 7,
  } };
  const token = projectEncounterEntityToken({ entity: prepared,
    placement: placement('placement-1', prepared.id, { x: 2, y: 3 }) });
  assert.equal(token.id, 'placement-1');
  assert.equal(token.size, 'small');
  assert.equal(token.movementCells, 6);
  assert.equal(token.initiativeModifier, -1);
  assert.equal(token.hitPoints, 7);
  assert.equal(token.ownerUserId, null);
  assert.equal(token.characterKey, null);
  assert.throws(() => projectEncounterEntityToken({ entity: { ...prepared,
    tokenProperties: { sourceUrl: 'https://example.test' } },
    placement: placement('placement-1', prepared.id, { x: 2, y: 3 }) }), /non supportate/);
});

test('derived sheet-less token uses the existing initiative lifecycle only after explicit combat', () => {
  const token = projectEncounterEntityToken({
    entity: entity('monster-ref', 'monster', 'Goblin'),
    placement: placement('placement-1', 'monster-ref', { x: 2, y: 2 }),
    tokenProperties: { initiativeModifier: 3 },
  });
  const user = { id: 'master', role: 'master', displayName: 'Master' };
  const service = { findIdByOwner: () => { throw new Error('no PC sheet lookup expected'); } };
  const state = { tokens: [token], initiatives: [], sessionMode: 'exploration' };
  assert.equal(rollInitiative({ user, state, service, tokenId: token.id }).status, 400);
  assert.deepEqual(state.initiatives, []);
  state.sessionMode = 'combat';
  const result = rollInitiative({ user, state, service, tokenId: token.id,
    nextUint32: () => 0 });
  assert.equal(result.entry.tokenId, token.id);
  assert.equal(result.entry.dexModifier, 3);
  assert.equal(result.log.visibility, 'secret');
  assert.equal(result.log.source, undefined);
  assert.deepEqual(insertInitiativeEntry([], result.entry), [result.entry]);
});
