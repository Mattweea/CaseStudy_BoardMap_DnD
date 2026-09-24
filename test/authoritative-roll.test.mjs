import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthoritativeRoll, parseRollFormula } from '../server/authoritative-roll.mjs';

const user = { id: 'player-1', username: 'vesuth', displayName: 'Vesuth' };

function queueUint32(values) {
  const queue = [...values];
  return () => {
    const value = queue.shift();
    if (value === undefined) throw new Error('uint32 queue exhausted');
    return value;
  };
}

const stableMetadata = { createId: () => 'roll-1', now: () => '2026-09-23T10:00:00.000Z' };

test('free rolls use the shared engine for a single group and d100 results', () => {
  const normal = createAuthoritativeRoll(user, { formula: '2d6+1', visibility: 'public' }, {
    ...stableMetadata, nextUint32: queueUint32([1, 5]),
  });
  assert.deepEqual(normal.log.rolls, [2, 6]);
  assert.deepEqual(normal.log.keptRolls, [2, 6]);
  assert.equal(normal.log.total, 9);
  assert.equal('parts' in normal.log, false);
  assert.deepEqual(normal.log.dice.map((die) => die.disposition), ['kept', 'kept']);

  const percentile = createAuthoritativeRoll(user, { formula: '1d100', visibility: 'public' }, {
    ...stableMetadata, nextUint32: queueUint32([99]),
  });
  assert.deepEqual(percentile.log.dice, [
    { id: 'die-1', sides: 100, value: 100, groupId: 'group-1', disposition: 'kept' },
  ]);
});

test('client-proposed outcomes, identities and seeds never enter an authoritative log', () => {
  const result = createAuthoritativeRoll(user, {
    formula: '1d8', visibility: 'public', rolls: [8], keptRolls: [8], total: 999,
    dice: [{ id: 'forged', sides: 8, value: 8, groupId: 'forged', disposition: 'kept' }],
    id: 'forged', authorUserId: 'master-1', seed: 123,
  }, { ...stableMetadata, nextUint32: queueUint32([2]) });

  assert.equal(result.log.id, 'roll-1');
  assert.equal(result.log.authorUserId, 'player-1');
  assert.deepEqual(result.log.rolls, [3]);
  assert.equal(result.log.total, 3);
  assert.equal('seed' in result.log, false);
});

test('spaziatura irrilevante: le tre grafie della stessa formula normalizzano allo stesso risultato', () => {
  for (const formula of ['1d8+2 + 3d6', '1d8 + 2 + 3d6', '1d8+2+3d6']) {
    const parsed = parseRollFormula(formula);
    assert.equal(parsed.formula, '1d8+2+3d6');
    assert.deepEqual(parsed.groups, [
      { sign: 1, count: 1, sides: 8, modifier: 2 },
      { sign: 1, count: 3, sides: 6, modifier: 0 },
    ]);
  }
});

test('gruppo sottratto: il subtotale del d4 abbassa il totale e nessun dado del log è negativo', () => {
  const result = createAuthoritativeRoll(user, { formula: '1d8 - 1d4', visibility: 'public' }, {
    ...stableMetadata, nextUint32: queueUint32([4, 0]),
  });
  assert.equal(result.log.formula, '1d8-1d4');
  assert.equal(result.log.parts.length, 2);
  assert.equal(result.log.parts[0].total, 5);
  assert.equal(result.log.parts[1].total, -1);
  assert.equal(result.log.total, 4);
  assert.ok(result.log.dice.every((die) => die.value > 0));
});

test('limiti superati da gruppi combinati: gruppi singolarmente validi ma insieme oltre il tetto vengono rifiutati', () => {
  assert.ok(parseRollFormula('10d4').groups);
  const rejected = parseRollFormula('11d4+10d6');
  assert.match(rejected.error, /Limite di dadi/);

  const result = createAuthoritativeRoll(user, { formula: '11d4+10d6', visibility: 'public' });
  assert.match(result.error, /Limite di dadi/);
});

test('formula non valida: malformata e fuori dai limiti producono messaggi distinti e nessun tiro entra nel log', () => {
  const malformed = parseRollFormula('1d20d5');
  assert.ok(malformed.error);

  const outOfBounds = parseRollFormula('1d8+2000');
  assert.match(outOfBounds.error, /modificatore/i);
  assert.notEqual(malformed.error, outOfBounds.error);

  const rejected = createAuthoritativeRoll(user, { formula: 'non una formula', visibility: 'public' });
  assert.ok(rejected.error);
  assert.equal(rejected.log, undefined);
});

test('d20 rifiutato in una formula mista, con un errore che ne spiega il motivo', () => {
  const parsed = parseRollFormula('1d20+5 + 6d4');
  assert.match(parsed.error, /d20 si tira da solo/);

  const result = createAuthoritativeRoll(user, { formula: '1d20+5 + 6d4', visibility: 'public' });
  assert.match(result.error, /d20 si tira da solo/);
});

test('un d20 produce due esiti indipendenti con lo stesso modificatore, e una modalità dichiarata è rifiutata', () => {
  const result = createAuthoritativeRoll(user, { formula: '1d20+5', visibility: 'public' }, {
    ...stableMetadata, nextUint32: queueUint32([9, 2]),
  });
  assert.deepEqual(result.log.rolls, [10, 3]);
  assert.deepEqual(result.log.dice.map((die) => die.disposition), ['unresolved', 'unresolved']);
  assert.equal(result.log.modifier, 5);

  const rejected = createAuthoritativeRoll(user, { formula: '1d20+5', visibility: 'public', mode: 'advantage' });
  assert.ok(rejected.error);
  assert.equal(rejected.log, undefined);
});

test('più d20 restano indipendenti, senza semantica di coppia', () => {
  const result = createAuthoritativeRoll(user, { formula: '3d20', visibility: 'public' }, {
    ...stableMetadata, nextUint32: queueUint32([1, 5, 10]),
  });
  assert.deepEqual(result.log.rolls, [2, 6, 11]);
  assert.deepEqual(result.log.dice.map((die) => die.disposition), ['kept', 'kept', 'kept']);
});

test('il tetto complessivo conta i dadi generati, non quelli scritti in formula', () => {
  // "1d20" genera due dadi (coppia non risolta): al confine del tetto, 19 dadi scritti altrove
  // più questo 1d20 supererebbero 20 dadi generati anche se la formula ne scrive soltanto uno.
  const soloD20 = parseRollFormula('1d20');
  assert.ok(soloD20.groups);
  assert.equal(soloD20.isSingleD20, true);

  const atLimit = parseRollFormula('20d6');
  assert.ok(atLimit.groups);
  const overLimit = parseRollFormula('21d6');
  assert.match(overLimit.error, /Limite di dadi/);
});

test('un tiro a gruppo singolo continua a non produrre parts', () => {
  const result = createAuthoritativeRoll(user, { formula: '2d6+1', visibility: 'public' }, {
    ...stableMetadata, nextUint32: queueUint32([1, 5]),
  });
  assert.equal('parts' in result.log, false);
});

test('ripetizione di un tiro storico a gruppo singolo: la formula resta valida con gli stessi criteri di calcolo', () => {
  const first = createAuthoritativeRoll(user, { formula: '1d8+3', visibility: 'public' }, {
    ...stableMetadata, nextUint32: queueUint32([4]),
  });
  const repeated = createAuthoritativeRoll(user, { formula: first.log.formula, visibility: 'public' }, {
    ...stableMetadata, nextUint32: queueUint32([4]),
  });
  assert.equal(repeated.log.total, first.log.total);
  assert.equal(repeated.log.formula, first.log.formula);
});

test('formula and legacy limit validation remains compatible', () => {
  assert.ok(parseRollFormula('0d20').error);
  assert.ok(parseRollFormula('1d3').error);
  assert.ok(parseRollFormula('1d20+1001').error);
  assert.ok(createAuthoritativeRoll(user, { formula: '1d20' }).error);
});
