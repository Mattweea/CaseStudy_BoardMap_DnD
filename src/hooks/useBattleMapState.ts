import { useCallback, useEffect, useRef, useState } from 'react';
import { collectDiceDeliveries } from '../../shared/dice-3d-presentation.mjs';
import { normalizeDiceLogDetail } from '../../shared/dice-log-normalization.mjs';
import { BOARD_CONFIG } from '../constants/board';
import type {
  BattleMapSharedState,
  BattleMapSessionSnapshot,
  BattleMapSessionStatus,
  BattleMapState,
  DiagonalRule,
  DiceRollLog,
  DiceRollRequest,
  EphemeralPing,
  EphemeralTemplate,
  GridPosition,
  InitiativeEntry,
  LightSource,
  MeasurementUnit,
  TemplateShape,
  TokenWalkEvent,
  MovementNotice,
  UnitToken,
} from '../types';
import { clampZoom, getTokenFootprint } from '../utils/board';
import { isValidCellsValue, pathCost } from '../../shared/grid-movement';
import {
  DEFAULT_TOKEN_COLORS,
  VEHICLE_PRESETS,
  defaultVehicleColor,
  isCreature,
} from '../utils/tokens';
import { API_BASE_URL, EVENTS_URL } from '../utils/api';
const ZOOM_STORAGE_KEY = 'dnd-battle-map-zoom';
// Il ping ha una durata fissa; la sagoma termina quando il suo autore invia l'evento di fine,
// più una durata massima di sicurezza per chi si disconnette senza inviarlo.
const PING_DURATION_MS = 3000;
const TEMPLATE_MAX_DURATION_MS = 30000;
const TOKEN_WALK_EVENT_TTL_MS = 4000;

function normalizeVehicleLinks(tokens: UnitToken[]): UnitToken[] {
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

    const dedupedOccupants: string[] = [];
    const seen = new Set<string>();

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
    const cells: GridPosition[] = [];
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

function applyVehicleAwareUpdates(tokens: UnitToken[]): UnitToken[] {
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

const initialSharedState: BattleMapSharedState = {
  tokens: [],
  diceLogs: [],
  latestDicePreview: null,
  combatAnnouncement: null,
  initiatives: [],
  activeTurnTokenId: null,
  roundNumber: 1,
  turnNotice: null,
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

function readStoredZoom() {
  if (typeof window === 'undefined') {
    return 1;
  }

  const rawValue = window.localStorage.getItem(ZOOM_STORAGE_KEY);
  return clampZoom(rawValue ? Number(rawValue) : 1);
}

function normalizeSharedState(parsed?: Partial<BattleMapSharedState> | null): BattleMapSharedState {
  const tokens = Array.isArray(parsed?.tokens)
    ? parsed.tokens.map<UnitToken>((token) => {
        const type = token.type ?? 'object';
        const affiliation =
          token.affiliation ??
          (type === 'enemy' ? 'enemy' : type === 'player' ? 'player' : null);
        const fallbackColor =
          type === 'vehicle'
            ? defaultVehicleColor(affiliation === 'enemy' ? 'enemy' : 'player')
            : DEFAULT_TOKEN_COLORS[type];
        const initiativeMode = token.initiativeMode === 'advantage' ? 'advantage' : 'normal';
        const { aura: legacyAura, ...tokenWithoutLegacyAura } = token as UnitToken & {
          aura?: { enabled?: boolean; radiusCells?: number } | null;
        };

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
          initiativeMode,
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
            : legacyAura?.enabled === true && typeof legacyAura.radiusCells === 'number'
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
  const initiatives = Array.isArray(parsed?.initiatives)
    ? parsed.initiatives.filter((entry) => tokens.some((token) => token.id === entry.tokenId))
    : [];
  const lightSources = Array.isArray(parsed?.lightSources)
    ? parsed.lightSources.flatMap<LightSource>((light) => {
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

  return {
    tokens: applyVehicleAwareUpdates(tokens),
    diceLogs: Array.isArray(parsed?.diceLogs)
      ? parsed.diceLogs.map((log) => normalizeDiceLogDetail({
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
    initiatives,
    activeTurnTokenId:
      typeof parsed?.activeTurnTokenId === 'string' ? parsed.activeTurnTokenId : null,
    roundNumber: typeof parsed?.roundNumber === 'number' && parsed.roundNumber > 0 ? parsed.roundNumber : 1,
    turnNotice: parsed?.turnNotice && typeof parsed.turnNotice.id === 'number' && (parsed.turnNotice.kind === 'next' || parsed.turnNotice.kind === 'turn') ? parsed.turnNotice : null,
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
    diagonalParityByTokenId:
      parsed?.diagonalParityByTokenId && typeof parsed.diagonalParityByTokenId === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.diagonalParityByTokenId).filter(
              ([tokenId, parity]) =>
                tokens.some((token) => token.id === tokenId) && (parity === 0 || parity === 1),
            ),
          )
        : {},
    diagonalRule: parsed?.diagonalRule === 'alternating' ? 'alternating' : 'standard',
    measurementUnit:
      parsed?.measurementUnit &&
      typeof parsed.measurementUnit.label === 'string' &&
      parsed.measurementUnit.label.trim() !== '' &&
      isValidCellsValue(parsed.measurementUnit.cellsValue)
        ? { label: parsed.measurementUnit.label, cellsValue: parsed.measurementUnit.cellsValue }
        : { label: 'm', cellsValue: 1.5 },
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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    state?: BattleMapSharedState;
    version?: number;
  };

  if (!response.ok) {
    const error = new Error(payload.message ?? 'Richiesta server fallita.') as Error & {
      payload?: typeof payload;
      status?: number;
    };
    error.payload = payload;
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function useBattleMapState(isAuthenticated: boolean) {
  const [sharedState, setSharedState] = useState<BattleMapSharedState>(initialSharedState);
  const [zoom, setZoomState] = useState(readStoredZoom);
  const [version, setVersion] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [diceRollDeliveries, setDiceRollDeliveries] = useState<DiceRollLog[]>([]);
  const [sessionStatus, setSessionStatus] = useState<BattleMapSessionStatus>({
    hasSnapshot: false,
    savedAt: null,
    version: null,
  });
  const sharedStateRef = useRef(sharedState);
  const versionRef = useRef(version);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const mutationCountRef = useRef(0);
  const [ephemeralPings, setEphemeralPings] = useState<EphemeralPing[]>([]);
  const [ephemeralTemplates, setEphemeralTemplates] = useState<EphemeralTemplate[]>([]);
  const [tokenWalkEvents, setTokenWalkEvents] = useState<TokenWalkEvent[]>([]);
  // Il server distingue budget insufficiente, ostacolo e destinazione occupata nel messaggio di
  // rifiuto: senza questo stato il motivo andrebbe perso e il token tornerebbe indietro da solo,
  // senza spiegazione. L'id cambia a ogni rifiuto cosi che due rifiuti identici restino distinti.
  const [movementNotice, setMovementNotice] = useState<MovementNotice | null>(null);
  const pingTimeoutsRef = useRef(new Map<string, ReturnType<typeof window.setTimeout>>());
  const templateTimeoutsRef = useRef(new Map<string, ReturnType<typeof window.setTimeout>>());
  const diceDeliverySeenIdsRef = useRef(new Set<string>());

  useEffect(() => {
    sharedStateRef.current = sharedState;
  }, [sharedState]);

  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  useEffect(() => {
    window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
  }, [zoom]);

  const recordDiceSnapshot = useCallback((logs: DiceRollLog[], baseline: boolean) => {
    const deliveries = collectDiceDeliveries(logs, diceDeliverySeenIdsRef.current, { baseline });
    if (deliveries.length > 0) {
      setDiceRollDeliveries((current) => [...current, ...deliveries].slice(-100));
    }
  }, []);

  const applySnapshot = useCallback((
    nextState: BattleMapSharedState,
    nextVersion: number,
    options: { diceBaseline?: boolean } = {},
  ) => {
    const normalizedState = normalizeSharedState(nextState);
    recordDiceSnapshot(normalizedState.diceLogs, options.diceBaseline === true);
    sharedStateRef.current = normalizedState;
    versionRef.current = nextVersion;
    setSharedState(normalizedState);
    setVersion(nextVersion);
  }, [recordDiceSnapshot]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsReady(false);
      setDiceRollDeliveries([]);
      diceDeliverySeenIdsRef.current.clear();
      setSessionStatus({
        hasSnapshot: false,
        savedAt: null,
        version: null,
      });
      return undefined;
    }

    let isMounted = true;

    const loadState = async () => {
      try {
        const [payload, persistence] = await Promise.all([
          requestJson<{ state: BattleMapSharedState; version: number }>('/battle-map/state'),
          requestJson<BattleMapSessionStatus>('/battle-map/session-status'),
        ]);

        if (!isMounted) {
          return;
        }

        const nextState = normalizeSharedState(payload.state);
        recordDiceSnapshot(nextState.diceLogs, true);
        sharedStateRef.current = nextState;
        versionRef.current = payload.version;
        setSharedState(nextState);
        setVersion(payload.version);
        setSessionStatus(persistence);
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    void loadState();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, recordDiceSnapshot]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) {
      return undefined;
    }

    // A same-origin SSE stream sends a snapshot only when the session state changes.
    const eventSource = new EventSource(EVENTS_URL, { withCredentials: true });
    let awaitingConnectionBaseline = true;
    eventSource.onopen = () => {
      awaitingConnectionBaseline = true;
    };
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          state: BattleMapSharedState;
          version: number;
        };
        applySnapshot(payload.state, payload.version, {
          diceBaseline: awaitingConnectionBaseline,
        });
        awaitingConnectionBaseline = false;
      } catch (error) {
        console.error(error);
      }
    };
    const relayCharacterSheetEvent = (event: MessageEvent) => {
      try {
        window.dispatchEvent(new CustomEvent('vtt:character-sheet-event', { detail: JSON.parse(event.data) }));
      } catch (error) { console.error(error); }
    };
    eventSource.addEventListener('character-sheet-patch', relayCharacterSheetEvent as EventListener);
    eventSource.addEventListener('character-sheet-persistence', relayCharacterSheetEvent as EventListener);
    eventSource.addEventListener('character-sheet-portrait', relayCharacterSheetEvent as EventListener);

    const handlePing = (event: MessageEvent) => {
      try {
        const ping = JSON.parse(event.data) as EphemeralPing;
        setEphemeralPings((current) => [...current.filter((entry) => entry.id !== ping.id), ping]);
        const previousTimeout = pingTimeoutsRef.current.get(ping.id);
        if (previousTimeout !== undefined) {
          window.clearTimeout(previousTimeout);
        }
        pingTimeoutsRef.current.set(
          ping.id,
          window.setTimeout(() => {
            setEphemeralPings((current) => current.filter((entry) => entry.id !== ping.id));
            pingTimeoutsRef.current.delete(ping.id);
          }, PING_DURATION_MS),
        );
      } catch (error) {
        console.error(error);
      }
    };

    const removeTemplate = (id: string) => {
      setEphemeralTemplates((current) => current.filter((entry) => entry.id !== id));
      const timeout = templateTimeoutsRef.current.get(id);
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
        templateTimeoutsRef.current.delete(id);
      }
    };

    const handleTemplateUpdate = (event: MessageEvent) => {
      try {
        const template = JSON.parse(event.data) as EphemeralTemplate;
        setEphemeralTemplates((current) => [...current.filter((entry) => entry.id !== template.id), template]);
        const previousTimeout = templateTimeoutsRef.current.get(template.id);
        if (previousTimeout !== undefined) {
          window.clearTimeout(previousTimeout);
        }
        templateTimeoutsRef.current.set(
          template.id,
          window.setTimeout(() => removeTemplate(template.id), TEMPLATE_MAX_DURATION_MS),
        );
      } catch (error) {
        console.error(error);
      }
    };

    const handleTemplateEnd = (event: MessageEvent) => {
      try {
        const { id } = JSON.parse(event.data) as { id: string };
        removeTemplate(id);
      } catch (error) {
        console.error(error);
      }
    };

    const tokenWalkTimeoutsRef = new Set<ReturnType<typeof window.setTimeout>>();
    const handleTokenWalk = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { tokenId: string; waypoints: GridPosition[] };
        const id = `${payload.tokenId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setTokenWalkEvents((current) => [...current, { id, tokenId: payload.tokenId, waypoints: payload.waypoints }]);
        const timeout = window.setTimeout(() => {
          setTokenWalkEvents((current) => current.filter((entry) => entry.id !== id));
          tokenWalkTimeoutsRef.delete(timeout);
        }, TOKEN_WALK_EVENT_TTL_MS);
        tokenWalkTimeoutsRef.add(timeout);
      } catch (error) {
        console.error(error);
      }
    };

    eventSource.addEventListener('ephemeral-ping', handlePing as EventListener);
    eventSource.addEventListener('ephemeral-template', handleTemplateUpdate as EventListener);
    eventSource.addEventListener('ephemeral-template-end', handleTemplateEnd as EventListener);
    eventSource.addEventListener('token-walk', handleTokenWalk as EventListener);
    eventSource.onerror = () => {
      // EventSource reconnects automatically using the retry interval supplied by the server.
    };

    return () => {
      eventSource.close();
      pingTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      pingTimeoutsRef.current.clear();
      templateTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      templateTimeoutsRef.current.clear();
      tokenWalkTimeoutsRef.forEach((timeout) => window.clearTimeout(timeout));
      tokenWalkTimeoutsRef.clear();
    };
  }, [applySnapshot, isAuthenticated, isReady]);

  const setOptimisticState = (nextState: BattleMapSharedState) => {
    sharedStateRef.current = nextState;
    setSharedState(nextState);
  };

  const enqueueMutation = <T,>(task: () => Promise<T>): Promise<T> => {
    mutationCountRef.current += 1;
    setIsMutating(true);

    const run = mutationQueueRef.current.then(task, task);
    mutationQueueRef.current = run.then(
      () => undefined,
      () => undefined,
    );

    return run.finally(() => {
      mutationCountRef.current = Math.max(0, mutationCountRef.current - 1);
      if (mutationCountRef.current === 0) {
        setIsMutating(false);
      }
    });
  };

  const commitSharedState = async (
    updater: (current: BattleMapSharedState) => BattleMapSharedState,
  ) => {
    return enqueueMutation(async () => {
      const previousState = sharedStateRef.current;
      const previousVersion = versionRef.current;
      const nextState = normalizeSharedState(updater(sharedStateRef.current));
      setOptimisticState(nextState);

      try {
        const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
          '/battle-map/state',
          {
            method: 'PUT',
            body: JSON.stringify({
              baseVersion: previousVersion,
              state: nextState,
            }),
          },
        );

        applySnapshot(payload.state, payload.version);
      } catch (error) {
        console.error(error);

        const conflictState =
          error instanceof Error && 'payload' in error
            ? (error.payload as { state?: BattleMapSharedState; version?: number } | undefined)
            : undefined;

        if (conflictState?.state && typeof conflictState.version === 'number') {
          const rebasedState = normalizeSharedState(updater(normalizeSharedState(conflictState.state)));
          setOptimisticState(rebasedState);

          try {
            const retryPayload = await requestJson<{ state: BattleMapSharedState; version: number }>(
              '/battle-map/state',
              {
                method: 'PUT',
                body: JSON.stringify({
                  baseVersion: conflictState.version,
                  state: rebasedState,
                }),
              },
            );

            applySnapshot(retryPayload.state, retryPayload.version);
            return;
          } catch (retryError) {
            console.error(retryError);

            const retryConflict =
              retryError instanceof Error && 'payload' in retryError
                ? (retryError.payload as { state?: BattleMapSharedState; version?: number } | undefined)
                : undefined;

            if (retryConflict?.state && typeof retryConflict.version === 'number') {
              applySnapshot(retryConflict.state, retryConflict.version);
              return;
            }
          }
        }

        applySnapshot(previousState, previousVersion);
      }
    });
  };

  const rollDice = async (roll: DiceRollRequest) => {
    return enqueueMutation(async () => {
      try {
        const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
          '/battle-map/rolls',
          {
            method: 'POST',
            body: JSON.stringify(roll),
          },
        );
        applySnapshot(payload.state, payload.version);
        return { ok: true as const };
      } catch (error) {
        return { ok: false as const, message: error instanceof Error ? error.message : 'Tiro non riuscito.' };
      }
    });
  };

  const clearDiceLogs = async () => {
    return enqueueMutation(async () => {
      const optimisticState = {
        ...sharedStateRef.current,
        diceLogs: [],
      };
      setOptimisticState(optimisticState);

      try {
        const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
          '/battle-map/dice-logs',
          {
            method: 'DELETE',
          },
        );
        applySnapshot(payload.state, payload.version);
      } catch (error) {
        console.error(error);
      }
    });
  };

  const setZoom = (nextZoom: number) => {
    setZoomState(clampZoom(nextZoom));
  };

  const moveToken = (tokenId: string, x: number, y: number) => {
    void commitSharedState((current) => ({
      ...current,
      tokens: applyVehicleAwareUpdates(
        current.tokens.map((token) => {
          if (token.id === tokenId) {
            return {
              ...token,
              position: { x, y },
            };
          }

          if (token.containedInVehicleId === tokenId) {
            return {
              ...token,
              position: { x, y },
            };
          }

          const movedToken = current.tokens.find((item) => item.id === tokenId);
          if (movedToken?.containedInVehicleId && token.id === movedToken.containedInVehicleId) {
            return {
              ...token,
              position: { x, y },
            };
          }

          return token;
        }),
      ),
    }));
  };

  const moveTokens = (moves: Array<{ tokenId: string; x: number; y: number }>) => {
    const moveMap = new Map(moves.map((move) => [move.tokenId, move]));

    void commitSharedState((current) => ({
      ...current,
      tokens: applyVehicleAwareUpdates(
        current.tokens.map((token) => {
          const directMove = moveMap.get(token.id);
          if (directMove) {
            return {
              ...token,
              position: { x: directMove.x, y: directMove.y },
            };
          }

          const containerMove = token.containedInVehicleId ? moveMap.get(token.containedInVehicleId) : null;
          if (containerMove) {
            return {
              ...token,
              position: { x: containerMove.x, y: containerMove.y },
            };
          }

          const movedOccupant = current.tokens.find(
            (item) => item.containedInVehicleId && item.containedInVehicleId === token.id && moveMap.has(item.id),
          );
          if (movedOccupant) {
            const move = moveMap.get(movedOccupant.id);
            return move
              ? {
                  ...token,
                  position: { x: move.x, y: move.y },
                }
              : token;
          }

          return token;
        }),
      ),
    }));
  };

  // Legge sempre sharedStateRef.current al momento dell'esecuzione (non un valore catturato in
  // precedenza), cosicché due chiamate consecutive in coda vedano ciascuna l'esito ottimistico
  // della precedente invece di partire entrambe dalla stessa posizione di partenza obsoleta.
  const performOwnedMove = async (tokenId: string, x: number, y: number, waypoints?: GridPosition[]) => {
    const previousState = sharedStateRef.current;
    const previousVersion = versionRef.current;
    const optimisticToken = previousState.tokens.find((token) => token.id === tokenId);
    if (!optimisticToken) {
      return;
    }

    const path = waypoints && waypoints.length > 0 ? waypoints : [optimisticToken.position, { x, y }];
    const destination = path[path.length - 1];
    const hasInitiativeOrder = previousState.initiatives.length > 0;
    const usedCells = previousState.movementUsedByTokenId[tokenId] ?? 0;
    const previousDiagonalParity = previousState.diagonalParityByTokenId[tokenId] ?? 0;
    const { cells: moveDistance, nextDiagonalParity } = pathCost(path, {
      rule: previousState.diagonalRule,
      diagonalParity: previousDiagonalParity,
    });
    const optimisticState = normalizeSharedState({
      ...previousState,
      tokens: applyVehicleAwareUpdates(
        previousState.tokens.map((token) =>
          token.id === tokenId ? { ...token, position: destination } : token,
        ),
      ),
      movementUsedByTokenId: hasInitiativeOrder
        ? {
            ...previousState.movementUsedByTokenId,
            [tokenId]: usedCells + moveDistance,
          }
        : previousState.movementUsedByTokenId,
      diagonalParityByTokenId: hasInitiativeOrder
        ? {
            ...previousState.diagonalParityByTokenId,
            [tokenId]: nextDiagonalParity,
          }
        : previousState.diagonalParityByTokenId,
      dashUsedByTokenId: previousState.dashUsedByTokenId,
    });
    setOptimisticState(optimisticState);

    try {
      const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
        '/battle-map/move',
        {
          method: 'POST',
          body: JSON.stringify(
            waypoints && waypoints.length > 0 ? { tokenId, waypoints } : { tokenId, x, y },
          ),
        },
      );
      applySnapshot(payload.state, payload.version);
      // Un movimento accettato chiude il rifiuto precedente: l'avviso descrive l'ultimo tentativo,
      // non resta appeso sopra una mossa andata a buon fine.
      setMovementNotice(null);
    } catch (error) {
      console.error(error);
      const payload =
        error instanceof Error && 'payload' in error
          ? (error.payload as { state?: BattleMapSharedState; version?: number } | undefined)
          : undefined;

      if (payload?.state && typeof payload.version === 'number') {
        applySnapshot(payload.state, payload.version);
      } else {
        applySnapshot(previousState, previousVersion);
      }

      setMovementNotice({
        id: crypto.randomUUID(),
        message: error instanceof Error ? error.message : 'Movimento rifiutato dal server.',
      });
    }
  };

  const moveOwnedToken = async (tokenId: string, x: number, y: number, waypoints?: GridPosition[]) => {
    return enqueueMutation(() => performOwnedMove(tokenId, x, y, waypoints));
  };

  // Il movimento da tastiera deve leggere la posizione corrente al momento dell'esecuzione in
  // coda, non quella catturata dal render al momento della pressione del tasto: altrimenti
  // pressioni rapide consecutive calcolano tutte la destinazione dalla stessa posizione di
  // partenza obsoleta invece che dall'ultima posizione ottimistica.
  const moveOwnedTokenBy = async (tokenId: string, deltaX: number, deltaY: number) => {
    return enqueueMutation(() => {
      const currentToken = sharedStateRef.current.tokens.find((token) => token.id === tokenId);
      if (!currentToken) {
        return Promise.resolve();
      }

      const x = Math.max(0, currentToken.position.x + deltaX);
      const y = Math.max(0, currentToken.position.y + deltaY);
      return performOwnedMove(tokenId, x, y);
    });
  };

  const addTokens = (tokens: BattleMapSharedState['tokens']) => {
    void commitSharedState((current) => ({
      ...current,
      tokens: applyVehicleAwareUpdates([...current.tokens, ...tokens]),
    }));
  };

  const updateToken = (tokenId: string, updates: Partial<UnitToken>) => {
    void commitSharedState((current) => ({
      ...current,
      tokens: applyVehicleAwareUpdates(
        current.tokens.map((token) =>
          token.id === tokenId
            ? {
                ...token,
                ...updates,
              }
            : token,
        ),
      ),
    }));
  };

  const removeToken = (tokenId: string) => {
    void commitSharedState((current) => {
      const nextTokens = applyVehicleAwareUpdates(current.tokens.filter((token) => token.id !== tokenId));
      const nextInitiatives = current.initiatives.filter((entry) => entry.tokenId !== tokenId);

      return {
        ...current,
        tokens: nextTokens,
        initiatives: nextInitiatives,
        activeTurnTokenId:
          current.activeTurnTokenId === tokenId ? nextInitiatives[0]?.tokenId ?? null : current.activeTurnTokenId,
        movementUsedByTokenId: Object.fromEntries(
          Object.entries(current.movementUsedByTokenId).filter(([currentTokenId]) => currentTokenId !== tokenId),
        ),
        diagonalParityByTokenId: Object.fromEntries(
          Object.entries(current.diagonalParityByTokenId).filter(([currentTokenId]) => currentTokenId !== tokenId),
        ),
        dashUsedByTokenId: Object.fromEntries(
          Object.entries(current.dashUsedByTokenId).filter(([currentTokenId]) => currentTokenId !== tokenId),
        ),
        extraMovementByTokenId: Object.fromEntries(
          Object.entries(current.extraMovementByTokenId).filter(([currentTokenId]) => currentTokenId !== tokenId),
        ),
      };
    });
  };

  const removeTokens = (tokenIds: string[]) => {
    const tokenIdSet = new Set(tokenIds);

    void commitSharedState((current) => {
      const nextTokens = applyVehicleAwareUpdates(
        current.tokens.filter((token) => !tokenIdSet.has(token.id)),
      );
      const nextInitiatives = current.initiatives.filter((entry) => !tokenIdSet.has(entry.tokenId));

      return {
        ...current,
        tokens: nextTokens,
        initiatives: nextInitiatives,
        activeTurnTokenId: tokenIdSet.has(current.activeTurnTokenId ?? '')
          ? nextInitiatives[0]?.tokenId ?? null
          : current.activeTurnTokenId,
        movementUsedByTokenId: Object.fromEntries(
          Object.entries(current.movementUsedByTokenId).filter(([tokenId]) => !tokenIdSet.has(tokenId)),
        ),
        diagonalParityByTokenId: Object.fromEntries(
          Object.entries(current.diagonalParityByTokenId).filter(([tokenId]) => !tokenIdSet.has(tokenId)),
        ),
        dashUsedByTokenId: Object.fromEntries(
          Object.entries(current.dashUsedByTokenId).filter(([tokenId]) => !tokenIdSet.has(tokenId)),
        ),
        extraMovementByTokenId: Object.fromEntries(
          Object.entries(current.extraMovementByTokenId).filter(([tokenId]) => !tokenIdSet.has(tokenId)),
        ),
      };
    });
  };

  const setInitiative = (entry: InitiativeEntry) => {
    void commitSharedState((current) => {
      if (!current.tokens.some((token) => token.id === entry.tokenId && isCreature(token))) {
        return current;
      }

      const nextEntries = current.initiatives.filter((item) => item.tokenId !== entry.tokenId);
      const insertIndex = nextEntries.findIndex((item) => item.value < entry.value);

      if (insertIndex === -1) {
        nextEntries.push(entry);
      } else {
        nextEntries.splice(insertIndex, 0, entry);
      }

      return {
        ...current,
        initiatives: nextEntries,
        activeTurnTokenId: current.activeTurnTokenId ?? nextEntries[0]?.tokenId ?? null,
        movementUsedByTokenId: current.movementUsedByTokenId,
        diagonalParityByTokenId: current.diagonalParityByTokenId,
        dashUsedByTokenId: current.dashUsedByTokenId,
        extraMovementByTokenId: current.extraMovementByTokenId,
      };
    });
  };

  const setInitiatives = (entries: InitiativeEntry[]) => {
    void commitSharedState((current) => {
      const validEntries = entries.filter((entry) =>
        current.tokens.some((token) => token.id === entry.tokenId && isCreature(token)),
      );

      if (validEntries.length === 0) {
        return current;
      }

      const nextEntries = current.initiatives.filter(
        (item) => !validEntries.some((entry) => entry.tokenId === item.tokenId),
      );

      validEntries.forEach((entry) => {
        const insertIndex = nextEntries.findIndex((item) => item.value < entry.value);

        if (insertIndex === -1) {
          nextEntries.push(entry);
        } else {
          nextEntries.splice(insertIndex, 0, entry);
        }
      });

      return {
        ...current,
        initiatives: nextEntries,
        activeTurnTokenId: current.activeTurnTokenId ?? nextEntries[0]?.tokenId ?? null,
        movementUsedByTokenId: current.movementUsedByTokenId,
        diagonalParityByTokenId: current.diagonalParityByTokenId,
        dashUsedByTokenId: current.dashUsedByTokenId,
        extraMovementByTokenId: current.extraMovementByTokenId,
      };
    });
  };

  const reorderInitiatives = (fromIndex: number, toIndex: number) => {
    void commitSharedState((current) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.initiatives.length ||
        toIndex >= current.initiatives.length ||
        fromIndex === toIndex
      ) {
        return current;
      }

      const nextInitiatives = [...current.initiatives];
      const [moved] = nextInitiatives.splice(fromIndex, 1);
      nextInitiatives.splice(toIndex, 0, moved);

      return {
        ...current,
        initiatives: nextInitiatives,
      };
    });
  };

  const clearInitiative = (tokenId: string) => {
    void commitSharedState((current) => {
      const nextInitiatives = current.initiatives.filter((entry) => entry.tokenId !== tokenId);

      return {
        ...current,
        initiatives: nextInitiatives,
        activeTurnTokenId:
          current.activeTurnTokenId === tokenId
            ? nextInitiatives[0]?.tokenId ?? null
            : current.activeTurnTokenId,
      };
    });
  };

  const clearInitiatives = () => {
    void commitSharedState((current) => ({
      ...current,
      initiatives: [],
      activeTurnTokenId: null,
      roundNumber: 1,
      movementUsedByTokenId: {},
      diagonalParityByTokenId: {},
      dashUsedByTokenId: {},
      extraMovementByTokenId: {},
    }));
  };

  const cycleTurn = (direction: 'next' | 'previous') => {
    void commitSharedState((current) => {
      if (current.initiatives.length === 0) {
        return current;
      }

      const activeIndex = current.initiatives.findIndex(
        (entry) => entry.tokenId === current.activeTurnTokenId,
      );
      const startIndex =
        activeIndex >= 0 ? activeIndex : direction === 'next' ? -1 : 0;
      const nextIndex =
        direction === 'next'
          ? (startIndex + 1) % current.initiatives.length
          : (startIndex - 1 + current.initiatives.length) % current.initiatives.length;
      const wrappedRound =
        (direction === 'next' && startIndex === current.initiatives.length - 1) ||
        (direction === 'previous' && startIndex === 0);

      return {
        ...current,
        activeTurnTokenId: current.initiatives[nextIndex]?.tokenId ?? null,
        roundNumber: wrappedRound
          ? Math.max(1, current.roundNumber + (direction === 'next' ? 1 : -1))
          : current.roundNumber,
        movementUsedByTokenId: wrappedRound ? {} : current.movementUsedByTokenId,
        diagonalParityByTokenId: wrappedRound ? {} : current.diagonalParityByTokenId,
        dashUsedByTokenId: wrappedRound ? {} : current.dashUsedByTokenId,
        extraMovementByTokenId: wrappedRound ? {} : current.extraMovementByTokenId,
      };
    });
  };

  const useDashAction = async (tokenId: string) => {
    return enqueueMutation(async () => {
      const optimisticState = normalizeSharedState({
        ...sharedStateRef.current,
        dashUsedByTokenId: {
          ...sharedStateRef.current.dashUsedByTokenId,
          [tokenId]: true,
        },
      });
      setOptimisticState(optimisticState);

      try {
        const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
          '/battle-map/dash',
          {
            method: 'POST',
            body: JSON.stringify({ tokenId }),
          },
        );
        applySnapshot(payload.state, payload.version);
      } catch (error) {
        console.error(error);
        const payload =
          error instanceof Error && 'payload' in error
            ? (error.payload as { state?: BattleMapSharedState; version?: number } | undefined)
            : undefined;

        if (payload?.state && typeof payload.version === 'number') {
          applySnapshot(payload.state, payload.version);
        }
      }
    });
  };

  const updateOwnedToken = async (
    tokenId: string,
    updates: Partial<Pick<UnitToken, 'hitPoints' | 'maxHitPoints' | 'conditions' | 'isInvisible' | 'excludeFromInitiative' | 'auras'>>,
  ) => {
    return enqueueMutation(async () => {
      const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
        '/battle-map/token-update',
        {
          method: 'POST',
          body: JSON.stringify({ tokenId, updates }),
        },
      );

      applySnapshot(payload.state, payload.version);
    });
  };

  const addOwnedExtraMovement = async (tokenId: string, amount = 1) => {
    return enqueueMutation(async () => {
      const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
        '/battle-map/extra-movement',
        {
          method: 'POST',
          body: JSON.stringify({ tokenId, amount }),
        },
      );

      applySnapshot(payload.state, payload.version);
    });
  };

  const undoLastAction = async () => {
    return enqueueMutation(async () => {
      try {
        const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
          '/battle-map/undo',
          {
            method: 'POST',
          },
        );

        applySnapshot(payload.state, payload.version);
      } catch (error) {
        console.error(error);
        const payload =
          error instanceof Error && 'payload' in error
            ? (error.payload as { state?: BattleMapSharedState; version?: number } | undefined)
            : undefined;

        if (payload?.state && typeof payload.version === 'number') {
          applySnapshot(payload.state, payload.version);
        }
      }
    });
  };

  const setActiveTurnToken = (tokenId: string) => {
    void commitSharedState((current) => ({
      ...current,
      activeTurnTokenId: tokenId,
    }));
  };

  const setBoardBackgroundHidden = (hidden: boolean) => {
    void commitSharedState((current) => ({
      ...current,
      isBoardBackgroundHidden: hidden,
    }));
  };

  const setBoardFullyLit = (fullyLit: boolean) => {
    void commitSharedState((current) => ({
      ...current,
      isBoardFullyLit: fullyLit,
    }));
  };

  const addLightSource = (position: GridPosition, radiusCells: number) => {
    void commitSharedState((current) => ({
      ...current,
      lightSources: [
        ...current.lightSources,
        {
          id: crypto.randomUUID(),
          position: {
            x: Math.max(0, Math.floor(position.x)),
            y: Math.max(0, Math.floor(position.y)),
          },
          radiusCells: Math.max(0, Math.floor(radiusCells)),
        },
      ],
    }));
  };

  const removeLightSource = (lightId: string) => {
    void commitSharedState((current) => ({
      ...current,
      lightSources: current.lightSources.filter((light) => light.id !== lightId),
    }));
  };

  const setSharedNotes = async (notes: string) => {
    return enqueueMutation(async () => {
      const previousState = sharedStateRef.current;
      const previousVersion = versionRef.current;
      setOptimisticState(normalizeSharedState({
        ...previousState,
        sharedNotes: notes,
      }));

      try {
        const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
          '/battle-map/notes',
          {
            method: 'POST',
            body: JSON.stringify({ notes }),
          },
        );
        applySnapshot(payload.state, payload.version);
      } catch (error) {
        console.error(error);
        applySnapshot(previousState, previousVersion);
      }
    });
  };

  const updateBattleMapSettings = async (
    updates: Partial<{ diagonalRule: DiagonalRule; measurementUnit: MeasurementUnit }>,
  ) => {
    return enqueueMutation(async () => {
      const previousState = sharedStateRef.current;
      const previousVersion = versionRef.current;
      setOptimisticState(normalizeSharedState({
        ...previousState,
        ...updates,
      }));

      try {
        const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
          '/battle-map/settings',
          {
            method: 'POST',
            body: JSON.stringify(updates),
          },
        );
        applySnapshot(payload.state, payload.version);
        return { ok: true as const };
      } catch (error) {
        console.error(error);
        applySnapshot(previousState, previousVersion);
        return { ok: false as const, message: error instanceof Error ? error.message : 'Impostazioni non valide.' };
      }
    });
  };

  const sendPing = async (position: GridPosition) => {
    try {
      await requestJson('/battle-map/ping', {
        method: 'POST',
        body: JSON.stringify({ position }),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const sendTemplateEvent = async (event: {
    id: string;
    phase: 'update' | 'end';
    shape: TemplateShape;
    origin: GridPosition;
    target: GridPosition;
    color: string;
  }) => {
    try {
      await requestJson('/battle-map/template', {
        method: 'POST',
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const startCombat = async () => {
    return enqueueMutation(async () => {
      const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
        '/battle-map/combat/start',
        {
          method: 'POST',
        },
      );

      applySnapshot(payload.state, payload.version);
    });
  };

  const resetZoom = () => setZoom(1);

  const suspendSession = async () => {
    const payload = await requestJson<BattleMapSessionSnapshot>('/battle-map/session/suspend', {
      method: 'POST',
    });

    setSessionStatus({
      hasSnapshot: true,
      savedAt: payload.savedAt,
      version: payload.version,
    });
  };

  const resumeLastSession = async () => {
    const payload = await requestJson<BattleMapSessionSnapshot>('/battle-map/session/resume', {
      method: 'POST',
    });

    applySnapshot(payload.state, payload.version, { diceBaseline: true });
    setSessionStatus({
      hasSnapshot: true,
      savedAt: payload.savedAt,
      version: payload.version,
    });
  };

  const clearMovementNotice = () => setMovementNotice(null);

  const state: BattleMapState = {
    ...sharedState,
    zoom,
  };

  return {
    boardConfig: BOARD_CONFIG,
    isReady,
    isMutating,
    state,
    diceRollDeliveries,
    setZoom,
    moveToken,
    moveTokens,
    moveOwnedToken,
    moveOwnedTokenBy,
    useDashAction,
    updateOwnedToken,
    addOwnedExtraMovement,
    addTokens,
    updateToken,
    removeToken,
    removeTokens,
    rollDice,
    clearDiceLogs,
    setInitiative,
    setInitiatives,
    reorderInitiatives,
    clearInitiative,
    clearInitiatives,
    cycleTurn,
    setActiveTurnToken,
    setBoardBackgroundHidden,
    setBoardFullyLit,
    addLightSource,
    removeLightSource,
    setSharedNotes,
    updateBattleMapSettings,
    ephemeralPings,
    ephemeralTemplates,
    tokenWalkEvents,
    movementNotice,
    clearMovementNotice,
    sendPing,
    sendTemplateEvent,
    startCombat,
    resetZoom,
    undoLastAction,
    sessionStatus,
    suspendSession,
    resumeLastSession,
  };
}
