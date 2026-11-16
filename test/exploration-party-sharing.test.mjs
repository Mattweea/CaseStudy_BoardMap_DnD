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
import { asRegion } from '../shared/explored-regions.mjs';

const includes = (regions, x, y) => polygonClipping.intersection(regions, asRegion([
  { x, y }, { x: x + .01, y }, { x: x + .01, y: y + .01 }, { x, y: y + .01 },
])).length > 0;

test('terrain explored by either PG is delivered to both players and survives moving away and reconnecting', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-party-exploration-'));
  const db = openDatabase({ path: join(directory, 'test.sqlite') });
  await migrate(db);
  db.prepare('INSERT INTO campaigns(id,name,owner_user_id) VALUES(?,?,?)').run('campaign', 'Party', 'master-user');
  const repository = new SceneRepository(db);
  repository.createAndActivate({ id: 'scene', campaignId: 'campaign', name: 'Scena', document: createDefaultSceneDocument() });
  const service = new SceneService({ repository, campaignId: 'campaign' }); service.load();
  const players = ['player-ilthar', 'player-thalendir'].map(id => ({ id, role: 'adventurer', darkvision: '3 m' }));
  const memory = new ExplorationService(db, players);
  process.env.BATTLE_MAP_TEST_MODE = '1';
  const { __testing } = await import('../server/index.mjs');
  __testing.setUserRepository({ findById: id => players.find(player => player.id === id) });
  __testing.setSceneService(service); __testing.setExplorationService(memory);
  __testing.setBattleMapState({ sessionMode: 'exploration', tokens: players.map((player, index) => ({
    id: `hero-${index}`, ownerUserId: player.id, type: 'player', size: 'medium',
    name: player.id, position: index ? { x: 25, y: 25 } : { x: 2, y: 2 }, conditions: [],
  })) });
  const clients = players.map(user => ({ user, snapshots: [], write(chunk) {
    if (chunk.startsWith('data: ')) this.snapshots.push(JSON.parse(chunk.slice(6)));
  } }));
  clients.forEach(client => __testing.streamClients.add(client));
  t.after(async () => {
    clients.forEach(client => __testing.streamClients.delete(client));
    __testing.setExplorationService(null); __testing.setSceneService(null);
    await __testing.app.close(); db.close(); rmSync(directory, { recursive: true, force: true });
  });
  const cookies = players.map(user => `battle_map_session=${__testing.createSession(user)}`);
  const move = async (index, destination) => {
    const state = __testing.getBattleMapState();
    const response = await __testing.app.inject({ method: 'POST', url: '/api/battle-map/move',
      headers: { cookie: cookies[index] }, payload: {
        sceneId: state.activeSceneId, sceneVersion: state.activeSceneVersion, tokenId: `hero-${index}`,
        waypoints: [state.tokens.find(token => token.id === `hero-${index}`).position, destination],
      } });
    assert.equal(response.statusCode, 200, response.body);
    for (const client of clients) {
      assert.deepEqual(client.snapshots.at(-1).state.exploredRegions, response.json().state.exploredRegions);
    }
  };
  await move(0, { x: 10, y: 2 });
  assert.equal(includes(clients[1].snapshots.at(-1).state.exploredRegions, 5.5, 2.5), true,
    'second player remembers the first player path without visiting it');
  await move(1, { x: 25, y: 15 });
  await move(0, { x: 15, y: 2 });
  for (const client of clients) {
    const regions = client.snapshots.at(-1).state.exploredRegions;
    assert.equal(includes(regions, 5.5, 2.5), true);
    assert.equal(includes(regions, 25.5, 20.5), true);
    assert.equal(includes(regions, 15.5, 15.5), false, 'unexplored terrain remains unknown');
  }
  for (const cookie of cookies) {
    const response = await __testing.app.inject({ method: 'GET', url: '/api/battle-map/state', headers: { cookie } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().state.exploredRegions, memory.read('scene').regions);
  }
  assert.deepEqual(new ExplorationService(db, players).read('scene'), memory.read('scene'));
});
