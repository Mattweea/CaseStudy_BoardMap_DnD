import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDiceCommand, createCommandHistory, rememberCommand, recallCommand } from '../shared/dice-commands.mjs';
import { createAuthoritativeRoll } from '../server/authoritative-roll.mjs';

const user = { id: 'player', displayName: 'Player' };
test('named commands preserve formula, signs, escapes, Unicode and visibility', () => {
  assert.deepEqual(parseDiceCommand('/r 1d12+5 -n "attacco con ascia"').request, {
    formula: '1d12+5',
    visibility: 'public',
    name: 'attacco con ascia',
  });
  assert.deepEqual(parseDiceCommand('/rs 1d8 + 3d6 - 2 -n "L’ascia \\"di fuoco\\""').request, {
    formula: '1d8 + 3d6 - 2',
    visibility: 'secret',
    name: 'L’ascia "di fuoco"',
  });
  assert.equal(parseDiceCommand('/r 1d20').request.name, undefined);
});
test('bad suffixes cannot reach a roll; API names are checked before entropy', () => {
  for (const suffix of [
    '-n',
    '-n ""',
    '-n "a" -n "b"',
    '-n "open',
    '-n "a" junk',
    '-n "bad\\n"',
    `-n "${'x'.repeat(121)}"`,
  ]) {
    assert.ok(parseDiceCommand(`/r 1d12 ${suffix}`).error, suffix);
  }
  for (const name of ['', '\n', 1, null, 'x'.repeat(121)]) {
    const result = createAuthoritativeRoll(
      user,
      { formula: '1d12', visibility: 'public', name },
      {
        nextUint32: () => {
          throw Error('must not roll');
        },
      },
    );
    assert.ok(result.error);
  }
});
test('named public and secret free rolls retain server identity, formula and totals', () => {
  for (const visibility of ['public', 'secret']) {
    const { log } = createAuthoritativeRoll(
      user,
      { formula: '1d12+5', visibility, name: '<b>ascia</b>', authorUserId: 'fake' },
      { nextUint32: () => 0 },
    );
    assert.equal(log.name, '<b>ascia</b>');
    assert.equal(log.formula, '1d12+5');
    assert.equal(log.total, 6);
    assert.equal(log.visibility, visibility);
    assert.equal(log.authorUserId, 'player');
  }
});
test('history walks without wrap, preserves drafts and distinct repeated executions', () => {
  let state = createCommandHistory();
  for (const c of ['/r 1d6', '/rs 1d8', '/rs 1d8']) state = rememberCommand(state, c);
  let current = '/r draft';
  const step = (direction) => {
    const next = recallCommand(state, direction, current);
    state = next.state;
    current = next.value;
    return current;
  };
  assert.equal(step('up'), '/rs 1d8');
  assert.equal(step('up'), '/rs 1d8');
  assert.equal(step('up'), '/r 1d6');
  assert.equal(step('up'), '/r 1d6');
  step('down');
  step('down');
  assert.equal(step('down'), '/r draft');
  assert.equal(step('down'), '/r draft');
  for (let i = 0; i < 60; i++) state = rememberCommand(state, String(i));
  assert.equal(state.entries.length, 50);
  assert.equal(state.entries[0], '10');
  assert.deepEqual(createCommandHistory().entries, []);
});
