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

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-character-sheet-migration-'));
  const db = new Database(join(directory, 'test.sqlite'));
  db.pragma('foreign_keys = ON');
  try {
    createRoles.up(db);
    createUsers.up(db);
    createCampaigns.up(db);
    createSheets.up(db);
    db.prepare('INSERT INTO campaigns (id, name, owner_user_id) VALUES (?, ?, ?)')
      .run('campaign-test', 'Test', 'master-user');
    run(db);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function columnNames(db) {
  return new Set(db.prepare('PRAGMA table_info(character_sheets)').all().map(({ name }) => name));
}

test('P0.4 migration applies, rolls back and reapplies', () => withDatabase((db) => {
  extendSheets.up(db);
  assert.ok(columnNames(db).has('portrait_file_name'));
  assert.throws(() => {
    const insert = db.prepare(`INSERT INTO character_sheets
      (id, owner_user_id, campaign_id, data_json) VALUES (?, ?, ?, ?)`);
    insert.run('sheet-a', 'player-ilthar', 'campaign-test', '{}');
    insert.run('sheet-b', 'player-ilthar', 'campaign-test', '{}');
  }, /UNIQUE constraint failed/);

  extendSheets.down(db);
  assert.equal(columnNames(db).has('portrait_file_name'), false);
  extendSheets.up(db);
  assert.ok(columnNames(db).has('portrait_updated_at'));
}));

test('P0.4 migration refuses existing duplicate sheets before altering the table', () => withDatabase((db) => {
  const insert = db.prepare(`INSERT INTO character_sheets
    (id, owner_user_id, campaign_id, data_json) VALUES (?, ?, ?, ?)`);
  insert.run('sheet-a', 'player-ilthar', 'campaign-test', '{}');
  insert.run('sheet-b', 'player-ilthar', 'campaign-test', '{}');

  assert.throws(() => extendSheets.up(db), /esistono 2 schede/);
  assert.equal(columnNames(db).has('portrait_file_name'), false);
}));
