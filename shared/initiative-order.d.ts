export interface OrderableInitiativeEntry {
  tokenId: string;
  value: number;
  dexModifier?: number;
  tiebreaker?: number;
}

export function compareInitiative(a: OrderableInitiativeEntry, b: OrderableInitiativeEntry): number;
export function insertInitiativeEntry<T extends OrderableInitiativeEntry>(entries: T[], entry: T): T[];
