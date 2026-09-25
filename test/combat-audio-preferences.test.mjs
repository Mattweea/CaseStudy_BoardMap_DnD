import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMBAT_AUDIO_PREFERENCES_STORAGE_KEY,
  DEFAULT_COMBAT_AUDIO_PREFERENCES,
  parseCombatAudioPreferences,
  readCombatAudioPreferences,
  serializeCombatAudioPreferences,
  writeCombatAudioPreferences,
} from '../shared/combat-audio-preferences.mjs';

test('i default sono suono attivo e volume 0.6', () => {
  assert.deepEqual(DEFAULT_COMBAT_AUDIO_PREFERENCES, { enabled: true, volume: 0.6 });
});

test('usa i default per valore assente, corrotto, di versione sconosciuta o fuori dominio', () => {
  for (const rawValue of [
    null, '', '{', '{}',
    '{"version":2,"enabled":false,"volume":0.2}',
    '{"version":1,"enabled":false}',
    '{"version":1,"enabled":"no","volume":0.2}',
    '{"version":1,"enabled":false,"volume":1.5}',
    '{"version":1,"enabled":false,"volume":-0.1}',
  ]) {
    assert.deepEqual(parseCombatAudioPreferences(rawValue), DEFAULT_COMBAT_AUDIO_PREFERENCES, String(rawValue));
  }
});

test('serializza e rilegge silenziamento e volume come record versionato', () => {
  const preferences = { enabled: false, volume: 0.25 };
  const encoded = serializeCombatAudioPreferences(preferences);
  assert.deepEqual(JSON.parse(encoded), { version: 1, ...preferences });
  assert.deepEqual(parseCombatAudioPreferences(encoded), preferences);
  assert.deepEqual(JSON.parse(serializeCombatAudioPreferences({ enabled: true, volume: 7 })), { version: 1, ...DEFAULT_COMBAT_AUDIO_PREFERENCES });
});

test('lettura e scrittura tollerano storage indisponibile o fallibile', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const preferences = { enabled: true, volume: 1 };
  assert.equal(writeCombatAudioPreferences(storage, preferences), true);
  assert.equal(values.has(COMBAT_AUDIO_PREFERENCES_STORAGE_KEY), true);
  assert.deepEqual(readCombatAudioPreferences(storage), preferences);

  const brokenStorage = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('denied'); },
  };
  assert.deepEqual(readCombatAudioPreferences(brokenStorage), DEFAULT_COMBAT_AUDIO_PREFERENCES);
  assert.equal(writeCombatAudioPreferences(brokenStorage, preferences), false);
  assert.deepEqual(readCombatAudioPreferences(null), DEFAULT_COMBAT_AUDIO_PREFERENCES);
  assert.equal(writeCombatAudioPreferences(null, preferences), false);
});
