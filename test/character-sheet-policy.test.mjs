import assert from 'node:assert/strict';
import test from 'node:test';
import { CharacterSheetPolicy } from '../server/character-sheet-policy.mjs';

const policy = new CharacterSheetPolicy();
const sheet = { ownerUserId: 'player-ilthar', campaignId: 'campaign-local' };
const matrix = [
  ['owner', { id: 'player-ilthar', role: 'adventurer' }, true],
  ['master', { id: 'master-user', role: 'master' }, true],
  ['other adventurer', { id: 'player-ragnar', role: 'adventurer' }, false],
  ['anonymous', null, false],
];

for (const [label, user, expected] of matrix) {
  test(`${label} read/write/subscribe matrix`, () => {
    assert.equal(policy.canRead(user, sheet), expected);
    assert.equal(policy.canWrite(user, sheet), expected);
    assert.equal(policy.canSubscribe(user, sheet), expected);
  });
}
