export interface DiceSoundCue {
  delayMs: number;
  src: string;
  volume: number;
}

export interface DiceScatterProfile {
  startMs: number;
  minGapMs: number;
  maxGapMs: number;
  rampMs: number;
  startVolume: number;
  endVolume: number;
  jitter: number;
  maxDensityFactor: number;
  maxConcurrent: number;
}

export interface DiceAudioLike {
  volume: number;
  currentTime: number;
  play?(): void | Promise<unknown>;
  pause?(): void;
  load?(): void;
  addEventListener?(type: string, listener: () => void, options?: { once?: boolean }): void;
}

export const DICE_ROLL_OPENING_CUES: readonly Readonly<DiceSoundCue>[];
export const DICE_IMPACT_SAMPLES: readonly string[];
export const DICE_SCATTER_PROFILE: Readonly<DiceScatterProfile>;

export const CANNON_SLEEPY: 1;

export interface DiceBodyLike {
  body?: { sleepState?: number };
}

export function diceLookStill(diceList: unknown): boolean;

export function canPlayDiceSound(options: {
  soundEnabled: boolean;
  userActivated: boolean;
}): boolean;

export class DiceRollAudioController {
  constructor(options: {
    createAudio: (src: string) => DiceAudioLike | null;
    schedule?: (callback: () => void, delayMs: number) => unknown;
    cancelSchedule?: (timer: unknown) => void;
    now?: () => number;
    random?: () => number;
    cues?: readonly DiceSoundCue[];
    impactSamples?: readonly string[];
    scatter?: Partial<DiceScatterProfile>;
  });
  start(options: {
    soundEnabled: boolean;
    userActivated: boolean;
    diceCount?: number;
  }): boolean;
  prime(): void;
  settle(): void;
  stop(): void;
}
