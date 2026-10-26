// Distance along a ray segment to the nearest two-sided wall. Endpoints count as closed.
export function firstWallIntersection(from, to, blockers) {
  const rx = to.x - from.x,
    ry = to.y - from.y;
  let nearest = 1;
  for (const wall of blockers) {
    if (!wall.points) continue;
    for (let i = 1; i < wall.points.length; i++) {
      const a = wall.points[i - 1],
        b = wall.points[i];
      const sx = b.x - a.x,
        sy = b.y - a.y;
      const denominator = rx * sy - ry * sx;
      if (Math.abs(denominator) < 1e-10) continue;
      const qx = a.x - from.x,
        qy = a.y - from.y;
      const t = (qx * sy - qy * sx) / denominator;
      const u = (qx * ry - qy * rx) / denominator;
      if (t >= -1e-9 && t <= nearest && u >= -1e-9 && u <= 1 + 1e-9) nearest = Math.max(0, t);
    }
  }
  return { x: from.x + rx * nearest, y: from.y + ry * nearest, fraction: nearest };
}
export function wallLineOfSight(origin, target, blockers) {
  return firstWallIntersection(origin, { x: target.x + 0.5, y: target.y + 0.5 }, blockers).fraction >= 1 - 1e-9;
}
