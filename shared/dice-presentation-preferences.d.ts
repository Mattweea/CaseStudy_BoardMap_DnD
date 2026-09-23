export interface DicePresentationPreferences {
  animationEnabled: boolean;
  soundEnabled: boolean;
}

export interface DicePresentationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DICE_PRESENTATION_PREFERENCES_VERSION: 1;
export const DICE_PRESENTATION_PREFERENCES_STORAGE_KEY: string;
export const DEFAULT_DICE_PRESENTATION_PREFERENCES: Readonly<DicePresentationPreferences>;

export function parseDicePresentationPreferences(rawValue: unknown): DicePresentationPreferences;
export function serializeDicePresentationPreferences(preferences: unknown): string;
export function readDicePresentationPreferences(storage: DicePresentationStorage | null): DicePresentationPreferences;
export function writeDicePresentationPreferences(
  storage: DicePresentationStorage | null,
  preferences: DicePresentationPreferences,
): boolean;
