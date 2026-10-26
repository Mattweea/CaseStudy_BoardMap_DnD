export interface MonsterAction {
  id: string;
  name: string;
  description: string;
  attackBonus: string;
  range: string;
  targets: string;
  damageFormula: string;
  damageType: string;
  recharge: string;
  remaining: string;
}
export interface MonsterData {
  kind: 'monster';
  [key: string]: string | MonsterAction[];
}
export const MONSTER_FIELDS: [string, string][];
export const MONSTER_COLLECTIONS: [string, string][];
export const MONSTER_ACTION_FIELDS: [string, string][];
export function emptyMonster(name?: string): MonsterData;
export function validateMonster(data: unknown): string | null;
export function splitCreatureData(value: unknown): { common: unknown; instance: { path: string[]; value: unknown }[] };
export function composeCreatureData(common: unknown, instance: { path: string[]; value: unknown }[]): unknown;
export function applySheetOperation(data: unknown, operation: unknown): void;
