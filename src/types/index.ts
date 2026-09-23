import type { RolledDie } from '../../shared/dice-engine.mjs';

export type { DieDisposition, RolledDie } from '../../shared/dice-engine.mjs';

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

export interface LightSource {
  id: string;
  position: GridPosition;
  radiusCells: number;
}

export interface TokenAura {
  id: string;
  radiusCells: number;
  isVisible: boolean;
  color: string;
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
  temporaryHitPoints?: number | null;
  speed?: string | null;
  isInvisible?: boolean;
  isFamiliar?: boolean;
  blocksMovement?: boolean;
  excludeFromInitiative?: boolean;
  auras?: TokenAura[];
  conditions: TokenCondition[];
}

export interface DicePreviewState {
  id: string;
  flavor: string;
  rollerUserId?: string;
  log: DiceRollLog;
}

export interface CombatAnnouncement {
  id: string;
  title: string;
  message: string;
}

export interface BattleMapState {
  tokens: UnitToken[];
  zoom: number;
  diceLogs: DiceRollLog[];
  latestDicePreview: DicePreviewState | null;
  combatAnnouncement: CombatAnnouncement | null;
  initiatives: InitiativeEntry[];
  activeTurnTokenId: string | null;
  roundNumber: number;
  turnNotice?: { id: number; kind: 'next' | 'turn' } | null;
  movementUsedByTokenId: Record<string, number>;
  movementAxisUsageByTokenId: Record<string, MovementAxisUsage>;
  dashUsedByTokenId: Record<string, boolean>;
  extraMovementByTokenId: Record<string, number>;
  isBoardBackgroundHidden: boolean;
  isBoardFullyLit: boolean;
  sharedNotes: string;
  lightSources: LightSource[];
}

export interface BattleMapSharedState {
  tokens: UnitToken[];
  diceLogs: DiceRollLog[];
  latestDicePreview: DicePreviewState | null;
  combatAnnouncement: CombatAnnouncement | null;
  initiatives: InitiativeEntry[];
  activeTurnTokenId: string | null;
  roundNumber: number;
  turnNotice?: { id: number; kind: 'next' | 'turn' } | null;
  movementUsedByTokenId: Record<string, number>;
  movementAxisUsageByTokenId: Record<string, MovementAxisUsage>;
  dashUsedByTokenId: Record<string, boolean>;
  extraMovementByTokenId: Record<string, number>;
  isBoardBackgroundHidden: boolean;
  isBoardFullyLit: boolean;
  sharedNotes: string;
  lightSources: LightSource[];
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

export interface DiceRollLogPart {
  label: string;
  formula: string;
  rolls: number[];
  keptRolls: number[];
  modifier: number;
  total: number;
  critical?: boolean;
}

export interface DiceRollLogSavingThrow {
  ability: string | null;
  dc: string;
}

export interface DiceRollLog {
  id: string;
  label: string;
  formula: string;
  rollerName?: string;
  timestamp: string;
  // Per un bersaglio 1d20 della scheda (P0.5 Fase B), due tiri indipendenti: `rolls` porta
  // entrambi i valori naturali, senza vantaggio/svantaggio pre-scelto dal server. `total`/
  // `keptRolls` restano il primo dei due, per compatibilità con un lettore che guarda solo il
  // campo di primo livello. Il tiro libero di P0.3 e il dado vita restano un solo dado.
  rolls: number[];
  keptRolls: number[];
  total: number;
  modifier: number;
  mode: RollMode;
  authorUserId: string;
  visibility: 'public' | 'secret';
  dice?: RolledDie[];
  characterName?: string;
  actionLabel?: string;
  // true su un tiro di attacco quando uno dei due d20 raggiunge la soglia di critico, o su un
  // tiro di danno i cui dadi sono stati raddoppiati di conseguenza.
  critical?: boolean;
  // Bersaglio della scheda che ha originato il tiro: permette di rilanciare il danno di un
  // attacco dal log, e al client di dedurre il critico dall'ultimo tiro di attacco per lo stesso id.
  source?: { sheetId: string; target: string };
  parts?: DiceRollLogPart[];
  savingThrow?: DiceRollLogSavingThrow | null;
}

export interface DiceRollFormulaRequest {
  formula: string;
  visibility: 'public' | 'secret';
  mode?: RollMode;
}

export interface DiceRollSourceRequest {
  source: { sheetId: string; target: string };
  visibility?: 'public' | 'secret';
  // Dichiarato dal client per un tiro di danno (`attack-damage:<id>`): il server raddoppia i
  // dadi di ogni blocco attivo quando true. Ignorato per ogni altro bersaglio.
  critical?: boolean;
}

export type DiceRollRequest = DiceRollFormulaRequest | DiceRollSourceRequest;

export interface InitiativeEntry {
  tokenId: string;
  value: number;
  source: 'rolled' | 'manual';
}
