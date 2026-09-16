import assert from 'node:assert/strict';
import test from 'node:test';
import { broadcastCharacterSheetEvent } from '../server/character-sheet-events.mjs';
import { CharacterSheetPolicy } from '../server/character-sheet-policy.mjs';

test('private sheet SSE reaches only owner and master while portrait reference reaches roster', () => {
  const messages = new Map();
  const makeClient = (id, role) => ({ user: { id, role }, write: (value) => messages.set(id, [...(messages.get(id) ?? []), value]) });
  const clients = new Set([
    makeClient('owner', 'adventurer'), makeClient('master', 'master'), makeClient('other', 'adventurer'),
  ]);
  const sheet = { ownerUserId: 'owner' };
  broadcastCharacterSheetEvent(clients, { type: 'character-sheet-patch', sheetId: 'sheet-1', operations: [{ path: 'character.name', value: 'Secret' }] }, sheet, new CharacterSheetPolicy());
  assert.equal(messages.get('owner').length, 1);
  assert.equal(messages.get('master').length, 1);
  assert.equal(messages.has('other'), false);
  broadcastCharacterSheetEvent(clients, { type: 'character-sheet-portrait', sheetId: 'sheet-1', portraitUrl: '/opaque' }, sheet, new CharacterSheetPolicy());
  assert.equal(messages.get('other').length, 1);
  assert.equal(messages.get('other')[0].includes('Secret'), false);
});
