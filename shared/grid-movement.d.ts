export type DiagonalRule = 'standard' | 'alternating';
export type DiagonalParity = 0 | 1;

export interface GridPosition {
  x: number;
  y: number;
}

export interface PathStep extends GridPosition {
  diagonal: boolean;
  cost: number;
}

export interface PathCostOptions {
  rule?: DiagonalRule;
  diagonalParity?: DiagonalParity;
}

export interface PathCostResult {
  cells: number;
  steps: PathStep[];
  nextDiagonalParity: DiagonalParity;
}

export function decomposeSegment(
  from: GridPosition,
  to: GridPosition,
): Array<GridPosition & { diagonal: boolean }>;

export function pathCost(waypoints: GridPosition[], options?: PathCostOptions): PathCostResult;

export function isValidCellsValue(value: unknown): value is number;

export function cellsToUnit(cells: number, cellsValue: number): number | null;
