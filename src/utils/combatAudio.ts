import type { CombatAudioPreferences } from '../../shared/combat-audio-preferences.mjs';
import combatStartUrl from '../assets/audio/combat-start-dd.mp3?url';
import turnNoticeUrl from '../assets/audio/turn-notice-dd.mp3?url';

// Campioni scelti dal Master, autorizzati per la consegna ai browser dei partecipanti.
// Solo presentazione: nessun suono influisce sullo stato o sulla comparsa degli avvisi.
const COMBAT_SOUND_URLS = {
  'combat-start': combatStartUrl,
  'turn-next': turnNoticeUrl,
  'turn-now': turnNoticeUrl,
} as const;

// Il campione di turno è circa 7,6 LUFS più forte di quello d'ingresso.
const TURN_NOTICE_GAIN = 0.42;

export type CombatSound = keyof typeof COMBAT_SOUND_URLS;

// Riproduce un suono solo dopo un'interazione affidabile con la pagina e secondo le preferenze
// locali. Un rifiuto di `play()` (autoplay bloccato, formato non supportato) resta silenzioso.
export function playCombatSound(sound: CombatSound, preferences: CombatAudioPreferences, hasUserActivated: boolean) {
  if (!preferences.enabled || preferences.volume <= 0 || !hasUserActivated) return;
  try {
    const audio = new Audio(COMBAT_SOUND_URLS[sound]);
    audio.volume = preferences.volume * (sound === 'combat-start' ? 1 : TURN_NOTICE_GAIN);
    const playback = audio.play();
    if (playback && typeof playback.catch === 'function') playback.catch(() => {});
  } catch {
    // L'avviso visivo compare comunque.
  }
}
