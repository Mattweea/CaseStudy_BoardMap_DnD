// Regole dei punti ferita condivise tra scheda, menu del token e server.
export function parseHitPointInput(text) {
  if (typeof text !== 'string') return { kind: 'invalid' };
  const trimmed = text.trim();
  if (!trimmed) return { kind: 'empty' };
  const delta = /^([+-])\s*(\d+)$/.exec(trimmed);
  if (delta) {
    const magnitude = Number(delta[2]);
    return magnitude >= 1 && magnitude <= 999
      ? { kind: 'delta', value: delta[1] === '-' ? -magnitude : magnitude }
      : { kind: 'invalid' };
  }
  return /^\d+$/.test(trimmed) && Number.isSafeInteger(Number(trimmed))
    ? { kind: 'absolute', value: Number(trimmed) }
    : { kind: 'invalid' };
}

export function readHitPointNumber(text) {
  if (typeof text === 'number') return Number.isInteger(text) ? text : null;
  return typeof text === 'string' && /^\s*-?\d+\s*$/.test(text) ? Number.parseInt(text, 10) : null;
}

export function applyHitPointDelta({ current, temporary, maximum }, delta) {
  const now = readHitPointNumber(current);
  if (now === null) return { error: 'missing-current' };
  if (delta > 0) {
    const max = readHitPointNumber(maximum);
    if (max === null) return { error: 'missing-maximum' };
    return { current: Math.min(max, now + delta), temporary };
  }
  const temp = readHitPointNumber(temporary);
  const absorbed = Math.min(Math.max(0, temp ?? 0), -delta);
  return { current: Math.max(0, now + delta + absorbed), temporary: temp === null ? temporary : temp - absorbed };
}

export function hitPointTransition(previousCurrent, nextCurrent) {
  const before = readHitPointNumber(previousCurrent);
  const after = readHitPointNumber(nextCurrent);
  if (before === null || after === null) return null;
  if (before > 0 && after === 0) return 'down';
  if (before === 0 && after > 0) return 'up';
  return null;
}

export function hitPointTone(current, maximum) {
  const now = readHitPointNumber(current);
  const max = readHitPointNumber(maximum);
  const ratio = max && max > 0 && now !== null ? now / max : 0;
  return ratio < 0.2 ? 'danger' : ratio <= 0.5 ? 'warn' : 'ok';
}
