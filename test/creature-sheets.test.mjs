import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { openDatabase } from '../database/connection.mjs';
import { migrate } from '../database/migrator.mjs';
import { SceneRepository } from '../server/scene-repository.mjs';
import { SceneService } from '../server/scene-service.mjs';
import { createDefaultSceneDocument } from '../shared/scene-model.mjs';
import { CreatureSheetService } from '../server/creature-sheet-service.mjs';
import { registerCreatureSheetRoutes } from '../server/creature-sheet-routes.mjs';
import { MONSTER_ACTION_FIELDS } from '../shared/creature-sheet-data.mjs';
const master = { id: 'master-user', role: 'master', displayName: 'Master' },
  player = { id: 'hero', role: 'adventurer' };
async function fixture(t, kind = 'monster') {
  const dir = mkdtempSync(join(tmpdir(), 'vtt-creature-')),
    db = openDatabase({ path: join(dir, 'test.sqlite') });
  await migrate(db);
  db.prepare('INSERT INTO campaigns(id,name,owner_user_id) VALUES(?,?,?)').run('campaign', 'Campagna', master.id);
  const doc = {
    ...createDefaultSceneDocument(),
    encounters: [{ id: 'enc', kind: 'combat', name: 'Incontro' }],
    entityReferences: [
      { id: 'entity', entityId: 'entity', encounterId: 'enc', entityType: kind, name: 'Diavolo spinato' },
    ],
    preparedPlacements: Array.from({ length: 4 }, (_, i) => ({
      id: `token-${i}`,
      encounterId: 'enc',
      entityReferenceId: 'entity',
      name: `Diavolo spinato ${i + 1}`,
      position: { x: i, y: 1 },
    })),
  };
  const repository = new SceneRepository(db);
  repository.createAndActivate({ id: 'scene', campaignId: 'campaign', name: 'Corridoio', document: doc });
  const sceneService = new SceneService({ repository, campaignId: 'campaign' });
  sceneService.load();
  const tokens = doc.preparedPlacements.map((p) => ({
    id: p.id,
    type: 'enemy',
    name: p.name,
    position: p.position,
    hitPoints: 7,
    maxHitPoints: 7,
  }));
  const events = [];
  let projections = 0;
  const service = new CreatureSheetService({
    db,
    sceneService,
    getTokens: () => tokens,
    emit: (e) => events.push(e),
    project: () => projections++,
  });
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    db,
    service,
    tokens,
    events,
    get projections() {
      return projections;
    },
  };
}
const payload = (record, data, extra = {}) => ({
  data,
  baseVersion: record.version,
  bindingVersion: record.bindingVersion,
  signature: record.signature,
  scope: 'all',
  ...extra,
});
test('one explicit definition links four distinct instances and shared saves preserve individual HP', async (t) => {
  const f = await fixture(t);
  assert.equal(f.service.context(master, 'scene', 'token-0').record, null);
  let record = f.service.bind(master, { sceneId: 'scene', tokenId: 'token-0', includeRelated: true });
  assert.equal(record.targets.length, 4);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM creature_sheet_definitions').get().n, 1);
  const data = structuredClone(record.data);
  data.armorClass = '17';
  data.hitPointsMaximum = '22';
  data.hitPointsCurrent = '3';
  const before = f.service.get(master, record.targets.find((t) => t.id !== record.id).id);
  const preview = f.service.preview(master, record.id, payload(record, data));
  assert.equal(preview.targets[0].sceneName, 'Corridoio');
  assert.equal(preview.targets.length, 4);
  assert.equal(f.service.get(master, record.id).data.armorClass, ''); // Preview never writes.
  record = f.service.save(master, record.id, payload(record, data, { signature: preview.signature }));
  const other = f.service.get(master, before.id);
  assert.equal(other.data.armorClass, '17');
  assert.equal(other.data.hitPointsCurrent, '7');
  assert.equal(record.data.hitPointsCurrent, '3');
  assert.equal(other.data.hitPointsMaximum, '22');
  assert.equal(record.name, 'Diavolo spinato 1');
  const projected = f.service.projectTokens(f.tokens, 'scene');
  assert.equal(projected[0].hitPoints, 3);
  assert.equal(projected[1].hitPoints, 7);
});
test('only this forks, cancellation leaves data intact and changing targets invalidates confirmation', async (t) => {
  const f = await fixture(t);
  let record = f.service.bind(master, { sceneId: 'scene', tokenId: 'token-0', includeRelated: true });
  const data = { ...record.data, armorClass: '19' };
  const forked = f.service.save(master, record.id, payload(record, data, { scope: 'one' }));
  assert.notEqual(forked.sheetId, record.sheetId);
  assert.equal(forked.targets.length, 1);
  assert.equal(f.service.get(master, record.targets.find((t) => t.id !== record.id).id).data.armorClass, '');
  let group = f.service.get(master, record.targets.find((t) => t.id !== record.id).id);
  f.service.preview(master, group.id, payload(group, { ...group.data, armorClass: '23' }));
  assert.equal(f.service.get(master, group.id).data.armorClass, '');
  f.db.prepare('UPDATE creature_sheet_bindings SET version=version+1 WHERE id=?').run(group.targets[1].id);
  assert.throws(
    () => f.service.save(master, group.id, payload(group, { ...group.data, armorClass: '23' })),
    (e) => e.status === 409,
  );
  assert.equal(f.service.get(master, group.id).data.armorClass, '');
});
test('Master access, schema discrimination, persisted restart and stored monster attacks', async (t) => {
  const f = await fixture(t);
  let record = f.service.bind(master, { sceneId: 'scene', tokenId: 'token-0' });
  for (const user of [null, player]) {
    assert.throws(() => f.service.get(user, record.id));
    assert.throws(() => f.service.bind(user, { sceneId: 'scene', tokenId: 'token-1' }));
  }
  assert.throws(() => f.service.save(master, record.id, payload(record, { character: { name: 'wrong' } })));
  const data = structuredClone(record.data);
  data.actions = [
    {
      id: 'axe',
      ...Object.fromEntries(MONSTER_ACTION_FIELDS.map(([k]) => [k, ''])),
      name: 'Ascia',
      attackBonus: '5',
      damageFormula: '1d12+5',
    },
  ];
  record = f.service.save(master, record.id, payload(record, data));
  const rolled = f.service.roll(
    master,
    record.id,
    { source: { sheetId: record.id, target: 'actions:axe:damage' }, formula: '99d20', visibility: 'secret' },
    { nextUint32: () => 0 },
  );
  assert.equal(rolled.log.formula, '1d12+5');
  assert.equal(rolled.log.total, 6);
  assert.equal(rolled.log.visibility, 'secret');
  const reopened = new CreatureSheetService({
    db: f.db,
    sceneService: f.service.sceneService,
    getTokens: () => f.tokens,
  });
  assert.deepEqual(reopened.get(master, record.id).data, record.data);
});
test('NPCs reuse the complete character schema and resource changes stay on their instance', async (t) => {
  const f = await fixture(t, 'npc');
  let record = f.service.bind(master, { sceneId: 'scene', tokenId: 'token-0', includeRelated: true });
  assert.equal(record.kind, 'character');
  assert.ok(record.data.spells.levels['9']);
  assert.ok(record.data.story);
  const data = structuredClone(record.data);
  data.character.hitDice.type = 'd8';
  data.character.hitDice.total = '3';
  data.character.hitDice.remaining = '2';
  record = f.service.save(master, record.id, payload(record, data));
  const otherId = record.targets.find((r) => r.id !== record.id).id;
  const roll = f.service.roll(
    master,
    record.id,
    { source: { sheetId: record.id, target: 'hit-dice' } },
    { nextUint32: () => 0 },
  );
  assert.ok(roll.log);
  assert.equal(f.service.get(master, record.id).data.character.hitDice.remaining, '1');
  assert.equal(f.service.get(master, otherId).data.character.hitDice.remaining, '');
});
test('creature routes deny direct Player requests and a save failure has no partial writes', async (t) => {
  const f = await fixture(t);
  const record = f.service.bind(master, { sceneId: 'scene', tokenId: 'token-0', includeRelated: true });
  const app = Fastify();
  registerCreatureSheetRoutes(app, {
    service: f.service,
    getUser: (r) => (r.headers['x-role'] === 'master' ? master : player),
  });
  t.after(() => app.close());
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const response = await app.inject({
      method,
      url: `/api/creature-sheets/bindings/${encodeURIComponent(record.id)}`,
      payload: method === 'PUT' ? payload(record, record.data) : undefined,
    });
    assert.equal(response.statusCode, 403);
  }
  f.db.exec(
    `CREATE TRIGGER fail_creature BEFORE UPDATE ON creature_sheet_definitions BEGIN SELECT RAISE(ABORT,'failure'); END`,
  );
  assert.throws(() => f.service.save(master, record.id, payload(record, { ...record.data, armorClass: '30' })));
  assert.equal(f.service.get(master, record.id).data.armorClass, '');
  assert.equal(f.projections, 0);
});

test('bound NPC initiative reuses Dexterity, misc bonus and stored mode without changing per-instance resources',async t=>{
 const {rollInitiative}=await import('../server/initiative-roll.mjs');const f=await fixture(t,'npc');
 let record=f.service.bind(master,{sceneId:'scene',tokenId:'token-0'});const data=structuredClone(record.data);
 data.character.abilities.dexterity.score='16';data.character.initiativeMiscBonus='2';data.character.initiativeRollMode='advantage';
 record=f.service.save(master,record.id,payload(record,data));
 const values=[0,9];const result=rollInitiative({user:master,state:{sessionMode:'combat',tokens:f.tokens,initiatives:[]},tokenId:'token-0',creatureSheet:record,nextUint32:()=>values.shift()});
 assert.equal(result.log.total,15);assert.equal(result.entry.dexModifier,3);assert.equal(result.log.mode,'advantage');
});

test('creature portraits share the save scope and validate bytes without exposing private sheets',async t=>{
 const {PortraitStorage}=await import('../server/portrait-storage.mjs');const {mkdtempSync,rmSync}=await import('node:fs');
 const f=await fixture(t);let record=f.service.bind(master,{sceneId:'scene',tokenId:'token-0',includeRelated:true});
 const root=mkdtempSync(join(tmpdir(),'vtt-creature-portrait-'));const storage=new PortraitStorage(root);await storage.initialize();
 const app=Fastify();registerCreatureSheetRoutes(app,{service:f.service,getUser:r=>r.headers['x-role']==='master'?master:player,portraitStorage:storage});
 t.after(async()=>{await app.close();rmSync(root,{recursive:true,force:true});});
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7/x1kAAAAASUVORK5CYII=';
 const saved=await app.inject({method:'PUT',url:`/api/creature-sheets/bindings/${encodeURIComponent(record.id)}`,headers:{'x-role':'master'},payload:{...payload(record,record.data),portrait:`data:image/png;base64,${png}`}});
 assert.equal(saved.statusCode,200);record=saved.json();assert.ok(record.portraitUrl);
 const image=await app.inject({method:'GET',url:record.portraitUrl,headers:{'x-role':'master'}});assert.equal(image.statusCode,200);assert.equal(image.headers['content-type'],'image/png');
 assert.equal((await app.inject({method:'GET',url:record.portraitUrl})).statusCode,403);
 const invalid=await app.inject({method:'PUT',url:`/api/creature-sheets/bindings/${encodeURIComponent(record.id)}`,headers:{'x-role':'master'},payload:{...payload(record,record.data),portrait:'data:image/png;base64,YmFk'}});
 assert.equal(invalid.statusCode,400);assert.equal(f.service.get(master,record.id).portraitUrl,record.portraitUrl);
});

test('new additive storage migrations roll back and reapply without altering Adventurer sheets',async t=>{
 const f=await fixture(t);const personal=f.db.prepare('SELECT count(*) AS n FROM character_sheets').get().n;
 const definitions=await import('../database/migrations/20261026_002_creature_sheets.mjs');
 const memory=await import('../database/migrations/20261026_001_explored_regions.mjs');
 definitions.down(f.db);memory.down(f.db);memory.up(f.db);definitions.up(f.db);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM character_sheets').get().n,personal);
 assert.deepEqual(f.db.pragma('foreign_key_check'),[]);assert.equal(f.db.prepare('SELECT count(*) AS n FROM creature_sheet_bindings').get().n,0);
});

test('signed HP draft previews use server arithmetic without saving before scope confirmation',async t=>{
 const f=await fixture(t,'npc'),record=f.service.bind(master,{sceneId:'scene',tokenId:'token-0'});
 const data=structuredClone(record.data);data.character.hitPoints.maximum='20';data.character.hitPoints.temporary='5';
 const result=f.service.previewHitPoints(master,record.id,{...payload(record,data),delta:-8});
 assert.equal(result.data.character.hitPoints.current,'4');assert.equal(result.data.character.hitPoints.temporary,'0');
 assert.equal(f.service.get(master,record.id).data.character.hitPoints.current,'7');
 assert.throws(()=>f.service.previewHitPoints(master,record.id,{...payload(record,data),delta:0}));
});
