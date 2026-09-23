export const DICE_PRESENTATION_PREFERENCES_VERSION = 1;
export const DICE_PRESENTATION_PREFERENCES_STORAGE_KEY = 'dnd-battle-map:dice-presentation';
export const DEFAULT_DICE_PRESENTATION_PREFERENCES = Object.freeze({
  animationEnabled: true,
  soundEnabled: true,
});

function defaults() {
  return { ...DEFAULT_DICE_PRESENTATION_PREFERENCES };
}

export function parseDicePresentationPreferences(rawValue) {
  if (typeof rawValue !== 'string' || rawValue.length === 0) return defaults();

  try {
    const value = JSON.parse(rawValue);
    if (
      !value
      || typeof value !== 'object'
      || value.version !== DICE_PRESENTATION_PREFERENCES_VERSION
      || typeof value.animationEnabled !== 'boolean'
      || typeof value.soundEnabled !== 'boolean'
    ) {
      return defaults();
    }

    return {
      animationEnabled: value.animationEnabled,
      soundEnabled: value.soundEnabled,
    };
  } catch {
    return defaults();
  }
}

export function serializeDicePresentationPreferences(preferences) {
  const normalized = (
    preferences
    && typeof preferences.animationEnabled === 'boolean'
    && typeof preferences.soundEnabled === 'boolean'
  ) ? preferences : DEFAULT_DICE_PRESENTATION_PREFERENCES;

  return JSON.stringify({
    version: DICE_PRESENTATION_PREFERENCES_VERSION,
    animationEnabled: normalized.animationEnabled,
    soundEnabled: normalized.soundEnabled,
  });
}

export function readDicePresentationPreferences(storage) {
  if (!storage || typeof storage.getItem !== 'function') return defaults();
  try {
    return parseDicePresentationPreferences(
      storage.getItem(DICE_PRESENTATION_PREFERENCES_STORAGE_KEY),
    );
  } catch {
    return defaults();
  }
}

export function writeDicePresentationPreferences(storage, preferences) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(
      DICE_PRESENTATION_PREFERENCES_STORAGE_KEY,
      serializeDicePresentationPreferences(preferences),
    );
    return true;
  } catch {
    return false;
  }
}
