import type { DiceType, RollMode } from '../types';

export const DICE_OPTIONS: DiceType[] = [4, 6, 8, 10, 12, 20, 100];

export interface DiceRollResult {
  rolls: number[];
  keptRolls: number[];
  total: number;
  label: string;
}

function randomIntInclusive(min: number, max: number): number {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);

  if (!Number.isInteger(lower) || !Number.isInteger(upper) || upper < lower) {
    throw new Error('Invalid random range');
  }

  const range = upper - lower + 1;
  const maxUint32 = 0x1_0000_0000;
  const limit = maxUint32 - (maxUint32 % range);
  const buffer = new Uint32Array(1);

  while (true) {
    crypto.getRandomValues(buffer);
    const value = buffer[0];

    if (value < limit) {
      return lower + (value % range);
    }
  }
}

function randomRoll(sides: number): number {
  return randomIntInclusive(1, sides);
}

export function rollDice(
  sides: DiceType,
  count: number,
  modifier: number,
  mode: RollMode,
): DiceRollResult {
  if (mode === 'advantage' || mode === 'disadvantage') {
    const rolls = [randomRoll(20), randomRoll(20)];
    const keptRoll = mode === 'advantage' ? Math.max(...rolls) : Math.min(...rolls);

    return {
      rolls,
      keptRolls: [keptRoll],
      total: keptRoll + modifier,
      label: `2d20... ${keptRoll}${modifier !== 0 ? formatModifier(modifier) : ''}`,
    };
  }

  const safeCount = Math.max(1, count);
  const rolls = Array.from({ length: safeCount }, () => randomRoll(sides));
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;

  return {
    rolls,
    keptRolls: rolls,
    total,
    label: `${safeCount}d${sides}${modifier !== 0 ? formatModifier(modifier) : ''}`,
  };
}

export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

export function rollSingleDie(sides: DiceType): number {
  return randomRoll(sides);
}
