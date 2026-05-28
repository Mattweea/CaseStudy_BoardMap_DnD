import type { GridPosition, LightSource, UnitToken } from '../types';
import { getTokenFootprint } from './board';

const FEET_PER_CELL = 5;
const METERS_PER_CELL = 1.5;
const DEFAULT_DARKVISION_CELLS = 12;
const RAY_SAMPLES_PER_CELL = 4;
const VISION_POLYGON_RAYS = 180;

export function darkvisionToCells(darkvision: string | null | undefined): number {
  const normalized = darkvision?.trim().toLowerCase() ?? '';

  if (!normalized || normalized === 'nessuna' || normalized.includes('nessuna')) {
    return 0;
  }

  const feetMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*ft/);
  if (feetMatch) {
    return Math.max(0, Math.round(Number(feetMatch[1].replace(',', '.')) / FEET_PER_CELL));
  }

  const meterMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*m/);
  if (meterMatch) {
    return Math.max(0, Math.round(Number(meterMatch[1].replace(',', '.')) / METERS_PER_CELL));
  }

  return DEFAULT_DARKVISION_CELLS;
}

export function tokenVisionCenter(token: UnitToken): { x: number; y: number } {
  const footprint = getTokenFootprint(token);

  return {
    x: token.position.x + footprint.width / 2,
    y: token.position.y + footprint.height / 2,
  };
}

export function visibleCellKey(cell: GridPosition): string {
  return `${cell.x}:${cell.y}`;
}

function tokenCellKeys(token: UnitToken): string[] {
  const footprint = getTokenFootprint(token);
  const keys: string[] = [];

  for (let y = 0; y < footprint.height; y += 1) {
    for (let x = 0; x < footprint.width; x += 1) {
      keys.push(visibleCellKey({ x: token.position.x + x, y: token.position.y + y }));
    }
  }

  return keys;
}

function blockerCellKeys(blockers: UnitToken[], ignoredTokenIds: string[] = []): Set<string> {
  const ignoredTokenIdSet = new Set(ignoredTokenIds);

  return new Set(
    blockers
      .filter((token) => !ignoredTokenIdSet.has(token.id))
      .flatMap((token) => tokenCellKeys(token)),
  );
}

function selfOcclusionIgnoredTokenIds(sourceToken: UnitToken, targetToken: UnitToken, blockers: UnitToken[]): string[] {
  const ignoredIds = [sourceToken.id, targetToken.id];

  if (targetToken.blocksMovement === true && targetToken.groupId) {
    ignoredIds.push(
      ...blockers
        .filter((token) => token.groupId === targetToken.groupId)
        .map((token) => token.id),
    );
  }

  return ignoredIds;
}

function lineCells(from: { x: number; y: number }, to: { x: number; y: number }): GridPosition[] {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance * RAY_SAMPLES_PER_CELL));
  const cells: GridPosition[] = [];
  const seen = new Set<string>();

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const cell = {
      x: Math.floor(from.x + (to.x - from.x) * progress),
      y: Math.floor(from.y + (to.y - from.y) * progress),
    };
    const key = visibleCellKey(cell);

    if (!seen.has(key)) {
      seen.add(key);
      cells.push(cell);
    }
  }

  return cells;
}

function hasLineOfSight(
  origin: { x: number; y: number },
  targetCell: GridPosition,
  blockerKeys: Set<string>,
): boolean {
  const targetKey = visibleCellKey(targetCell);
  const sourceKey = visibleCellKey({ x: Math.floor(origin.x), y: Math.floor(origin.y) });

  return lineCells(origin, { x: targetCell.x + 0.5, y: targetCell.y + 0.5 }).every((cell) => {
    const key = visibleCellKey(cell);
    return key === sourceKey || key === targetKey || !blockerKeys.has(key);
  });
}

function firstBlockedRayPoint(
  origin: { x: number; y: number },
  angle: number,
  radiusCells: number,
  blockerKeys: Set<string>,
): { x: number; y: number } {
  const steps = Math.max(1, Math.ceil(radiusCells * RAY_SAMPLES_PER_CELL));
  const sourceKey = visibleCellKey({ x: Math.floor(origin.x), y: Math.floor(origin.y) });
  let lastPoint = origin;

  for (let step = 1; step <= steps; step += 1) {
    const distance = (radiusCells * step) / steps;
    const point = {
      x: origin.x + Math.cos(angle) * distance,
      y: origin.y + Math.sin(angle) * distance,
    };
    const key = visibleCellKey({ x: Math.floor(point.x), y: Math.floor(point.y) });

    if (key !== sourceKey && blockerKeys.has(key)) {
      return lastPoint;
    }

    lastPoint = point;
  }

  return lastPoint;
}

export function buildVisionPolygon(
  sourceToken: UnitToken,
  radiusCells: number,
  blockers: UnitToken[] = [],
): Array<{ x: number; y: number }> {
  return buildVisionPolygonFromPoint(tokenVisionCenter(sourceToken), radiusCells, blockers, [sourceToken.id]);
}

export function buildVisionPolygonFromPoint(
  origin: { x: number; y: number },
  radiusCells: number,
  blockers: UnitToken[] = [],
  ignoredBlockerIds: string[] = [],
): Array<{ x: number; y: number }> {
  const blockersByCell = blockerCellKeys(blockers, ignoredBlockerIds);

  if (radiusCells <= 0) {
    return [
      { x: origin.x - 0.5, y: origin.y - 0.5 },
      { x: origin.x + 0.5, y: origin.y - 0.5 },
      { x: origin.x + 0.5, y: origin.y + 0.5 },
      { x: origin.x - 0.5, y: origin.y + 0.5 },
    ];
  }

  return Array.from({ length: VISION_POLYGON_RAYS }, (_, index) => {
    const angle = (index / VISION_POLYGON_RAYS) * Math.PI * 2;
    return firstBlockedRayPoint(origin, angle, radiusCells, blockersByCell);
  });
}

export function buildVisibleCellSet(
  sourceToken: UnitToken,
  radiusCells: number,
  blockers: UnitToken[] = [],
  viewport: { x: number; y: number; columns: number; rows: number },
): Set<string> {
  const origin = tokenVisionCenter(sourceToken);
  const blockersByCell = blockerCellKeys(blockers, [sourceToken.id]);
  const visibleCells = new Set<string>();

  for (let y = viewport.y; y < viewport.y + viewport.rows; y += 1) {
    for (let x = viewport.x; x < viewport.x + viewport.columns; x += 1) {
      const distance = Math.hypot(x + 0.5 - origin.x, y + 0.5 - origin.y);
      if (distance <= radiusCells + 0.5 && hasLineOfSight(origin, { x, y }, blockersByCell)) {
        visibleCells.add(visibleCellKey({ x, y }));
      }
    }
  }

  return visibleCells;
}

export function isTokenInsideVision(
  sourceToken: UnitToken,
  targetToken: UnitToken,
  radiusCells: number,
  blockers: UnitToken[] = [],
): boolean {
  if (sourceToken.id === targetToken.id || targetToken.ownerUserId === sourceToken.ownerUserId) {
    return true;
  }

  const sourceCenter = tokenVisionCenter(sourceToken);
  const blockersByCell = blockerCellKeys(
    blockers,
    selfOcclusionIgnoredTokenIds(sourceToken, targetToken, blockers),
  );

  return tokenCellKeys(targetToken).some((key) => {
    const [x, y] = key.split(':').map(Number);
    const distance = Math.hypot(x + 0.5 - sourceCenter.x, y + 0.5 - sourceCenter.y);
    return distance <= radiusCells + 0.5 && hasLineOfSight(sourceCenter, { x, y }, blockersByCell);
  });
}

export function isTokenInsideLight(
  light: LightSource,
  targetToken: UnitToken,
  blockers: UnitToken[] = [],
): boolean {
  const origin = { x: light.position.x + 0.5, y: light.position.y + 0.5 };
  const blockersByCell = blockerCellKeys(
    blockers,
    targetToken.blocksMovement === true && targetToken.groupId
      ? blockers
          .filter((token) => token.groupId === targetToken.groupId)
          .map((token) => token.id)
      : [targetToken.id],
  );

  return tokenCellKeys(targetToken).some((key) => {
    const [x, y] = key.split(':').map(Number);
    const distance = Math.hypot(x + 0.5 - origin.x, y + 0.5 - origin.y);
    return distance <= light.radiusCells + 0.5 && hasLineOfSight(origin, { x, y }, blockersByCell);
  });
}
