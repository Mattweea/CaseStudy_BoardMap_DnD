import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import * as createRoles from '../database/migrations/20260914_002_create_roles.mjs';
import * as createUsers from '../database/migrations/20260914_003_create_users.mjs';
import * as createCampaigns from '../database/migrations/20260914_004_create_campaigns.mjs';
import * as createSheets from '../database/migrations/20260914_006_create_character_sheets.mjs';
import * as extendSheets from '../database/migrations/20260916_001_extend_character_sheets_for_p0_4.mjs';
import {
  computeInitiative, computeSavingThrowValue, computeSkillValue, computePassivePerception,
  computeSpellAttackBonus, computeSpellSaveDc, abilityModifier, proficiencyBonusForLevel,
} from '../shared/dnd-rules.mjs';
import { normalizeCharacterSheetData, validateCharacterSheetData } from '../server/character-sheet-schema.mjs';

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), 'vtt-character-sheet-migration-'));
  const db = new Database(join(directory, 'test.sqlite'));
  db.pragma('foreign_keys = ON');
  try {
    createRoles.up(db);
    createUsers.up(db);
    createCampaigns.up(db);
    createSheets.up(db);
    db.prepare('INSERT INTO campaigns (id, name, owner_user_id) VALUES (?, ?, ?)')
      .run('campaign-test', 'Test', 'master-user');
    run(db);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function columnNames(db) {
  return new Set(db.prepare('PRAGMA table_info(character_sheets)').all().map(({ name }) => name));
}

test('P0.4 migration applies, rolls back and reapplies', () => withDatabase((db) => {
  extendSheets.up(db);
  assert.ok(columnNames(db).has('portrait_file_name'));
  assert.throws(() => {
    const insert = db.prepare(`INSERT INTO character_sheets
      (id, owner_user_id, campaign_id, data_json) VALUES (?, ?, ?, ?)`);
    insert.run('sheet-a', 'player-ilthar', 'campaign-test', '{}');
    insert.run('sheet-b', 'player-ilthar', 'campaign-test', '{}');
  }, /UNIQUE constraint failed/);

  extendSheets.down(db);
  assert.equal(columnNames(db).has('portrait_file_name'), false);
  extendSheets.up(db);
  assert.ok(columnNames(db).has('portrait_updated_at'));
}));

test('P0.4 migration refuses existing duplicate sheets before altering the table', () => withDatabase((db) => {
  const insert = db.prepare(`INSERT INTO character_sheets
    (id, owner_user_id, campaign_id, data_json) VALUES (?, ?, ?, ?)`);
  insert.run('sheet-a', 'player-ilthar', 'campaign-test', '{}');
  insert.run('sheet-b', 'player-ilthar', 'campaign-test', '{}');

  assert.throws(() => extendSheets.up(db), /esistono 2 schede/);
  assert.equal(columnNames(db).has('portrait_file_name'), false);
}));

// P0.5 Fase A: la scheda in lettura ricostruisce gli input delle regole 5e da un documento
// scritto prima dell'introduzione dei valori calcolati, senza mai cambiare un totale visibile.

test('ability score is reconstructed from the legacy modifier only when the score is missing', () => {
  const scorePresent = normalizeCharacterSheetData({ character: { abilities: { strength: { score: '14', modifier: '99' } } } });
  assert.equal(scorePresent.character.abilities.strength.score, '14');

  const scoreMissing = normalizeCharacterSheetData({ character: { abilities: { dexterity: { modifier: '3' } } } });
  assert.equal(scoreMissing.character.abilities.dexterity.score, '16');

  const bothMissing = normalizeCharacterSheetData({ character: { abilities: { wisdom: {} } } });
  assert.equal(bothMissing.character.abilities.wisdom.score, '10');
});

test('level is reconstructed from the legacy proficiency bonus and falls back to 1 when uninterpretable', () => {
  const withLevel = normalizeCharacterSheetData({ character: { level: '9', proficiencyBonus: '99' } });
  assert.equal(withLevel.character.level, '9');

  const fromBonus = normalizeCharacterSheetData({ character: { proficiencyBonus: '4' } });
  assert.equal(fromBonus.character.level, '9');

  const uninterpretable = normalizeCharacterSheetData({ character: { level: 'non numerico', proficiencyBonus: 'anche questo' } });
  assert.equal(uninterpretable.character.level, '1');
});

test('misc bonus is the difference between the old value and the value recomputed from the new inputs', () => {
  const normalized = normalizeCharacterSheetData({
    character: {
      abilities: { dexterity: { score: '16' } },
      level: '5',
      savingThrows: { dexterity: { proficient: true, value: '9' } },
      skills: { stealth: { proficient: true, value: '10' } },
      initiativeModifier: '5',
    },
  });
  // Il livello 5 dà bonus di competenza 3; modificatore Destrezza 16 è +3.
  assert.equal(normalized.character.savingThrows.dexterity.miscBonus, '3');
  assert.equal(computeSavingThrowValue({ score: '16', proficient: true, level: '5', miscBonus: normalized.character.savingThrows.dexterity.miscBonus }), 9);
  assert.equal(normalized.character.skills.stealth.miscBonus, '4');
  assert.equal(computeSkillValue({ score: '16', proficiency: 'proficient', level: '5', miscBonus: normalized.character.skills.stealth.miscBonus }), 10);
  assert.equal(normalized.character.initiativeMiscBonus, '2');
  assert.equal(computeInitiative({ dexScore: '16', miscBonus: normalized.character.initiativeMiscBonus }), 5);
});

test('a non-integer legacy value leaves the misc bonus empty instead of guessing', () => {
  const normalized = normalizeCharacterSheetData({
    character: {
      savingThrows: { charisma: { proficient: false, value: 'forte' } },
      skills: { arcana: { proficient: false, value: '' } },
      initiativeModifier: '',
    },
  });
  assert.equal(normalized.character.savingThrows.charisma.miscBonus, '');
  assert.equal(normalized.character.skills.arcana.miscBonus, '');
  assert.equal(normalized.character.initiativeMiscBonus, '');
});

test('attacks and tools saved before the dedicated editors keep every entered value', () => {
  const normalized = normalizeCharacterSheetData({
    character: {
      attacks: [{ id: 'attack_0001', name: 'Spada corta', bonus: '+5', damageType: '1d6+3 perforante', notes: 'Finesse' }],
      tools: [{ id: 'tool_0001', name: 'Arnesi da scasso', proficiency: 'expertise', ability: 'dexterity', modifier: '+7' }],
    },
  });
  const attack = normalized.character.attacks[0];
  assert.equal(attack.name, 'Spada corta');
  assert.equal(attack.attackEnabled, true);
  assert.equal(attack.attackBonus, '+5');
  assert.equal(attack.damageEnabled, true);
  assert.equal(attack.damageDice, '1d6+3 perforante');
  assert.equal(attack.damageType, '');
  assert.equal(attack.description, 'Finesse');
  assert.equal(attack.critRange, '20');
  assert.equal(attack.saveEnabled, false);

  const tool = normalized.character.tools[0];
  assert.equal(tool.name, 'Arnesi da scasso');
  assert.equal(tool.proficiency, 'expertise');
  assert.equal(tool.ability, 'dexterity');
  assert.equal(tool.bonus, '+7');
  assert.deepEqual(validateCharacterSheetData(normalized), []);
});

test('recognizable spellcasting ability text keeps the same visible DC and attack bonus', () => {
  const normalized = normalizeCharacterSheetData({
    character: { abilities: { charisma: { score: '16' } }, level: '5' },
    spells: { spellcastingAbility: 'Carisma', saveDc: '15', attackBonus: '7' },
  });
  assert.equal(normalized.spells.spellcastingAbility, 'charisma');
  assert.equal(computeSpellSaveDc({ score: '16', level: '5', miscBonus: normalized.spells.saveDcMiscBonus }), 15);
  assert.equal(computeSpellAttackBonus({ score: '16', level: '5', miscBonus: normalized.spells.attackMiscBonus }), 7);
});

test('an unrecognizable spellcasting ability text is left unset instead of being reinterpreted', () => {
  const normalized = normalizeCharacterSheetData({
    character: { level: '5' },
    spells: { spellcastingAbility: 'Vigore interiore', saveDc: '15', attackBonus: '7' },
  });
  assert.equal(normalized.spells.spellcastingAbility, '');
  assert.equal(normalized.spells.saveDcMiscBonus, '');
  assert.equal(normalized.spells.attackMiscBonus, '');
});

test('a free-text hit dice type is recognized when possible and reset to unset otherwise', () => {
  const recognizable = normalizeCharacterSheetData({ character: { hitDice: { type: 'D8 (a mano libera)' } } });
  assert.equal(recognizable.character.hitDice.type, 'd8');
  const unrecognizable = normalizeCharacterSheetData({ character: { hitDice: { type: 'boh' } } });
  assert.equal(unrecognizable.character.hitDice.type, '');
});

test('death save counters land inside the 0-3 range', () => {
  const normalized = normalizeCharacterSheetData({ character: { deathSaves: { successes: '2', failures: 'II' } } });
  assert.equal(normalized.character.deathSaves.successes, '2');
  assert.equal(normalized.character.deathSaves.failures, '0');
});

test('every total visible before the change is identical after normalizing a hand-written legacy document', () => {
  const legacy = {
    character: {
      abilities: {
        strength: { modifier: '2' }, dexterity: { score: '16' }, constitution: { modifier: '1' },
        intelligence: { modifier: '0' }, wisdom: { modifier: '1' }, charisma: { score: '16' },
      },
      proficiencyBonus: '3',
      savingThrows: {
        strength: { proficient: false, value: '2' }, dexterity: { proficient: true, value: '6' },
        constitution: { proficient: true, value: '4' }, intelligence: { proficient: false, value: '0' },
        wisdom: { proficient: false, value: '1' }, charisma: { proficient: true, value: '6' },
      },
      skills: {
        acrobatics: { proficient: true, value: '6' }, animalHandling: { proficient: false, value: '1' },
        arcana: { proficient: false, value: '0' }, athletics: { proficient: false, value: '2' },
        deception: { proficient: false, value: '3' }, history: { proficient: false, value: '0' },
        insight: { proficient: false, value: '1' }, intimidation: { proficient: false, value: '3' },
        investigation: { proficient: false, value: '0' }, medicine: { proficient: false, value: '1' },
        nature: { proficient: false, value: '0' }, perception: { proficient: true, value: '4' },
        performance: { proficient: false, value: '3' }, persuasion: { proficient: false, value: '3' },
        religion: { proficient: false, value: '0' }, sleightOfHand: { proficient: false, value: '3' },
        stealth: { proficient: true, value: '6' }, survival: { proficient: false, value: '1' },
      },
      passivePerception: '14',
      initiativeModifier: '3',
    },
    spells: { spellcastingAbility: 'Carisma', saveDc: '14', attackBonus: '6' },
  };

  const normalized = normalizeCharacterSheetData(legacy);
  assert.deepEqual(validateCharacterSheetData(normalized), []);
  const level = normalized.character.level;

  for (const [key, oldEntry] of Object.entries(legacy.character.savingThrows)) {
    const score = normalized.character.abilities[key].score;
    const recomputed = computeSavingThrowValue({
      score, proficient: oldEntry.proficient, level, miscBonus: normalized.character.savingThrows[key].miscBonus,
    });
    assert.equal(recomputed, Number(oldEntry.value), `tiro salvezza ${key}`);
    assert.equal(normalized.character.savingThrows[key].proficient, oldEntry.proficient);
  }

  const skillAbility = {
    acrobatics: 'dexterity', animalHandling: 'wisdom', arcana: 'intelligence', athletics: 'strength',
    deception: 'charisma', history: 'intelligence', insight: 'wisdom', intimidation: 'charisma',
    investigation: 'intelligence', medicine: 'wisdom', nature: 'intelligence', perception: 'wisdom',
    performance: 'charisma', persuasion: 'charisma', religion: 'intelligence', sleightOfHand: 'dexterity',
    stealth: 'dexterity', survival: 'wisdom',
  };
  for (const [key, oldEntry] of Object.entries(legacy.character.skills)) {
    const score = normalized.character.abilities[skillAbility[key]].score;
    const proficiency = normalized.character.skills[key].proficiency;
    const recomputed = computeSkillValue({ score, proficiency, level, miscBonus: normalized.character.skills[key].miscBonus });
    assert.equal(recomputed, Number(oldEntry.value), `abilita ${key}`);
  }

  const perceptionValue = computeSkillValue({
    score: normalized.character.abilities.wisdom.score,
    proficiency: normalized.character.skills.perception.proficiency,
    level,
    miscBonus: normalized.character.skills.perception.miscBonus,
  });
  assert.equal(computePassivePerception(perceptionValue), Number(legacy.character.passivePerception));

  assert.equal(computeInitiative({ dexScore: normalized.character.abilities.dexterity.score, miscBonus: normalized.character.initiativeMiscBonus }), Number(legacy.character.initiativeModifier));

  assert.equal(normalized.spells.spellcastingAbility, 'charisma');
  const spellScore = normalized.character.abilities.charisma.score;
  assert.equal(computeSpellSaveDc({ score: spellScore, level, miscBonus: normalized.spells.saveDcMiscBonus }), Number(legacy.spells.saveDc));
  assert.equal(computeSpellAttackBonus({ score: spellScore, level, miscBonus: normalized.spells.attackMiscBonus }), Number(legacy.spells.attackBonus));

  // Sanity: le formule di base sono coerenti con il bonus di competenza dichiarato in origine.
  assert.equal(proficiencyBonusForLevel(level), 3);
  assert.equal(abilityModifier(normalized.character.abilities.dexterity.score), 3);
});
