import assert from 'node:assert/strict';
import test from 'node:test';
import { CharacterSheetPolicy } from '../server/character-sheet-policy.mjs';
import { CharacterSheetService, CharacterSheetError } from '../server/character-sheet-service.mjs';
import { createInitialCharacterSheetData, createAttack, createTool } from '../server/character-sheet-schema.mjs';
import { rollCharacterSheetTarget, __testables } from '../server/character-sheet-roll-resolver.mjs';

const { resolveTargetPlan } = __testables;

function baseData() {
  const data = createInitialCharacterSheetData();
  data.character.name = 'Vesuth';
  data.character.level = '5';
  data.character.abilities.strength.score = '16';
  data.character.abilities.dexterity.score = '14';
  data.character.savingThrows.strength = { proficient: true, miscBonus: '' };
  data.character.skills.stealth = { proficiency: 'expertise', miscBonus: '1' };
  data.character.initiativeMiscBonus = '2';
  data.character.hitDice = { type: 'd8', total: '5', remaining: '3' };
  data.character.deathSaves = { successes: '0', failures: '0' };
  data.character.tools = [createTool({ id: 'tool_0001', name: 'Arnesi da scasso', proficiency: 'proficient', ability: 'dexterity', bonus: '' })];
  data.character.attacks = [createAttack({
    id: 'attack_0001', name: 'Spada corta',
    attackEnabled: true, attackAbility: 'strength', attackBonus: '', attackProficient: true, magicBonus: '', critRange: '20',
    damageEnabled: true, damageDice: '1d6', damageAbility: 'strength', damageBonus: '',
    damage2Enabled: false,
    saveEnabled: false,
  })];
  return data;
}

// harness() mirrors test/character-sheet-service.test.mjs so applyPatch's version control,
// SSE emit and debounce scheduling are exercised through the real service, not a stub.
function harness(data = baseData()) {
  const initial = { id: 'sheet-1', ownerUserId: 'player-1', campaignId: 'campaign-1', version: 1, data, portraitFileName: null, portraitMediaType: null, portraitUpdatedAt: null };
  let stored = structuredClone(initial);
  const events = [];
  const repository = {
    findById: () => structuredClone(stored),
    saveVersion: ({ expectedVersion, version, data: nextData }) => {
      if (stored.version !== expectedVersion) return null;
      stored = { ...stored, version, data: structuredClone(nextData) };
      return structuredClone(stored);
    },
  };
  const service = new CharacterSheetService({
    repository,
    policy: new CharacterSheetPolicy(),
    schedule: () => null,
    cancel: () => {},
    emit: (event) => events.push(event),
  });
  return { service, events, getStored: () => stored };
}

const owner = { id: 'player-1', role: 'adventurer', displayName: 'Vesuth' };
const otherAdventurer = { id: 'player-2', role: 'adventurer', displayName: 'Thalendir' };
const master = { id: 'master-1', role: 'master', displayName: 'Master' };

// Small uint32 values chosen so the shared rejection sampler maps them to the desired faces;
// a queue lets a test script an exact sequence without ever reaching the rejected tail.
function queueRng(desiredFaces) {
  const values = [...desiredFaces];
  return () => {
    const next = values.shift();
    if (next === undefined) throw new Error('rng queue exhausted');
    return next - 1;
  };
}

test('1.1 resolves ability, saving throw, skill and initiative modifiers from live sheet fields', () => {
  const data = baseData();
  const ability = resolveTargetPlan(data, 'ability:strength');
  assert.equal(ability.group.modifier, 3); // (16-10)/2
  assert.equal(ability.actionLabel, 'Prova di Forza');

  const saving = resolveTargetPlan(data, 'saving-throw:strength');
  assert.equal(saving.group.modifier, 6); // +3 mod +3 proficiency (level 5)

  const skill = resolveTargetPlan(data, 'skill:stealth');
  // dexterity 14 -> mod +2; expertise at level 5 = proficiency bonus 3 * 2 = 6; +1 misc = 9
  assert.equal(skill.group.modifier, 2 + 6 + 1);

  const initiative = resolveTargetPlan(data, 'initiative');
  assert.equal(initiative.group.modifier, 2 + 2); // dex mod +2, misc +2

  const tool = resolveTargetPlan(data, 'tool:tool_0001');
  assert.equal(tool.group.modifier, 2 + 3); // dex mod +2, proficiency bonus +3
  assert.equal(tool.actionLabel, 'Arnesi da scasso');
});

test('1.1 rejects an uninterpretable value without inventing a number', () => {
  const data = baseData();
  data.character.skills.stealth.miscBonus = 'non-numerico';
  const plan = resolveTargetPlan(data, 'skill:stealth');
  assert.ok(plan.error);

  const unknownTool = resolveTargetPlan(data, 'tool:missing');
  assert.ok(unknownTool.error);
});

test('1.2 resolves hit dice and death saves as single rolls (no advantage/disadvantage), and rejects a missing type or exhausted pool', () => {
  const data = baseData();
  const withDice = resolveTargetPlan(data, 'hit-dice');
  assert.equal(withDice.group.sides, 8);
  assert.equal(withDice.dual, false);
  assert.equal(withDice.sideEffect.kind, 'hit-dice');

  const deathSave = resolveTargetPlan(data, 'death-saves');
  assert.equal(deathSave.dual, false);

  data.character.hitDice.type = '';
  assert.ok(resolveTargetPlan(data, 'hit-dice').error);

  data.character.hitDice.type = 'd8';
  data.character.hitDice.remaining = '0';
  assert.ok(resolveTargetPlan(data, 'hit-dice').error);
});

test('1.3 a reader without access to the sheet is rejected before any dice are generated', () => {
  const { service } = harness();
  const result = rollCharacterSheetTarget(otherAdventurer, service, {
    source: { sheetId: 'sheet-1', target: 'ability:strength' },
  });
  assert.ok(result.error);
  assert.equal(result.log, undefined);
});

test('every d20 target rolls two independent dice, not a pre-picked advantage/disadvantage', () => {
  const { service } = harness();
  const result = rollCharacterSheetTarget(owner, service, {
    source: { sheetId: 'sheet-1', target: 'ability:strength' },
  }, { rng: queueRng([5, 18]) });
  assert.deepEqual(result.log.rolls, [5, 18]);
  assert.equal(result.log.total, 5 + 3); // first roll is canonical for the top-level total
  assert.equal(result.log.modifier, 3);
  assert.deepEqual(result.log.dice.map((die) => die.disposition), ['unresolved', 'unresolved']);
});

test('a roll from the sheet defaults to public and respects an explicit secret visibility', () => {
  const { service } = harness();
  const defaulted = rollCharacterSheetTarget(owner, service, {
    source: { sheetId: 'sheet-1', target: 'ability:strength' },
  }, { rng: queueRng([5, 18]) });
  assert.equal(defaulted.log.visibility, 'public');

  const secret = rollCharacterSheetTarget(owner, service, {
    source: { sheetId: 'sheet-1', target: 'ability:strength' }, visibility: 'secret',
  }, { rng: queueRng([5, 18]) });
  assert.equal(secret.log.visibility, 'secret');
});

test('hit dice stays a single roll (not a d20, no dual roll)', () => {
  const { service } = harness();
  const result = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'hit-dice' } }, { rng: queueRng([5]) });
  assert.deepEqual(result.log.rolls, [5]);
});

test('2.1 the attack target rolls only the to-hit dice, no damage attached', () => {
  const { service } = harness();
  const result = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'attack:attack_0001' } }, { rng: queueRng([10, 3]) });
  assert.equal('parts' in result.log, false);
  assert.deepEqual(result.log.rolls, [10, 3]);
  assert.equal(result.log.modifier, 3 + 3); // strength mod +3, proficient +3
});

test('2.1/2.3 an attack roll flags critical when either of the two d20 hits the threshold, and carries the saving throw as metadata', () => {
  const data = baseData();
  data.character.attacks[0].saveEnabled = true;
  data.character.attacks[0].saveAbility = 'wisdom';
  data.character.attacks[0].saveDc = '13';
  const { service } = harness(data);

  const critOnFirst = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'attack:attack_0001' } }, { rng: queueRng([20, 5]) });
  assert.equal(critOnFirst.log.critical, true);
  assert.deepEqual(critOnFirst.log.savingThrow, { ability: 'wisdom', dc: '13' });

  const critOnSecond = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'attack:attack_0001' } }, { rng: queueRng([5, 20]) });
  assert.equal(critOnSecond.log.critical, true);

  const noCrit = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'attack:attack_0001' } }, { rng: queueRng([10, 15]) });
  assert.equal(noCrit.log.critical, false);
});

test('2.1 attack-damage resolves one active block, and both blocks when the second is enabled', () => {
  const data = baseData();
  const single = resolveTargetPlan(data, 'attack-damage:attack_0001');
  assert.equal(single.groups.length, 1);
  assert.equal(single.dual, false);

  data.character.attacks[0].damage2Enabled = true;
  data.character.attacks[0].damage2Dice = '1d4';
  data.character.attacks[0].damage2Ability = 'strength';
  const both = resolveTargetPlan(data, 'attack-damage:attack_0001');
  assert.equal(both.groups.length, 2);
});

test('2.2 a critical damage roll doubles the dice and leaves the modifier untouched, without being asked twice', () => {
  const data = baseData();
  const { service } = harness(data);

  const normal = rollCharacterSheetTarget(owner, service, {
    source: { sheetId: 'sheet-1', target: 'attack-damage:attack_0001' },
  }, { rng: queueRng([4]) });
  assert.equal(normal.log.critical, false);
  assert.equal(normal.log.rolls.length, 1);
  assert.equal(normal.log.total, 4 + 3); // strength mod +3

  const critical = rollCharacterSheetTarget(owner, service, {
    source: { sheetId: 'sheet-1', target: 'attack-damage:attack_0001' }, critical: true,
  }, { rng: queueRng([2, 4]) });
  assert.equal(critical.log.critical, true);
  assert.equal(critical.log.rolls.length, 2); // 1d6 doubled to 2 independent d6
  assert.deepEqual(critical.log.rolls, [2, 4]);
  assert.equal(critical.log.total, 2 + 4 + 3); // modifier applied once, not doubled
});

test('2.2 a critical damage roll with two active blocks doubles each block independently, in separate parts', () => {
  const data = baseData();
  data.character.attacks[0].damage2Enabled = true;
  data.character.attacks[0].damage2Dice = '1d4';
  data.character.attacks[0].damage2Ability = 'strength';
  const { service } = harness(data);

  const result = rollCharacterSheetTarget(owner, service, {
    source: { sheetId: 'sheet-1', target: 'attack-damage:attack_0001' }, critical: true,
  }, { rng: queueRng([2, 4, 1, 3]) });
  assert.equal(result.log.parts.length, 2);
  assert.equal(result.log.parts[0].rolls.length, 2); // 1d6 -> 2d6 worth of independent rolls
  assert.equal(result.log.parts[1].rolls.length, 2); // 1d4 -> 2d4 worth of independent rolls
  assert.ok(result.log.parts.every((part) => part.critical === true));
  assert.equal(result.log.dice.length, 4);
  assert.ok(result.log.dice.every((die) => die.disposition === 'kept'));
  assert.equal(new Set(result.log.dice.slice(0, 2).map((die) => die.groupId)).size, 1);
  assert.notEqual(result.log.dice[0].groupId, result.log.dice[2].groupId);
});

test('3.4 the log carries the character, the action and a source reference usable to roll damage again', () => {
  const { service } = harness();
  const attackRoll = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'attack:attack_0001' } }, { rng: queueRng([10, 3]) });
  assert.equal(attackRoll.log.characterName, 'Vesuth');
  assert.equal(attackRoll.log.actionLabel, 'Attacco — Spada corta');
  assert.deepEqual(attackRoll.log.source, { sheetId: 'sheet-1', target: 'attack:attack_0001' });

  const stealth = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'skill:stealth' } }, { rng: queueRng([12, 8]) });
  assert.equal(stealth.log.actionLabel, 'Prova di Furtività');
  assert.notEqual(stealth.log.actionLabel, attackRoll.log.actionLabel);
});

test('3.5 rejects an unreadable target, an exhausted hit dice pool, a decided death save and an attack with no active damage block', () => {
  const data = baseData();
  data.character.skills.stealth.miscBonus = 'x';
  data.character.hitDice.remaining = '0';
  data.character.deathSaves = { successes: '3', failures: '0' };
  data.character.attacks[0].damageEnabled = false;
  const { service } = harness(data);

  const badValue = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'skill:stealth' } });
  assert.ok(badValue.error);
  assert.equal(badValue.log, undefined);

  const exhaustedDice = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'hit-dice' } });
  assert.ok(exhaustedDice.error);

  const decidedDeathSave = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'death-saves' } });
  assert.ok(decidedDeathSave.error);

  const noDamageBlock = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'attack-damage:attack_0001' } });
  assert.ok(noDamageBlock.error);
});

test('4.1 an accepted hit dice roll decrements the pool through the same patch/version/SSE chain', () => {
  const { service, events } = harness();
  const result = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'hit-dice' } }, { rng: queueRng([5]) });
  assert.equal(result.log.rolls[0], 5);
  assert.equal(result.log.dice[0].value, 5);
  assert.equal(service.get(owner, 'sheet-1').data.character.hitDice.remaining, '2');
  assert.equal(events.at(-1).type, 'character-sheet-patch');
});

test('4.2 a death save is a single roll (no advantage/disadvantage in 5e) and fills the matching pip, stopping at the third', () => {
  const { service } = harness();
  const failure = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'death-saves' } }, { rng: queueRng([4]) });
  assert.deepEqual(failure.log.rolls, [4]);
  assert.equal(service.get(owner, 'sheet-1').data.character.deathSaves.failures, '1');

  const success = rollCharacterSheetTarget(owner, service, { source: { sheetId: 'sheet-1', target: 'death-saves' } }, { rng: queueRng([15]) });
  assert.equal(service.get(owner, 'sheet-1').data.character.deathSaves.successes, '1');
  assert.notEqual(success.log, undefined);
});

test('4.3 a rejected side-effect patch aborts the request before any log entry is produced', () => {
  const { service } = harness();
  const failingApply = {
    get: (...args) => service.get(...args),
    applyPatch: () => { throw new CharacterSheetError('Salvataggio della scheda non riuscito.', 503); },
  };
  const result = rollCharacterSheetTarget(owner, failingApply, { source: { sheetId: 'sheet-1', target: 'hit-dice' } }, { rng: queueRng([5]) });
  assert.ok(result.error);
  assert.equal(result.log, undefined);
  assert.equal(service.get(owner, 'sheet-1').data.character.hitDice.remaining, '3'); // unchanged
});

test('4.3 a concurrent same-path update makes the side effect stale and leaves no phantom log', () => {
  const { service } = harness();
  let raced = false;
  const racingService = {
    get: (...args) => {
      const stale = service.get(...args);
      if (!raced) {
        raced = true;
        service.applyPatch(owner, 'sheet-1', {
          baseVersion: stale.version,
          operations: [{ op: 'set', path: 'character.hitDice.remaining', value: '2' }],
        });
      }
      return stale;
    },
    applyPatch: (...args) => service.applyPatch(...args),
  };

  const result = rollCharacterSheetTarget(owner, racingService, {
    source: { sheetId: 'sheet-1', target: 'hit-dice' },
  }, { rng: queueRng([5]) });
  assert.ok(result.error);
  assert.equal(result.log, undefined);
  assert.equal(service.get(owner, 'sheet-1').data.character.hitDice.remaining, '2');
});

test('a master can roll on a sheet they do not own', () => {
  const { service } = harness();
  const result = rollCharacterSheetTarget(master, service, { source: { sheetId: 'sheet-1', target: 'ability:strength' } }, { rng: queueRng([9, 2]) });
  assert.deepEqual(result.log.rolls, [9, 2]);
});
