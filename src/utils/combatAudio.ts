import type { CombatAudioPreferences } from '../../shared/combat-audio-preferences.mjs';

// Effetti sonori del combattimento (P0.8a), asset locali CC0: corno d'inizio da OpenGameArt
// (StumpyStrust), «Sei il prossimo!» da Kenney Interface Sounds, tamburi di «Tocca a te!»
// sintetizzati per il progetto. Solo presentazione: nessun suono influisce sullo stato o sulla
// comparsa degli avvisi.
const COMBAT_SOUND_URLS = {
  'combat-start': '/media/audio/combat-start.ogg',
  'turn-next': '/media/audio/turn-next.ogg',
  'turn-now': '/media/audio/turn-now.ogg',
} as const;

export type CombatSound = keyof typeof COMBAT_SOUND_URLS;

// Riproduce un suono solo dopo un'interazione affidabile con la pagina e secondo le preferenze
// locali. Un rifiuto di `play()` (autoplay bloccato, formato non supportato) resta silenzioso.
export function playCombatSound(sound: CombatSound, preferences: CombatAudioPreferences, hasUserActivated: boolean) {
  if (!preferences.enabled || preferences.volume <= 0 || !hasUserActivated) return;
  try {
    const audio = new Audio(COMBAT_SOUND_URLS[sound]);
    audio.volume = preferences.volume;
    const playback = audio.play();
    if (playback && typeof playback.catch === 'function') playback.catch(() => {});
  } catch {
    // L'avviso visivo compare comunque.
  }
}
