export type TokenType = 'player' | 'enemy' | 'object' | 'vehicle';

export const CREATURE_CONDITIONS: readonly string[];
export const VEHICLE_CONDITIONS: readonly string[];
export const SPEED_ZERO_CONDITIONS: readonly string[];

export function conditionCatalogFor(tokenType: TokenType | string): readonly string[];

export function clampExhaustionLevel(level: unknown): number;

export interface NormalizedConditions {
  conditions: string[];
  exhaustionLevel: number;
}

export function normalizeConditionsForType(
  tokenType: TokenType | string,
  conditions: unknown,
  exhaustionLevel: unknown,
): NormalizedConditions;

export interface EffectiveSpeedResult {
  cells: number;
  reason: string | null;
}

export function effectiveSpeed(
  movementCells: number | null | undefined,
  conditions?: string[],
  exhaustionLevel?: number,
): EffectiveSpeedResult;

export function standUpCost(effectiveCells: number): number;

export interface MovementBudgetInput {
  effectiveCells: number;
  dashed?: boolean;
  extra?: number;
}

export function movementBudget(input: MovementBudgetInput): number;
