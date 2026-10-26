import assert from 'node:assert/strict';
import test from 'node:test';
import { planEncounterBatch } from '../shared/encounter-batch.mjs';
import { createDefaultSceneDocument, normalizeSceneDocument } from '../shared/scene-model.mjs';
import { projectEncounterEntityToken } from '../shared/encounter-token.mjs';
const entity = { id: 'ref', entityId: 'creature', encounterId: 'enc', entityType: 'monster', name: 'Diavolo spinato' };
const doc = {
  ...createDefaultSceneDocument(),
  encounters: [{ id: 'enc', name: 'Incontro', kind: 'combat' }],
  entityReferences: [entity],
};
const input = { entityReferenceId: 'ref', position: { x: 2, y: 3 } };
test('four placements have legacy names and unique positions, one keeps the base name', () => {
  const batch = planEncounterBatch(doc, 'enc', { ...input, quantity: 4 });
  const normalized = normalizeSceneDocument({ ...doc, preparedPlacements: batch });
  assert.deepEqual(
    normalized.preparedPlacements.map((p) => projectEncounterEntityToken({ entity, placement: p }).name),
    ['Diavolo spinato 1', 'Diavolo spinato 2', 'Diavolo spinato 3', 'Diavolo spinato 4'],
  );
  assert.equal(new Set(batch.map((p) => `${p.position.x}:${p.position.y}`)).size, 4);
  const one = planEncounterBatch(doc, 'enc', input);
  assert.equal(projectEncounterEntityToken({ entity, placement: one[0] }).name, entity.name);
  assert.equal(doc.entityReferences.length, 1);
  assert.equal(doc.preparedPlacements.length, 0);
});
test('invalid quantities and insufficient space fail without mutating preparation', () => {
  for (const quantity of [0, -1, 1.5, 101, NaN, null])
    assert.throws(() => planEncounterBatch(doc, 'enc', { ...input, quantity }));
  const tiny = { ...doc, board: { ...doc.board, dimensions: { columns: 2, rows: 1 } } };
  assert.throws(() => planEncounterBatch(tiny, 'enc', { ...input, position: { x: 0, y: 0 }, quantity: 4 }));
});

test('batch placement persists once and one versioned undo removes the whole batch',async t=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {openDatabase}=await import('../database/connection.mjs');const {migrate}=await import('../database/migrator.mjs');
 const {SceneService}=await import('../server/scene-service.mjs');const {SceneRepository}=await import('../server/scene-repository.mjs');
 const dir=mkdtempSync(join(tmpdir(),'vtt-batch-')),db=openDatabase({path:join(dir,'test.sqlite')});await migrate(db);
 t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
 db.prepare('INSERT INTO campaigns(id,name,owner_user_id) VALUES(?,?,?)').run('camp','Test','master-user');
 const repository=new SceneRepository(db);repository.createAndActivate({id:'scene',campaignId:'camp',name:'Test',document:doc});
 const service=new SceneService({repository,campaignId:'camp'});service.load();
 const before=service.getScene('scene');const saved=service.mutateEncounterPlacement({id:'scene',encounterId:'enc',expectedVersion:before.version,placement:{...input,quantity:4},mode:'create'});
 assert.equal(saved.version,before.version+1);assert.equal(saved.document.preparedPlacements.length,4);
 assert.equal(service.getPlacementHistoryState('scene').canUndo,true);
 const undone=service.undoPlacement({id:'scene',expectedVersion:saved.version});assert.equal(undone.document.preparedPlacements.length,0);
 assert.equal(repository.findById('scene').document.preparedPlacements.length,0);
});

test('legacy full-state creation limits new creatures rather than the total map size',async t=>{
 process.env.BATTLE_MAP_TEST_MODE='1';const {__testing}=await import('../server/index.mjs');
 const master={id:'master-user',role:'master',username:'master',displayName:'Master'};
 __testing.setUserRepository({findById:()=>master});
 const token=i=>({id:`creature-${i}`,name:`Creatura ${i}`,type:'enemy',size:'medium',position:{x:i%30,y:Math.floor(i/30)}});
 const known=Array.from({length:200},(_,i)=>token(i));__testing.setBattleMapState({tokens:known});
 const session=__testing.createSession(master);
 t.after(async()=>{__testing.setUserRepository(null);await __testing.app.close();});
 const update=state=>__testing.app.inject({method:'PUT',url:'/api/battle-map/state',headers:{cookie:`battle_map_session=${session}`},payload:{state}});
 const tooMany=await update({tokens:[...known,...Array.from({length:101},(_,i)=>token(300+i))]});
 assert.equal(tooMany.statusCode,400);assert.equal(__testing.getBattleMapState().tokens.length,200);
 assert.equal((await update({tokens:known})).statusCode,200);
});
