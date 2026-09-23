import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DICE_PRESENTATION_PREFERENCES,
  DICE_PRESENTATION_PREFERENCES_STORAGE_KEY,
  parseDicePresentationPreferences,
  readDicePresentationPreferences,
  serializeDicePresentationPreferences,
  writeDicePresentationPreferences,
} from '../shared/dice-presentation-preferences.mjs';

test('usa default compatibili per valore assente, corrotto o di versione sconosciuta', () => {
  for (const rawValue of [null, '', '{', '{}', '{"version":2,"animationEnabled":false,"soundEnabled":false}', '{"version":1,"animationEnabled":false}']) {
    assert.deepEqual(parseDicePresentationPreferences(rawValue), DEFAULT_DICE_PRESENTATION_PREFERENCES);
  }
});

test('serializza e rilegge entrambe le preferenze come record versionato', () => {
  const preferences = { animationEnabled: false, soundEnabled: true };
  const encoded = serializeDicePresentationPreferences(preferences);
  assert.deepEqual(JSON.parse(encoded), { version: 1, ...preferences });
  assert.deepEqual(parseDicePresentationPreferences(encoded), preferences);
});

test('lettura e scrittura tollerano storage indisponibile o fallibile', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const preferences = { animationEnabled: true, soundEnabled: false };
  assert.equal(writeDicePresentationPreferences(storage, preferences), true);
  assert.equal(values.has(DICE_PRESENTATION_PREFERENCES_STORAGE_KEY), true);
  assert.deepEqual(readDicePresentationPreferences(storage), preferences);

  const brokenStorage = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('denied'); },
  };
  assert.deepEqual(readDicePresentationPreferences(brokenStorage), DEFAULT_DICE_PRESENTATION_PREFERENCES);
  assert.equal(writeDicePresentationPreferences(brokenStorage, preferences), false);
});
