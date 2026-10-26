import type { UnitToken, LightSource } from '../src/types';
import type { SceneBlocker } from './scene-blockers';
export type ExploredRegions = number[][][][];
export function asRegion(points: { x: number; y: number }[]): ExploredRegions;
export function mergeRegions(...regions: ExploredRegions[]): ExploredRegions;
export function normalizeExploredRegions(value: unknown): ExploredRegions;
export function visibleRegions(
  token: UnitToken,
  radius: number,
  blockers: SceneBlocker[],
  lights: LightSource[],
): ExploredRegions;
export function regionPaths(regions: ExploredRegions, camera: { x: number; y: number }, cellSize: number): string[];

export function clipRegions(regions:ExploredRegions,dimensions?:{columns:number;rows:number}):ExploredRegions;
