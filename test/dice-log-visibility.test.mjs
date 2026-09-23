import assert from 'node:assert/strict';
import test from 'node:test';
import { visibleDiceLogsForUser } from '../server/dice-log-visibility.mjs';

const detail = [{ id: 'die-1', sides: 20, value: 14, groupId: 'group-1', disposition: 'kept' }];
const logs = [
  { id: 'public', visibility: 'public', authorUserId: 'player-1', dice: detail },
  { id: 'secret-own', visibility: 'secret', authorUserId: 'player-1', dice: detail },
  { id: 'secret-other', visibility: 'secret', authorUserId: 'player-2', dice: detail },
];

test('public detail is identical while a secret roll and all its dice stay recipient-scoped', () => {
  const player = visibleDiceLogsForUser(logs, { id: 'player-1', role: 'adventurer' });
  assert.deepEqual(player.map((log) => log.id), ['public', 'secret-own']);
  assert.deepEqual(player[0].dice, detail);
  assert.equal(player.some((log) => log.id === 'secret-other'), false);

  assert.deepEqual(visibleDiceLogsForUser(logs, { id: 'master-1', role: 'master' }), logs);
  assert.deepEqual(visibleDiceLogsForUser(logs, { id: 'player-3', role: 'adventurer' }).map((log) => log.id), ['public']);
});
