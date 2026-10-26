import type { UnitToken, GridPosition, LightSource } from '../src/types';
import type { SceneBlocker } from './scene-blockers';
export function darkvisionToCells(text?: string | null): number;
export function tokenVisionCenter(token: UnitToken): { x: number; y: number };
export function visibleCellKey(point: GridPosition): string;
export function buildVisionPolygon(
  token: UnitToken,
  radius: number,
  blockers?: SceneBlocker[],
): { x: number; y: number }[];
export function buildVisionPolygonFromPoint(
  origin: { x: number; y: number },
  radius: number,
  blockers?: SceneBlocker[],
  ignored?: string[],
): { x: number; y: number }[];
export function buildVisibleCellSet(
  token: UnitToken,
  radius: number,
  blockers: SceneBlocker[],
  viewport: { x: number; y: number; columns: number; rows: number },
): Set<string>;
export function isTokenInsideVision(
  source: UnitToken,
  target: UnitToken,
  radius: number,
  blockers?: SceneBlocker[],
): boolean;
export function isTokenInsideLight(light: LightSource, target: UnitToken, blockers?: SceneBlocker[]): boolean;
