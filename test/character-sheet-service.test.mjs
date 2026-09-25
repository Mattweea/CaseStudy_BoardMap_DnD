import assert from 'node:assert/strict';
import test from 'node:test';
import { CharacterSheetPolicy } from '../server/character-sheet-policy.mjs';
import { CharacterSheetService } from '../server/character-sheet-service.mjs';
import { createEquipmentItem, createFeature, createInitialCharacterSheetData, createAttack } from '../server/character-sheet-schema.mjs';

function harness(overrides = {}) {
  const initial = {
    id: 'sheet-1', ownerUserId: 'player-1', campaignId: 'campaign-1', version: 1,
    data: createInitialCharacterSheetData(), portraitFileName: null, portraitMediaType: null, portraitUpdatedAt: null,
  };
  let stored = structuredClone(initial);
  let writes = 0;
  const timers = [];
  const events = [];
  const projections = [];
  const repository = {
    findById: () => structuredClone(stored),
    saveVersion: ({ expectedVersion, version, data }) => {
      writes += 1;
      if (overrides.failSaveOnce) {
        overrides.failSaveOnce = false;
        throw new Error('disk full');
      }
      if (stored.version !== expectedVersion) return null;
      stored = { ...stored, version, data: structuredClone(data) };
      return structuredClone(stored);
    },
    updatePortrait: (_id, metadata) => {
      stored = { ...stored, portraitFileName: metadata.fileName, portraitMediaType: metadata.mediaType, portraitUpdatedAt: metadata.updatedAt };
      return structuredClone(stored);
    },
  };
  const service = new CharacterSheetService({
    repository,
    policy: new CharacterSheetPolicy(),
    schedule: (callback, delay) => { const timer = { callback, delay, cancelled: false }; timers.push(timer); return timer; },
    cancel: (timer) => { timer.cancelled = true; },
    emit: (event) => events.push(event),
    projectToken: (ownerUserId, updates) => projections.push({ ownerUserId, updates }),
  });
  return { service, initial, timers, events, projections, getStored: () => stored, getWrites: () => writes };
}

const owner = { id: 'player-1', role: 'adventurer' };

test('valid patch changes only requested path and invalid patch is atomic', () => {
  const { service } = harness();
  const result = service.applyPatch(owner, 'sheet-1', { baseVersion: 1, operations: [{ op: 'set', path: 'character.name', value: 'Vesuth' }] });
  assert.equal(result.version, 2);
  assert.equal(result.data.character.name, 'Vesuth');
  assert.equal(result.data.character.armorClass, '');
  assert.throws(() => service.applyPatch(owner, 'sheet-1', { baseVersion: 2, operations: [{ op: 'set', path: 'character.unknown', value: 'x' }] }), /non ammesso/);
  assert.equal(service.get(owner, 'sheet-1').version, 2);
});

test('concurrent fields and rows merge while the same stale field conflicts', () => {
  const { service } = harness();
  service.applyPatch(owner, 'sheet-1', { baseVersion: 1, operations: [{ op: 'set', path: 'character.name', value: 'A' }] });
  const merged = service.applyPatch(owner, 'sheet-1', { baseVersion: 1, operations: [{ op: 'set', path: 'character.armorClass', value: '17' }] });
  assert.equal(merged.data.character.name, 'A');
  assert.equal(merged.data.character.armorClass, '17');
  assert.throws(() => service.applyPatch(owner, 'sheet-1', { baseVersion: 1, operations: [{ op: 'set', path: 'character.name', value: 'B' }] }), (error) => error.status === 409 && error.details.conflicts[0].value === 'A');

  const left = createAttack({ id: 'attack_left' });
  const right = createAttack({ id: 'attack_right' });
  service.applyPatch(owner, 'sheet-1', { baseVersion: 3, operations: [{ op: 'add', path: 'character.attacks', value: left }] });
  const rows = service.applyPatch(owner, 'sheet-1', { baseVersion: 3, operations: [{ op: 'add', path: 'character.attacks', value: right }] });
  assert.deepEqual(rows.data.character.attacks.map(({ id }) => id), ['attack_left', 'attack_right']);
});

test('rows of the new collections merge and nested resource blocks are patchable', () => {
  const { service } = harness();
  const item = createEquipmentItem({ id: 'item_0001', quantity: '2', name: 'Torcia' });
  const feature = createFeature({ id: 'feat_0001', name: 'Scurovisione', source: 'race' });
  service.applyPatch(owner, 'sheet-1', { baseVersion: 1, operations: [{ op: 'add', path: 'character.equipment', value: item }] });
  const merged = service.applyPatch(owner, 'sheet-1', { baseVersion: 1, operations: [{ op: 'add', path: 'character.features', value: feature }] });
  assert.deepEqual(merged.data.character.equipment.map(({ name }) => name), ['Torcia']);
  assert.deepEqual(merged.data.character.features.map(({ source }) => source), ['race']);

  const sectionId = merged.data.character.resources[0].id;
  const resources = service.applyPatch(owner, 'sheet-1', {
    baseVersion: merged.version,
    operations: [
      { op: 'set', path: `character.resources.${sectionId}.classResource.name`, value: 'Ki' },
      { op: 'set', path: `character.resources.${sectionId}.classResource.current`, value: '3' },
    ],
  });
  assert.equal(resources.data.character.resources[0].classResource.name, 'Ki');
  assert.equal(resources.data.character.resources[0].classResource.current, '3');
  assert.equal(resources.data.character.resources[0].otherResource.name, '');

  const removed = service.applyPatch(owner, 'sheet-1', { baseVersion: resources.version, operations: [{ op: 'remove', path: 'character.equipment.item_0001' }] });
  assert.deepEqual(removed.data.character.equipment, []);
});

test('debounce groups writes, explicit flush saves immediately and failure retries', () => {
  const state = harness({ failSaveOnce: true });
  state.service.applyPatch(owner, 'sheet-1', { baseVersion: 1, operations: [{ op: 'set', path: 'character.name', value: 'A' }] });
  state.service.applyPatch(owner, 'sheet-1', { baseVersion: 2, operations: [{ op: 'set', path: 'character.armorClass', value: '18' }] });
  assert.equal(state.timers.length, 2);
  assert.equal(state.timers[0].cancelled, true);
  assert.throws(() => state.service.flush(owner, 'sheet-1'), /verra riprovato/);
  assert.equal(state.getWrites(), 1);
  const retry = state.timers.at(-1);
  retry.callback();
  assert.equal(state.getWrites(), 2);
  assert.equal(state.getStored().version, 3);
  assert.equal(state.events.at(-1).status, 'saved');
});

test('global flush persists every dirty live sheet immediately', () => {
  const state = harness();
  state.service.applyPatch(owner, 'sheet-1', { baseVersion: 1, operations: [{ op: 'set', path: 'character.name', value: 'A' }] });
  state.service.flushAll();
  assert.equal(state.getWrites(), 1);
  assert.equal(state.getStored().data.character.name, 'A');
});

test('only linked paths project to the token and token changes cannot affect the sheet', () => {
  const { service, projections } = harness();
  service.applyPatch(owner, 'sheet-1', { baseVersion: 1, operations: [
    { op: 'set', path: 'character.name', value: 'Ragnar' },
    { op: 'set', path: 'character.hitPoints.current', value: '12' },
    { op: 'set', path: 'character.hitPoints.maximum', value: '30' },
    { op: 'set', path: 'character.hitPoints.temporary', value: '4' },
    { op: 'set', path: 'character.speed', value: '12 m' },
    { op: 'set', path: 'character.armorClass', value: '19' },
  ] });
  assert.deepEqual(projections[0], { ownerUserId: 'player-1', updates: {
    name: 'Ragnar', hitPoints: 12, maxHitPoints: 30, temporaryHitPoints: 4, speed: '12 m',
  } });
  assert.equal(service.get(owner, 'sheet-1').data.character.armorClass, '19');
});

test('initiative is recalculated and projected from a dexterity score or misc bonus patch, never stored on the sheet', () => {
  const { service, projections } = harness();
  const fromScore = service.applyPatch(owner, 'sheet-1', { baseVersion: 1, operations: [
    { op: 'set', path: 'character.abilities.dexterity.score', value: '16' },
  ] });
  assert.deepEqual(projections.at(-1), { ownerUserId: 'player-1', updates: { initiativeModifier: 3 } });
  assert.equal('initiativeModifier' in fromScore.data.character, false);

  const fromMiscBonus = service.applyPatch(owner, 'sheet-1', { baseVersion: fromScore.version, operations: [
    { op: 'set', path: 'character.initiativeMiscBonus', value: '2' },
  ] });
  assert.deepEqual(projections.at(-1), { ownerUserId: 'player-1', updates: { initiativeModifier: 5 } });
  assert.equal('initiativeModifier' in fromMiscBonus.data.character, false);

  const unrelated = service.applyPatch(owner, 'sheet-1', { baseVersion: fromMiscBonus.version, operations: [
    { op: 'set', path: 'character.armorClass', value: '18' },
  ] });
  assert.equal(projections.length, 2);
  assert.equal(unrelated.data.character.armorClass, '18');
});

test('owner or master can replace a portrait without projecting it to the token', async () => {
  const { service, events, projections } = harness();
  const removed = [];
  const storage = {
    stage: async () => ({ fileName: '11111111-1111-1111-1111-111111111111.png', mediaType: 'image/png', updatedAt: '2026-09-16T00:00:00.000Z' }),
    remove: async (name) => removed.push(name),
  };
  const result = await service.replacePortrait({ id: 'master', role: 'master' }, 'sheet-1', { buffer: Buffer.from('png'), mediaType: 'image/png' }, storage);
  assert.match(result.portraitUrl, /portrait\?v=/);
  assert.equal(events.at(-1).type, 'character-sheet-portrait');
  assert.equal(projections.length, 0);
  assert.deepEqual(removed, []);
  await assert.rejects(service.replacePortrait({ id: 'other', role: 'adventurer' }, 'sheet-1', { buffer: Buffer.from('png'), mediaType: 'image/png' }, storage), /negata/);
});

test("la modalità d'iniziativa si salva con le regole di autorizzazione e versione degli altri campi", () => {
  const { service } = harness();
  // Una scheda letta dal repository senza il campo (normalizzata in lettura) non cambia versione.
  assert.equal(service.get(owner, 'sheet-1').version, 1);
  assert.equal(service.get(owner, 'sheet-1').data.character.initiativeRollMode, 'normal');

  const saved = service.applyPatch(owner, 'sheet-1', { baseVersion: 1, operations: [
    { op: 'set', path: 'character.initiativeRollMode', value: 'advantage' },
  ] });
  assert.equal(saved.version, 2);
  assert.equal(saved.data.character.initiativeRollMode, 'advantage');

  assert.throws(() => service.applyPatch(owner, 'sheet-1', { baseVersion: 2, operations: [
    { op: 'set', path: 'character.initiativeRollMode', value: 'triple' },
  ] }), /non valido/);
  const intruder = { id: 'player-2', role: 'adventurer' };
  assert.throws(() => service.applyPatch(intruder, 'sheet-1', { baseVersion: 2, operations: [
    { op: 'set', path: 'character.initiativeRollMode', value: 'disadvantage' },
  ] }), /negata/);
  assert.equal(service.get(owner, 'sheet-1').data.character.initiativeRollMode, 'advantage');
  assert.equal(service.get(owner, 'sheet-1').version, 2);
});
