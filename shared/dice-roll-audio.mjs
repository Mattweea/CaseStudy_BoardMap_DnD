// Il rumore reale di dadi che rotolano non e' un suono continuo: e' una raffica di impatti
// discreti che si dirada man mano che i dadi perdono energia. Un singolo campione in loop
// suonerebbe come un drone e farebbe sentire la giunzione a ogni ripetizione, percio' la
// sequenza e' generata: due cue di apertura per il lancio, poi impatti seminati a intervalli
// crescenti finche' stop() non arriva. La durata non e' nota in anticipo (roll() risolve solo
// a dadi fermi), quindi lo scheduler resta aperto invece di programmare una coda finita.

export const DICE_ROLL_OPENING_CUES = Object.freeze([
  Object.freeze({ delayMs: 0, src: '/dice-box/sounds/dicehit/dicehit_plastic8.mp3', volume: 0.78 }),
  Object.freeze({ delayMs: 70, src: '/dice-box/sounds/surfaces/surface_felt7.mp3', volume: 0.54 }),
  Object.freeze({ delayMs: 130, src: '/dice-box/sounds/dicehit/dicehit_plastic11.mp3', volume: 0.68 }),
]);

export const DICE_IMPACT_SAMPLES = Object.freeze([
  '/dice-box/sounds/dicehit/dicehit_plastic1.mp3',
  '/dice-box/sounds/dicehit/dicehit_plastic3.mp3',
  '/dice-box/sounds/dicehit/dicehit_plastic5.mp3',
  '/dice-box/sounds/dicehit/dicehit_plastic7.mp3',
  '/dice-box/sounds/dicehit/dicehit_plastic8.mp3',
  '/dice-box/sounds/dicehit/dicehit_plastic11.mp3',
  '/dice-box/sounds/dicehit/dicehit_plastic13.mp3',
  '/dice-box/sounds/dicehit/dicehit_plastic15.mp3',
  '/dice-box/sounds/surfaces/surface_felt2.mp3',
  '/dice-box/sounds/surfaces/surface_felt5.mp3',
]);

export const DICE_SCATTER_PROFILE = Object.freeze({
  // Lo scatter parte dopo le cue di apertura, cosi' il lancio resta netto.
  startMs: 150,
  // Intervallo fra impatti: fitto all'inizio, rado quando i dadi si assestano.
  minGapMs: 52,
  maxGapMs: 240,
  // Sopra questa soglia i dadi sono fermi: densita' e volume restano al minimo.
  rampMs: 1800,
  startVolume: 0.5,
  endVolume: 0.1,
  // Scarto casuale applicato a intervallo e volume perche' la raffica non suoni meccanica.
  jitter: 0.3,
  // Piu' dadi, piu' collisioni: la densita' cresce sotto radice, non linearmente.
  maxDensityFactor: 3.2,
  // Oltre questo numero di sorgenti simultanee la raffica impasta invece di definirsi.
  maxConcurrent: 6,
});

// Cannon porta un corpo a SLEEPY appena scende sotto la soglia di velocita', ma a SLEEPING solo
// dopo sleepTimeLimit continuativi, che in questa scena vale 0.9s. throwFinished() aspetta
// SLEEPING, quindi la promise di roll() arriva quasi un secondo dopo che i dadi si sono
// visibilmente fermati: troppo tardi per il suono, che deve seguire l'occhio e non il
// rilevamento fisico. SLEEPY e' l'istante giusto.
export const CANNON_SLEEPY = 1;

export function diceLookStill(diceList) {
  if (!Array.isArray(diceList) || diceList.length === 0) return false;
  return diceList.every((die) => {
    const sleepState = die?.body?.sleepState;
    return typeof sleepState === 'number' && sleepState >= CANNON_SLEEPY;
  });
}

export function canPlayDiceSound({ soundEnabled, userActivated }) {
  return soundEnabled === true && userActivated === true;
}

function ignorePlaybackFailure(result) {
  if (result && typeof result.catch === 'function') result.catch(() => undefined);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export class DiceRollAudioController {
  constructor({
    createAudio,
    schedule = (callback, delayMs) => setTimeout(callback, delayMs),
    cancelSchedule = (timer) => clearTimeout(timer),
    now = () => Date.now(),
    random = Math.random,
    cues = DICE_ROLL_OPENING_CUES,
    impactSamples = DICE_IMPACT_SAMPLES,
    scatter = DICE_SCATTER_PROFILE,
  }) {
    this.createAudio = createAudio;
    this.schedule = schedule;
    this.cancelSchedule = cancelSchedule;
    this.now = now;
    this.random = random;
    this.cues = cues;
    this.impactSamples = impactSamples;
    this.scatter = { ...DICE_SCATTER_PROFILE, ...scatter };
    this.timers = new Set();
    this.activeAudio = new Set();
    this.rolling = false;
    this.startedAt = 0;
    this.densityFactor = 1;
  }

  start({ soundEnabled, userActivated, diceCount = 1 }) {
    this.stop();
    if (!canPlayDiceSound({ soundEnabled, userActivated })) return false;

    this.rolling = true;
    this.startedAt = this.now();
    this.densityFactor = clamp(
      Math.sqrt(clamp(diceCount, 1, 64)),
      1,
      this.scatter.maxDensityFactor,
    );

    for (const cue of this.cues) this.scheduleAt(cue.delayMs, () => this.playCue(cue));
    this.scheduleAt(this.scatter.startMs, () => this.emitImpact());
    return true;
  }

  scheduleAt(delayMs, callback) {
    let timer;
    timer = this.schedule(() => {
      this.timers.delete(timer);
      callback();
    }, Math.max(0, delayMs));
    this.timers.add(timer);
    return timer;
  }

  // Frazione di assestamento: 0 appena lanciati, 1 quando la raffica e' esaurita.
  settleProgress() {
    const elapsed = this.now() - this.startedAt - this.scatter.startMs;
    return clamp(elapsed / this.scatter.rampMs, 0, 1);
  }

  jittered(value) {
    const spread = (this.random() - 0.5) * 2 * this.scatter.jitter;
    return value * (1 + spread);
  }

  emitImpact() {
    if (!this.rolling) return;
    const progress = this.settleProgress();

    const volumeSpan = this.scatter.startVolume - this.scatter.endVolume;
    this.playCue({
      src: this.impactSamples[Math.floor(this.random() * this.impactSamples.length)]
        ?? this.impactSamples[0],
      volume: clamp(this.jittered(this.scatter.startVolume - volumeSpan * progress), 0.02, 1),
    });

    const gapSpan = this.scatter.maxGapMs - this.scatter.minGapMs;
    const gap = (this.scatter.minGapMs + gapSpan * progress) / this.densityFactor;
    this.scheduleAt(clamp(this.jittered(gap), 16, 4000), () => this.emitImpact());
  }

  playCue(cue) {
    if (!cue?.src) return;
    // Senza questo tetto una raffica lunga accumula sorgenti finche' il mix diventa fango.
    if (this.activeAudio.size >= this.scatter.maxConcurrent) return;
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

  // Il primo impatto di un tiro arriverebbe in ritardo se il campione non fosse gia' in cache:
  // basta forzarne il caricamento appena suono e gesto utente sono disponibili.
  prime() {
    const sources = new Set([...this.cues.map((cue) => cue.src), ...this.impactSamples]);
    for (const src of sources) {
      try {
        this.createAudio(src)?.load?.();
      } catch {
        // Il preload è un'ottimizzazione: il fallimento non deve propagarsi.
      }
    }
  }

  // Fine naturale del tiro: i dadi si sono fermati, quindi non vanno seminati altri impatti, ma
  // i campioni gia' partiti devono spegnersi da soli. Troncarli darebbe un click al posto
  // dell'ultimo colpo, che e' proprio il momento piu' esposto della sequenza.
  settle() {
    this.rolling = false;
    for (const timer of this.timers) this.cancelSchedule(timer);
    this.timers.clear();
  }

  // Interruzione secca: skip, cambio preferenza o smontaggio. Qui il silenzio immediato e'
  // il comportamento voluto.
  stop() {
    this.rolling = false;
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
