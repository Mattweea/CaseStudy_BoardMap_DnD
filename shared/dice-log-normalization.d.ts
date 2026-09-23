import type { RolledDie } from './dice-engine';

export function normalizeDiceDetail(value: unknown): RolledDie[] | undefined;
export function normalizeDiceLogDetail<T extends object>(log: T): Omit<T, 'dice'> & { dice?: RolledDie[] };
