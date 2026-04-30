import type {
  CharacterKey,
  DndSize,
  GridPosition,
  InitiativeMode,
  TokenAffiliation,
  TokenCondition,
  TokenType,
  UnitToken,
  VehicleKind,
} from '../types';

export const DEFAULT_TOKEN_COLORS: Record<Exclude<TokenType, 'vehicle'>, string> = {
  player: '#4a6fd4',
  enemy: '#9b1f1b',
  object: '#8a5226',
};

export const TOKEN_COLOR_PALETTE = [
  '#6b8afd',
  '#3c5cc5',
  '#2a9d8f',
  '#64b65f',
  '#d1a13b',
  '#d97745',
  '#c75146',
  '#8f1815',
  '#b85fc7',
  '#7f6ad6',
  '#7d8a94',
  '#9a6b43',
] as const;

export const VEHICLE_PRESETS: Record<
  VehicleKind,
  { label: string; size: DndSize; capacity: number; icon: string }
> = {
  'infernal-bike': { label: 'Biruote infernale', size: 'large', capacity: 1, icon: '🏍️' },
  tormentor: { label: 'Tormentatore', size: 'huge', capacity: 4, icon: '🚙' },
  'demon-grinder': { label: 'Tritademoni', size: 'gargantuan', capacity: 8, icon: '🚂' },
};

export const CREATURE_CONDITIONS: TokenCondition[] = ['dead', 'prone', 'conditioned', 'inspired'];
export const VEHICLE_CONDITIONS: TokenCondition[] = ['broken', 'overturned'];

export function defaultVehicleColor(affiliation: TokenAffiliation): string {
  return affiliation === 'player' ? '#6e6e6e' : '#111111';
}

function sizeToCells(size: DndSize): number {
  switch (size) {
    case 'large':
      return 2;
    case 'huge':
      return 3;
    case 'gargantuan':
      return 4;
    case 'tiny':
    case 'small':
    case 'medium':
    default:
      return 1;
  }
}

export function createToken(
  name: string,
  type: TokenType,
  size: DndSize,
  index: number,
  color: string,
  initiativeModifier = 0,
  affiliation?: TokenAffiliation | null,
  vehicleKind?: VehicleKind | null,
  initiativeMode: InitiativeMode = 'normal',
  imageUrl?: string | null,
  ownerUserId?: string | null,
  characterKey?: CharacterKey | null,
): UnitToken {
  return {
    id: crypto.randomUUID(),
    name,
    type,
    size,
    position: {
      x: index % 5,
      y: Math.floor(index / 5),
    },
    color,
    initiativeModifier,
    initiativeMode,
    affiliation: affiliation ?? null,
    vehicleKind: vehicleKind ?? null,
    vehicleOccupantIds: [],
    showVehicleOccupants: type === 'vehicle' ? true : undefined,
    containedInVehicleId: null,
    imageUrl: imageUrl ?? null,
    ownerUserId: ownerUserId ?? null,
    characterKey: characterKey ?? null,
    groupId: null,
    hitPoints: null,
    maxHitPoints: null,
    isInvisible: false,
    isFamiliar: false,
    blocksMovement: false,
    excludeFromInitiative: false,
    conditions: [],
  };
}

function tokenFootprint(token: UnitToken): { width: number; height: number } {
  return {
    width:
      typeof token.widthCells === 'number' && token.widthCells > 0
        ? Math.max(1, Math.floor(token.widthCells))
        : sizeToCells(token.size),
    height:
      typeof token.heightCells === 'number' && token.heightCells > 0
        ? Math.max(1, Math.floor(token.heightCells))
        : sizeToCells(token.size),
  };
}

function overlapsFootprints(
  position: GridPosition,
  footprint: { width: number; height: number },
  token: UnitToken,
): boolean {
  const tokenSize = tokenFootprint(token);

  return !(
    position.x + footprint.width - 1 < token.position.x ||
    token.position.x + tokenSize.width - 1 < position.x ||
    position.y + footprint.height - 1 < token.position.y ||
    token.position.y + tokenSize.height - 1 < position.y
  );
}

export function findFirstAvailablePositionToRight(
  tokens: UnitToken[],
  footprint: { width: number; height: number },
  start: GridPosition,
): GridPosition {
  const startX = Math.max(0, start.x);
  const startY = Math.max(0, start.y);
  const horizontalSearchLimit = Math.max(
    startX + 1,
    ...tokens.map((token) => token.position.x + tokenFootprint(token).width),
  ) + 24;
  const verticalSearchLimit = Math.max(
    startY + 1,
    ...tokens.map((token) => token.position.y + tokenFootprint(token).height),
  ) + 24;

  for (let y = startY; y <= verticalSearchLimit; y += 1) {
    const xOrigin = y === startY ? startX : 0;
    for (let x = xOrigin; x <= horizontalSearchLimit; x += 1) {
      const candidate = { x, y };
      if (!tokens.some((token) => overlapsFootprints(candidate, footprint, token))) {
        return candidate;
      }
    }
  }

  return { x: startX, y: verticalSearchLimit + 1 };
}

export function findTokenName(tokens: UnitToken[], tokenId: string): string {
  return tokens.find((token) => token.id === tokenId)?.name ?? 'Sconosciuto';
}

export function tokenCompactLabel(name: string): string {
  const normalizedName = name.trim();
  const numberedMatch = normalizedName.match(/^(.*?)(?:\s+)(\d+)$/);
  if (numberedMatch) {
    const [, baseName, number] = numberedMatch;
    const initial = baseName.trim().charAt(0).toUpperCase() || '?';
    return `${initial}${number}`;
  }

  return normalizedName.replace(/\s+/g, '').slice(0, 2).toUpperCase() || '?';
}

export function tokenInitials(name: string): string {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return '?';
  }

  const numberedMatch = normalizedName.match(/^(.*?)(?:\s+)(\d+)$/);
  if (numberedMatch) {
    const [, baseName, number] = numberedMatch;
    const firstLetter = baseName.trim().charAt(0).toUpperCase() || '?';
    return `${firstLetter}${number}`;
  }

  const words = normalizedName.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return words
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export function vehicleCapacity(vehicleKind: VehicleKind): number {
  return VEHICLE_PRESETS[vehicleKind].capacity;
}

export function vehicleCompactLabel(vehicle: UnitToken, tokens: UnitToken[]): string {
  const kind = vehicle.vehicleKind ?? 'infernal-bike';
  const icon = VEHICLE_PRESETS[kind].icon;
  const occupantIds = vehicle.vehicleOccupantIds ?? [];
  const initials = occupantIds
    .map((occupantId) => tokens.find((token) => token.id === occupantId))
    .filter((token): token is UnitToken => Boolean(token))
    .map((token) => tokenInitials(token.name))
    .join('');

  return `${icon}${initials || '?'}`;
}

export function isCreature(token: UnitToken): boolean {
  return token.type === 'player' || token.type === 'enemy' || token.type === 'vehicle';
}

export function tokenTypeLabel(type: TokenType): string {
  switch (type) {
    case 'player':
      return 'PG';
    case 'enemy':
      return 'Nemico';
    case 'object':
      return 'Oggetto';
    case 'vehicle':
      return 'Mezzo';
    default:
      return type;
  }
}

export function tokenGroupLabel(type: TokenType): string {
  switch (type) {
    case 'player':
      return 'PG';
    case 'enemy':
      return 'Nemici';
    case 'object':
      return 'Oggetti';
    case 'vehicle':
      return 'Mezzi';
    default:
      return type;
  }
}

export function sizeLabel(size: DndSize): string {
  switch (size) {
    case 'tiny':
      return 'Minuscola';
    case 'small':
      return 'Piccola';
    case 'medium':
      return 'Media';
    case 'large':
      return 'Grande';
    case 'huge':
      return 'Enorme';
    case 'gargantuan':
      return 'Mastodontica';
    default:
      return size;
  }
}

export function conditionLabel(condition: TokenCondition): string {
  switch (condition) {
    case 'dead':
      return 'Morto';
    case 'prone':
      return 'Prono';
    case 'conditioned':
      return 'Condizionato';
    case 'inspired':
      return 'Ispirato';
    case 'broken':
      return 'Rotto';
    case 'overturned':
      return 'Ribaltato';
    default:
      return condition;
  }
}

export function tokenConditionOptions(token: UnitToken): TokenCondition[] {
  return token.type === 'vehicle' ? VEHICLE_CONDITIONS : CREATURE_CONDITIONS;
}

export function canUseCondition(tokenType: TokenType, condition: TokenCondition): boolean {
  if (tokenType === 'vehicle') {
    return VEHICLE_CONDITIONS.includes(condition);
  }

  if (tokenType === 'player' || tokenType === 'enemy') {
    return CREATURE_CONDITIONS.includes(condition);
  }

  return false;
}
