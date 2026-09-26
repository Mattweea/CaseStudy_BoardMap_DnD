import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../database/connection.mjs';
import { migrate, migrationStatus, rollbackLatestBatch } from '../database/migrator.mjs';

test('scene migration applies idempotently, rolls back, reapplies and survives reopen', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-scene-migration-'));
  const path = join(directory, 'test.sqlite');
  let db = openDatabase({ path });
  try {
    const first = await migrate(db);
    assert.ok(first.applied.includes('20260926_001_create_scenes.mjs'));
    assert.deepEqual((await migrate(db)).applied, []);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'scenes'").get().name, 'scenes');

    const rollback = await rollbackLatestBatch(db);
    assert.ok(rollback.rolledBack.includes('20260926_001_create_scenes.mjs'));
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'scenes'").get(), undefined);

    const reapplied = await migrate(db);
    assert.ok(reapplied.applied.includes('20260926_001_create_scenes.mjs'));
    db.close();
    db = openDatabase({ path });
    const status = await migrationStatus(db);
    assert.equal(status.find(({ name }) => name === '20260926_001_create_scenes.mjs')?.applied, true);
  } finally {
    if (db.open) db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
