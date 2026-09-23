import type { DiceType, RollMode } from '../types';
import { resolveDiceRoll, rollUniformDie } from '../../shared/dice-engine.mjs';

export const DICE_OPTIONS: DiceType[] = [4, 6, 8, 10, 12, 20, 100];

export interface DiceRollResult {
  rolls: number[];
  keptRolls: number[];
  total: number;
  label: string;
}

function nextBrowserUint32(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0];
}

export function rollDice(
  sides: DiceType,
  count: number,
  modifier: number,
  mode: RollMode,
): DiceRollResult {
  const safeCount = Math.max(1, count);
  const result = resolveDiceRoll({
    groups: [{ count: safeCount, sides, modifier }],
    mode,
  }, { nextUint32: nextBrowserUint32 });
  const keptRoll = result.keptRolls[0];

  return {
    rolls: result.rolls,
    keptRolls: result.keptRolls,
    total: result.total,
    label: mode === 'normal'
      ? `${safeCount}d${sides}${modifier !== 0 ? formatModifier(modifier) : ''}`
      : `2d20... ${keptRoll}${modifier !== 0 ? formatModifier(modifier) : ''}`,
  };
}

export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

export function rollSingleDie(sides: DiceType): number {
  return rollUniformDie(sides, nextBrowserUint32);
}
