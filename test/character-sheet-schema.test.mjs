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
  const data = createInitialCharacterSheetData({ displayName: 'Ilthar' });
  assert.equal(data.character.name, 'Ilthar');
  assert.equal(data.story.name, 'Ilthar');
  assert.deepEqual(validateCharacterSheetData(data), []);
});

test('a new sheet starts every ability at score 10 and level 1', () => {
  const data = createInitialCharacterSheetData();
  assert.equal(data.character.level, '1');
  for (const key of Object.keys(data.character.abilities)) assert.equal(data.character.abilities[key].score, '10');
  assert.deepEqual(data.character.sectionLocks, { attacks: false, tools: false });
  assert.equal(data.spells.spellcastingAbility, '');
});

test('unknown and invalid fields are rejected', () => {
  const unknown = createInitialCharacterSheetData();
  unknown.character.automaticArmorClass = '18';
  assert.match(validateCharacterSheetData(unknown).join(' '), /Campo sconosciuto/);
  const invalid = createInitialCharacterSheetData();
  invalid.character.skills.stealth.proficiency = 'yes';
  assert.throws(() => assertValidCharacterSheetData(invalid), /non e valido/);
});

test('ability score and level must be integers', () => {
  const badScore = createInitialCharacterSheetData();
  badScore.character.abilities.strength.score = 'sedici';
  assert.match(validateCharacterSheetData(badScore).join(' '), /abilities.strength.score deve essere un intero/);
  const badLevel = createInitialCharacterSheetData();
  badLevel.character.level = 'cinque';
  assert.match(validateCharacterSheetData(badLevel).join(' '), /character.level deve essere un intero/);
});

test('derived values are not part of the document', () => {
  const data = createInitialCharacterSheetData();
  assert.equal('modifier' in data.character.abilities.strength, false);
  assert.equal('proficiencyBonus' in data.character, false);
  assert.equal('passivePerception' in data.character, false);
  assert.equal('initiativeModifier' in data.character, false);
  assert.equal('value' in data.character.savingThrows.strength, false);
  assert.equal('value' in data.character.skills.stealth, false);
  assert.equal('saveDc' in data.spells, false);
  assert.equal('attackBonus' in data.spells, false);
});

test('additional repeatable rows with stable IDs are accepted', () => {
  const data = createInitialCharacterSheetData();
  data.character.attacks.push(createAttack({ id: 'attack_0001', name: 'Spada', attackEnabled: true, attackAbility: 'strength' }));
  data.character.attacks.push(createAttack({ id: 'attack_0002', name: 'Arco' }));
  data.character.equipment.push(createEquipmentItem({ id: 'item_0001', quantity: '2', name: 'Torcia', weight: '1' }));
  data.character.tools.push(createTool({ id: 'tool_0001', name: 'Arnesi da scasso', proficiency: 'expertise', ability: 'dexterity', bonus: '+7' }));
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

test('closed option sets of tools, features, hit dice and death saves are enforced', () => {
  const data = createInitialCharacterSheetData();
  data.character.tools.push(createTool({ id: 'tool_0001', proficiency: 'legendary' }));
  assert.match(validateCharacterSheetData(data).join(' '), /tools\[0\].proficiency non e valido/);
  const features = createInitialCharacterSheetData();
  features.character.features.push(createFeature({ id: 'feat_0001', source: 'divine' }));
  assert.match(validateCharacterSheetData(features).join(' '), /features\[0\].source non e valido/);
  const hitDice = createInitialCharacterSheetData();
  hitDice.character.hitDice.type = 'd20';
  assert.match(validateCharacterSheetData(hitDice).join(' '), /hitDice.type non e valido/);
  const deathSaves = createInitialCharacterSheetData();
  deathSaves.character.deathSaves.successes = '4';
  assert.match(validateCharacterSheetData(deathSaves).join(' '), /deathSaves.successes non e valido/);
});

test('the attack row accepts its flat fields and rejects an unknown one', () => {
  const data = createInitialCharacterSheetData();
  const attack = createAttack({ id: 'attack_0001' });
  assert.equal(attack.critRange, '20');
  data.character.attacks.push(attack);
  assert.deepEqual(validateCharacterSheetData(data), []);
  const invalid = createInitialCharacterSheetData();
  invalid.character.attacks.push({ ...createAttack({ id: 'attack_0002' }), damageJson: '{}' });
  assert.match(validateCharacterSheetData(invalid).join(' '), /Campo sconosciuto/);
});

test('spellcasting ability is a closed choice among the six abilities', () => {
  const data = createInitialCharacterSheetData();
  data.spells.spellcastingAbility = 'charisma';
  assert.deepEqual(validateCharacterSheetData(data), []);
  const invalid = createInitialCharacterSheetData();
  invalid.spells.spellcastingAbility = 'Carisma';
  assert.match(validateCharacterSheetData(invalid).join(' '), /spellcastingAbility non e valido/);
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
  assert.match(validatePatchOperation({ op: 'set', path: 'character.skills.stealth.proficiency', value: 'yes' }), /non valido/);
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

test('patch allowlist covers derived-value rules and rejects the removed derived paths', () => {
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.abilities.strength.score', value: '16' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.level', value: '5' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.savingThrows.dexterity.proficient', value: true }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.savingThrows.dexterity.miscBonus', value: '1' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.skills.stealth.miscBonus', value: '1' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.initiativeMiscBonus', value: '1' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.sectionLocks.attacks', value: true }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.hitDice.type', value: 'd8' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'character.deathSaves.successes', value: '2' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'spells.spellcastingAbility', value: 'charisma' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'spells.saveDcMiscBonus', value: '1' }), null);
  assert.equal(validatePatchOperation({ op: 'set', path: 'spells.attackMiscBonus', value: '1' }), null);

  assert.match(validatePatchOperation({ op: 'set', path: 'character.abilities.strength.modifier', value: '3' }), /non ammesso/);
  assert.match(validatePatchOperation({ op: 'set', path: 'character.proficiencyBonus', value: '3' }), /non ammesso/);
  assert.match(validatePatchOperation({ op: 'set', path: 'character.passivePerception', value: '13' }), /non ammesso/);
  assert.match(validatePatchOperation({ op: 'set', path: 'character.initiativeModifier', value: '3' }), /non ammesso/);
  assert.match(validatePatchOperation({ op: 'set', path: 'character.savingThrows.dexterity.value', value: '3' }), /non ammesso/);
  assert.match(validatePatchOperation({ op: 'set', path: 'character.skills.stealth.value', value: '3' }), /non ammesso/);
  assert.match(validatePatchOperation({ op: 'set', path: 'spells.saveDc', value: '13' }), /non ammesso/);
  assert.match(validatePatchOperation({ op: 'set', path: 'spells.attackBonus', value: '5' }), /non ammesso/);
  assert.match(validatePatchOperation({ op: 'set', path: 'character.level', value: 'cinque' }), /non valido/);
  assert.match(validatePatchOperation({ op: 'set', path: 'spells.spellcastingAbility', value: 'Carisma' }), /non valido/);
});
