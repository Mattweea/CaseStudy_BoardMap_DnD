import { SCENE_LIMITS, normalizeSceneWallCells } from './scene-model.mjs';
export const cellKey = (cell) => `${cell.x}:${cell.y}`;
export function rectangleCells(a, b) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const width = Math.abs(a.x - b.x) + 1, height = Math.abs(a.y - b.y) + 1;
  if (!Number.isSafeInteger(width * height) || width * height > SCENE_LIMITS.maxWallCells) {
    throw new TypeError('La selezione supera il limite di 5000 celle.');
  }
  return normalizeSceneWallCells(Array.from({ length: width * height }, (_, i) => ({ x: x + i % width, y: y + Math.floor(i / width) })));
}
export function lineWallCells(a, b) {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  if (steps >= SCENE_LIMITS.maxWallCells) throw new TypeError('Il tratto supera il limite di 5000 celle.');
  return normalizeSceneWallCells(Array.from({ length: steps + 1 }, (_, i) => ({
    x: Math.round(a.x + (b.x - a.x) * (steps ? i / steps : 0)),
    y: Math.round(a.y + (b.y - a.y) * (steps ? i / steps : 0)),
  })));
}
export function wallCellPaths(cells) {
  const keys = new Set(cells.map(cellKey));
  let fill = '', outline = '';
  for (const { x, y } of cells) {
    fill += `M${x},${y}h1v1h-1Z`;
    if (!keys.has(`${x}:${y - 1}`)) outline += `M${x},${y}h1`;
    if (!keys.has(`${x + 1}:${y}`)) outline += `M${x + 1},${y}v1`;
    if (!keys.has(`${x}:${y + 1}`)) outline += `M${x},${y + 1}h1`;
    if (!keys.has(`${x - 1}:${y}`)) outline += `M${x},${y}v1`;
  }
  return { fill, outline };
}
