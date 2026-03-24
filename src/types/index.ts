export type TokenType = 'player' | 'enemy' | 'object' | 'vehicle';

export type DndSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

export type TokenAffiliation = 'player' | 'enemy';

export type VehicleKind = 'infernal-bike' | 'tormentor' | 'demon-grinder';

export type TokenCondition =
  | 'dead'
  | 'prone'
  | 'conditioned'
  | 'inspired'
  | 'broken'
  | 'overturned';

export interface GridPosition {
  x: number;
  y: number;
}

export interface UnitToken {
  id: string;
  name: string;
  type: TokenType;
  size: DndSize;
  position: GridPosition;
  color: string;
  initiativeModifier: number;
  affiliation?: TokenAffiliation | null;
  vehicleKind?: VehicleKind | null;
  vehicleOccupantIds?: string[];
  showVehicleOccupants?: boolean;
  containedInVehicleId?: string | null;
  conditions: TokenCondition[];
}

export interface BattleMapState {
  tokens: UnitToken[];
  zoom: number;
  diceLogs: DiceRollLog[];
  initiatives: InitiativeEntry[];
  activeTurnTokenId: string | null;
}

export interface DragState {
  tokenId: string;
  pointerId: number;
  hoverCell: GridPosition;
}

export type DiceType = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export interface DiceRollLog {
  id: string;
  label: string;
  formula: string;
  rollerName?: string;
  timestamp: string;
  rolls: number[];
  keptRolls: number[];
  total: number;
  modifier: number;
  mode: RollMode;
}

export interface InitiativeEntry {
  tokenId: string;
  value: number;
  source: 'rolled' | 'manual';
}
