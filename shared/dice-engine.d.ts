export type SupportedDie = 4 | 6 | 8 | 10 | 12 | 20 | 100;
export type DieDisposition = 'kept' | 'discarded' | 'unresolved';
export type DiceResolutionMode = 'normal' | 'advantage' | 'disadvantage' | 'unresolved';

export interface RolledDie {
  id: string;
  sides: SupportedDie;
  value: number;
  groupId: string;
  disposition: DieDisposition;
}

export interface DiceGroupRequest {
  count: number;
  sides: SupportedDie;
  modifier?: number;
  label?: string;
}

export interface ResolvedDiceGroup {
  groupId: string;
  label?: string;
  formula: string;
  rolls: number[];
  keptRolls: number[];
  modifier: number;
  total: number;
  dice: RolledDie[];
}

export interface DiceRollResolution {
  formula: string;
  rolls: number[];
  keptRolls: number[];
  modifier: number;
  total: number;
  dice: RolledDie[];
  groups: ResolvedDiceGroup[];
}

export const SUPPORTED_DICE: readonly SupportedDie[];
export function rollUniformDie(sides: SupportedDie, nextUint32: () => number): number;
export function resolveDiceRoll(
  request: { groups: DiceGroupRequest[]; mode?: DiceResolutionMode },
  options: { nextUint32: () => number },
): DiceRollResolution;
export function singleDieModel(sides: SupportedDie): { probability: number; mean: number; variance: number };
export function sumDiceModel(count: number, sides: SupportedDie): { mean: number; variance: number };
export function advantageProbability(value: number): number;
export function disadvantageProbability(value: number): number;
export function successProbability(dc: number, modifier?: number, mode?: 'normal' | 'advantage' | 'disadvantage'): number;
export function criticalProbability(threshold: number): number;
