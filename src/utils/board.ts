import { BOARD_CONFIG } from '../constants/board';
import type { DndSize, GridPosition, UnitToken } from '../types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampZoom(zoom: number): number {
  return clamp(zoom, BOARD_CONFIG.minZoom, BOARD_CONFIG.maxZoom);
}

export function gridToPixels(position: GridPosition): GridPosition {
  return {
    x: position.x * BOARD_CONFIG.cellSize,
    y: position.y * BOARD_CONFIG.cellSize,
  };
}

export function sizeToCells(size: DndSize): number {
  switch (size) {
    case 'large':
      return 2;
    case 'huge':
      return 3;
    case 'gargantuan':
      return 4;
    case 'tiny':
    case 'small':
    case 'medium':
    default:
      return 1;
  }
}

export function viewportPointToWorldCell(
  clientX: number,
  clientY: number,
  stageRect: DOMRect,
  zoom: number,
  camera: GridPosition,
): GridPosition {
  const xInBoard = (clientX - stageRect.left) / zoom;
  const yInBoard = (clientY - stageRect.top) / zoom;

  return {
    x: Math.floor(xInBoard / BOARD_CONFIG.cellSize) + camera.x,
    y: Math.floor(yInBoard / BOARD_CONFIG.cellSize) + camera.y,
  };
}

export function boardPixelSize(columns: number, rows: number): { width: number; height: number } {
  return {
    width: columns * BOARD_CONFIG.cellSize,
    height: rows * BOARD_CONFIG.cellSize,
  };
}

export function gridRowToLabel(index: number): string {
  let value = Math.max(1, index + 1);
  let result = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

export function rowLabelToGridIndex(label: string): number {
  const normalized = label.trim().toUpperCase();
  if (!normalized) {
    return 0;
  }

  let value = 0;
  for (const character of normalized) {
    const code = character.charCodeAt(0);
    if (code < 65 || code > 90) {
      continue;
    }

    value = value * 26 + (code - 64);
  }

  return Math.max(0, value - 1);
}

export function gridColumnToLabel(index: number): string {
  return String(Math.max(1, index + 1));
}

export function getTokenFootprint(token: UnitToken): { width: number; height: number } {
  const width =
    typeof token.widthCells === 'number' && token.widthCells > 0
      ? Math.max(1, Math.floor(token.widthCells))
      : sizeToCells(token.size);
  const height =
    typeof token.heightCells === 'number' && token.heightCells > 0
      ? Math.max(1, Math.floor(token.heightCells))
      : sizeToCells(token.size);

  return { width, height };
}
