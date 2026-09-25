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
// Modalità del tiro d'iniziativa scelta dalla scheda o dal Master (P0.8a); distinta dal vecchio
// `InitiativeMode` del roster, che nessun flusso legge più.
export type InitiativeRollMode = RollMode;
export type SessionMode = 'exploration' | 'combat';

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

export type DiagonalRule = 'standard' | 'alternating';
export type DiagonalParity = 0 | 1;

export interface MeasurementUnit {
  label: string;
  cellsValue: number;
}

export interface LightSource {
  id: string;
  position: GridPosition;
  radiusCells: number;
}

export type TemplateShape = 'circle' | 'cone' | 'line';

export interface EphemeralPing {
  id: string;
  position: GridPosition;
  authorUserId: string;
  authorName: string;
}

export interface EphemeralTemplate {
  id: string;
  shape: TemplateShape;
  origin: GridPosition;
  target: GridPosition;
  color: string;
  authorUserId: string;
  authorName: string;
}

export interface TokenWalkEvent {
  id: string;
  tokenId: string;
  waypoints: GridPosition[];
  // Falso per un passo singolo da tastiera: animazione senza binario del percorso.
  showTrack: boolean;
}

// Motivo per cui il server ha rifiutato un movimento, tenuto fuori dallo stato condiviso perche
// riguarda solo il client che ha inviato la richiesta.
export interface MovementNotice {
  id: string;
  message: string;
}

export interface TokenMovementBudget {
  usedCells: number;
  totalCells: number | null;
  diagonalParity: DiagonalParity;
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
  sessionMode: SessionMode;
  // Solo in combattimento: false durante la fase di tiro, true da quando il Master avvia il round 1.
  isRoundStarted: boolean;
  playersCanEndTurn: boolean;
  initiatives: InitiativeEntry[];
  activeTurnTokenId: string | null;
  roundNumber: number;
  turnNotice?: { id: number; kind: 'next' | 'turn' } | null;
  movementUsedByTokenId: Record<string, number>;
  diagonalParityByTokenId: Record<string, DiagonalParity>;
  diagonalRule: DiagonalRule;
  measurementUnit: MeasurementUnit;
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
  sessionMode: SessionMode;
  // Solo in combattimento: false durante la fase di tiro, true da quando il Master avvia il round 1.
  isRoundStarted: boolean;
  playersCanEndTurn: boolean;
  initiatives: InitiativeEntry[];
  activeTurnTokenId: string | null;
  roundNumber: number;
  turnNotice?: { id: number; kind: 'next' | 'turn' } | null;
  movementUsedByTokenId: Record<string, number>;
  diagonalParityByTokenId: Record<string, DiagonalParity>;
  diagonalRule: DiagonalRule;
  measurementUnit: MeasurementUnit;
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
  // Assente per un gruppo del tiro libero, che non ha un'etichetta come "Danno" o "Danno
  // secondario"; presente per un blocco di danno della scheda.
  label?: string;
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
  // Modificatore di Destrezza registrato alla creazione della voce, usato per lo spareggio. Il
  // server lo completa sempre; manca solo su una voce manuale non ancora accettata.
  dexModifier?: number;
  // Frazione di spareggio in [0, 1), generata dal server; mai mostrata, assente per gli Adventurer.
  tiebreaker?: number;
  mode?: InitiativeRollMode;
}
