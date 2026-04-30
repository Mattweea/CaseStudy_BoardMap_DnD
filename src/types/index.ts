export type TokenType = 'player' | 'enemy' | 'object' | 'vehicle';
export type UserRole = 'master' | 'adventurer';
export type CharacterKey =
  | 'master'
  | 'ilthar'
  | 'thalendir'
  | 'ragnar'
  | 'hunter'
  | 'sylas'
  | 'vesuth';
export type RollMode = 'normal' | 'advantage' | 'disadvantage';
export type InitiativeMode = Extract<RollMode, 'normal' | 'advantage'>;

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

export interface MovementAxisUsage {
  horizontal: number;
  vertical: number;
}

export interface UnitToken {
  id: string;
  name: string;
  type: TokenType;
  size: DndSize;
  position: GridPosition;
  widthCells?: number | null;
  heightCells?: number | null;
  color: string;
  initiativeModifier: number;
  initiativeMode?: InitiativeMode;
  movementCells?: number | null;
  affiliation?: TokenAffiliation | null;
  vehicleKind?: VehicleKind | null;
  vehicleOccupantIds?: string[];
  showVehicleOccupants?: boolean;
  containedInVehicleId?: string | null;
  imageUrl?: string | null;
  ownerUserId?: string | null;
  characterKey?: CharacterKey | null;
  groupId?: string | null;
  hitPoints?: number | null;
  maxHitPoints?: number | null;
  isInvisible?: boolean;
  isFamiliar?: boolean;
  blocksMovement?: boolean;
  excludeFromInitiative?: boolean;
  conditions: TokenCondition[];
}

export interface DicePreviewState {
  id: string;
  flavor: string;
  log: DiceRollLog;
}

export interface BattleMapState {
  tokens: UnitToken[];
  zoom: number;
  diceLogs: DiceRollLog[];
  latestDicePreview: DicePreviewState | null;
  initiatives: InitiativeEntry[];
  activeTurnTokenId: string | null;
  roundNumber: number;
  movementUsedByTokenId: Record<string, number>;
  movementAxisUsageByTokenId: Record<string, MovementAxisUsage>;
  dashUsedByTokenId: Record<string, boolean>;
  extraMovementByTokenId: Record<string, number>;
}

export interface BattleMapSharedState {
  tokens: UnitToken[];
  diceLogs: DiceRollLog[];
  latestDicePreview: DicePreviewState | null;
  initiatives: InitiativeEntry[];
  activeTurnTokenId: string | null;
  roundNumber: number;
  movementUsedByTokenId: Record<string, number>;
  movementAxisUsageByTokenId: Record<string, MovementAxisUsage>;
  dashUsedByTokenId: Record<string, boolean>;
  extraMovementByTokenId: Record<string, number>;
}

export interface BattleMapSessionSnapshot {
  savedAt: string;
  version: number;
  state: BattleMapSharedState;
}

export interface BattleMapSessionStatus {
  hasSnapshot: boolean;
  savedAt: string | null;
  version: number | null;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  characterKey?: CharacterKey | null;
  playerTokenId?: string | null;
  initiativeModifier?: number | null;
  initiativeMode?: InitiativeMode | null;
  movement?: string | null;
  movementCells?: number | null;
  darkvision?: string | null;
}

export interface DragState {
  tokenId: string;
  pointerId: number;
  hoverCell: GridPosition;
}

export type DiceType = 4 | 6 | 8 | 10 | 12 | 20 | 100;

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
