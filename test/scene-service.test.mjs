import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../database/connection.mjs';
import { migrate } from '../database/migrator.mjs';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';
import { SceneRepository } from '../server/scene-repository.mjs';
import { ScenePersistenceConflictError, SceneService } from '../server/scene-service.mjs';

async function withRepository(run) {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-scene-service-'));
  const db = openDatabase({ path: join(directory, 'test.sqlite') });
  try {
    await migrate(db);
    db.prepare('INSERT INTO campaigns (id, name, owner_user_id) VALUES (?, ?, ?)')
      .run('campaign-test', 'Test', 'master-user');
    const repository = new SceneRepository(db);
    repository.createAndActivate({
      id: 'scene-a', campaignId: 'campaign-test', name: 'Originale',
      document: createDefaultSceneDocument(),
    });
    await run(repository);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test('service reports a stale write and keeps its prior in-memory projection', () => withRepository((repository) => {
  const first = new SceneService({ repository, campaignId: 'campaign-test' });
  const stale = new SceneService({ repository, campaignId: 'campaign-test' });
  first.load();
  stale.load();

  const changed = first.getScene('scene-a').document;
  changed.board.isFullyLit = true;
  first.updateScene({ id: 'scene-a', expectedVersion: 1, name: 'Nuova', document: changed, sortOrder: 0 });

  assert.throws(
    () => stale.updateScene({
      id: 'scene-a', expectedVersion: 1, name: 'Obsoleta',
      document: stale.getScene('scene-a').document, sortOrder: 0,
    }),
    (error) => error instanceof ScenePersistenceConflictError
      && error.statusCode === 409
      && error.currentScene.version === 2,
  );
  assert.equal(stale.getScene('scene-a').version, 1);
  assert.equal(stale.getScene('scene-a').name, 'Originale');
}));

test('service projects a mutation only after persistence succeeds', () => withRepository((repository) => {
  const failingRepository = {
    findByCampaign: (...args) => repository.findByCampaign(...args),
    findActiveByCampaign: (...args) => repository.findActiveByCampaign(...args),
    findById: (...args) => repository.findById(...args),
    saveVersion: () => { throw new Error('disk full'); },
  };
  const service = new SceneService({ repository: failingRepository, campaignId: 'campaign-test' });
  service.load();
  const candidate = service.getScene('scene-a').document;
  candidate.board.isFullyLit = true;

  assert.throws(
    () => service.updateScene({
      id: 'scene-a', expectedVersion: 1, name: 'Non salvata', document: candidate, sortOrder: 0,
    }),
    /disk full/,
  );
  assert.equal(service.getScene('scene-a').name, 'Originale');
  assert.equal(service.getScene('scene-a').document.board.isFullyLit, false);
  assert.equal(repository.findById('scene-a').version, 1);
}));
