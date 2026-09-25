import assert from 'node:assert/strict';
import test from 'node:test';
import { compareInitiative, insertInitiativeEntry } from '../shared/initiative-order.mjs';

const ids = (entries) => entries.map((entry) => entry.tokenId);

test('a parità di valore viene prima la Destrezza più alta', () => {
  const low = { tokenId: 'low', value: 15, dexModifier: 1, tiebreaker: 0.9 };
  const high = { tokenId: 'high', value: 15, dexModifier: 3, tiebreaker: 0.1 };
  assert.ok(compareInitiative(high, low) < 0);
  assert.deepEqual(ids(insertInitiativeEntry([low], high)), ['high', 'low']);
  assert.deepEqual(ids(insertInitiativeEntry([high], low)), ['high', 'low']);
});

test('a parità completa decide la frazione di spareggio', () => {
  const a = { tokenId: 'a', value: 12, dexModifier: 2, tiebreaker: 0.25 };
  const b = { tokenId: 'b', value: 12, dexModifier: 2, tiebreaker: 0.75 };
  assert.deepEqual(ids(insertInitiativeEntry([a], b)), ['b', 'a']);
  assert.deepEqual(ids(insertInitiativeEntry([b], a)), ['b', 'a']);
});

test("l'inserimento dopo uno spostamento del Master non tocca le altre voci", () => {
  // Il Master ha spostato la voce da 8 sopra quella da 18.
  const moved = [
    { tokenId: 'slow', value: 8, dexModifier: 0, tiebreaker: 0.5 },
    { tokenId: 'fast', value: 18, dexModifier: 0, tiebreaker: 0.5 },
    { tokenId: 'mid', value: 10, dexModifier: 0, tiebreaker: 0.5 },
  ];
  const next = insertInitiativeEntry(moved, { tokenId: 'new', value: 12, dexModifier: 0, tiebreaker: 0.5 });
  // 12 precede 8 (prima voce che la segue), le altre restano nella loro posizione relativa.
  assert.deepEqual(ids(next), ['new', 'slow', 'fast', 'mid']);
  assert.deepEqual(ids(next.filter((entry) => entry.tokenId !== 'new')), ids(moved));
});

test('una voce senza voci che la seguano va in coda', () => {
  const entries = [{ tokenId: 'a', value: 20, dexModifier: 0, tiebreaker: 0.1 }];
  assert.deepEqual(ids(insertInitiativeEntry(entries, { tokenId: 'b', value: 3, dexModifier: 0, tiebreaker: 0.1 })), ['a', 'b']);
  assert.deepEqual(ids(insertInitiativeEntry([], { tokenId: 'b', value: 3 })), ['b']);
});

test('sostituire una voce equivale a rimuoverla e reinserirla', () => {
  const entries = [
    { tokenId: 'a', value: 20, dexModifier: 0, tiebreaker: 0.1 },
    { tokenId: 'b', value: 10, dexModifier: 0, tiebreaker: 0.1 },
    { tokenId: 'c', value: 5, dexModifier: 0, tiebreaker: 0.1 },
  ];
  const next = insertInitiativeEntry(entries, { tokenId: 'c', value: 15, dexModifier: 0, tiebreaker: 0.2 });
  assert.deepEqual(ids(next), ['a', 'c', 'b']);
  assert.equal(next.filter((entry) => entry.tokenId === 'c').length, 1);
  assert.equal(next[1].value, 15);
});
