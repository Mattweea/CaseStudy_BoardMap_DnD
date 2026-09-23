export interface DiceSoundCue {
  delayMs: number;
  src: string;
  volume: number;
}

export interface DiceAudioLike {
  volume: number;
  currentTime: number;
  play?(): void | Promise<unknown>;
  pause?(): void;
  addEventListener?(type: string, listener: () => void, options?: { once?: boolean }): void;
}

export const DICE_ROLL_SOUND_CUES: readonly Readonly<DiceSoundCue>[];

export function canPlayDiceSound(options: {
  soundEnabled: boolean;
  userActivated: boolean;
}): boolean;

export class DiceRollAudioController {
  constructor(options: {
    createAudio: (src: string) => DiceAudioLike | null;
    schedule?: (callback: () => void, delayMs: number) => unknown;
    cancelSchedule?: (timer: unknown) => void;
    cues?: readonly DiceSoundCue[];
  });
  start(options: { soundEnabled: boolean; userActivated: boolean }): boolean;
  stop(): void;
}
