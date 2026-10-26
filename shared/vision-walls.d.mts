import type { SceneBlocker } from './scene-blockers';
export function firstWallIntersection(
  from: { x: number; y: number },
  to: { x: number; y: number },
  blockers: SceneBlocker[],
): { x: number; y: number; fraction: number };
export function wallLineOfSight(
  from: { x: number; y: number },
  target: { x: number; y: number },
  blockers: SceneBlocker[],
): boolean;
