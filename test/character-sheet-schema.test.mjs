import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertValidCharacterSheetData,
  createAttack,
  createEquipmentItem,
  createFeature,
  createInitialCharacterSheetData,
  createLanguage,
  createResourceSection,
  createSpell,
  createTool,
  normalizeCharacterSheetData,
  validateCharacterSheetData,
  validatePatchOperation,
} from '../server/character-sheet-schema.mjs';

test('initial document covers all tabs and is valid', () => {
  const data = createInitialCharacterSheetData({ displayName: 'Ilthar', initiativeModifier: 3 });
  assert.equal(data.character.name, 'Ilthar');
  assert.equal(data.story.name, 'Ilthar');
  assert.deepEqual(validateCharacterSheetData(data), []);
});

test('unknown and invalid fields are rejected', () => {
  const unknown = createInitialCharacterSheetData();
  unknown.character.automaticArmorClass = '18';
  assert.match(validateCharacterSheetData(unknown).join(' '), /Campo sconosciuto/);
  const invalid = createInitialCharacterSheetData();
  invalid.character.skills.stealth.proficient = 'yes';
  assert.throws(() => assertValidCharacterSheetData(invalid), /booleano/);
});

test('additional repeatable rows with stable IDs are accepted', () => {
  const data = createInitialCharacterSheetData();
  data.character.attacks.push(createAttack({ id: 'attack_0001', name: 'Spada' }));
  data.character.attacks.push(createAttack({ id: 'attack_0002', name: 'Arco' }));
  data.character.equipment.push(createEquipmentItem({ id: 'item_0001', quantity: '2', name: 'Torcia', weight: '1' }));
  data.character.tools.push(createTool({ id: 'tool_0001', name: 'Arnesi da scasso', proficiency: 'expertise', ability: 'dexterity', modifier: '+7' }));
  data.character.languages.push(createLanguage({ id: 'lang_0001', name: 'Nanico' }));
  data.character.features.push(createFeature({ id: 'feat_0001', name: 'Scurovisione', source: 'race', description: '18 metri.' }));
  data.character.resources.push(createResourceSection({ id: 'res_0002' }));
  data.spells.levels['3'].spells.push(createSpell({ id: 'spell_0001', name: 'Palla di fuoco' }));
  assert.deepEqual(validateCharacterSheetData(data), []);
});

test('the character tab ships one resource section and no electrum coin', () => {
  const data = createInitialCharacterSheetData();
  assert.equal(data.character.resources.length, 1);
  assert.deepEqual(Object.keys(data.character.currency), ['cp', 'sp', 'gp', 'pp']);
  assert.equal('ep' in data.character.currency, false);
  assert.equal('actions' in data.character, false);
});

test('closed option sets of tools and features are enforced', () => {
  const data = createInitialCharacterSheetData();
  data.character.tools.push(createTool({ id: 'tool_0001', proficiency: 'legendary' }));
  assert.match(validateCharacterSheetData(data).join(' '), /tools\[0\].proficiency non e valido/);
  const features = createInitialCharacterSheetData();
  features.character.features.push(createFeature({ id: 'feat_0001', source: 'divine' }));
  assert.match(validateCharacterSheetData(features).join(' '), /features\[0\].source non e valido/);
});

test('documents written before the reorganisation keep their text', () => {
  const normalized = normalizeCharacterSheetData({
    character: {
      classLevel: 'Ladro 4',
      equipment: 'Corda di canapa',
      proficienciesLanguages: 'Comune, Ladresco',
      featuresTraits: 'Attacco furtivo',
      actions: [{ id: 'action_0001', name: 'Scatto', notes: '' }],
      currency: { ep: '9', gp: '12' },
    },
  });
  assert.equal(normalized.character.className, 'Ladro 4');
  assert.equal(normalized.character.equipment[0].name, 'Corda di canapa');
  assert.equal(normalized.character.languages[0].name, 'Comune, Ladresco');
  assert.equal(normalized.character.features[0].description, 'Attacco furtivo');
  assert.equal(normalized.character.features[0].source, 'other');
  assert.deepEqual(normalized.character.currency, { cp: '', sp: '', gp: '12', pp: '' });
  assert.equal(normalized.character.resources.length, 1);
});

test('patch allowlist accepts granular fields and rejects unknown paths and values', () => {
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.hitPoints.current', value: '17' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.attacks.attack_0001.name', value: 'Spada' }), null);
  assert.match(validatePatchOperation({ op: 'set', path: 'character.rules.autoCalculate', value: true }), /non ammesso/);
  assert.match(validatePatchOperation({ op: 'set', path: 'character.skills.stealth.proficient', value: 'yes' }), /non valido/);
});

test('patch allowlist covers the new collections of the character tab', () => {
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.equipment.item_0001.weight', value: '3' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.tools.tool_0001.proficiency', value: 'expertise' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.features.feat_0001.source', value: 'background' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.resources.res_0001.otherResource.current', value: '2' }), null);
  assert.equal(validatePatchOperation({ op: 'add', path: 'character.languages', value: createLanguage({ id: 'lang_0002' }) }), null);
  assert.equal(validatePatchOperation({ op: 'remove', path: 'character.resources.res_0002' }), null);
  assert.match(validatePatchOperation({ op: 'set', path: 'character.tools.tool_0001.proficiency', value: 'legendary' }), /non valido/);
  assert.match(validatePatchOperation({ op: 'set', path: 'character.resources.res_0001.classResource', value: 'Ki' }), /non ammesso/);
  assert.match(validatePatchOperation({ op: 'set', path: 'character.currency.ep', value: '4' }), /non ammesso/);
  assert.match(validatePatchOperation({ op: 'add', path: 'character.actions', value: { id: 'action_0001' } }), /non ammesso/);
});
