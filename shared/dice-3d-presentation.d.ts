import type { DiceRollLog } from '../src/types';
import type { DieDisposition, SupportedDie } from './dice-engine';

export const MAX_PRESENTATION_DICE: 20;

export interface PercentileFaces {
  tens: number;
  units: number;
  label: string;
}

export interface DicePresentationRailDie {
  id: string;
  sides: SupportedDie;
  value: number;
  label: string;
  disposition: DieDisposition;
}

export interface DicePresentation {
  logId: string;
  label: string;
  notation: string;
  visualDice: Array<{ logicalDieId: string; type: string; forcedValue: number }>;
  groups: Array<{ id: string; dice: DicePresentationRailDie[] }>;
}

export type DicePresentationResult =
  | { ok: true; presentation: DicePresentation }
  | { ok: false; reason: string };

export function percentileFaces(value: number): PercentileFaces;
export function buildDicePresentation(log: Partial<DiceRollLog>): DicePresentationResult;
export function collectDiceDeliveries(
  logs: DiceRollLog[],
  seenIds: Set<string>,
  options?: { baseline?: boolean },
): DiceRollLog[];

export class DicePresentationQueue {
  constructor(options: {
    run: (log: DiceRollLog) => void | Promise<void>;
    timeoutMs?: number;
    onError?: (error: unknown, log: DiceRollLog) => void;
  });
  enqueue(logs: DiceRollLog[]): void;
  whenIdle(): Promise<void>;
}

export function canAnimateDice(options: {
  reducedMotion: boolean;
  createCanvas: () => { getContext: (kind: string) => unknown };
}): boolean;
