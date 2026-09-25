import { useEffect, useState } from 'react';
import {
  readCombatAudioPreferences,
  writeCombatAudioPreferences,
  type CombatAudioPreferences,
} from '../../shared/combat-audio-preferences.mjs';

export type { CombatAudioPreferences };

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useCombatAudioPreferences() {
  const [preferences, setPreferences] = useState<CombatAudioPreferences>(
    () => readCombatAudioPreferences(getLocalStorage()),
  );

  useEffect(() => {
    writeCombatAudioPreferences(getLocalStorage(), preferences);
  }, [preferences]);

  return {
    preferences,
    setEnabled: (enabled: boolean) => {
      setPreferences((current) => ({ ...current, enabled }));
    },
    setVolume: (volume: number) => {
      setPreferences((current) => ({ ...current, volume: Math.min(1, Math.max(0, volume)) }));
    },
  };
}
