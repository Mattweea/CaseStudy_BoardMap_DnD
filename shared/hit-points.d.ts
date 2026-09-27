export type HitPointInput = { kind: 'delta'; value: number } | { kind: 'absolute'; value: number } | { kind: 'empty' } | { kind: 'invalid' };
export function parseHitPointInput(text: string): HitPointInput;
export function readHitPointNumber(text: string | number | null | undefined): number | null;
export interface HitPointValues { current: string | number | null; temporary: string | number | null; maximum: string | number | null }
export function applyHitPointDelta(values: HitPointValues, delta: number): { current: number; temporary: string | number | null } | { error: 'missing-current' | 'missing-maximum' };
export function hitPointTransition(previousCurrent: string | number | null, nextCurrent: string | number | null): 'down' | 'up' | null;
export function hitPointTone(current: string | number | null, maximum: string | number | null): 'ok' | 'warn' | 'danger';
