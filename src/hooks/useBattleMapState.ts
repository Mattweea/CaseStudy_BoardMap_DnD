import { useEffect, useRef, useState } from 'react';
import { BOARD_CONFIG } from '../constants/board';
import type {
  BattleMapSharedState,
  BattleMapSessionSnapshot,
  BattleMapSessionStatus,
  BattleMapState,
  DiceRollLog,
  GridPosition,
  InitiativeEntry,
  UnitToken,
} from '../types';
import { clampZoom, getTokenFootprint } from '../utils/board';
import {
  DEFAULT_TOKEN_COLORS,
  VEHICLE_PRESETS,
  defaultVehicleColor,
  isCreature,
} from '../utils/tokens';
import { API_BASE_URL, EVENTS_URL } from '../utils/api';
const ZOOM_STORAGE_KEY = 'dnd-battle-map-zoom';

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
  initiatives: [],
  activeTurnTokenId: null,
  roundNumber: 1,
  movementUsedByTokenId: {},
  dashUsedByTokenId: {},
  extraMovementByTokenId: {},
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

        return {
          ...token,
          type,
          size: token.size ?? (token.vehicleKind ? VEHICLE_PRESETS[token.vehicleKind].size : 'medium'),
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
          hitPoints: typeof token.hitPoints === 'number' ? token.hitPoints : null,
          maxHitPoints: typeof token.maxHitPoints === 'number' ? token.maxHitPoints : null,
          isInvisible: token.isInvisible === true,
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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
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

export function useBattleMapState() {
  const [sharedState, setSharedState] = useState<BattleMapSharedState>(initialSharedState);
  const [zoom, setZoomState] = useState(readStoredZoom);
  const [version, setVersion] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<BattleMapSessionStatus>({
    hasSnapshot: false,
    savedAt: null,
    version: null,
  });
  const sharedStateRef = useRef(sharedState);
  const versionRef = useRef(version);

  useEffect(() => {
    sharedStateRef.current = sharedState;
  }, [sharedState]);

  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  useEffect(() => {
    window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
  }, [zoom]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!isReady) {
      return undefined;
    }

    // The server pushes the canonical battle map snapshot to every connected client.
    const eventSource = new EventSource(EVENTS_URL, { withCredentials: true });
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          state: BattleMapSharedState;
          version: number;
        };
        applySnapshot(payload.state, payload.version);
      } catch (error) {
        console.error(error);
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isReady]);

  const applySnapshot = (nextState: BattleMapSharedState, nextVersion: number) => {
    const normalizedState = normalizeSharedState(nextState);
    sharedStateRef.current = normalizedState;
    versionRef.current = nextVersion;
    setSharedState(normalizedState);
    setVersion(nextVersion);
  };

  const setOptimisticState = (nextState: BattleMapSharedState) => {
    sharedStateRef.current = nextState;
    setSharedState(nextState);
  };

  const commitSharedState = async (
    updater: (current: BattleMapSharedState) => BattleMapSharedState,
  ) => {
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
  };

  const addDiceLog = async (log: DiceRollLog) => {
    const optimisticState = {
      ...sharedStateRef.current,
      diceLogs: [log, ...sharedStateRef.current.diceLogs].slice(0, 30),
    };
    setOptimisticState(optimisticState);

    try {
      const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
        '/battle-map/dice-logs',
        {
          method: 'POST',
          body: JSON.stringify({ log }),
        },
      );
      applySnapshot(payload.state, payload.version);
    } catch (error) {
      console.error(error);
    }
  };

  const clearDiceLogs = async () => {
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

  const moveOwnedToken = async (tokenId: string, x: number, y: number) => {
    const previousState = sharedStateRef.current;
    const previousVersion = versionRef.current;
    const optimisticToken = previousState.tokens.find((token) => token.id === tokenId);
    if (!optimisticToken) {
      return;
    }

    const hasInitiativeOrder = previousState.initiatives.length > 0;
    const optimisticDistance = Math.max(
      Math.abs(optimisticToken.position.x - x),
      Math.abs(optimisticToken.position.y - y),
    );
    const optimisticState = normalizeSharedState({
      ...previousState,
      tokens: applyVehicleAwareUpdates(
        previousState.tokens.map((token) =>
          token.id === tokenId ? { ...token, position: { x, y } } : token,
        ),
      ),
      movementUsedByTokenId: hasInitiativeOrder
        ? {
            ...previousState.movementUsedByTokenId,
            [tokenId]: (previousState.movementUsedByTokenId[tokenId] ?? 0) + optimisticDistance,
          }
        : previousState.movementUsedByTokenId,
      dashUsedByTokenId: previousState.dashUsedByTokenId,
    });
    setOptimisticState(optimisticState);

    try {
      const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
        '/battle-map/move',
        {
          method: 'POST',
          body: JSON.stringify({ tokenId, x, y }),
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
      } else {
        applySnapshot(previousState, previousVersion);
      }
    }
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
        dashUsedByTokenId: wrappedRound ? {} : current.dashUsedByTokenId,
        extraMovementByTokenId: wrappedRound ? {} : current.extraMovementByTokenId,
      };
    });
  };

  const useDashAction = async (tokenId: string) => {
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
  };

  const updateOwnedToken = async (
    tokenId: string,
    updates: Partial<Pick<UnitToken, 'hitPoints' | 'maxHitPoints'>>,
  ) => {
    const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
      '/battle-map/token-update',
      {
        method: 'POST',
        body: JSON.stringify({ tokenId, updates }),
      },
    );

    applySnapshot(payload.state, payload.version);
  };

  const addOwnedExtraMovement = async (tokenId: string, amount = 1) => {
    const payload = await requestJson<{ state: BattleMapSharedState; version: number }>(
      '/battle-map/extra-movement',
      {
        method: 'POST',
        body: JSON.stringify({ tokenId, amount }),
      },
    );

    applySnapshot(payload.state, payload.version);
  };

  const undoLastAction = async () => {
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
  };

  const setActiveTurnToken = (tokenId: string) => {
    void commitSharedState((current) => ({
      ...current,
      activeTurnTokenId: tokenId,
    }));
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

    applySnapshot(payload.state, payload.version);
    setSessionStatus({
      hasSnapshot: true,
      savedAt: payload.savedAt,
      version: payload.version,
    });
  };

  const state: BattleMapState = {
    ...sharedState,
    zoom,
  };

  return {
    boardConfig: BOARD_CONFIG,
    isReady,
    state,
    setZoom,
    moveToken,
    moveTokens,
    moveOwnedToken,
    useDashAction,
    updateOwnedToken,
    addOwnedExtraMovement,
    addTokens,
    updateToken,
    removeToken,
    removeTokens,
    addDiceLog,
    clearDiceLogs,
    setInitiative,
    setInitiatives,
    reorderInitiatives,
    clearInitiative,
    clearInitiatives,
    cycleTurn,
    setActiveTurnToken,
    resetZoom,
    undoLastAction,
    sessionStatus,
    suspendSession,
    resumeLastSession,
  };
}
