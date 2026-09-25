// Preferenze audio di combattimento (P0.8a): locali al browser, mai nello stato condiviso.
// Stesso modello di `dice-presentation-preferences.mjs`: record versionato, default per ogni
// valore assente o non valido, storage che può mancare o fallire.
export const COMBAT_AUDIO_PREFERENCES_VERSION = 1;
export const COMBAT_AUDIO_PREFERENCES_STORAGE_KEY = 'dnd-battle-map:combat-audio';
export const DEFAULT_COMBAT_AUDIO_PREFERENCES = Object.freeze({
  enabled: true,
  volume: 0.6,
});

function defaults() {
  return { ...DEFAULT_COMBAT_AUDIO_PREFERENCES };
}

function isValidVolume(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isValidPreferences(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.enabled === 'boolean' && isValidVolume(value.volume);
}

export function parseCombatAudioPreferences(rawValue) {
  if (typeof rawValue !== 'string' || rawValue.length === 0) return defaults();
  try {
    const value = JSON.parse(rawValue);
    if (!isValidPreferences(value) || value.version !== COMBAT_AUDIO_PREFERENCES_VERSION) return defaults();
    return { enabled: value.enabled, volume: value.volume };
  } catch {
    return defaults();
  }
}

export function serializeCombatAudioPreferences(preferences) {
  const normalized = isValidPreferences(preferences) ? preferences : DEFAULT_COMBAT_AUDIO_PREFERENCES;
  return JSON.stringify({
    version: COMBAT_AUDIO_PREFERENCES_VERSION,
    enabled: normalized.enabled,
    volume: normalized.volume,
  });
}

export function readCombatAudioPreferences(storage) {
  if (!storage || typeof storage.getItem !== 'function') return defaults();
  try {
    return parseCombatAudioPreferences(storage.getItem(COMBAT_AUDIO_PREFERENCES_STORAGE_KEY));
  } catch {
    return defaults();
  }
}

export function writeCombatAudioPreferences(storage, preferences) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(COMBAT_AUDIO_PREFERENCES_STORAGE_KEY, serializeCombatAudioPreferences(preferences));
    return true;
  } catch {
    return false;
  }
}
