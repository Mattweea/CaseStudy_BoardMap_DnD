import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../database/connection.mjs';
import { migrate } from '../database/migrator.mjs';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';
import { SceneRepository } from '../server/scene-repository.mjs';

async function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-scene-repository-'));
  const path = join(directory, 'test.sqlite');
  let db = openDatabase({ path });
  try {
    await migrate(db);
    db.prepare('INSERT INTO campaigns (id, name, owner_user_id) VALUES (?, ?, ?)')
      .run('campaign-test', 'Test', 'master-user');
    await run({ db, path, reopen() {
      db.close();
      db = openDatabase({ path });
      return db;
    } });
  } finally {
    if (db.open) db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test('scene repository persists catalog, active scene and configuration across reopen', () => withDatabase(async ({ db, reopen }) => {
  let repository = new SceneRepository(db);
  const document = createDefaultSceneDocument();
  document.board.diagonalRule = 'alternating';
  document.runtime.tokens = [{ id: 'live-only', position: { x: 2, y: 3 } }];
  const first = repository.createAndActivate({
    id: 'scene-a', campaignId: 'campaign-test', name: 'Dungeon', document,
  });
  repository.create({
    id: 'scene-b', campaignId: 'campaign-test', name: 'Dungeon',
    document: createDefaultSceneDocument(), sortOrder: 1,
  });

  assert.equal(first.document.board.diagonalRule, 'alternating');
  assert.deepEqual(first.document.runtime.tokens, []);
  assert.equal(repository.findByCampaign('campaign-test').length, 2);
  assert.equal(repository.findActiveByCampaign('campaign-test').id, 'scene-a');

  db = reopen();
  repository = new SceneRepository(db);
  assert.equal(repository.findByCampaign('campaign-test').length, 2);
  assert.equal(repository.findActiveByCampaign('campaign-test').document.board.diagonalRule, 'alternating');
}));

test('scene repository lets only one write advance an expected version', () => withDatabase(async ({ db }) => {
  const repository = new SceneRepository(db);
  const original = repository.create({
    id: 'scene-a', campaignId: 'campaign-test', name: 'Originale',
    document: createDefaultSceneDocument(),
  });
  const changed = structuredClone(original.document);
  changed.board.isFullyLit = true;

  const first = repository.saveVersion({
    id: original.id, campaignId: 'campaign-test', expectedVersion: 1,
    name: 'Aggiornata', document: changed, sortOrder: 0,
  });
  const stale = repository.saveVersion({
    id: original.id, campaignId: 'campaign-test', expectedVersion: 1,
    name: 'Obsoleta', document: original.document, sortOrder: 0,
  });

  assert.equal(first.version, 2);
  assert.equal(stale, null);
  assert.equal(repository.findById(original.id).name, 'Aggiornata');
  assert.equal(repository.findById(original.id).document.board.isFullyLit, true);
}));

test('active scene foreign key rejects a scene from another campaign', () => withDatabase(async ({ db }) => {
  db.prepare('INSERT INTO campaigns (id, name, owner_user_id) VALUES (?, ?, ?)')
    .run('campaign-other', 'Other', 'master-user');
  const repository = new SceneRepository(db);
  repository.create({
    id: 'other-scene', campaignId: 'campaign-other', name: 'Other',
    document: createDefaultSceneDocument(),
  });
  assert.equal(repository.setActiveScene('campaign-test', 'other-scene'), null);
}));
