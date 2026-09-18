import assert from 'node:assert/strict';
import test from 'node:test';
import {
  abilityModifier,
  computeAttackBonus,
  computeDamageModifier,
  computeInitiative,
  computePassivePerception,
  computeSavingThrowValue,
  computeSkillValue,
  computeSpellAttackBonus,
  computeSpellSaveDc,
  computeToolBonus,
  proficiencyBonusForLevel,
  SKILL_ABILITY,
} from '../shared/dnd-rules.mjs';

test('ability modifier boundary scores', () => {
  assert.equal(abilityModifier('1'), -5);
  assert.equal(abilityModifier('10'), 0);
  assert.equal(abilityModifier('11'), 0);
  assert.equal(abilityModifier('20'), 5);
  assert.equal(abilityModifier('30'), 10);
  assert.equal(abilityModifier(''), null);
  assert.equal(abilityModifier('abc'), null);
});

test('proficiency bonus at every level breakpoint', () => {
  const expected = { 1: 2, 4: 2, 5: 3, 8: 3, 9: 4, 12: 4, 13: 5, 16: 5, 17: 6, 20: 6 };
  for (const [level, bonus] of Object.entries(expected)) {
    assert.equal(proficiencyBonusForLevel(String(level)), bonus, `livello ${level}`);
  }
  assert.equal(proficiencyBonusForLevel('non-interpretabile'), null);
});

test('saving throw value across the two competence states', () => {
  const base = { score: '16', level: '5', miscBonus: '' };
  assert.equal(computeSavingThrowValue({ ...base, proficient: false }), 3);
  assert.equal(computeSavingThrowValue({ ...base, proficient: true }), 6);
  assert.equal(computeSavingThrowValue({ ...base, proficient: true, miscBonus: '1' }), 7);
  assert.equal(computeSavingThrowValue({ ...base, proficient: true, miscBonus: 'x' }), null);
  assert.equal(computeSavingThrowValue({ score: '', proficient: false, level: '5', miscBonus: '' }), null);
});

test('skill value across the three competence levels', () => {
  const base = { score: '16', level: '5' };
  assert.equal(computeSkillValue({ ...base, proficiency: 'none', miscBonus: '' }), 3);
  assert.equal(computeSkillValue({ ...base, proficiency: 'proficient', miscBonus: '' }), 6);
  assert.equal(computeSkillValue({ ...base, proficiency: 'expertise', miscBonus: '' }), 9);
  assert.equal(computeSkillValue({ ...base, proficiency: 'expertise', miscBonus: '2' }), 11);
  assert.equal(computeSkillValue({ ...base, proficiency: 'expertise', miscBonus: 'nope' }), null);
  // A non-proficient skill does not consult the proficiency bonus, so an uninterpretable level does not block it.
  assert.equal(computeSkillValue({ score: '16', proficiency: 'none', level: 'nope', miscBonus: '' }), 3);
  assert.equal(computeSkillValue({ score: '16', proficiency: 'proficient', level: 'nope', miscBonus: '' }), null);
});

test('passive perception adds ten to the perception skill value', () => {
  assert.equal(computePassivePerception(4), 14);
  assert.equal(computePassivePerception(null), null);
});

test('initiative is the dexterity modifier plus its misc bonus', () => {
  assert.equal(computeInitiative({ dexScore: '16', miscBonus: '' }), 3);
  assert.equal(computeInitiative({ dexScore: '16', miscBonus: '2' }), 5);
  assert.equal(computeInitiative({ dexScore: '', miscBonus: '' }), null);
});

test('tool bonus follows the same formula as a skill', () => {
  assert.equal(computeToolBonus({ score: '14', proficiency: 'expertise', level: '9', miscBonus: '' }), 2 + 8);
});

test('attack bonus sums modifier, proficiency, magic bonus and additional bonus', () => {
  const base = { score: '16', level: '5', magicBonus: '1', bonus: '1' };
  assert.equal(computeAttackBonus({ ...base, proficient: false }), 3 + 1 + 1);
  assert.equal(computeAttackBonus({ ...base, proficient: true }), 3 + 3 + 1 + 1);
  assert.equal(computeAttackBonus({ score: '', proficient: true, level: '5', magicBonus: '', bonus: '' }), null);
});

test('damage modifier is null without a chosen ability', () => {
  assert.equal(computeDamageModifier({ score: '16', bonus: '2' }), 5);
  assert.equal(computeDamageModifier({ score: '', bonus: '2' }), null);
});

test('spellcasting DC and attack bonus require a chosen ability', () => {
  assert.equal(computeSpellSaveDc({ score: '16', level: '5', miscBonus: '' }), 14);
  assert.equal(computeSpellAttackBonus({ score: '16', level: '5', miscBonus: '' }), 6);
  assert.equal(computeSpellSaveDc({ score: '', level: '5', miscBonus: '' }), null);
  assert.equal(computeSpellAttackBonus({ score: '', level: '5', miscBonus: '' }), null);
});

test('every skill maps to one of the six abilities', () => {
  const abilities = new Set(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']);
  for (const ability of Object.values(SKILL_ABILITY)) assert.ok(abilities.has(ability));
});
