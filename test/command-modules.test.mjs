import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMAND_MODULES, commandModulesFor } from '../src/constants/commandModules.ts';
import { CONDITION_ACCESS_KEYS, AURAS_ACCESS_KEY, STAND_UP_ACCESS_KEY } from '../src/utils/tokens.ts';

function allKeys(modules) {
  return modules.flatMap((module) => module.sections.flatMap((section) => section.entries.flatMap((entry) => entry.keys)));
}

test('i moduli sono in ordine e con id unici', () => {
  const ids = COMMAND_MODULES.map((module) => module.id);
  assert.deepEqual(ids, [
    'map',
    'movement',
    'measurement',
    'combat',
    'dice',
    'conditions',
    'auras',
    'hitPoints',
    'characterSheet',
    'mapManagement',
  ]);
  assert.equal(new Set(ids).size, ids.length);
});

test('commandModulesFor("player") non ha Gestione della mappa ne voci master', () => {
  const modules = commandModulesFor('player');
  assert.ok(!modules.some((module) => module.id === 'mapManagement'));
  for (const module of modules) {
    for (const section of module.sections) {
      for (const entry of section.entries) {
        assert.notEqual(entry.audience, 'master');
      }
    }
  }
});

test('commandModulesFor("master") ha tutti i moduli e nessuna voce player', () => {
  const modules = commandModulesFor('master');
  const ids = modules.map((module) => module.id);
  assert.deepEqual(ids, COMMAND_MODULES.map((module) => module.id));
  for (const module of modules) {
    for (const section of module.sections) {
      for (const entry of section.entries) {
        assert.notEqual(entry.audience, 'player');
      }
    }
  }
});

test('nessun modulo o sezione resta vuoto dopo il filtro per ruolo', () => {
  for (const role of ['master', 'player']) {
    const modules = commandModulesFor(role);
    for (const module of modules) {
      assert.ok(module.sections.length > 0, `${module.id} non deve restare senza sezioni`);
      for (const section of module.sections) {
        assert.ok(section.entries.length > 0, `una sezione di ${module.id} non deve restare senza voci`);
      }
    }
  }
});

test('i tasti del menu delle condizioni compaiono in Condizioni, Aure e Punti ferita per entrambi i ruoli', () => {
  const requiredKeys = [
    ...Object.values(CONDITION_ACCESS_KEYS),
    STAND_UP_ACCESS_KEY,
    AURAS_ACCESS_KEY,
    '0', '1', '2', '3', '4', '5', '6',
    '-', '+',
    'S', 'Shift+F10',
  ];

  for (const role of ['master', 'player']) {
    const modules = commandModulesFor(role);
    const relevant = modules.filter((module) => ['conditions', 'auras', 'hitPoints'].includes(module.id));
    const keys = allKeys(relevant);
    for (const requiredKey of new Set(requiredKeys)) {
      assert.ok(keys.includes(requiredKey), `manca ${requiredKey} per ${role}`);
    }
  }
});

test('gli strumenti di misura elencano R, P, C, O e L', () => {
  const module = COMMAND_MODULES.find((entry) => entry.id === 'measurement');
  const keys = allKeys([module]);
  for (const key of ['R', 'P', 'C', 'O', 'L']) {
    assert.ok(keys.includes(key));
  }
});

test('il modulo Dadi documenta /r e /rs', () => {
  const module = COMMAND_MODULES.find((entry) => entry.id === 'dice');
  const keys = allKeys([module]);
  assert.ok(keys.includes('/r'));
  assert.ok(keys.includes('/rs'));
});

test('nessuna voce + menziona la card Azioni superata', () => {
  for (const module of COMMAND_MODULES) {
    for (const section of module.sections) {
      for (const entry of section.entries) {
        if (entry.keys.includes('+')) {
          assert.ok(!/card Azioni/i.test(entry.text), `voce + superata trovata in ${module.id}`);
        }
      }
    }
  }
});
