export const DICE_ROLL_SOUND_CUES = Object.freeze([
  Object.freeze({ delayMs: 0, src: '/dice-box/sounds/dicehit/dicehit_plastic8.mp3', volume: 0.78 }),
  Object.freeze({ delayMs: 130, src: '/dice-box/sounds/dicehit/dicehit_plastic11.mp3', volume: 0.68 }),
  Object.freeze({ delayMs: 340, src: '/dice-box/sounds/surfaces/surface_felt7.mp3', volume: 0.82 }),
]);

export function canPlayDiceSound({ soundEnabled, userActivated }) {
  return soundEnabled === true && userActivated === true;
}

function ignorePlaybackFailure(result) {
  if (result && typeof result.catch === 'function') result.catch(() => undefined);
}

export class DiceRollAudioController {
  constructor({
    createAudio,
    schedule = (callback, delayMs) => setTimeout(callback, delayMs),
    cancelSchedule = (timer) => clearTimeout(timer),
    cues = DICE_ROLL_SOUND_CUES,
  }) {
    this.createAudio = createAudio;
    this.schedule = schedule;
    this.cancelSchedule = cancelSchedule;
    this.cues = cues;
    this.timers = new Set();
    this.activeAudio = new Set();
  }

  start({ soundEnabled, userActivated }) {
    this.stop();
    if (!canPlayDiceSound({ soundEnabled, userActivated })) return false;

    for (const cue of this.cues) {
      let timer;
      timer = this.schedule(() => {
        this.timers.delete(timer);
        this.playCue(cue);
      }, cue.delayMs);
      this.timers.add(timer);
    }
    return true;
  }

  playCue(cue) {
    try {
      const audio = this.createAudio(cue.src);
      if (!audio) return;
      audio.volume = cue.volume;
      this.activeAudio.add(audio);
      const release = () => this.activeAudio.delete(audio);
      if (typeof audio.addEventListener === 'function') {
        audio.addEventListener('ended', release, { once: true });
        audio.addEventListener('error', release, { once: true });
      }
      ignorePlaybackFailure(audio.play?.());
    } catch {
      // L'audio è decorativo: la presentazione visiva deve proseguire.
    }
  }

  stop() {
    for (const timer of this.timers) this.cancelSchedule(timer);
    this.timers.clear();
    for (const audio of this.activeAudio) {
      try {
        audio.pause?.();
        audio.currentTime = 0;
      } catch {
        // Anche il cleanup audio non deve influenzare la coda dei tiri.
      }
    }
    this.activeAudio.clear();
  }
}
