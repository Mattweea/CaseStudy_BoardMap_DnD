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
import { bootstrapCharacterSheets, LOCAL_CAMPAIGN_ID } from '../server/character-sheet-bootstrap.mjs';
import { CHARACTER_PROFILES } from '../server/characters.mjs';

test('two character sheet bootstraps preserve count and existing data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-character-sheet-bootstrap-'));
  const db = new Database(join(directory, 'test.sqlite'));
  db.pragma('foreign_keys = ON');
  try {
    createRoles.up(db); createUsers.up(db); createCampaigns.up(db); createSheets.up(db); extendSheets.up(db);
    db.prepare('INSERT INTO campaigns (id, name, owner_user_id) VALUES (?, ?, ?)')
      .run(LOCAL_CAMPAIGN_ID, 'Legacy', 'master-user');
    db.prepare(`INSERT INTO character_sheets (id, owner_user_id, campaign_id, data_json)
      VALUES (?, ?, ?, ?)`)
      .run('legacy-sheet', 'player-ilthar', LOCAL_CAMPAIGN_ID, JSON.stringify({
        character: { name: 'Ilthar il Rosso', hitPoints: { current: '31' } },
      }));

    const first = bootstrapCharacterSheets(db, CHARACTER_PROFILES);
    const firstIlthar = first.find((sheet) => sheet.ownerUserId === 'player-ilthar');
    assert.equal(first.length, CHARACTER_PROFILES.filter(({ role }) => role === 'adventurer').length);
    assert.equal(firstIlthar.data.character.name, 'Ilthar il Rosso');
    assert.equal(firstIlthar.data.character.hitPoints.current, '31');

    const serializedBefore = db.prepare('SELECT data_json FROM character_sheets WHERE id = ?').get('legacy-sheet').data_json;
    const second = bootstrapCharacterSheets(db, CHARACTER_PROFILES);
    assert.equal(second.length, first.length);
    assert.equal(db.prepare('SELECT data_json FROM character_sheets WHERE id = ?').get('legacy-sheet').data_json, serializedBefore);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
