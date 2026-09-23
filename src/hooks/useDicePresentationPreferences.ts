import { useEffect, useState } from 'react';
import {
  readDicePresentationPreferences,
  writeDicePresentationPreferences,
} from '../../shared/dice-presentation-preferences.mjs';

export interface DicePresentationPreferences {
  animationEnabled: boolean;
  soundEnabled: boolean;
}

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useDicePresentationPreferences() {
  const [preferences, setPreferences] = useState<DicePresentationPreferences>(
    () => readDicePresentationPreferences(getLocalStorage()),
  );

  useEffect(() => {
    writeDicePresentationPreferences(getLocalStorage(), preferences);
  }, [preferences]);

  return {
    preferences,
    setAnimationEnabled: (animationEnabled: boolean) => {
      setPreferences((current) => ({ ...current, animationEnabled }));
    },
    setSoundEnabled: (soundEnabled: boolean) => {
      setPreferences((current) => ({ ...current, soundEnabled }));
    },
  };
}
