export interface AuraLimits {
  maxAuras: number;
  minRadiusCells: number;
  maxRadiusCells: number;
  maxNameLength: number;
  maxEffectLength: number;
}

export const AURA_COLORS: readonly string[];
export const AURA_LIMITS: AuraLimits;

export function radiusCellsFromUnit(value: number, cellsValue: number): number;

export interface SheetAuraRow {
  id: string;
  name?: string;
  effect?: string;
  radiusCells: number | string;
  color?: string;
  active?: boolean;
}

export interface ProjectedTokenAura {
  id: string;
  name: string;
  effect: string;
  radiusCells: number;
  color: string;
  active: boolean;
}

export function projectSheetAuras(rows: SheetAuraRow[] | null | undefined): ProjectedTokenAura[];

export interface AuraGridPosition {
  x: number;
  y: number;
}

export interface AuraFootprintToken {
  position: AuraGridPosition;
  size?: string;
  widthCells?: number | null;
  heightCells?: number | null;
}

export interface AuraRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function auraRect(ownerToken: AuraFootprintToken, radiusCells: number): AuraRect;

export interface AuraLike {
  radiusCells: number;
}

export function isTokenInAura(
  target: AuraFootprintToken,
  ownerToken: AuraFootprintToken,
  aura: AuraLike,
): boolean;

export interface AuraPresenceToken extends AuraFootprintToken {
  id: string;
  name: string;
  ownerUserId?: string | null;
  containedInVehicleId?: string | null;
  isFamiliar?: boolean;
  auras?: ProjectedTokenAura[];
}

export interface AuraPresenceState {
  tokens: AuraPresenceToken[];
}

export interface AuraPresenceRow {
  key: string;
  subjectTokenId: string;
  isFamiliar: boolean;
  subjectName: string;
  ownerName: string;
  auraName: string;
  effect: string;
}

export function auraPresenceFor(
  state: AuraPresenceState | null | undefined,
  userId: string | null | undefined,
): AuraPresenceRow[];
