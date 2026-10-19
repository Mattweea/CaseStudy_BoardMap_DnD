import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../database/connection.mjs';
import { migrate } from '../database/migrator.mjs';
import { bootstrapScenes, INITIAL_SCENE_ID } from '../server/scene-bootstrap.mjs';
import { LOCAL_CAMPAIGN_ID } from '../server/character-sheet-bootstrap.mjs';

async function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-scene-bootstrap-'));
  const db = openDatabase({ path: join(directory, 'test.sqlite') });
  try {
    await migrate(db);
    db.prepare('INSERT INTO campaigns (id, name, owner_user_id) VALUES (?, ?, ?)')
      .run(LOCAL_CAMPAIGN_ID, 'Locale', 'master-user');
    await run(db);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test('legacy bootstrap imports supported board configuration exactly once', () => withDatabase((db) => {
  const snapshot = {
    state: {
      diagonalRule: 'alternating',
      measurementUnit: { label: 'ft', cellsValue: 5 },
      isBoardBackgroundHidden: true,
      isBoardFullyLit: true,
      lightSources: [{ id: 'torch', position: { x: 4, y: 7 }, radiusCells: 6 }],
      tokens: [{ id: 'live-token', position: { x: 1, y: 1 }, hitPoints: 3 }],
    },
  };

  const first = bootstrapScenes(db, { legacySnapshot: snapshot });
  const second = bootstrapScenes(db, { legacySnapshot: { state: { diagonalRule: 'standard' } } });

  assert.equal(first.created, true);
  assert.equal(first.activeScene.id, INITIAL_SCENE_ID);
  assert.equal(first.activeScene.document.board.diagonalRule, 'alternating');
  assert.deepEqual(first.activeScene.document.board.measurementUnit, { label: 'ft', cellsValue: 5 });
  assert.equal(first.activeScene.document.board.lightSources[0].id, 'torch');
  assert.deepEqual(first.activeScene.document.runtime.tokens, []);
  assert.equal(second.created, false);
  assert.equal(second.scenes.length, 1);
  assert.equal(second.activeScene.document.board.diagonalRule, 'alternating');
}));

test('bootstrap creates a safe default for an absent or malformed legacy snapshot', async (t) => {
  for (const [label, snapshot] of [['assente', null], ['malformato', { state: { measurementUnit: { label: '', cellsValue: -1 } } }]]) {
    await t.test(label, () => withDatabase((db) => {
      const result = bootstrapScenes(db, { legacySnapshot: snapshot });
      assert.equal(result.created, true);
      assert.equal(result.scenes.length, 1);
      assert.equal(result.activeScene.document.board.diagonalRule, 'standard');
      assert.deepEqual(result.activeScene.document.board.measurementUnit, { label: 'm', cellsValue: 1.5 });
    }));
  }
});
