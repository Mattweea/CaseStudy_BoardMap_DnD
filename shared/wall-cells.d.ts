import type { GridPosition } from '../src/types';
export function cellKey(cell: GridPosition): string;
export function rectangleCells(a: GridPosition, b: GridPosition): GridPosition[];
export function lineWallCells(a: GridPosition, b: GridPosition): GridPosition[];
export function wallCellPaths(cells: GridPosition[]): { fill: string; outline: string };
