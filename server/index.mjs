import Fastify from 'fastify';
import { randomBytes, randomUUID } from 'node:crypto';
import { normalizeDiceLogDetail } from '../shared/dice-log-normalization.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHARACTER_PROFILES,
  findCharacterProfileById,
  findCharacterProfileByUsername,
} from './characters.mjs';
import { openDatabase } from '../database/connection.mjs';
import { bootstrapRoster, AuthService } from './auth-service.mjs';
import { UserRepository } from './user-repository.mjs';
import { bootstrapCharacterSheets } from './character-sheet-bootstrap.mjs';
import { CharacterSheetPolicy } from './character-sheet-policy.mjs';
import { broadcastCharacterSheetEvent as broadcastSheetEvent } from './character-sheet-events.mjs';
import { CharacterSheetRepository } from './character-sheet-repository.mjs';
import { registerCharacterSheetRoutes } from './character-sheet-routes.mjs';
import { CharacterSheetService } from './character-sheet-service.mjs';
import { rollCharacterSheetTarget } from './character-sheet-roll-resolver.mjs';
import { createAuthoritativeRoll } from './authoritative-roll.mjs';
import { canUserSeeDiceLog, visibleDiceLogsForUser } from './dice-log-visibility.mjs';
import { PortraitStorage } from './portrait-storage.mjs';
import { findCharacterTokenForOwner, rollInitiative } from './initiative-roll.mjs';
import { insertInitiativeEntry } from '../shared/initiative-order.mjs';
import { isValidCellsValue, pathCost } from '../shared/grid-movement.mjs';
import { abilityModifier } from '../shared/dnd-rules.mjs';

const app = Fastify({
  logger: true,
});

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const SESSION_COOKIE = 'battle_map_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DATA_DIR = path.join(SERVER_DIR, 'data');
const SESSION_SNAPSHOT_PATH = path.join(SESSION_DATA_DIR, 'last-session.json');
const PORTRAIT_STORAGE_PATH = path.join(SESSION_DATA_DIR, 'portraits');

const DEFAULT_TOKEN_COLORS = {
  player: '#2f9e44',
  enemy: '#c92a2a',
  object: '#e67700',
  vehicle: '#495057',
};

const VEHICLE_PRESETS = {
  'infernal-bike': { size: 'large', capacity: 1 },
  tormentor: { size: 'huge', capacity: 4 },
  'demon-grinder': { size: 'gargantuan', capacity: 8 },
};

const initialSharedState = {
  tokens: [],
  diceLogs: [],
  latestDicePreview: null,
  combatAnnouncement: null,
  sessionMode: 'exploration',
  isRoundStarted: false,
  playersCanEndTurn: false,
  initiatives: [],
  activeTurnTokenId: null,
  roundNumber: 1,
  movementUsedByTokenId: {},
  diagonalParityByTokenId: {},
  diagonalRule: 'standard',
  measurementUnit: { label: 'm', cellsValue: 1.5 },
  dashUsedByTokenId: {},
  extraMovementByTokenId: {},
  isBoardBackgroundHidden: false,
  isBoardFullyLit: false,
  sharedNotes: '',
  lightSources: [],
};

const MAX_MOVEMENT_WAYPOINTS = 40;
const INITIATIVE_ROLL_MODES = new Set(['normal', 'advantage', 'disadvantage']);

// Dichiarato prima del primo `normalizeSharedState`: la normalizzazione delle voci d'iniziativa
// lo consulta per ricavare il modificatore di Destrezza dalla scheda collegata a un token.
let characterSheetService;
let battleMapState = normalizeSharedState(initialSharedState);
let battleMapVersion = 1;
let turnTransitionId = 0;
let lastSessionSnapshot = null;
const streamClients = new Set();
const masterUndoStack = [];
const playerUndoStackByUserId = new Map();
const MAX_UNDO_STEPS = 40;
function defaultVehicleColor(side) {
  return side === 'enemy' ? '#7f1d1d' : '#374151';
}

function normalizeVehicleLinks(tokens) {
  const clonedTokens = tokens.map((token) => ({
    ...token,
    vehicleOccupantIds: token.type === 'vehicle' ? [...(token.vehicleOccupantIds ?? [])] : [],
    showVehicleOccupants: token.type === 'vehicle' ? token.showVehicleOccupants ?? true : undefined,
    containedInVehicleId: token.containedInVehicleId ?? null,
  }));
  const tokenMap = new Map(clonedTokens.map((token) => [token.id, token]));

  clonedTokens.forEach((token) => {
    token.containedInVehicleId = null;
  });

  clonedTokens.forEach((token) => {
    if (token.type !== 'vehicle') {
      token.vehicleOccupantIds = [];
      return;
    }

    const dedupedOccupants = [];
    const seen = new Set();

    (token.vehicleOccupantIds ?? []).forEach((occupantId) => {
      if (seen.has(occupantId)) {
        return;
      }

      const occupant = tokenMap.get(occupantId);
      if (!occupant || occupant.id === token.id || occupant.type === 'object' || occupant.type === 'vehicle') {
        return;
      }

      seen.add(occupantId);
      dedupedOccupants.push(occupantId);
      occupant.containedInVehicleId = token.id;
    });

    token.vehicleOccupantIds = dedupedOccupants;
    const footprint = getTokenFootprint(token);
    const cells = [];
    for (let row = 0; row < footprint.height; row += 1) {
      for (let column = 0; column < footprint.width; column += 1) {
        cells.push({
          x: token.position.x + column,
          y: token.position.y + row,
        });
      }
    }

    dedupedOccupants.forEach((occupantId, index) => {
      const occupant = tokenMap.get(occupantId);
      if (!occupant) {
        return;
      }

      occupant.position = cells[index] ?? { ...token.position };
    });
  });

  return clonedTokens;
}

function applyVehicleAwareUpdates(tokens) {
  const normalized = normalizeVehicleLinks(tokens);
  const vehicleMap = new Map(
    normalized
      .filter((token) => token.type === 'vehicle')
      .map((token) => [token.id, token]),
  );

  return normalized.map((token) => {
    if (!token.containedInVehicleId) {
      return token;
    }

    const vehicle = vehicleMap.get(token.containedInVehicleId);
    if (!vehicle) {
      return {
        ...token,
        containedInVehicleId: null,
      };
    }

    return {
      ...token,
      position: { ...token.position },
    };
  });
}

function normalizeSharedState(parsed) {
  const tokens = Array.isArray(parsed?.tokens)
    ? parsed.tokens.map((token) => {
        const { aura: legacyAura, ...tokenWithoutLegacyAura } = token;
        const type = token.type ?? 'object';
        const affiliation =
          token.affiliation ??
          (type === 'enemy' ? 'enemy' : type === 'player' ? 'player' : null);
        const fallbackColor =
          type === 'vehicle'
            ? defaultVehicleColor(affiliation === 'enemy' ? 'enemy' : 'player')
            : DEFAULT_TOKEN_COLORS[type];

        return {
          ...tokenWithoutLegacyAura,
          type,
          size: token.size ?? (token.vehicleKind ? VEHICLE_PRESETS[token.vehicleKind].size : 'medium'),
          widthCells:
            typeof token.widthCells === 'number' && token.widthCells > 0
              ? Math.max(1, Math.floor(token.widthCells))
              : null,
          heightCells:
            typeof token.heightCells === 'number' && token.heightCells > 0
              ? Math.max(1, Math.floor(token.heightCells))
              : null,
          color: token.color ?? fallbackColor,
          initiativeModifier:
            typeof token.initiativeModifier === 'number' ? token.initiativeModifier : 0,
          initiativeMode: token.initiativeMode === 'advantage' ? 'advantage' : 'normal',
          movementCells:
            typeof token.movementCells === 'number' ? token.movementCells : null,
          affiliation,
          vehicleKind: token.vehicleKind ?? null,
          vehicleOccupantIds: Array.isArray(token.vehicleOccupantIds) ? token.vehicleOccupantIds : [],
          showVehicleOccupants:
            type === 'vehicle'
              ? typeof token.showVehicleOccupants === 'boolean'
                ? token.showVehicleOccupants
                : true
              : undefined,
          containedInVehicleId:
            typeof token.containedInVehicleId === 'string' ? token.containedInVehicleId : null,
          imageUrl: typeof token.imageUrl === 'string' ? token.imageUrl : null,
          ownerUserId: typeof token.ownerUserId === 'string' ? token.ownerUserId : null,
          characterKey: typeof token.characterKey === 'string' ? token.characterKey : null,
          groupId: typeof token.groupId === 'string' ? token.groupId : null,
          hitPoints: typeof token.hitPoints === 'number' ? token.hitPoints : null,
          maxHitPoints: typeof token.maxHitPoints === 'number' ? token.maxHitPoints : null,
          isInvisible: token.isInvisible === true,
          isFamiliar: token.isFamiliar === true,
          blocksMovement: token.blocksMovement === true,
          excludeFromInitiative: token.excludeFromInitiative === true,
          auras: Array.isArray(token.auras)
            ? token.auras.flatMap((aura, index) =>
                aura && typeof aura.radiusCells === 'number'
                  ? [{
                      id: typeof aura.id === 'string' ? aura.id : `${token.id}-aura-${index}`,
                      radiusCells: Math.max(0, Math.floor(aura.radiusCells)),
                      isVisible: aura.isVisible !== false,
                      color: typeof aura.color === 'string' ? aura.color : token.color,
                    }]
                  : [],
              )
            : legacyAura &&
                typeof legacyAura === 'object' &&
                legacyAura.enabled === true &&
                typeof legacyAura.radiusCells === 'number'
              ? [{
                  id: `${token.id}-aura-legacy`,
                  radiusCells: Math.max(0, Math.floor(legacyAura.radiusCells)),
                  isVisible: true,
                  color: token.color,
                }]
              : [],
          conditions: Array.isArray(token.conditions) ? token.conditions : [],
        };
      })
    : initialSharedState.tokens;
  // Modalità di sessione (P0.8a). Uno snapshot precedente non ha `sessionMode`: con voci
  // d'iniziativa è un incontro in corso (a round avviato se c'è un turno attivo), senza voci è
  // esplorazione. Le invarianti per modalità valgono per ogni stato, legacy o no.
  const rawInitiatives = normalizeInitiativeEntries(parsed?.initiatives, tokens);
  const rawActiveTurnTokenId =
    typeof parsed?.activeTurnTokenId === 'string' ? parsed.activeTurnTokenId : null;
  const hasSessionMode = parsed?.sessionMode === 'exploration' || parsed?.sessionMode === 'combat';
  const sessionMode = hasSessionMode
    ? parsed.sessionMode
    : rawInitiatives.length > 0 ? 'combat' : 'exploration';
  const isRoundStarted = sessionMode === 'combat' &&
    (hasSessionMode ? parsed?.isRoundStarted === true : rawActiveTurnTokenId !== null);
  const initiatives = sessionMode === 'combat' ? rawInitiatives : [];
  const activeTurnTokenId = isRoundStarted ? rawActiveTurnTokenId : null;
  const lightSources = Array.isArray(parsed?.lightSources)
    ? parsed.lightSources.flatMap((light) => {
        if (
          typeof light.id !== 'string' ||
          !light.position ||
          typeof light.position.x !== 'number' ||
          typeof light.position.y !== 'number' ||
          typeof light.radiusCells !== 'number'
        ) {
          return [];
        }

        return [{
          id: light.id,
          position: {
            x: Math.max(0, Math.floor(light.position.x)),
            y: Math.max(0, Math.floor(light.position.y)),
          },
          radiusCells: Math.max(0, Math.floor(light.radiusCells)),
        }];
      })
    : [];

  const rawMovementUsed =
    parsed?.movementUsedByTokenId && typeof parsed.movementUsedByTokenId === 'object'
      ? Object.fromEntries(
          Object.entries(parsed.movementUsedByTokenId).filter(
            ([tokenId, used]) =>
              tokens.some((token) => token.id === tokenId) &&
              typeof used === 'number' &&
              used >= 0,
          ),
        )
      : {};
  // Compatibilità: uno snapshot pre-P0.7 porta il conteggio per asse invece del costo di percorso.
  // Si converte con la vecchia regola (`max(horizontal, vertical)`) solo quando il token non ha già
  // un movimento usato registrato, poi il campo viene scartato: nessun personaggio si ritrova a metà
  // turno con più movimento speso di quanto ne avesse speso prima del riavvio.
  const legacyAxisUsageEntries =
    parsed?.movementAxisUsageByTokenId && typeof parsed.movementAxisUsageByTokenId === 'object'
      ? Object.entries(parsed.movementAxisUsageByTokenId).flatMap(([tokenId, usage]) => {
          if (
            rawMovementUsed[tokenId] !== undefined ||
            !tokens.some((token) => token.id === tokenId) ||
            !usage ||
            typeof usage !== 'object' ||
            typeof usage.horizontal !== 'number' ||
            typeof usage.vertical !== 'number' ||
            usage.horizontal < 0 ||
            usage.vertical < 0
          ) {
            return [];
          }

          return [[tokenId, Math.max(usage.horizontal, usage.vertical)]];
        })
      : [];
  const movementUsedByTokenId = { ...rawMovementUsed, ...Object.fromEntries(legacyAxisUsageEntries) };

  const diagonalParityByTokenId =
    parsed?.diagonalParityByTokenId && typeof parsed.diagonalParityByTokenId === 'object'
      ? Object.fromEntries(
          Object.entries(parsed.diagonalParityByTokenId).filter(
            ([tokenId, parity]) =>
              tokens.some((token) => token.id === tokenId) && (parity === 0 || parity === 1),
          ),
        )
      : {};

  const diagonalRule = parsed?.diagonalRule === 'alternating' ? 'alternating' : 'standard';
  const measurementUnit =
    parsed?.measurementUnit &&
    typeof parsed.measurementUnit === 'object' &&
    typeof parsed.measurementUnit.label === 'string' &&
    parsed.measurementUnit.label.trim() !== '' &&
    isValidCellsValue(parsed.measurementUnit.cellsValue)
      ? { label: parsed.measurementUnit.label, cellsValue: parsed.measurementUnit.cellsValue }
      : { label: 'm', cellsValue: 1.5 };

  return {
    tokens: applyVehicleAwareUpdates(tokens),
    diceLogs: Array.isArray(parsed?.diceLogs)
      ? parsed.diceLogs.flatMap((log) => (log && typeof log === 'object' && typeof log.authorUserId === 'string' &&
          (log.visibility === 'public' || log.visibility === 'secret') && Array.isArray(log.rolls) &&
          typeof log.total === 'number'
        ? [normalizeDiceLogDetail({
          ...log,
          formula: log.formula ?? log.label,
        })] : []))
      : [],
    latestDicePreview:
      parsed?.latestDicePreview &&
      typeof parsed.latestDicePreview === 'object' &&
      typeof parsed.latestDicePreview.id === 'string' &&
      typeof parsed.latestDicePreview.flavor === 'string' &&
      parsed.latestDicePreview.log &&
      typeof parsed.latestDicePreview.log === 'object'
        ? {
            id: parsed.latestDicePreview.id,
            flavor: parsed.latestDicePreview.flavor,
            rollerUserId:
              typeof parsed.latestDicePreview.rollerUserId === 'string'
                ? parsed.latestDicePreview.rollerUserId
                : undefined,
            log: normalizeDiceLogDetail({
              ...parsed.latestDicePreview.log,
              formula:
                parsed.latestDicePreview.log.formula ?? parsed.latestDicePreview.log.label ?? '',
            }),
          }
        : null,
    combatAnnouncement:
      parsed?.combatAnnouncement &&
      typeof parsed.combatAnnouncement === 'object' &&
      typeof parsed.combatAnnouncement.id === 'string' &&
      typeof parsed.combatAnnouncement.title === 'string' &&
      typeof parsed.combatAnnouncement.message === 'string'
        ? {
            id: parsed.combatAnnouncement.id,
            title: parsed.combatAnnouncement.title,
            message: parsed.combatAnnouncement.message,
          }
        : null,
    sessionMode,
    isRoundStarted,
    playersCanEndTurn: parsed?.playersCanEndTurn === true,
    initiatives,
    activeTurnTokenId,
    roundNumber: typeof parsed?.roundNumber === 'number' && parsed.roundNumber > 0 ? parsed.roundNumber : 1,
    movementUsedByTokenId,
    diagonalParityByTokenId,
    diagonalRule,
    measurementUnit,
    dashUsedByTokenId:
      parsed?.dashUsedByTokenId && typeof parsed.dashUsedByTokenId === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.dashUsedByTokenId).filter(
              ([tokenId, used]) =>
                tokens.some((token) => token.id === tokenId) && typeof used === 'boolean',
            ),
          )
        : {},
    extraMovementByTokenId:
      parsed?.extraMovementByTokenId && typeof parsed.extraMovementByTokenId === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.extraMovementByTokenId).filter(
              ([tokenId, extra]) =>
                tokens.some((token) => token.id === tokenId) &&
                typeof extra === 'number' &&
                extra >= 0,
            ),
          )
        : {},
    isBoardBackgroundHidden: parsed?.isBoardBackgroundHidden === true,
    isBoardFullyLit: parsed?.isBoardFullyLit === true,
    sharedNotes: typeof parsed?.sharedNotes === 'string' ? parsed.sharedNotes : '',
    lightSources,
  };
}

// Token collegato a una scheda: il personaggio (non famiglio) di un utente. La scheda è quella
// del proprietario, la stessa usata dalla proiezione scheda → token.
function findLinkedSheetId(token) {
  if (!token || token.type !== 'player' || token.isFamiliar === true || !token.ownerUserId) return null;
  try {
    return characterSheetService?.findIdByOwner(token.ownerUserId) ?? null;
  } catch {
    return null;
  }
}

// Modificatore di Destrezza per lo spareggio: dal punteggio della scheda collegata, altrimenti
// dal modificatore d'iniziativa del token (un PNG senza scheda non ha una Destrezza separata).
function dexModifierForToken(token) {
  const sheetId = findLinkedSheetId(token);
  if (sheetId) {
    try {
      const modifier = abilityModifier(characterSheetService.readInternal(sheetId).character.abilities.dexterity.score);
      if (modifier !== null) return modifier;
    } catch {
      // Scheda illeggibile: si ricade sul modificatore del token.
    }
  }
  return typeof token?.initiativeModifier === 'number' ? token.initiativeModifier : 0;
}

function createTiebreaker() {
  return randomBytes(4).readUInt32BE(0) / 0x1_0000_0000;
}

// Completa ogni voce: una per token esistente, valore numerico, Destrezza registrata e frazione
// di spareggio. Solo il server genera la frazione mancante; una frazione esistente resta stabile.
function normalizeInitiativeEntries(rawEntries, tokens) {
  if (!Array.isArray(rawEntries)) return [];
  const tokenById = new Map(tokens.map((token) => [token.id, token]));
  const seen = new Set();
  return rawEntries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || typeof entry.tokenId !== 'string') return [];
    const token = tokenById.get(entry.tokenId);
    if (!token || seen.has(entry.tokenId) || typeof entry.value !== 'number' || !Number.isFinite(entry.value)) return [];
    seen.add(entry.tokenId);
    const normalized = {
      tokenId: entry.tokenId,
      value: entry.value,
      source: entry.source === 'rolled' ? 'rolled' : 'manual',
      dexModifier: typeof entry.dexModifier === 'number' && Number.isFinite(entry.dexModifier)
        ? entry.dexModifier
        : dexModifierForToken(token),
      tiebreaker: typeof entry.tiebreaker === 'number' && entry.tiebreaker >= 0 && entry.tiebreaker < 1
        ? entry.tiebreaker
        : createTiebreaker(),
    };
    if (INITIATIVE_ROLL_MODES.has(entry.mode)) normalized.mode = entry.mode;
    return [normalized];
  });
}

function gridDistance(from, to) {
  return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
}

function sizeToCells(size) {
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

function getTokenFootprint(token) {
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

function isCreatureToken(token) {
  return token.type === 'player' || token.type === 'enemy';
}

function tokensOverlap(left, right) {
  const leftFootprint = getTokenFootprint(left);
  const rightFootprint = getTokenFootprint(right);

  return !(
    left.position.x + leftFootprint.width - 1 < right.position.x ||
    right.position.x + rightFootprint.width - 1 < left.position.x ||
    left.position.y + leftFootprint.height - 1 < right.position.y ||
    right.position.y + rightFootprint.height - 1 < left.position.y
  );
}

function findCreatureOverlap(tokens) {
  const visibleCreatures = tokens.filter(
    (token) => isCreatureToken(token) && !token.containedInVehicleId,
  );

  for (let index = 0; index < visibleCreatures.length; index += 1) {
    const current = visibleCreatures[index];

    for (let comparisonIndex = index + 1; comparisonIndex < visibleCreatures.length; comparisonIndex += 1) {
      const other = visibleCreatures[comparisonIndex];
      if (tokensOverlap(current, other)) {
        return { current, other };
      }
    }
  }

  return null;
}

function validateSharedState(nextState) {
  const overlap = findCreatureOverlap(nextState.tokens);
  if (overlap) {
    return {
      status: 400,
      message: `${overlap.current.name} e ${overlap.other.name} non possono sovrapporsi fuori da un veicolo.`,
    };
  }

  const vehicles = nextState.tokens.filter((token) => token.type === 'vehicle');
  for (const vehicle of vehicles) {
    const occupantCount = (vehicle.vehicleOccupantIds ?? []).length;
    const seatCapacity = VEHICLE_PRESETS[vehicle.vehicleKind ?? 'infernal-bike'].capacity;

    if (occupantCount > seatCapacity) {
      return {
        status: 400,
        message: `${vehicle.name} supera i posti disponibili del mezzo.`,
      };
    }
  }

  return null;
}

function isMovementBlockingToken(token) {
  return token.blocksMovement === true;
}

function canTokenIgnoreObstacles(token, user) {
  return user?.role === 'master' || token.type === 'vehicle';
}

function findBlockingObstacle(tokens, movingTokenId, position, footprint) {
  return tokens.find((token) => {
    if (token.id === movingTokenId || !isMovementBlockingToken(token)) {
      return false;
    }

    const obstacleFootprint = getTokenFootprint(token);
    return !(
      position.x + footprint.width - 1 < token.position.x ||
      token.position.x + obstacleFootprint.width - 1 < position.x ||
      position.y + footprint.height - 1 < token.position.y ||
      token.position.y + obstacleFootprint.height - 1 < position.y
    );
  }) ?? null;
}

function findBlockedMovement(tokens, movingToken, from, to) {
  const footprint = getTokenFootprint(movingToken);
  const stepX = Math.sign(to.x - from.x);
  const stepY = Math.sign(to.y - from.y);
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  let currentX = from.x;
  let currentY = from.y;

  for (let index = 0; index < steps; index += 1) {
    if (currentX !== to.x) {
      currentX += stepX;
    }
    if (currentY !== to.y) {
      currentY += stepY;
    }

    const obstacle = findBlockingObstacle(tokens, movingToken.id, { x: currentX, y: currentY }, footprint);
    if (obstacle) {
      return obstacle;
    }
  }

  return null;
}

function isValidWaypoint(point) {
  return (
    Boolean(point) &&
    typeof point === 'object' &&
    Number.isInteger(point.x) &&
    Number.isInteger(point.y) &&
    point.x >= 0 &&
    point.y >= 0
  );
}

function firstAvailablePositionToRight(tokens, footprint, start) {
  const startX = Math.max(0, start.x);
  const startY = Math.max(0, start.y);
  const horizontalSearchLimit = Math.max(
    startX + 1,
    ...tokens.map((token) => token.position.x + getTokenFootprint(token).width),
  ) + 24;
  const verticalSearchLimit = Math.max(
    startY + 1,
    ...tokens.map((token) => token.position.y + getTokenFootprint(token).height),
  ) + 24;

  for (let y = startY; y <= verticalSearchLimit; y += 1) {
    const xOrigin = y === startY ? startX : 0;
    for (let x = xOrigin; x <= horizontalSearchLimit; x += 1) {
      const position = { x, y };
      const overlaps = tokens.some((token) => {
        const tokenFootprint = getTokenFootprint(token);
        return !(
          position.x + footprint.width - 1 < token.position.x ||
          token.position.x + tokenFootprint.width - 1 < position.x ||
          position.y + footprint.height - 1 < token.position.y ||
          token.position.y + tokenFootprint.height - 1 < position.y
        );
      });

      if (!overlaps) {
        return position;
      }
    }
  }

  return { x: startX, y: verticalSearchLimit + 1 };
}

function findUserControlledVehicle(user) {
  if (!user) {
    return null;
  }

  const playerToken =
    battleMapState.tokens.find(
      (token) => token.ownerUserId === user.id && token.type === 'player' && token.isFamiliar !== true,
    ) ?? null;
  if (!playerToken) {
    return null;
  }

  return (
    battleMapState.tokens.find(
      (token) =>
        token.type === 'vehicle' &&
        Array.isArray(token.vehicleOccupantIds) &&
        token.vehicleOccupantIds.includes(playerToken.id),
    ) ?? null
  );
}

function isTokenVisibleToUser(token, user) {
  return !user || user.role === 'master' || token.isInvisible !== true || token.ownerUserId === user.id;
}

function sanitizeStateForUser(state, user) {
  const visibleDiceLogs = visibleDiceLogsForUser(state.diceLogs, user);
  const visiblePreview = state.latestDicePreview && canUserSeeDiceLog(state.latestDicePreview.log, user)
    ? state.latestDicePreview
    : null;
  if (!user || user.role === 'master') {
    return { ...state, diceLogs: visibleDiceLogs, latestDicePreview: visiblePreview };
  }

  const visibleTokens = state.tokens.filter((token) => isTokenVisibleToUser(token, user));
  const visibleTokenIds = new Set(visibleTokens.map((token) => token.id));
  const visibleInitiatives = state.initiatives.filter((entry) => visibleTokenIds.has(entry.tokenId));
  const visibleDicePreview =
    state.latestDicePreview?.rollerUserId === user.id ? state.latestDicePreview : null;

  const sanitized = normalizeSharedState({
    ...state,
    tokens: visibleTokens,
    latestDicePreview: visibleDicePreview,
    initiatives: visibleInitiatives,
    activeTurnTokenId: visibleTokenIds.has(state.activeTurnTokenId) ? state.activeTurnTokenId : null,
    diceLogs: visibleDiceLogs,
    latestDicePreview: visiblePreview,
  });
  // La frazione di spareggio non raggiunge mai un Adventurer: l'ordine gli arriva già deciso.
  return {
    ...sanitized,
    initiatives: sanitized.initiatives.map(({ tiebreaker: _tiebreaker, ...entry }) => entry),
  };
}

function getTurnNotice(user) {
  if (!user || user.role === 'master' || !battleMapState.isRoundStarted || !battleMapState.activeTurnTokenId) return null;
  const ownToken = battleMapState.tokens.find((token) => token.ownerUserId === user.id && token.type === 'player');
  const activeIndex = battleMapState.initiatives.findIndex((entry) => entry.tokenId === battleMapState.activeTurnTokenId);
  const ownIndex = battleMapState.initiatives.findIndex((entry) => entry.tokenId === ownToken?.id);
  if (activeIndex < 0 || ownIndex < 0) return null;
  const kind = activeIndex === ownIndex ? 'turn' : (activeIndex + 1) % battleMapState.initiatives.length === ownIndex ? 'next' : null;
  return kind ? { id: turnTransitionId, kind } : null;
}

function nextSnapshot(user = null) {
  return {
    state: { ...sanitizeStateForUser(battleMapState, user), turnNotice: getTurnNotice(user) },
    version: battleMapVersion,
  };
}

function getSessionStatus() {
  return {
    hasSnapshot: Boolean(lastSessionSnapshot),
    savedAt: lastSessionSnapshot?.savedAt ?? null,
    version: typeof lastSessionSnapshot?.version === 'number' ? lastSessionSnapshot.version : null,
  };
}

function cloneStateSnapshot(state = battleMapState) {
  return JSON.parse(JSON.stringify(state));
}

function pushMasterUndoState() {
  masterUndoStack.push(cloneStateSnapshot());
  if (masterUndoStack.length > MAX_UNDO_STEPS) {
    masterUndoStack.shift();
  }
}

function pushPlayerUndoAction(userId, action) {
  const currentStack = playerUndoStackByUserId.get(userId) ?? [];
  currentStack.push(action);
  if (currentStack.length > MAX_UNDO_STEPS) {
    currentStack.shift();
  }
  playerUndoStackByUserId.set(userId, currentStack);
}

async function persistSessionSnapshot(snapshot) {
  await mkdir(SESSION_DATA_DIR, { recursive: true });
  await writeFile(SESSION_SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
  lastSessionSnapshot = snapshot;
}

async function saveCurrentSessionSnapshot() {
  const snapshot = {
    savedAt: new Date().toISOString(),
    version: battleMapVersion,
    state: battleMapState,
  };

  await persistSessionSnapshot(snapshot);
  return snapshot;
}

async function readPersistedSessionSnapshot() {
  try {
    const rawSnapshot = await readFile(SESSION_SNAPSHOT_PATH, 'utf8');
    const parsedSnapshot = JSON.parse(rawSnapshot);
    const normalizedState = normalizeSharedState(parsedSnapshot?.state);
    const version = typeof parsedSnapshot?.version === 'number' && parsedSnapshot.version > 0
      ? parsedSnapshot.version
      : 1;
    const snapshot = {
      savedAt:
        typeof parsedSnapshot?.savedAt === 'string'
          ? parsedSnapshot.savedAt
          : new Date().toISOString(),
      version,
      state: normalizedState,
    };

    return snapshot;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      app.log.error(error, 'Unable to load persisted session snapshot.');
    }

    return null;
  }
}

async function loadPersistedSessionMetadata() {
  const snapshot = await readPersistedSessionSnapshot();
  lastSessionSnapshot = snapshot;
  return snapshot;
}

function bumpBattleMapVersion() {
  battleMapVersion += 1;
}

function broadcastSnapshot() {
  streamClients.forEach((client) => {
    try {
      client.write(`data: ${JSON.stringify(nextSnapshot(client.user))}\n\n`);
    } catch (error) {
      streamClients.delete(client);
    }
  });
}

function broadcastCharacterSheetEvent(event, sheet) {
  broadcastSheetEvent(streamClients, event, sheet, characterSheetPolicy);
}

const TEMPLATE_SHAPES = new Set(['circle', 'cone', 'line']);

// Sagome e ping sono eventi SSE nominati sullo stesso stream dello snapshot: mai scritti in
// battleMapState, mai versionati, mai inclusi in uno snapshot o in una persistenza. Una
// riconnessione dopo la loro scomparsa non ne trova traccia perché non esistono al di fuori di
// questa trasmissione una tantum.
function broadcastEphemeralEvent(type, payload, { filterByOriginToken = null } = {}) {
  const event = { type, ...payload };
  streamClients.forEach((client) => {
    if (filterByOriginToken && !isTokenVisibleToUser(filterByOriginToken, client.user)) {
      return;
    }
    try {
      client.write(`event: ${type}\ndata: ${JSON.stringify(event)}\n\n`);
    } catch {
      streamClients.delete(client);
    }
  });
}

// Trasmette il percorso di un movimento appena accettato così ogni client (non solo chi lo ha
// mosso) possa riprodurre la stessa camminata animata invece di vedere solo la posizione finale.
// Puramente presentazionale: non tocca battleMapState, la versione o lo snapshot.
// `showTrack` è falso per un passo singolo da tastiera o dal pad: il token si anima comunque, ma
// senza il binario del percorso, che serve solo a leggere un movimento pianificato.
function broadcastTokenWalk(token, waypoints, showTrack = true) {
  broadcastEphemeralEvent('token-walk', { tokenId: token.id, waypoints, showTrack }, { filterByOriginToken: token });
}

function sendPing(user, position) {
  if (!isValidWaypoint(position)) {
    return { status: 400, message: 'Posizione del ping non valida.' };
  }

  broadcastEphemeralEvent('ephemeral-ping', {
    id: randomUUID(),
    position,
    authorUserId: user.id,
    authorName: user.displayName,
  });
  return { status: 200 };
}

function sendTemplateEvent(user, body) {
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  const phase = body?.phase === 'end' ? 'end' : body?.phase === 'update' ? 'update' : null;
  if (!id || id.length > 64 || !phase) {
    return { status: 400, message: 'Payload sagoma non valido.' };
  }

  if (phase === 'end') {
    broadcastEphemeralEvent('ephemeral-template-end', { id });
    return { status: 200 };
  }

  const shape = body?.shape;
  const color = body?.color;
  if (
    !TEMPLATE_SHAPES.has(shape) ||
    !isValidWaypoint(body?.origin) ||
    !isValidWaypoint(body?.target) ||
    typeof color !== 'string' ||
    color.trim() === '' ||
    color.length > 32
  ) {
    return { status: 400, message: 'Payload sagoma non valido.' };
  }

  // La sagoma è trasmessa a chi già potrebbe vedere la sua origine: se un'altra creatura invisibile
  // occupa quella casella, il filtro riusa la stessa sanitizzazione dello stato per non rivelarla.
  const originToken = battleMapState.tokens.find(
    (token) => token.position.x === body.origin.x && token.position.y === body.origin.y,
  ) ?? null;

  broadcastEphemeralEvent(
    'ephemeral-template',
    {
      id,
      shape,
      origin: body.origin,
      target: body.target,
      color,
      authorUserId: user.id,
      authorName: user.displayName,
    },
    { filterByOriginToken: originToken },
  );
  return { status: 200 };
}

function projectCharacterSheetToToken(ownerUserId, updates) {
  const tokenIndex = battleMapState.tokens.findIndex(
    (token) => token.ownerUserId === ownerUserId && token.type === 'player' && token.isFamiliar !== true,
  );
  if (tokenIndex < 0) return;
  const nextTokens = [...battleMapState.tokens];
  nextTokens[tokenIndex] = { ...nextTokens[tokenIndex], ...updates };
  battleMapState = normalizeSharedState({ ...battleMapState, tokens: nextTokens });
  bumpBattleMapVersion();
  broadcastSnapshot();
}

function replaceBattleMapState(nextState) {
  return commitBattleMapState({
    ...nextState,
    diceLogs: battleMapState.diceLogs,
    latestDicePreview: battleMapState.latestDicePreview,
  }, { recordMasterUndo: true, validate: true });
}

function commitBattleMapState(nextState, options = {}) {
  const { recordMasterUndo = false, validate = true } = options;

  if (recordMasterUndo) {
    pushMasterUndoState();
  }

  const normalizedState = normalizeSharedState(nextState);
  const validationError = validate ? validateSharedState(normalizedState) : null;
  if (validationError) {
    if (recordMasterUndo) {
      masterUndoStack.pop();
    }

    return {
      ...validationError,
      ...nextSnapshot(),
    };
  }

  if (normalizedState.activeTurnTokenId !== battleMapState.activeTurnTokenId) turnTransitionId += 1;
  battleMapState = normalizedState;
  bumpBattleMapVersion();
  broadcastSnapshot();
  return nextSnapshot();
}

async function restoreLastSessionSnapshot() {
  const snapshot = await readPersistedSessionSnapshot();
  if (!snapshot) {
    lastSessionSnapshot = null;
    return null;
  }

  lastSessionSnapshot = snapshot;
  battleMapState = normalizeSharedState({
    ...snapshot.state,
    diceLogs: battleMapState.diceLogs,
    latestDicePreview: battleMapState.latestDicePreview,
  });
  battleMapVersion = snapshot.version;
  broadcastSnapshot();
  return nextSnapshot();
}

function appendDiceLog(user, log) {
  commitBattleMapState({
    ...battleMapState,
    diceLogs: [log, ...battleMapState.diceLogs].slice(0, 30),
    latestDicePreview: null,
  }, {
    recordMasterUndo: user?.role === 'master',
    validate: false,
  });
  return nextSnapshot(user);
}

function updateSharedNotes(user, notes) {
  battleMapState = normalizeSharedState({
    ...battleMapState,
    sharedNotes: notes,
  });

  bumpBattleMapVersion();
  broadcastSnapshot();
  return nextSnapshot(user);
}

// Azzeramenti comuni a ingresso e uscita dal combattimento: tracker, turno, round e contabilità
// del movimento ripartono da zero.
const COMBAT_RESET = Object.freeze({
  initiatives: [],
  activeTurnTokenId: null,
  isRoundStarted: false,
  roundNumber: 1,
  movementUsedByTokenId: {},
  diagonalParityByTokenId: {},
  dashUsedByTokenId: {},
  extraMovementByTokenId: {},
});

// Ingresso in Combattimento: tracker vuoto, fase di tiro aperta, nuovo annuncio (un id nuovo per
// ogni ingresso, così ogni client lo mostra una volta sola).
function enterCombat() {
  if (battleMapState.sessionMode === 'combat') {
    return { status: 400, message: 'La sessione è già in Combattimento.' };
  }
  return commitBattleMapState({
    ...battleMapState,
    ...COMBAT_RESET,
    sessionMode: 'combat',
    combatAnnouncement: {
      id: randomUUID(),
      title: 'Il combattimento ha inizio',
      message: '"C vol la iaul? C VOL LA IAAAAAUL!?!?"',
    },
  }, {
    recordMasterUndo: true,
    validate: false,
  });
}

function exitCombat() {
  if (battleMapState.sessionMode !== 'combat') {
    return { status: 400, message: 'La sessione è già in Esplorazione.' };
  }
  return commitBattleMapState({
    ...battleMapState,
    ...COMBAT_RESET,
    sessionMode: 'exploration',
  }, { recordMasterUndo: true, validate: false });
}

function startFirstRound() {
  if (battleMapState.sessionMode !== 'combat') {
    return { status: 400, message: 'Avvia prima il combattimento.' };
  }
  if (battleMapState.isRoundStarted) {
    return { status: 400, message: 'Il round è già cominciato.' };
  }
  if (battleMapState.initiatives.length === 0) {
    return { status: 400, message: "Nessuna voce d'iniziativa: il round 1 non può cominciare con un ordine vuoto." };
  }
  return commitBattleMapState({
    ...battleMapState,
    isRoundStarted: true,
    roundNumber: 1,
    activeTurnTokenId: battleMapState.initiatives[0].tokenId,
  }, { recordMasterUndo: true, validate: false });
}

// Avanzamento del turno. Il Master avanza e arretra; l'Adventurer può solo chiudere il proprio
// turno (`next`), quando il Master lo consente e il token attivo è il suo personaggio.
function advanceTurn(user, direction) {
  if (direction !== 'next' && direction !== 'previous') {
    return { status: 400, message: 'Direzione del turno non valida.' };
  }
  if (battleMapState.sessionMode !== 'combat') {
    return { status: 400, message: 'La sessione è in Esplorazione: non ci sono turni da avanzare.' };
  }
  if (!battleMapState.isRoundStarted) {
    return { status: 400, message: 'Il round non è ancora cominciato.' };
  }
  const { initiatives } = battleMapState;
  if (initiatives.length === 0) {
    return { status: 400, message: "Nessuna voce d'iniziativa." };
  }
  if (user.role !== 'master') {
    const activeToken = battleMapState.tokens.find((token) => token.id === battleMapState.activeTurnTokenId);
    if (direction !== 'next') {
      return { status: 403, message: 'Solo il Master può tornare al turno precedente.' };
    }
    if (!battleMapState.playersCanEndTurn) {
      return { status: 403, message: 'Il Master non consente ai giocatori di terminare il proprio turno.' };
    }
    if (!activeToken || activeToken.ownerUserId !== user.id || activeToken.type !== 'player') {
      return { status: 403, message: 'Puoi terminare solo il tuo turno.' };
    }
  }

  const activeIndex = initiatives.findIndex((entry) => entry.tokenId === battleMapState.activeTurnTokenId);
  const startIndex = activeIndex >= 0 ? activeIndex : direction === 'next' ? -1 : 0;
  const nextIndex = direction === 'next'
    ? (startIndex + 1) % initiatives.length
    : (startIndex - 1 + initiatives.length) % initiatives.length;
  return commitBattleMapState({
    ...applyRoundWrapState(battleMapState, direction),
    activeTurnTokenId: initiatives[nextIndex].tokenId,
  }, { recordMasterUndo: user.role === 'master', validate: false });
}

function setPlayersCanEndTurn(enabled) {
  if (typeof enabled !== 'boolean') {
    return { status: 400, message: 'Impostazione non valida.' };
  }
  return commitBattleMapState({ ...battleMapState, playersCanEndTurn: enabled }, { recordMasterUndo: true, validate: false });
}

const EXPLORATION_ROLL_ERROR =
  "La sessione è in Esplorazione: il tiro d'iniziativa si abilita quando il Master avvia il combattimento.";

// Tiro d'iniziativa: voce nel tracker e log nella stessa commit, un solo incremento di versione.
// Il gestore è sincrono dal controllo alla commit, quindi due richieste per lo stesso token si
// serializzano e la seconda trova la voce già presente. Nessun undo: il Master corregge con
// modifica o rimozione della voce.
function commitInitiativeRoll(user, tokenId, requestedMode) {
  const result = rollInitiative({ user, state: battleMapState, service: characterSheetService, tokenId, requestedMode });
  if (result.error) return { status: result.status, message: result.error };
  return commitBattleMapState({
    ...battleMapState,
    initiatives: insertInitiativeEntry(battleMapState.initiatives, result.entry),
    diceLogs: [result.log, ...battleMapState.diceLogs].slice(0, 30),
    latestDicePreview: null,
  }, { recordMasterUndo: false, validate: false });
}

// «Tira per tutti»: ogni creatura non esclusa priva di voce, nell'ordine dei token, in una sola
// commit. Le voci esistenti non vengono mai sovrascritte.
function commitInitiativeRollAll(user) {
  if (battleMapState.sessionMode !== 'combat') {
    return { status: 400, message: EXPLORATION_ROLL_ERROR };
  }
  let workingState = battleMapState;
  const logs = [];
  const skipped = [];
  for (const token of battleMapState.tokens) {
    if (!isCreatureToken(token) || token.excludeFromInitiative === true) continue;
    if (workingState.initiatives.some((entry) => entry.tokenId === token.id)) continue;
    const result = rollInitiative({ user, state: workingState, service: characterSheetService, tokenId: token.id });
    if (result.error) {
      skipped.push(token.name);
      continue;
    }
    workingState = { ...workingState, initiatives: insertInitiativeEntry(workingState.initiatives, result.entry) };
    logs.push(result.log);
  }
  if (logs.length === 0) {
    return {
      status: 400,
      message: skipped.length
        ? `Nessun tiro riuscito: ${skipped.join(', ')}.`
        : "Ogni creatura ha già una voce d'iniziativa.",
    };
  }
  const committed = commitBattleMapState({
    ...workingState,
    diceLogs: [...logs.reverse(), ...battleMapState.diceLogs].slice(0, 30),
    latestDicePreview: null,
  }, { recordMasterUndo: false, validate: false });
  return { ...committed, skipped };
}

function clearBattleMapDiceLogs(user) {
  if (user.role !== 'master') {
    return { status: 403, message: 'Solo il Master può cancellare il log dei dadi.' };
  }
  return commitBattleMapState({
    ...battleMapState,
    diceLogs: [],
  }, {
    recordMasterUndo: user?.role === 'master',
    validate: false,
  });
}

function updateBattleMapSettings(updates) {
  const nextDiagonalRule =
    updates?.diagonalRule === 'standard' || updates?.diagonalRule === 'alternating'
      ? updates.diagonalRule
      : battleMapState.diagonalRule;

  let nextMeasurementUnit = battleMapState.measurementUnit;
  if (updates?.measurementUnit !== undefined) {
    const label = updates.measurementUnit?.label;
    const cellsValue = updates.measurementUnit?.cellsValue;
    if (typeof label !== 'string' || label.trim() === '' || !isValidCellsValue(cellsValue)) {
      return { status: 400, message: 'Unità di misura non valida.' };
    }
    nextMeasurementUnit = { label, cellsValue };
  }

  return commitBattleMapState(
    {
      ...battleMapState,
      diagonalRule: nextDiagonalRule,
      measurementUnit: nextMeasurementUnit,
    },
    { recordMasterUndo: true, validate: false },
  );
}

function applyRoundWrapState(nextState, direction) {
  const initiativesLength = nextState.initiatives.length;
  if (initiativesLength === 0) {
    return {
      ...nextState,
      roundNumber: 1,
      movementUsedByTokenId: {},
      diagonalParityByTokenId: {},
      dashUsedByTokenId: {},
      extraMovementByTokenId: {},
    };
  }

  const activeIndex = nextState.initiatives.findIndex(
    (entry) => entry.tokenId === nextState.activeTurnTokenId,
  );
  const startIndex = activeIndex >= 0 ? activeIndex : direction === 'next' ? -1 : 0;
  const wrappedRound =
    (direction === 'next' && startIndex === initiativesLength - 1) ||
    (direction === 'previous' && startIndex === 0);

  return wrappedRound
    ? {
        ...nextState,
        roundNumber: Math.max(1, nextState.roundNumber + (direction === 'next' ? 1 : -1)),
        movementUsedByTokenId: {},
        diagonalParityByTokenId: {},
        dashUsedByTokenId: {},
        extraMovementByTokenId: {},
      }
    : nextState;
}

function moveOwnedToken(user, tokenId, waypoints, { showTrack = true } = {}) {
  const tokenIndex = battleMapState.tokens.findIndex((token) => token.id === tokenId);
  if (tokenIndex === -1) {
    return { status: 404, message: 'Token non trovato.' };
  }

  const token = battleMapState.tokens[tokenIndex];

  if (
    !Array.isArray(waypoints) ||
    waypoints.length < 2 ||
    waypoints.length > MAX_MOVEMENT_WAYPOINTS ||
    !waypoints.every(isValidWaypoint)
  ) {
    return { status: 400, message: 'Percorso non valido.' };
  }

  if (waypoints[0].x !== token.position.x || waypoints[0].y !== token.position.y) {
    return { status: 400, message: 'Il percorso deve partire dalla posizione corrente del token.' };
  }

  const destination = waypoints[waypoints.length - 1];
  const controlledVehicle = findUserControlledVehicle(user);
  const isOwnedPlayer = token.ownerUserId === user.id && token.type === 'player';
  const isControlledVehicle = token.type === 'vehicle' && controlledVehicle?.id === token.id;

  if (user.role !== 'master' && !isOwnedPlayer && !isControlledVehicle) {
    return { status: 403, message: 'Puoi muovere solo il tuo personaggio o il mezzo a cui sei assegnato.' };
  }

  // Il budget vale solo in Combattimento a round avviato. In Esplorazione e durante la fase di
  // tiro (il Master può chiedere ai giocatori di disporsi) il movimento è libero e non addebitato.
  const budgetApplies = battleMapState.sessionMode === 'combat' && battleMapState.isRoundStarted;
  const movementSourceToken = isControlledVehicle
    ? battleMapState.tokens.find(
        (candidate) =>
          candidate.ownerUserId === user.id && candidate.type === 'player' && candidate.isFamiliar !== true,
      ) ?? null
    : token;
  const movementSourceId = movementSourceToken?.id ?? tokenId;
  const movementCells = typeof movementSourceToken?.movementCells === 'number' ? movementSourceToken.movementCells : 0;
  const extraMovement = battleMapState.extraMovementByTokenId[movementSourceId] ?? 0;
  const usedCells = battleMapState.movementUsedByTokenId[movementSourceId] ?? 0;
  const previousDiagonalParity = battleMapState.diagonalParityByTokenId[movementSourceId] ?? 0;
  const hasDashed = battleMapState.dashUsedByTokenId[movementSourceId] === true;
  const movementBudget = movementCells * (hasDashed ? 2 : 1) + extraMovement;
  const { cells: moveDistance, nextDiagonalParity } = pathCost(waypoints, {
    rule: battleMapState.diagonalRule,
    diagonalParity: previousDiagonalParity,
  });

  if (budgetApplies && user.role !== 'master' && usedCells + moveDistance > movementBudget) {
    return {
      status: 400,
      message: `Movimento insufficiente: restano ${Math.max(0, movementBudget - usedCells)} caselle in questo round.`,
      snapshot: nextSnapshot(),
    };
  }

  if (!canTokenIgnoreObstacles(token, user)) {
    for (let index = 0; index < waypoints.length - 1; index += 1) {
      const blockingObstacle = findBlockedMovement(
        battleMapState.tokens,
        token,
        waypoints[index],
        waypoints[index + 1],
      );
      if (blockingObstacle) {
        return {
          status: 400,
          message: `${blockingObstacle.name} blocca il movimento.`,
          snapshot: nextSnapshot(),
        };
      }
    }
  }

  const nextTokens = applyVehicleAwareUpdates(
    battleMapState.tokens.map((currentToken) =>
      currentToken.id === tokenId ? { ...currentToken, position: destination } : currentToken,
    ),
  );

  const nextState = normalizeSharedState({
    ...battleMapState,
    tokens: nextTokens,
    movementUsedByTokenId: budgetApplies
      ? {
          ...battleMapState.movementUsedByTokenId,
          [movementSourceId]: usedCells + moveDistance,
        }
      : battleMapState.movementUsedByTokenId,
    diagonalParityByTokenId: budgetApplies
      ? {
          ...battleMapState.diagonalParityByTokenId,
          [movementSourceId]: nextDiagonalParity,
        }
      : battleMapState.diagonalParityByTokenId,
    dashUsedByTokenId: battleMapState.dashUsedByTokenId,
  });
  const validationError = validateSharedState(nextState);
  if (validationError) {
    return {
      ...validationError,
      snapshot: nextSnapshot(),
    };
  }

  if (user.role === 'master') {
    const result = commitBattleMapState(nextState, { recordMasterUndo: true, validate: false });
    broadcastTokenWalk(token, waypoints, showTrack);
    return result;
  }

  battleMapState = nextState;
  if (user.role !== 'master') {
    pushPlayerUndoAction(user.id, {
      type: 'move',
      tokenId,
      previousPosition: token.position,
      movementSourceId,
      previousMovementUsed: usedCells,
      previousDiagonalParity,
    });
  }
  bumpBattleMapVersion();
  broadcastSnapshot();
  broadcastTokenWalk(token, waypoints, showTrack);
  return { status: 200, snapshot: nextSnapshot() };
}

function useDashAction(user, tokenId) {
  const token = battleMapState.tokens.find((entry) => entry.id === tokenId);
  if (!token) {
    return { status: 404, message: 'Token non trovato.' };
  }

  if (token.ownerUserId !== user.id) {
    return { status: 403, message: 'Puoi usare lo scatto solo sul tuo personaggio.' };
  }

  if (battleMapState.activeTurnTokenId !== tokenId) {
    return { status: 400, message: 'Puoi usare lo scatto solo nel tuo turno.' };
  }

  if (battleMapState.dashUsedByTokenId[tokenId] === true) {
    return { status: 400, message: 'Scatto gia usato in questo round.' };
  }

  battleMapState = normalizeSharedState({
    ...battleMapState,
    dashUsedByTokenId: {
      ...battleMapState.dashUsedByTokenId,
      [tokenId]: true,
    },
  });
  pushPlayerUndoAction(user.id, {
    type: 'dash',
    tokenId,
    previousDashUsed: false,
  });
  bumpBattleMapVersion();
  broadcastSnapshot();
  return { status: 200, snapshot: nextSnapshot() };
}

function updateOwnedToken(user, tokenId, updates) {
  const tokenIndex = battleMapState.tokens.findIndex((token) => token.id === tokenId);
  if (tokenIndex === -1) {
    return { status: 404, message: 'Token non trovato.' };
  }

  const token = battleMapState.tokens[tokenIndex];
  if (user.role !== 'master' && token.ownerUserId !== user.id) {
    return { status: 403, message: 'Puoi modificare solo il tuo personaggio.' };
  }

  const nextUpdates = {};
  if (typeof updates?.hitPoints === 'number') {
    nextUpdates.hitPoints = updates.hitPoints;
  } else if (updates?.hitPoints === null) {
    nextUpdates.hitPoints = null;
  }

  if (typeof updates?.maxHitPoints === 'number') {
    nextUpdates.maxHitPoints = updates.maxHitPoints;
  } else if (updates?.maxHitPoints === null) {
    nextUpdates.maxHitPoints = null;
  }

  if (Array.isArray(updates?.conditions)) {
    nextUpdates.conditions = updates.conditions.filter((condition) => typeof condition === 'string');
  }

  if (user.role === 'master' && typeof updates?.excludeFromInitiative === 'boolean') {
    nextUpdates.excludeFromInitiative = updates.excludeFromInitiative;
  }

  if (
    (user.role === 'master' || token.isFamiliar === true) &&
    typeof updates?.isInvisible === 'boolean'
  ) {
    nextUpdates.isInvisible = updates.isInvisible;
  }

  if (
    (token.type === 'player' || token.type === 'enemy') &&
    Array.isArray(updates?.auras)
  ) {
    nextUpdates.auras = updates.auras.flatMap((aura, index) =>
      aura && typeof aura.radiusCells === 'number'
        ? [{
            id: typeof aura.id === 'string' ? aura.id : `${token.id}-aura-${index}`,
            radiusCells: Math.max(0, Math.floor(aura.radiusCells)),
            isVisible: aura.isVisible !== false,
            color: typeof aura.color === 'string' ? aura.color : token.color,
          }]
        : [],
    );
  }

  if (Object.keys(nextUpdates).length === 0) {
    return { status: 400, message: 'Nessun aggiornamento valido.' };
  }

  const nextState = normalizeSharedState({
    ...battleMapState,
    tokens: battleMapState.tokens.map((currentToken) =>
      currentToken.id === tokenId ? { ...currentToken, ...nextUpdates } : currentToken,
    ),
  });

  if (user.role === 'master') {
    return commitBattleMapState(nextState, { recordMasterUndo: true, validate: false });
  }

  battleMapState = nextState;

  if (user.role !== 'master') {
    pushPlayerUndoAction(user.id, {
      type: 'token-update',
      tokenId,
      previousValues: {
        hitPoints: token.hitPoints ?? null,
        maxHitPoints: token.maxHitPoints ?? null,
        conditions: token.conditions ?? [],
        isInvisible: token.isInvisible === true,
        auras: token.auras ?? [],
      },
    });
  }

  bumpBattleMapVersion();
  broadcastSnapshot();
  return { status: 200, snapshot: nextSnapshot() };
}

function addExtraMovement(user, tokenId, amount) {
  const token = battleMapState.tokens.find((entry) => entry.id === tokenId);
  if (!token) {
    return { status: 404, message: 'Token non trovato.' };
  }

  if (user.role !== 'master' && token.ownerUserId !== user.id) {
    return { status: 403, message: 'Puoi aggiungere movimento solo al tuo personaggio.' };
  }

  const parsedAmount = Math.trunc(Number.isFinite(amount) ? amount : 1);
  if (parsedAmount === 0) {
    return { status: 400, message: 'La variazione di movimento non puo essere zero.' };
  }

  const previousAmount = battleMapState.extraMovementByTokenId[tokenId] ?? 0;
  const nextAmount = Math.max(0, previousAmount + parsedAmount);

  if (nextAmount === previousAmount) {
    return { status: 400, message: 'Nessuna variazione di movimento disponibile.' };
  }

  const nextState = normalizeSharedState({
    ...battleMapState,
    extraMovementByTokenId: {
      ...battleMapState.extraMovementByTokenId,
      [tokenId]: nextAmount,
    },
  });

  if (user.role === 'master') {
    return commitBattleMapState(nextState, { recordMasterUndo: true, validate: false });
  }

  battleMapState = nextState;

  if (user.role !== 'master') {
    pushPlayerUndoAction(user.id, {
      type: 'extra-movement',
      tokenId,
      previousAmount,
    });
  }

  bumpBattleMapVersion();
  broadcastSnapshot();
  return { status: 200, snapshot: nextSnapshot() };
}

function undoLastAction(user) {
  if (user.role === 'master') {
    const previousState = masterUndoStack.pop();
    if (!previousState) {
      return { status: 400, message: 'Nessuna azione da annullare.' };
    }

    battleMapState = normalizeSharedState({
      ...previousState,
      diceLogs: battleMapState.diceLogs,
      latestDicePreview: battleMapState.latestDicePreview,
    });
    bumpBattleMapVersion();
    broadcastSnapshot();
    return { status: 200, snapshot: nextSnapshot() };
  }

  const playerStack = playerUndoStackByUserId.get(user.id) ?? [];
  const action = playerStack.pop();
  if (!action) {
    return { status: 400, message: 'Nessuna tua azione da annullare.' };
  }

  if (action.type === 'move') {
    battleMapState = normalizeSharedState({
      ...battleMapState,
      tokens: applyVehicleAwareUpdates(
        battleMapState.tokens.map((token) =>
          token.id === action.tokenId ? { ...token, position: action.previousPosition } : token,
        ),
      ),
      movementUsedByTokenId: {
        ...battleMapState.movementUsedByTokenId,
        [action.movementSourceId]: action.previousMovementUsed,
      },
      diagonalParityByTokenId: {
        ...battleMapState.diagonalParityByTokenId,
        [action.movementSourceId]: action.previousDiagonalParity,
      },
    });
  }

  if (action.type === 'dash') {
    battleMapState = normalizeSharedState({
      ...battleMapState,
      dashUsedByTokenId: {
        ...battleMapState.dashUsedByTokenId,
        [action.tokenId]: action.previousDashUsed,
      },
    });
  }

  if (action.type === 'token-update') {
    battleMapState = normalizeSharedState({
      ...battleMapState,
      tokens: battleMapState.tokens.map((token) =>
        token.id === action.tokenId ? { ...token, ...action.previousValues } : token,
      ),
    });
  }

  if (action.type === 'extra-movement') {
    battleMapState = normalizeSharedState({
      ...battleMapState,
      extraMovementByTokenId: {
        ...battleMapState.extraMovementByTokenId,
        [action.tokenId]: action.previousAmount,
      },
    });
  }

  playerUndoStackByUserId.set(user.id, playerStack);
  bumpBattleMapVersion();
  broadcastSnapshot();
  return { status: 200, snapshot: nextSnapshot() };
}

const sessionStore = new Map();
let database;
let userRepository;
let authService;
const characterSheetPolicy = new CharacterSheetPolicy();
const portraitStorage = new PortraitStorage(PORTRAIT_STORAGE_PATH);

function parseCookies(headerValue) {
  if (!headerValue) {
    return {};
  }

  return headerValue.split(';').reduce((cookies, chunk) => {
    const [rawName, ...rawValueParts] = chunk.trim().split('=');
    if (!rawName) {
      return cookies;
    }

    cookies[rawName] = decodeURIComponent(rawValueParts.join('='));
    return cookies;
  }, {});
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${options.maxAge}`);
  }

  segments.push(`Path=${options.path ?? '/'}`);
  segments.push(`SameSite=${options.sameSite ?? 'Lax'}`);

  if (options.httpOnly !== false) {
    segments.push('HttpOnly');
  }

  if (options.secure) {
    segments.push('Secure');
  }

  return segments.join('; ');
}

function sanitizeUser(user) {
  const profile = findCharacterProfileById(user.id);
  const playerToken =
    battleMapState.tokens.find(
      (token) => token.ownerUserId === user.id && token.type === 'player' && token.isFamiliar !== true,
    ) ??
    battleMapState.tokens.find((token) => token.characterKey === profile?.key) ??
    null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    characterKey: profile?.key ?? user.characterKey ?? null,
    playerTokenId: playerToken?.id ?? null,
    initiativeModifier: profile?.initiativeModifier ?? null,
    initiativeMode: profile?.initiativeMode ?? null,
    movement: profile?.movement ?? null,
    movementCells: profile?.movementCells ?? null,
    darkvision: profile?.darkvision ?? null,
  };
}

function createCharacterToken(profile, userId, position = profile.spawnPosition) {
  return {
    id: `player-token-${profile.key}`,
    name: profile.displayName,
    type: 'player',
    size: 'medium',
    position: { ...position },
    color: DEFAULT_TOKEN_COLORS.player,
    initiativeModifier: profile.initiativeModifier,
    initiativeMode: profile.initiativeMode,
    movementCells: profile.movementCells,
    affiliation: 'player',
    vehicleKind: null,
    vehicleOccupantIds: [],
    showVehicleOccupants: undefined,
    containedInVehicleId: null,
    imageUrl: profile.imageUrl,
    ownerUserId: userId,
    characterKey: profile.key,
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

function ensureCharacterTokenForUser(user) {
  const profile = findCharacterProfileById(user.id);
  if (!profile?.spawnToken || !profile.spawnPosition) {
    return;
  }

  const existingIndex = battleMapState.tokens.findIndex(
    (token) => token.ownerUserId === user.id || token.characterKey === profile.key,
  );

  if (existingIndex === -1) {
    const spawnToken = createCharacterToken(profile, user.id);
    const spawnPosition = firstAvailablePositionToRight(
      battleMapState.tokens.filter((token) => token.ownerUserId !== user.id && token.characterKey !== profile.key),
      getTokenFootprint(spawnToken),
      profile.spawnPosition,
    );

    battleMapState = normalizeSharedState({
      ...battleMapState,
      tokens: [...battleMapState.tokens, { ...spawnToken, position: spawnPosition }],
    });
    bumpBattleMapVersion();
    broadcastSnapshot();
    return;
  }

  const nextTokens = [...battleMapState.tokens];
  nextTokens[existingIndex] = {
    ...nextTokens[existingIndex],
    name: profile.displayName,
    type: 'player',
    size: nextTokens[existingIndex].size ?? 'medium',
    color: nextTokens[existingIndex].color ?? DEFAULT_TOKEN_COLORS.player,
    initiativeModifier: profile.initiativeModifier,
    initiativeMode: profile.initiativeMode,
    movementCells: profile.movementCells,
    affiliation: 'player',
    imageUrl: profile.imageUrl,
    ownerUserId: user.id,
    characterKey: profile.key,
  };

  battleMapState = normalizeSharedState({
    ...battleMapState,
    tokens: nextTokens,
  });
  bumpBattleMapVersion();
  broadcastSnapshot();
}

function clearExpiredSessions() {
  const now = Date.now();

  sessionStore.forEach((session, sessionId) => {
    if (session.expiresAt <= now) {
      sessionStore.delete(sessionId);
    }
  });
}

function getSessionUser(request) {
  clearExpiredSessions();
  const cookies = parseCookies(request.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) {
    return null;
  }

  const session = sessionStore.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    sessionStore.delete(sessionId);
    return null;
  }

  const user = userRepository?.findById(session.userId);
  return user ? sanitizeUser(user) : null;
}

function requireUser(request, reply) {
  const user = getSessionUser(request);
  if (!user) {
    reply.code(401);
    reply.send({ message: 'Sessione non valida.' });
    return null;
  }

  return user;
}

function requireMaster(request, reply) {
  const user = requireUser(request, reply);
  if (!user) {
    return null;
  }

  if (user.role !== 'master') {
    reply.code(403);
    reply.send({ message: 'Solo il master puo modificare la battle map.' });
    return null;
  }

  return user;
}

function setSessionCookie(reply, sessionId) {
  reply.header(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      path: '/',
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    }),
  );
}

function clearSessionCookie(reply) {
  reply.header(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, '', {
      httpOnly: true,
      maxAge: 0,
      path: '/',
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    }),
  );
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return false;
  }

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/u.test(origin)) {
    return true;
  }

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return configuredOrigins.includes(origin);
}

app.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;

  if (isAllowedOrigin(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    reply.header('Vary', 'Origin');
  }

  if (request.method === 'OPTIONS') {
    return reply.code(204).send();
  }
});

app.get('/api/health', async () => ({
  ok: true,
  users: userRepository?.userCount() ?? 0,
  version: battleMapVersion,
}));

app.get('/api/auth/session', async (request) => ({
  user: getSessionUser(request),
}));

app.post('/api/auth/login', async (request, reply) => {
  const body = request.body ?? {};
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    reply.code(400);
    return { message: 'Inserisci username e password.' };
  }

  const profile = findCharacterProfileByUsername(username);
  const user = await authService.authenticate(username, password);
  if (!user) {
    reply.code(401);
    return { message: 'Credenziali non valide.' };
  }

  const sessionId = randomBytes(24).toString('hex');
  authService.createSession(sessionId, user.id);
  setSessionCookie(reply, sessionId);
  if (profile?.spawnToken) {
    ensureCharacterTokenForUser(user);
  }

  return {
    user: sanitizeUser(user),
  };
});

app.post('/api/auth/logout', async (request, reply) => {
  try { characterSheetService?.flushAll(); } catch (error) { app.log.error(error, 'Unable to flush character sheets during logout.'); }
  const cookies = parseCookies(request.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE];
  if (sessionId) {
    sessionStore.delete(sessionId);
  }

  clearSessionCookie(reply);
  return { ok: true };
});

app.get('/api/battle-map/state', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  return nextSnapshot(user);
});

app.get('/api/battle-map/session-status', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  return getSessionStatus();
});

app.put('/api/battle-map/state', async (request, reply) => {
  const user = requireMaster(request, reply);
  if (!user) {
    return;
  }

  const body = request.body ?? {};
  const nextState = normalizeSharedState(placeNewManualInitiatives(body.state));
  const baseVersion = typeof body.baseVersion === 'number' ? body.baseVersion : null;

  if (baseVersion !== null && baseVersion !== battleMapVersion) {
    reply.code(409);
    return {
      message: 'Lo stato condiviso e cambiato. Sincronizza e riprova.',
      ...nextSnapshot(user),
    };
  }

  return replaceBattleMapState(nextState);
});

app.post('/api/battle-map/dice-logs', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }
  reply.code(410);
  return { message: 'Questo endpoint non accetta più log dal client. Usa /rolls.' };
});

app.post('/api/battle-map/rolls', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const body = request.body ?? {};
  // Il bersaglio Iniziativa della scheda è il tiro d'iniziativa autorevole: scrive il tracker e
  // ignora l'interruttore segreto della scheda (la visibilità la decide il modulo d'iniziativa).
  if (body.source?.target === 'initiative') {
    const tokenResult = resolveSheetInitiativeToken(user, body.source.sheetId);
    if (tokenResult.error) {
      reply.code(tokenResult.status);
      return { message: tokenResult.error, ...nextSnapshot(user) };
    }
    return sendMutationResult(reply, user, commitInitiativeRoll(user, tokenResult.tokenId));
  }

  const result = body.source
    ? rollCharacterSheetTarget(user, characterSheetService, body)
    : createAuthoritativeRoll(user, body);
  if (result.error) {
    reply.code(400);
    return { message: result.error, ...nextSnapshot(user) };
  }

  return appendDiceLog(user, result.log);
});

// Una voce manuale nuova del Master arriva senza frazione né Destrezza, che il client non conosce.
// Il server la colloca con la regola d'inserimento condivisa, dopo averla completata; le voci già
// presenti (e quindi gli spostamenti del Master) restano dove sono.
function placeNewManualInitiatives(rawState) {
  if (!rawState || typeof rawState !== 'object' || !Array.isArray(rawState.initiatives)) return rawState;
  const current = new Map(battleMapState.initiatives.map((entry) => [entry.tokenId, entry]));
  const isFresh = (entry) => entry && typeof entry === 'object' && typeof entry.tiebreaker !== 'number' && (
    !current.has(entry.tokenId) ||
    current.get(entry.tokenId).value !== entry.value ||
    current.get(entry.tokenId).source !== entry.source
  );
  const freshEntries = rawState.initiatives.filter(isFresh);
  if (freshEntries.length === 0) return rawState;
  const tokens = Array.isArray(rawState.tokens) ? rawState.tokens : [];
  const placed = normalizeInitiativeEntries(freshEntries, tokens).reduce(
    (entries, entry) => insertInitiativeEntry(entries, entry),
    rawState.initiatives.filter((entry) => !isFresh(entry)),
  );
  return { ...rawState, initiatives: placed };
}

function resolveSheetInitiativeToken(user, sheetId) {
  if (typeof sheetId !== 'string' || !sheetId) return { status: 400, error: 'Bersaglio di tiro non valido.' };
  if (battleMapState.sessionMode !== 'combat') return { status: 400, error: EXPLORATION_ROLL_ERROR };
  let sheet;
  try {
    sheet = characterSheetService.get(user, sheetId);
  } catch (error) {
    return { status: 400, error: error?.message ?? 'Impossibile leggere la scheda.' };
  }
  const token = findCharacterTokenForOwner(battleMapState.tokens, sheet.ownerUserId);
  if (!token) {
    return { status: 400, error: "Questa scheda non ha un token sulla mappa: l'iniziativa si tira per un token presente." };
  }
  return { tokenId: token.id };
}

// Risposta comune delle mutazioni dedicate: un errore riporta motivo e snapshot sanitizzato per
// il riallineamento; un successo restituisce lo snapshot per l'utente che ha chiesto.
function sendMutationResult(reply, user, result) {
  if (result.status && result.status !== 200) {
    reply.code(result.status);
    return { message: result.message, ...nextSnapshot(user) };
  }
  const response = nextSnapshot(user);
  return result.skipped?.length ? { ...response, skipped: result.skipped } : response;
}

app.delete('/api/battle-map/dice-logs', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const result = clearBattleMapDiceLogs(user);
  if (result.status && result.status !== 200) {
    reply.code(result.status);
    return { message: result.message, ...nextSnapshot(user) };
  }
  return result;
});

app.post('/api/battle-map/notes', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const body = request.body ?? {};
  if (typeof body.notes !== 'string') {
    reply.code(400);
    return { message: 'Payload note non valido.' };
  }

  return updateSharedNotes(user, body.notes);
});

app.post('/api/battle-map/combat/start', async (request, reply) => {
  const user = requireMaster(request, reply);
  if (!user) {
    return;
  }

  return sendMutationResult(reply, user, enterCombat());
});

app.post('/api/battle-map/combat/end', async (request, reply) => {
  const user = requireMaster(request, reply);
  if (!user) {
    return;
  }

  return sendMutationResult(reply, user, exitCombat());
});

app.post('/api/battle-map/combat/round/start', async (request, reply) => {
  const user = requireMaster(request, reply);
  if (!user) {
    return;
  }

  return sendMutationResult(reply, user, startFirstRound());
});

app.post('/api/battle-map/turn/advance', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  return sendMutationResult(reply, user, advanceTurn(user, request.body?.direction));
});

app.post('/api/battle-map/settings/players-can-end-turn', async (request, reply) => {
  const user = requireMaster(request, reply);
  if (!user) {
    return;
  }

  return sendMutationResult(reply, user, setPlayersCanEndTurn(request.body?.enabled));
});

app.post('/api/battle-map/initiative/roll', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const body = request.body ?? {};
  if (typeof body.tokenId !== 'string' || !body.tokenId) {
    reply.code(400);
    return { message: 'Payload tiro iniziativa non valido.', ...nextSnapshot(user) };
  }
  return sendMutationResult(reply, user, commitInitiativeRoll(user, body.tokenId, body.mode));
});

app.post('/api/battle-map/initiative/roll-all', async (request, reply) => {
  const user = requireMaster(request, reply);
  if (!user) {
    return;
  }

  return sendMutationResult(reply, user, commitInitiativeRollAll(user));
});

app.post('/api/battle-map/move', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const body = request.body ?? {};
  const tokenId = typeof body.tokenId === 'string' ? body.tokenId : '';
  if (!tokenId) {
    reply.code(400);
    return { message: 'Payload movimento non valido.' };
  }

  let waypoints;
  if (Array.isArray(body.waypoints)) {
    waypoints = body.waypoints;
  } else if (typeof body.x === 'number' && typeof body.y === 'number') {
    const currentToken = battleMapState.tokens.find((candidate) => candidate.id === tokenId);
    if (!currentToken) {
      reply.code(404);
      return { message: 'Token non trovato.' };
    }
    waypoints = [currentToken.position, { x: body.x, y: body.y }];
  } else {
    reply.code(400);
    return { message: 'Payload movimento non valido.' };
  }

  const result = moveOwnedToken(user, tokenId, waypoints, { showTrack: Array.isArray(body.waypoints) });
  if (result.status && result.status !== 200) {
    reply.code(result.status);
    return {
      message: result.message,
      ...nextSnapshot(user),
    };
  }

  return nextSnapshot(user);
});

app.post('/api/battle-map/settings', async (request, reply) => {
  const user = requireMaster(request, reply);
  if (!user) {
    return;
  }

  const result = updateBattleMapSettings(request.body ?? {});
  if (result.status && result.status !== 200) {
    reply.code(result.status);
    return {
      message: result.message,
      ...nextSnapshot(user),
    };
  }

  return result;
});

app.post('/api/battle-map/ping', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const body = request.body ?? {};
  const result = sendPing(user, body.position);
  if (result.status !== 200) {
    reply.code(result.status);
    return { message: result.message };
  }

  return { ok: true };
});

app.post('/api/battle-map/template', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const result = sendTemplateEvent(user, request.body ?? {});
  if (result.status !== 200) {
    reply.code(result.status);
    return { message: result.message };
  }

  return { ok: true };
});

app.post('/api/battle-map/dash', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const body = request.body ?? {};
  const tokenId = typeof body.tokenId === 'string' ? body.tokenId : '';
  if (!tokenId) {
    reply.code(400);
    return { message: 'Payload scatto non valido.' };
  }

  const result = useDashAction(user, tokenId);
  if (result.status !== 200) {
    reply.code(result.status);
    return {
      message: result.message,
      ...nextSnapshot(user),
    };
  }

  return nextSnapshot(user);
});

app.post('/api/battle-map/token-update', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const body = request.body ?? {};
  const tokenId = typeof body.tokenId === 'string' ? body.tokenId : '';
  if (!tokenId || typeof body.updates !== 'object' || !body.updates) {
    reply.code(400);
    return { message: 'Payload token update non valido.' };
  }

  const result = updateOwnedToken(user, tokenId, body.updates);
  if (result.status && result.status !== 200) {
    reply.code(result.status);
    return {
      message: result.message,
      ...nextSnapshot(user),
    };
  }

  return nextSnapshot(user);
});

app.post('/api/battle-map/extra-movement', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const body = request.body ?? {};
  const tokenId = typeof body.tokenId === 'string' ? body.tokenId : '';
  const amount = typeof body.amount === 'number' ? body.amount : 1;
  if (!tokenId) {
    reply.code(400);
    return { message: 'Payload extra movement non valido.' };
  }

  const result = addExtraMovement(user, tokenId, amount);
  if (result.status && result.status !== 200) {
    reply.code(result.status);
    return {
      message: result.message,
      ...nextSnapshot(user),
    };
  }

  return nextSnapshot(user);
});

app.post('/api/battle-map/undo', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const result = undoLastAction(user);
  if (result.status !== 200) {
    reply.code(result.status);
    return {
      message: result.message,
      ...nextSnapshot(user),
    };
  }

  return nextSnapshot(user);
});

app.post('/api/battle-map/session/suspend', async (request, reply) => {
  const user = requireMaster(request, reply);
  if (!user) {
    return;
  }

  characterSheetService.flushAll();
  const snapshot = await saveCurrentSessionSnapshot();
  return snapshot;
});

app.post('/api/battle-map/session/resume', async (request, reply) => {
  const user = requireMaster(request, reply);
  if (!user) {
    return;
  }

  const snapshot = await restoreLastSessionSnapshot();
  if (!snapshot) {
    reply.code(404);
    return { message: 'Nessuna sessione salvata disponibile.' };
  }

  return {
    savedAt: lastSessionSnapshot.savedAt,
    version: snapshot.version,
    state: snapshot.state,
  };
});

app.get('/api/battle-map/stream', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  // SSE keeps every authenticated client aligned with the latest server snapshot.
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  reply.hijack();

  const client = {
    user,
    write: (payload) => reply.raw.write(payload),
  };
  streamClients.add(client);
  client.write('retry: 2000\n\n');
  client.write(`data: ${JSON.stringify(nextSnapshot(user))}\n\n`);

  const keepAliveId = setInterval(() => {
    client.write(': keepalive\n\n');
  }, 25000);

  request.raw.on('close', () => {
    clearInterval(keepAliveId);
    streamClients.delete(client);
  });
});

async function start() {
  database = openDatabase();
  try {
    await bootstrapRoster(database, CHARACTER_PROFILES);
    bootstrapCharacterSheets(database, CHARACTER_PROFILES);
  } catch (error) {
    database.close();
    throw new Error(`Database non pronto: ${error.message} Esegui npm run db:migrate.`);
  }
  userRepository = new UserRepository(database);
  authService = new AuthService(userRepository, sessionStore, SESSION_TTL_MS, CHARACTER_PROFILES.map((profile) => profile.id));
  const characterSheetRepository = new CharacterSheetRepository(database);
  characterSheetService = new CharacterSheetService({
    repository: characterSheetRepository,
    policy: characterSheetPolicy,
    emit: broadcastCharacterSheetEvent,
    projectToken: projectCharacterSheetToToken,
  });
  await portraitStorage.initialize();
  await registerCharacterSheetRoutes(app, { service: characterSheetService, portraitStorage, getUser: getSessionUser });
  app.addHook('onClose', async () => {
    characterSheetService.flushAll();
    database.close();
  });
  await loadPersistedSessionMetadata();
  await app.listen({ port: PORT, host: HOST });
  let isShuttingDown = false;
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    app.log.info({ signal }, 'Graceful shutdown requested.');
    try {
      await app.close();
      process.exitCode = 0;
    } catch (error) {
      app.log.error(error, 'Graceful shutdown failed.');
      process.exitCode = 1;
    }
  };
  process.once('SIGINT', () => { void shutdown('SIGINT'); });
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
}

const isTestEnvironment = process.env.BATTLE_MAP_TEST_MODE === '1';

if (!isTestEnvironment) {
  start().catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}

// Surface exposed only so integration tests can exercise the real Fastify routes with
// app.inject: a fake user repository plus a real session, without opening the SQLite
// database or binding a port. Production code never imports this export.
export const __testing = {
  app,
  setUserRepository: (repository) => {
    userRepository = repository;
  },
  createSession: (user) => {
    const sessionId = randomBytes(24).toString('hex');
    sessionStore.set(sessionId, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
    return sessionId;
  },
  setBattleMapState: (state) => {
    battleMapState = normalizeSharedState(state);
    battleMapVersion = 1;
  },
  getBattleMapState: () => battleMapState,
  setCharacterSheetService: (service) => {
    characterSheetService = service;
  },
  sanitizeStateForUser,
  nextSnapshot,
  normalizeSharedState,
  getBattleMapVersion: () => battleMapVersion,
  applyRoundWrapState,
  streamClients,
};
