// Shared deterministic vision geometry, used by client presentation and server exploration.
import { firstWallIntersection, wallLineOfSight } from './vision-walls.mjs';
function getTokenFootprint(token) {
  const size = { large: 2, huge: 3, gargantuan: 4 }[token.size] ?? 1;
  return {
    width:
      typeof token.widthCells === 'number' && token.widthCells > 0 ? Math.max(1, Math.floor(token.widthCells)) : size,
    height:
      typeof token.heightCells === 'number' && token.heightCells > 0
        ? Math.max(1, Math.floor(token.heightCells))
        : size,
  };
}
const FEET_PER_CELL = 5;
const METERS_PER_CELL = 1.5;
const DEFAULT_DARKVISION_CELLS = 12;
const RAY_SAMPLES_PER_CELL = 4;
const VISION_POLYGON_RAYS = 180;
function darkvisionToCells(darkvision) {
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
function tokenVisionCenter(token) {
  const footprint = getTokenFootprint(token);
  return {
    x: token.position.x + footprint.width / 2,
    y: token.position.y + footprint.height / 2,
  };
}
function visibleCellKey(cell) {
  return `${cell.x}:${cell.y}`;
}
function tokenCellKeys(token) {
  const footprint = getTokenFootprint(token);
  const keys = [];
  for (let y = 0; y < footprint.height; y += 1) {
    for (let x = 0; x < footprint.width; x += 1) {
      keys.push(visibleCellKey({ x: token.position.x + x, y: token.position.y + y }));
    }
  }
  return keys;
}
function blockerCellKeys(blockers, ignoredTokenIds = []) {
  const ignoredTokenIdSet = new Set(ignoredTokenIds);
  return new Set(
    blockers
      .filter((blocker) => blocker.source !== 'token' || !ignoredTokenIdSet.has(blocker.id))
      .flatMap((blocker) => {
        const keys = [];
        for (let y = 0; y < blocker.heightCells; y += 1) {
          for (let x = 0; x < blocker.widthCells; x += 1) {
            keys.push(visibleCellKey({ x: blocker.position.x + x, y: blocker.position.y + y }));
          }
        }
        return keys;
      }),
  );
}
function selfOcclusionIgnoredTokenIds(sourceToken, targetToken, blockers) {
  const ignoredIds = [sourceToken.id, targetToken.id];
  if (targetToken.blocksMovement === true && targetToken.groupId) {
    ignoredIds.push(...blockers.filter((token) => token.groupId === targetToken.groupId).map((token) => token.id));
  }
  return ignoredIds;
}
function lineCells(from, to) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance * RAY_SAMPLES_PER_CELL));
  const cells = [];
  const seen = /* @__PURE__ */ new Set();
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
function hasLineOfSight(origin, targetCell, blockerKeys) {
  const targetKey = visibleCellKey(targetCell);
  const sourceKey = visibleCellKey({ x: Math.floor(origin.x), y: Math.floor(origin.y) });
  return lineCells(origin, { x: targetCell.x + 0.5, y: targetCell.y + 0.5 }).every((cell) => {
    const key = visibleCellKey(cell);
    return key === sourceKey || key === targetKey || !blockerKeys.has(key);
  });
}
function firstBlockedRayPoint(origin, angle, radiusCells, blockerKeys) {
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
function buildVisionPolygon(sourceToken, radiusCells, blockers = []) {
  return buildVisionPolygonFromPoint(tokenVisionCenter(sourceToken), radiusCells, blockers, [sourceToken.id]);
}
function buildVisionPolygonFromPoint(origin, radiusCells, blockers = [], ignoredBlockerIds = []) {
  const blockersByCell = blockerCellKeys(blockers, ignoredBlockerIds);
  if (radiusCells <= 0) {
    return [
      { x: origin.x - 0.5, y: origin.y - 0.5 },
      { x: origin.x + 0.5, y: origin.y - 0.5 },
      { x: origin.x + 0.5, y: origin.y + 0.5 },
      { x: origin.x - 0.5, y: origin.y + 0.5 },
    ].map((point) => {
      const hit = firstWallIntersection(origin, point, blockers);
      return { x: hit.x, y: hit.y };
    });
  }
  const angles = Array.from({ length: VISION_POLYGON_RAYS }, (_, i) => (i / VISION_POLYGON_RAYS) * Math.PI * 2);
  for (const wall of blockers)
    for (const point of wall.points ?? []) {
      const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
      for (const offset of [-1e-6, 0, 1e-6]) angles.push((angle + offset + Math.PI * 2) % (Math.PI * 2));
    }
  return angles
    .sort((a, b) => a - b)
    .map((angle) => {
      const end = firstBlockedRayPoint(origin, angle, radiusCells, blockersByCell);
      const hit = firstWallIntersection(origin, end, blockers);
      return { x: hit.x, y: hit.y };
    });
}
function buildVisibleCellSet(sourceToken, radiusCells, blockers = [], viewport) {
  const origin = tokenVisionCenter(sourceToken);
  const blockersByCell = blockerCellKeys(blockers, [sourceToken.id]);
  const visibleCells = /* @__PURE__ */ new Set();
  for (let y = viewport.y; y < viewport.y + viewport.rows; y += 1) {
    for (let x = viewport.x; x < viewport.x + viewport.columns; x += 1) {
      const distance = Math.hypot(x + 0.5 - origin.x, y + 0.5 - origin.y);
      if (
        distance <= radiusCells + 0.5 &&
        hasLineOfSight(origin, { x, y }, blockersByCell) &&
        wallLineOfSight(origin, { x, y }, blockers)
      ) {
        visibleCells.add(visibleCellKey({ x, y }));
      }
    }
  }
  return visibleCells;
}
function isTokenInsideVision(sourceToken, targetToken, radiusCells, blockers = []) {
  if (sourceToken.id === targetToken.id || targetToken.ownerUserId === sourceToken.ownerUserId) {
    return true;
  }
  const sourceCenter = tokenVisionCenter(sourceToken);
  const blockersByCell = blockerCellKeys(blockers, selfOcclusionIgnoredTokenIds(sourceToken, targetToken, blockers));
  return tokenCellKeys(targetToken).some((key) => {
    const [x, y] = key.split(':').map(Number);
    const distance = Math.hypot(x + 0.5 - sourceCenter.x, y + 0.5 - sourceCenter.y);
    return (
      distance <= radiusCells + 0.5 &&
      hasLineOfSight(sourceCenter, { x, y }, blockersByCell) &&
      wallLineOfSight(sourceCenter, { x, y }, blockers)
    );
  });
}
function isTokenInsideLight(light, targetToken, blockers = []) {
  const origin = { x: light.position.x + 0.5, y: light.position.y + 0.5 };
  const blockersByCell = blockerCellKeys(
    blockers,
    targetToken.blocksMovement === true && targetToken.groupId
      ? blockers.filter((token) => token.groupId === targetToken.groupId).map((token) => token.id)
      : [targetToken.id],
  );
  return tokenCellKeys(targetToken).some((key) => {
    const [x, y] = key.split(':').map(Number);
    const distance = Math.hypot(x + 0.5 - origin.x, y + 0.5 - origin.y);
    return (
      distance <= light.radiusCells + 0.5 &&
      hasLineOfSight(origin, { x, y }, blockersByCell) &&
      wallLineOfSight(origin, { x, y }, blockers)
    );
  });
}
export {
  buildVisibleCellSet,
  buildVisionPolygon,
  buildVisionPolygonFromPoint,
  darkvisionToCells,
  isTokenInsideLight,
  isTokenInsideVision,
  tokenVisionCenter,
  visibleCellKey,
};
