import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import * as createRoles from '../database/migrations/20260914_002_create_roles.mjs';
import * as createUsers from '../database/migrations/20260914_003_create_users.mjs';
import * as createCampaigns from '../database/migrations/20260914_004_create_campaigns.mjs';
import * as createSheets from '../database/migrations/20260914_006_create_character_sheets.mjs';
import * as extendSheets from '../database/migrations/20260916_001_extend_character_sheets_for_p0_4.mjs';
import { CharacterSheetRepository } from '../server/character-sheet-repository.mjs';
import { createInitialCharacterSheetData } from '../server/character-sheet-schema.mjs';

function createDatabase(path) {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  return db;
}

test('repository creates idempotently, persists across reopen and checks versions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-character-sheet-repository-'));
  const path = join(directory, 'test.sqlite');
  let db = createDatabase(path);
  try {
    createRoles.up(db);
    createUsers.up(db);
    createCampaigns.up(db);
    createSheets.up(db);
    extendSheets.up(db);
    db.prepare('INSERT INTO campaigns (id, name, owner_user_id) VALUES (?, ?, ?)')
      .run('campaign-test', 'Test', 'master-user');

    let repository = new CharacterSheetRepository(db);
    const data = createInitialCharacterSheetData({ displayName: 'Ilthar' });
    const first = repository.createOrGet({ id: 'sheet-a', ownerUserId: 'player-ilthar', campaignId: 'campaign-test', data });
    const second = repository.createOrGet({ id: 'sheet-b', ownerUserId: 'player-ilthar', campaignId: 'campaign-test', data });
    assert.equal(first.id, 'sheet-a');
    assert.equal(second.id, 'sheet-a');
    assert.equal(repository.findByCampaign('campaign-test').length, 1);

    const changed = structuredClone(first.data);
    changed.character.hitPoints.current = '23';
    assert.equal(repository.saveVersion({ id: first.id, expectedVersion: 99, version: 100, data: changed }), null);
    const saved = repository.saveVersion({ id: first.id, expectedVersion: 1, version: 2, data: changed });
    assert.equal(saved.version, 2);

    db.close();
    db = createDatabase(path);
    repository = new CharacterSheetRepository(db);
    assert.equal(repository.findById(first.id).data.character.hitPoints.current, '23');
    assert.equal(repository.findById(first.id).version, 2);
  } finally {
    if (db.open) db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
