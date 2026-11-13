import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as polygonClipping from 'polyclip-ts';
import { openDatabase } from '../database/connection.mjs';
import { migrate } from '../database/migrator.mjs';
import { SceneRepository } from '../server/scene-repository.mjs';
import { SceneService } from '../server/scene-service.mjs';
import { ExplorationService } from '../server/exploration-service.mjs';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';
import { asRegion, mergeRegions, visibleRegions } from '../shared/explored-regions.mjs';
import { collectVisionBlockers } from '../shared/scene-blockers.mjs';

// Reduced from a move rejected with an open output ring: one structural cell,
// one distant traced segment and a light seen by a character without darkvision.
const walls = [{
  id: 'wall', color: '#ff7970', widthCells: 0.05,
  points: [
    { x: 8.424354416167665, y: 18.78116672453029 },
    { x: 8.703235517718836, y: 18.948687773643346 },
  ],
}];
const cells = [{ x: 19, y: 6 }];
const lights = [
  { id: 'remote-light', position: { x: 4, y: 15 }, radiusCells: 3 },
  { id: 'light', position: { x: 21, y: 20 }, radiusCells: 2 },
];
const hero = {
  id: 'hero', ownerUserId: 'player-ilthar', type: 'player', size: 'medium',
  position: { x: 19, y: 5 },
};
const sample = (x, y, size = 0.01) => asRegion([
  { x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size },
]);
const includes = (regions, x, y) => polygonClipping.intersection(regions, sample(x, y)).length > 0;

test('light intersections recover an open ring without revealing terrain behind a structural wall', () => {
  const blockers = collectVisionBlockers([], [], () => ({ width: 1, height: 1 }), walls, cells);
  const regions = visibleRegions({ ...hero, position: { x: 20, y: 5 } }, 0, blockers, lights);
  assert.ok(regions.length);
  assert.equal(includes(regions, 21.5, 20.5), true);
  assert.equal(includes(regions, 4.5, 15.5), false);
  assert.equal(includes(regions, 19.5, 6.5), false);
  assert.equal(includes(regions, 21.5, 23), false);
  assert.deepEqual(mergeRegions(regions, regions), regions);
  assert.deepEqual(visibleRegions({ ...hero, position: { x: 20, y: 5 } }, 0, blockers, lights), regions);
  // The exact retry must release precision state, including on invalid input.
  assert.ok(polygonClipping.union(sample(0, 0, 1e-14)).length);
  assert.throws(() => mergeRegions([[[['invalid', 0], [1, 0], [1, 1], ['invalid', 0]]]]));
  assert.ok(polygonClipping.union(sample(0, 0, 1e-14)).length);
});

test('Master and Player movement persist light visibility once and preserve existing exploration', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-light-move-'));
  const db = openDatabase({ path: join(directory, 'test.sqlite') });
  await migrate(db);
  db.prepare('INSERT INTO campaigns(id,name,owner_user_id) VALUES(?,?,?)').run('campaign', 'Test', 'master-user');
  const repository = new SceneRepository(db);
  const document = createDefaultSceneDocument();
  repository.createAndActivate({
    id: 'scene', campaignId: 'campaign', name: 'Scena',
    document: { ...document, walls, wallCells: cells, board: { ...document.board, lightSources: lights } },
  });
  const service = new SceneService({ repository, campaignId: 'campaign' });
  service.load();
  const master = { id: 'master-user', role: 'master' };
  const player = { id: hero.ownerUserId, role: 'adventurer' };
  const memory = new ExplorationService(db, [{ ...player, darkvision: 'Nessuna' }]);
  process.env.BATTLE_MAP_TEST_MODE = '1';
  const { __testing } = await import('../server/index.mjs');
  __testing.setUserRepository({ findById: (id) => [master, player].find((user) => user.id === id) });
  __testing.setSceneService(service);
  __testing.setExplorationService(memory);
  const events = [];
  const clients = [master, player].map(user => ({ user, write: data => events.push({ user, data }) }));
  clients.forEach(client => __testing.streamClients.add(client));
  t.after(async () => {
    clients.forEach(client => __testing.streamClients.delete(client));
    __testing.setExplorationService(null);
    __testing.setSceneService(null);
    await __testing.app.close();
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  for (const user of [master, player]) {
    __testing.setBattleMapState({ tokens: [hero], sessionMode: 'exploration' });
    // Previously discovered terrain survives even though it is outside current sight.
    const remembered = sample(28, 28);
    db.prepare('INSERT OR REPLACE INTO explored_regions VALUES(?,?,?)').run('scene', 1, JSON.stringify(remembered));
    const before = __testing.getBattleMapState();
    const version = __testing.getBattleMapVersion();
    events.length = 0;
    const response = await __testing.app.inject({
      method: 'POST', url: '/api/battle-map/move',
      headers: { cookie: `battle_map_session=${__testing.createSession(user)}` },
      payload: {
        tokenId: hero.id, x: 20, y: 5,
        sceneId: before.activeSceneId, sceneVersion: before.activeSceneVersion,
      },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json().state.tokens[0].position, { x: 20, y: 5 });
    assert.equal(__testing.getBattleMapVersion(), version + 1);
    assert.equal(memory.read('scene').revision, 2);
    assert.equal(includes(memory.read('scene').regions, 28, 28), true);
    assert.equal(includes(memory.read('scene').regions, 21.5, 20.5), true);
    assert.equal(includes(memory.read('scene').regions, 19.5, 6.5), false);
    for (const recipient of [master, player]) {
      assert.equal(events.filter(event => event.user === recipient && event.data.startsWith('data: ')).length, 1);
    }
  }
});
