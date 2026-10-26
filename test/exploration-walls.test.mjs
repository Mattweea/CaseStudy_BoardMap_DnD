import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import polygonClipping from 'polygon-clipping';
import { openDatabase } from '../database/connection.mjs';
import { migrate } from '../database/migrator.mjs';
import { SceneRepository } from '../server/scene-repository.mjs';
import { SceneService } from '../server/scene-service.mjs';
import { SceneWalls } from '../server/scene-walls.mjs';
import { createDefaultSceneDocument, normalizeSceneWalls } from '../shared/scene-model.mjs';
import { firstWallIntersection } from '../shared/vision-walls.mjs';
import { visibleRegions, asRegion } from '../shared/explored-regions.mjs';
import { collectVisionBlockers } from '../shared/scene-blockers.mjs';
const wall = {
  id: 'wall',
  color: '#ff7970',
  widthCells: 0.05,
  points: [
    { x: 3, y: 0 },
    { x: 3, y: 8 },
  ],
};
const token = { id: 'hero', ownerUserId: 'hero', type: 'player', size: 'medium', position: { x: 1, y: 1 } };
const footprint = () => ({ width: 1, height: 1 });
const includes = (regions, x, y) =>
  polygonClipping.intersection(
    regions,
    asRegion([
      { x: x - 0.01, y: y - 0.01 },
      { x: x + 0.01, y: y - 0.01 },
      { x: x + 0.01, y: y + 0.01 },
      { x: x - 0.01, y: y + 0.01 },
    ]),
  ).length > 0;
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vtt-explored-'));
  const db = openDatabase({ path: join(dir, 'test.sqlite') });
  await migrate(db);
  db.prepare('INSERT INTO campaigns(id,name,owner_user_id) VALUES(?,?,?)').run('campaign', 'Test', 'master-user');
  const repository = new SceneRepository(db);
  repository.createAndActivate({
    id: 'scene',
    campaignId: 'campaign',
    name: 'Scena',
    document: createDefaultSceneDocument(),
  });
  const service = new SceneService({ repository, campaignId: 'campaign' });
  service.load();
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { db, repository, service };
}
test('walls stop both ray directions and darkvision without rectangular overblocking', () => {
  const blockers = collectVisionBlockers([], [], footprint, [wall]);
  assert.equal(firstWallIntersection({ x: 1, y: 1 }, { x: 5, y: 1 }, blockers).x, 3);
  assert.equal(firstWallIntersection({ x: 5, y: 1 }, { x: 1, y: 1 }, blockers).x, 3);
  const region = visibleRegions(token, 6, blockers, []);
  assert.equal(includes(region, 2, 2), true);
  assert.equal(includes(region, 4, 2), false);
  const lit = visibleRegions(token, 0, blockers, [{ position: { x: 5, y: 1 }, radiusCells: 6 }]);
  assert.equal(includes(lit, 4, 2), false);
});
test('wall history is separate, persists and invalid/stale writes are atomic', async (t) => {
  const { db, service } = await fixture(t);
  const editor = new SceneWalls(service);
  const apply = (op, value) => editor.mutate('scene', service.getScene('scene').version, op, value);
  apply('add', wall);
  assert.equal(service.getScene('scene').document.walls.length, 1);
  assert.equal(service.getScene('scene').document.drawings.length, 0);
  apply('remove', 'wall');
  apply('undo');
  assert.equal(service.getScene('scene').document.walls.length, 1);
  apply('redo');
  assert.equal(service.getScene('scene').document.walls.length, 0);
  assert.throws(() => editor.mutate('scene', 1, 'add', wall));
  apply('add', wall);
  service.load();
  assert.equal(service.getScene('scene').document.walls.length, 1);
  assert.deepEqual(new SceneWalls(service).state('scene'), { canUndo: false, canRedo: false });
  assert.throws(() => normalizeSceneWalls([{ ...wall, points: [{ x: 1, y: 1 }] }]));
});
test('wall endpoint authorization and stale mutations preserve the active scene',async t=>{
 const {service}=await fixture(t);
 const {default:Fastify}=await import('fastify');
 const {registerSceneRoutes}=await import('../server/scene-routes.mjs');
 const app=Fastify();let projected=0;
 registerSceneRoutes(app,{service,getUser:r=>r.headers['x-role']?{role:r.headers['x-role']}:null,onActiveSceneUpdated:()=>projected++});
 t.after(()=>app.close());
 const request=(role,baseVersion=service.getScene('scene').version)=>app.inject({method:'POST',url:'/api/scenes/scene/walls',headers:role?{'x-role':role}:{},payload:{baseVersion,wall}});
 assert.equal((await request(null)).statusCode,401);assert.equal((await request('adventurer')).statusCode,403);
 const version=service.getScene('scene').version;assert.equal((await request('master')).statusCode,200);assert.equal(projected,1);
 assert.equal((await request('master',version)).statusCode,409);assert.equal(projected,1);
 assert.equal(service.getScene('scene').document.walls.length,1);
});

test('diagonal walls, closed joins and real openings use segments instead of bounding boxes',()=>{
 const diagonal=collectVisionBlockers([],[],footprint,[{...wall,points:[{x:1,y:1},{x:5,y:5}]}]);
 assert.equal(firstWallIntersection({x:1,y:3},{x:1.5,y:4},diagonal).fraction,1);
 assert.ok(firstWallIntersection({x:1,y:3},{x:4,y:1},diagonal).fraction<1);
 const joined=collectVisionBlockers([],[],footprint,[{...wall,points:[{x:3,y:0},{x:3,y:2},{x:5,y:4}]}]);
 assert.equal(firstWallIntersection({x:0,y:2},{x:6,y:2},joined).fraction,.5);
 const opening=collectVisionBlockers([],[],footprint,[{...wall,points:[{x:3,y:0},{x:3,y:1}]},{...wall,id:'wall-2',points:[{x:3,y:3},{x:3,y:8}]}]);
 assert.equal(firstWallIntersection({x:0,y:2},{x:6,y:2},opening).fraction,1);
});
