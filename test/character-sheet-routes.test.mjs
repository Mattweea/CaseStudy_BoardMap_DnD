import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { registerCharacterSheetRoutes } from '../server/character-sheet-routes.mjs';
import { CharacterSheetPolicy } from '../server/character-sheet-policy.mjs';
import { CharacterSheetService } from '../server/character-sheet-service.mjs';
import { createInitialCharacterSheetData } from '../server/character-sheet-schema.mjs';

async function createApp() {
  const record = { id: 'sheet-1', ownerUserId: 'owner', campaignId: 'campaign', version: 1, data: createInitialCharacterSheetData(), portraitFileName: null, portraitMediaType: null, portraitUpdatedAt: null };
  const repository = {
    findById: () => structuredClone(record),
    findByCampaign: () => [structuredClone(record)],
    saveVersion: ({ expectedVersion, version, data }) => {
      if (record.version !== expectedVersion) return null;
      record.version = version; record.data = structuredClone(data); return structuredClone(record);
    },
  };
  const service = new CharacterSheetService({ repository, policy: new CharacterSheetPolicy(), schedule: () => 1, cancel: () => {} });
  const app = Fastify();
  await registerCharacterSheetRoutes(app, {
    service,
    portraitStorage: {},
    getUser: (request) => ({ owner: { id: 'owner', role: 'adventurer' }, master: { id: 'master', role: 'master' }, other: { id: 'other', role: 'adventurer' } })[request.headers['x-test-user']] ?? null,
  });
  return app;
}

test('character sheet HTTP authorization, validation and conflicts', async () => {
  const app = await createApp();
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/character-sheets/sheet-1' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/api/character-sheets/sheet-1', headers: { 'x-test-user': 'other' } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'GET', url: '/api/character-sheets/sheet-1', headers: { 'x-test-user': 'owner' } })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/api/character-sheets/sheet-1', headers: { 'x-test-user': 'master' } })).statusCode, 200);
    const roster = await app.inject({ method: 'GET', url: '/api/character-sheets', headers: { 'x-test-user': 'other' } });
    assert.equal(roster.statusCode, 200);
    assert.equal(roster.json().sheets[0].ownerUserId, 'owner');
    assert.equal('data' in roster.json().sheets[0], false);
    const invalid = await app.inject({ method: 'PATCH', url: '/api/character-sheets/sheet-1', headers: { 'x-test-user': 'owner' }, payload: { baseVersion: 1, operations: [{ op: 'set', path: 'unknown', value: 'x' }] } });
    assert.equal(invalid.statusCode, 400);
    const accepted = await app.inject({ method: 'PATCH', url: '/api/character-sheets/sheet-1', headers: { 'x-test-user': 'owner' }, payload: { baseVersion: 1, operations: [{ op: 'set', path: 'character.name', value: 'A' }] } });
    assert.equal(accepted.statusCode, 200);
    const conflict = await app.inject({ method: 'PATCH', url: '/api/character-sheets/sheet-1', headers: { 'x-test-user': 'master' }, payload: { baseVersion: 1, operations: [{ op: 'set', path: 'character.name', value: 'B' }] } });
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.json().conflicts[0].value, 'A');
  } finally { await app.close(); }
});
