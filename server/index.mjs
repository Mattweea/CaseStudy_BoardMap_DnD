import Fastify from 'fastify';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHARACTER_PROFILES,
  findCharacterProfileById,
  findCharacterProfileByUsername,
} from './characters.mjs';

const app = Fastify({
  logger: true,
});

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const SESSION_COOKIE = 'battle_map_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const PASSWORD_SALT = process.env.AUTH_PASSWORD_SALT ?? 'board-map-demo-salt';
const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DATA_DIR = path.join(SERVER_DIR, 'data');
const SESSION_SNAPSHOT_PATH = path.join(SESSION_DATA_DIR, 'last-session.json');

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

const demoUsers = CHARACTER_PROFILES.map((profile) => ({
  id: profile.id,
  username: profile.username,
  password: `${profile.username}123`,
  displayName: profile.displayName,
  role: profile.role,
  characterKey: profile.key,
}));

const initialSharedState = {
  tokens: [],
  diceLogs: [],
  latestDicePreview: null,
  initiatives: [],
  activeTurnTokenId: null,
  roundNumber: 1,
  movementUsedByTokenId: {},
  movementAxisUsageByTokenId: {},
  dashUsedByTokenId: {},
  extraMovementByTokenId: {},
};

let battleMapState = normalizeSharedState(initialSharedState);
let battleMapVersion = 1;
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
        const type = token.type ?? 'object';
        const affiliation =
          token.affiliation ??
          (type === 'enemy' ? 'enemy' : type === 'player' ? 'player' : null);
        const fallbackColor =
          type === 'vehicle'
            ? defaultVehicleColor(affiliation === 'enemy' ? 'enemy' : 'player')
            : DEFAULT_TOKEN_COLORS[type];

        return {
          ...token,
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
          conditions: Array.isArray(token.conditions) ? token.conditions : [],
        };
      })
    : initialSharedState.tokens;
  const initiatives = Array.isArray(parsed?.initiatives)
    ? parsed.initiatives.filter((entry) => tokens.some((token) => token.id === entry.tokenId))
    : [];

  return {
    tokens: applyVehicleAwareUpdates(tokens),
    diceLogs: Array.isArray(parsed?.diceLogs)
      ? parsed.diceLogs.map((log) => ({
          ...log,
          formula: log.formula ?? log.label,
        }))
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
            log: {
              ...parsed.latestDicePreview.log,
              formula:
                parsed.latestDicePreview.log.formula ?? parsed.latestDicePreview.log.label ?? '',
            },
          }
        : null,
    initiatives,
    activeTurnTokenId:
      typeof parsed?.activeTurnTokenId === 'string' ? parsed.activeTurnTokenId : null,
    roundNumber: typeof parsed?.roundNumber === 'number' && parsed.roundNumber > 0 ? parsed.roundNumber : 1,
    movementUsedByTokenId:
      parsed?.movementUsedByTokenId && typeof parsed.movementUsedByTokenId === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.movementUsedByTokenId).filter(
              ([tokenId, used]) =>
                tokens.some((token) => token.id === tokenId) &&
                typeof used === 'number' &&
                used >= 0,
            ),
          )
        : {},
    movementAxisUsageByTokenId:
      parsed?.movementAxisUsageByTokenId && typeof parsed.movementAxisUsageByTokenId === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.movementAxisUsageByTokenId).flatMap(([tokenId, usage]) => {
              if (
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

              return [[tokenId, { horizontal: usage.horizontal, vertical: usage.vertical }]];
            }),
          )
        : {},
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
  };
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

function calculateMovementAxisUsage(previousUsage, from, to) {
  return {
    horizontal: (previousUsage?.horizontal ?? 0) + Math.abs(to.x - from.x),
    vertical: (previousUsage?.vertical ?? 0) + Math.abs(to.y - from.y),
  };
}

function movementUsedFromAxisUsage(usage) {
  return Math.max(usage?.horizontal ?? 0, usage?.vertical ?? 0);
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

function sanitizeStateForUser(state, user) {
  if (!user || user.role === 'master') {
    return state;
  }

  return normalizeSharedState(state);
}

function nextSnapshot(user = null) {
  return {
    state: sanitizeStateForUser(battleMapState, user),
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

function replaceBattleMapState(nextState) {
  return commitBattleMapState(nextState, { recordMasterUndo: true, validate: true });
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
  battleMapState = snapshot.state;
  battleMapVersion = snapshot.version;
  broadcastSnapshot();
  return nextSnapshot();
}

function appendDiceLog(user, log, flavor = '') {
  return commitBattleMapState({
    ...battleMapState,
    diceLogs: [log, ...battleMapState.diceLogs].slice(0, 30),
    latestDicePreview:
      typeof flavor === 'string' && flavor.trim()
        ? {
            id: crypto.randomUUID(),
            flavor,
            log,
          }
        : battleMapState.latestDicePreview,
  }, {
    recordMasterUndo: user?.role === 'master',
    validate: false,
  });
}

function clearBattleMapDiceLogs(user) {
  return commitBattleMapState({
    ...battleMapState,
    diceLogs: [],
  }, {
    recordMasterUndo: user?.role === 'master',
    validate: false,
  });
}

function applyRoundWrapState(nextState, direction) {
  const initiativesLength = nextState.initiatives.length;
  if (initiativesLength === 0) {
    return {
      ...nextState,
      roundNumber: 1,
      movementUsedByTokenId: {},
      movementAxisUsageByTokenId: {},
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
        movementAxisUsageByTokenId: {},
        dashUsedByTokenId: {},
        extraMovementByTokenId: {},
      }
    : nextState;
}

function moveOwnedToken(user, tokenId, x, y) {
  const tokenIndex = battleMapState.tokens.findIndex((token) => token.id === tokenId);
  if (tokenIndex === -1) {
    return { status: 404, message: 'Token non trovato.' };
  }

  const token = battleMapState.tokens[tokenIndex];
  const controlledVehicle = findUserControlledVehicle(user);
  const isOwnedPlayer = token.ownerUserId === user.id && token.type === 'player';
  const isControlledVehicle = token.type === 'vehicle' && controlledVehicle?.id === token.id;

  if (user.role !== 'master' && !isOwnedPlayer && !isControlledVehicle) {
    return { status: 403, message: 'Puoi muovere solo il tuo personaggio o il mezzo a cui sei assegnato.' };
  }

  const hasInitiativeOrder = battleMapState.initiatives.length > 0;
  const movementSourceToken = isControlledVehicle
    ? battleMapState.tokens.find(
        (candidate) =>
          candidate.ownerUserId === user.id && candidate.type === 'player' && candidate.isFamiliar !== true,
      ) ?? null
    : token;
  const movementSourceId = movementSourceToken?.id ?? tokenId;
  const movementCells = typeof movementSourceToken?.movementCells === 'number' ? movementSourceToken.movementCells : 0;
  const extraMovement = battleMapState.extraMovementByTokenId[movementSourceId] ?? 0;
  const previousAxisUsage = battleMapState.movementAxisUsageByTokenId[movementSourceId] ?? {
    horizontal: 0,
    vertical: 0,
  };
  const usedCells = movementUsedFromAxisUsage(previousAxisUsage);
  const hasDashed = battleMapState.dashUsedByTokenId[movementSourceId] === true;
  const movementBudget = movementCells * (hasDashed ? 2 : 1) + extraMovement;
  const nextAxisUsage = calculateMovementAxisUsage(previousAxisUsage, token.position, { x, y });
  const moveDistance = movementUsedFromAxisUsage(nextAxisUsage) - usedCells;

  if (hasInitiativeOrder && user.role !== 'master' && usedCells + moveDistance > movementBudget) {
    return {
      status: 400,
      message: `Movimento insufficiente: restano ${Math.max(0, movementBudget - usedCells)} caselle in questo round.`,
      snapshot: nextSnapshot(),
    };
  }

  if (!canTokenIgnoreObstacles(token, user)) {
    const blockingObstacle = findBlockedMovement(battleMapState.tokens, token, token.position, { x, y });
    if (blockingObstacle) {
      return {
        status: 400,
        message: `${blockingObstacle.name} blocca il movimento.`,
        snapshot: nextSnapshot(),
      };
    }
  }

  const nextTokens = applyVehicleAwareUpdates(
    battleMapState.tokens.map((currentToken) =>
      currentToken.id === tokenId ? { ...currentToken, position: { x, y } } : currentToken,
    ),
  );

  const nextState = normalizeSharedState({
    ...battleMapState,
    tokens: nextTokens,
    movementUsedByTokenId: hasInitiativeOrder
      ? {
          ...battleMapState.movementUsedByTokenId,
          [movementSourceId]: movementUsedFromAxisUsage(nextAxisUsage),
        }
      : battleMapState.movementUsedByTokenId,
    movementAxisUsageByTokenId: hasInitiativeOrder
      ? {
          ...battleMapState.movementAxisUsageByTokenId,
          [movementSourceId]: nextAxisUsage,
        }
      : battleMapState.movementAxisUsageByTokenId,
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
    return commitBattleMapState(nextState, { recordMasterUndo: true, validate: false });
  }

  battleMapState = nextState;
  if (user.role !== 'master') {
    pushPlayerUndoAction(user.id, {
      type: 'move',
      tokenId,
      previousPosition: token.position,
      movementSourceId,
      previousMovementUsed: usedCells,
      previousMovementAxisUsage: previousAxisUsage,
    });
  }
  bumpBattleMapVersion();
  broadcastSnapshot();
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

    battleMapState = normalizeSharedState(previousState);
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
      movementAxisUsageByTokenId: {
        ...battleMapState.movementAxisUsageByTokenId,
        [action.movementSourceId]: action.previousMovementAxisUsage,
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

function hashPassword(password) {
  return scryptSync(password, PASSWORD_SALT, 64);
}

function normalizeUsers(rawUsers) {
  return rawUsers.map((user) => ({
    id: user.id,
    username: String(user.username).trim().toLowerCase(),
    displayName: user.displayName,
    role: user.role === 'master' ? 'master' : 'adventurer',
    characterKey: typeof user.characterKey === 'string' ? user.characterKey : null,
    passwordHash: hashPassword(String(user.password)),
  }));
}

function loadUsers() {
  if (!process.env.AUTH_USERS_JSON) {
    return normalizeUsers(demoUsers);
  }

  try {
    const parsed = JSON.parse(process.env.AUTH_USERS_JSON);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AUTH_USERS_JSON must be a non-empty array');
    }

    return normalizeUsers(parsed);
  } catch (error) {
    app.log.error(error, 'Invalid AUTH_USERS_JSON. Falling back to demo users.');
    return normalizeUsers(demoUsers);
  }
}

const users = loadUsers();
const userMap = new Map(users.map((user) => [user.id, user]));
const sessionStore = new Map();

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

function createCharacterToken(profile, userId) {
  return {
    id: `player-token-${profile.key}`,
    name: profile.displayName,
    type: 'player',
    size: 'medium',
    position: { ...profile.spawnPosition },
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
    battleMapState = normalizeSharedState({
      ...battleMapState,
      tokens: [...battleMapState.tokens, createCharacterToken(profile, user.id)],
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

  const user = userMap.get(session.userId);
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
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    reply.header('Vary', 'Origin');
  }

  if (request.method === 'OPTIONS') {
    return reply.code(204).send();
  }
});

app.get('/api/health', async () => ({
  ok: true,
  users: users.length,
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
  const user = users.find((candidate) => candidate.username === username);
  if (!user) {
    reply.code(401);
    return { message: 'Credenziali non valide.' };
  }

  const providedHash = hashPassword(password);
  if (!timingSafeEqual(providedHash, user.passwordHash)) {
    reply.code(401);
    return { message: 'Credenziali non valide.' };
  }

  const sessionId = randomBytes(24).toString('hex');
  sessionStore.set(sessionId, {
    userId: user.id,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  setSessionCookie(reply, sessionId);
  if (profile?.spawnToken) {
    ensureCharacterTokenForUser(user);
  }

  return {
    user: sanitizeUser(user),
  };
});

app.post('/api/auth/logout', async (request, reply) => {
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
  const nextState = normalizeSharedState(body.state);
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

  const body = request.body ?? {};
  if (!body.log || typeof body.log !== 'object') {
    reply.code(400);
    return { message: 'Payload log non valido.' };
  }

  return appendDiceLog(user, body.log, typeof body.flavor === 'string' ? body.flavor : '');
});

app.delete('/api/battle-map/dice-logs', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  return clearBattleMapDiceLogs(user);
});

app.post('/api/battle-map/move', async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) {
    return;
  }

  const body = request.body ?? {};
  const tokenId = typeof body.tokenId === 'string' ? body.tokenId : '';
  const x = typeof body.x === 'number' ? body.x : null;
  const y = typeof body.y === 'number' ? body.y : null;

  if (!tokenId || x === null || y === null) {
    reply.code(400);
    return { message: 'Payload movimento non valido.' };
  }

  const result = moveOwnedToken(user, tokenId, x, y);
  if (result.status !== 200) {
    reply.code(result.status);
    return {
      message: result.message,
      ...nextSnapshot(user),
    };
  }

  return nextSnapshot(user);
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
  if (result.status !== 200) {
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
  if (result.status !== 200) {
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
  await loadPersistedSessionMetadata();
  await app.listen({ port: PORT, host: HOST });
}

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
