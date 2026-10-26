import polygonClipping from 'polygon-clipping';
import { buildVisionPolygon, buildVisionPolygonFromPoint, tokenVisionCenter } from './vision.mjs';
const { union, intersection } = polygonClipping;
export function asRegion(points) {
  if (points.length < 3) return [];
  const ring = points.map((p) => [p.x, p.y]);
  ring.push([...ring[0]]);
  return [[ring]];
}
export function mergeRegions(...regions) {
  const nonempty = regions.filter((r) => r?.length);
  return nonempty.length ? union(...nonempty) : [];
}
export function normalizeExploredRegions(value) {
  if (!Array.isArray(value)) return [];
  try {
    for (const polygon of value)
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4) throw Error();
        for (const pair of ring)
          if (
            !Array.isArray(pair) ||
            pair.length !== 2 ||
            pair.some((n) => !Number.isFinite(n) || Math.abs(n) > 1_000_100)
          )
            throw Error();
      }
    return value;
  } catch {
    return [];
  }
}
export function visibleRegions(token, radius, blockers, lights) {
  const origin = tokenVisionCenter(token);
  let result = asRegion(buildVisionPolygon(token, radius, blockers));
  for (const light of lights) {
    const reach = Math.hypot(light.position.x + 0.5 - origin.x, light.position.y + 0.5 - origin.y) + light.radiusCells;
    const sight = asRegion(buildVisionPolygon(token, Math.max(radius, reach), blockers));
    const lit = asRegion(
      buildVisionPolygonFromPoint(
        { x: light.position.x + 0.5, y: light.position.y + 0.5 },
        light.radiusCells,
        blockers,
      ),
    );
    result = mergeRegions(result, intersection(sight, lit));
  }
  return result;
}
export function regionPaths(regions, camera, cellSize) {
  return regions.map((polygon) =>
    polygon
      .map(
        (ring) =>
          ring
            .map(([x, y], i) => `${i ? 'L' : 'M'}${(x - camera.x) * cellSize},${(y - camera.y) * cellSize}`)
            .join(' ') + ' Z',
      )
      .join(' '),
  );
}

export function clipRegions(regions, dimensions = { columns: 0, rows: 0 }) {
  const width = dimensions.columns || 1_000_000,
    height = dimensions.rows || 1_000_000;
  return regions.length
    ? intersection(
        regions,
        asRegion([
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: height },
          { x: 0, y: height },
        ]),
      )
    : [];
}
