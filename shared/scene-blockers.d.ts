import type { GridPosition, SceneElement, UnitToken } from '../src/types';

export interface SceneBlocker {
  id: string;
  source: 'token' | 'element';
  name: string;
  groupId: string | null;
  position: GridPosition;
  widthCells: number;
  heightCells: number;
}

export function collectMovementBlockers(
  tokens: UnitToken[],
  elements: SceneElement[],
  getTokenFootprint: (token: UnitToken) => { width: number; height: number },
): SceneBlocker[];
export function collectVisionBlockers(
  tokens: UnitToken[],
  elements: SceneElement[],
  getTokenFootprint: (token: UnitToken) => { width: number; height: number },
): SceneBlocker[];
export function footprintsOverlap(
  position: GridPosition,
  footprint: { width: number; height: number },
  blocker: SceneBlocker,
): boolean;
