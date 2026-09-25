export interface CombatAudioPreferences {
  enabled: boolean;
  volume: number;
}

export interface CombatAudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const COMBAT_AUDIO_PREFERENCES_VERSION: 1;
export const COMBAT_AUDIO_PREFERENCES_STORAGE_KEY: string;
export const DEFAULT_COMBAT_AUDIO_PREFERENCES: Readonly<CombatAudioPreferences>;

export function parseCombatAudioPreferences(rawValue: unknown): CombatAudioPreferences;
export function serializeCombatAudioPreferences(preferences: unknown): string;
export function readCombatAudioPreferences(storage: CombatAudioStorage | null): CombatAudioPreferences;
export function writeCombatAudioPreferences(
  storage: CombatAudioStorage | null,
  preferences: CombatAudioPreferences,
): boolean;
