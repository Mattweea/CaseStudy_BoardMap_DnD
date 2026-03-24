import { useEffect, useState } from 'react';
import { BOARD_CONFIG, STORAGE_KEY } from '../constants/board';
import type { BattleMapState, DiceRollLog, InitiativeEntry, UnitToken } from '../types';
import { clampZoom } from '../utils/board';
import {
  DEFAULT_TOKEN_COLORS,
  VEHICLE_PRESETS,
  defaultVehicleColor,
  isCreature,
} from '../utils/tokens';

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
      occupant.position = { ...token.position };
    });

    token.vehicleOccupantIds = dedupedOccupants;
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
      position: { ...vehicle.position },
    };
  });
}

const initialState: BattleMapState = {
  zoom: 1,
  tokens: [
    {
      id: 'sample-player-1',
      name: 'Aria',
      type: 'player',
      size: 'medium',
      position: { x: 4, y: 4 },
      color: DEFAULT_TOKEN_COLORS.player,
      initiativeModifier: 0,
      affiliation: 'player',
      vehicleKind: null,
      showVehicleOccupants: undefined,
      conditions: [],
    },
    {
      id: 'sample-player-2',
      name: 'Borin',
      type: 'player',
      size: 'medium',
      position: { x: 6, y: 5 },
      color: DEFAULT_TOKEN_COLORS.player,
      initiativeModifier: 0,
      affiliation: 'player',
      vehicleKind: null,
      showVehicleOccupants: undefined,
      conditions: [],
    },
    {
      id: 'sample-enemy-1',
      name: 'Goblin A',
      type: 'enemy',
      size: 'small',
      position: { x: 14, y: 10 },
      color: DEFAULT_TOKEN_COLORS.enemy,
      initiativeModifier: 0,
      affiliation: 'enemy',
      vehicleKind: null,
      showVehicleOccupants: undefined,
      conditions: [],
    },
    {
      id: 'sample-enemy-2',
      name: 'Goblin B',
      type: 'enemy',
      size: 'small',
      position: { x: 16, y: 11 },
      color: DEFAULT_TOKEN_COLORS.enemy,
      initiativeModifier: 0,
      affiliation: 'enemy',
      vehicleKind: null,
      showVehicleOccupants: undefined,
      conditions: [],
    },
  ],
  diceLogs: [],
  initiatives: [],
  activeTurnTokenId: null,
};

function readStoredState(): BattleMapState {
  if (typeof window === 'undefined') {
    return initialState;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return initialState;
    }

    const parsed = JSON.parse(rawValue) as Partial<BattleMapState>;
    const tokens = Array.isArray(parsed.tokens)
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
            color: token.color ?? fallbackColor,
            initiativeModifier:
              typeof token.initiativeModifier === 'number' ? token.initiativeModifier : 0,
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
            conditions: Array.isArray(token.conditions) ? token.conditions : [],
          };
        })
      : initialState.tokens;
    const initiatives = Array.isArray(parsed.initiatives)
      ? parsed.initiatives.filter((entry) => tokens.some((token) => token.id === entry.tokenId))
      : [];

    return {
      zoom: clampZoom(parsed.zoom ?? initialState.zoom),
      tokens: applyVehicleAwareUpdates(tokens),
      diceLogs: Array.isArray(parsed.diceLogs)
        ? parsed.diceLogs.map((log) => ({
            ...log,
            formula: log.formula ?? log.label,
          }))
        : [],
      initiatives,
      activeTurnTokenId:
        typeof parsed.activeTurnTokenId === 'string' ? parsed.activeTurnTokenId : null,
    };
  } catch {
    return initialState;
  }
}

export function useBattleMapState() {
  const [state, setState] = useState<BattleMapState>(() => readStoredState());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setZoom = (zoom: number) => {
    setState((current) => ({
      ...current,
      zoom: clampZoom(zoom),
    }));
  };

  const moveToken = (tokenId: string, x: number, y: number) => {
    setState((current) => ({
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

    setState((current) => ({
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

  const addTokens = (tokens: BattleMapState['tokens']) => {
    setState((current) => ({
      ...current,
      tokens: applyVehicleAwareUpdates([...current.tokens, ...tokens]),
    }));
  };

  const updateToken = (tokenId: string, updates: Partial<UnitToken>) => {
    setState((current) => ({
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
    setState((current) => {
      const nextTokens = applyVehicleAwareUpdates(current.tokens.filter((token) => token.id !== tokenId));
      const nextInitiatives = current.initiatives.filter((entry) => entry.tokenId !== tokenId);

      return {
        ...current,
        tokens: nextTokens,
        initiatives: nextInitiatives,
        activeTurnTokenId:
          current.activeTurnTokenId === tokenId ? nextInitiatives[0]?.tokenId ?? null : current.activeTurnTokenId,
      };
    });
  };

  const addDiceLog = (log: DiceRollLog) => {
    setState((current) => ({
      ...current,
      diceLogs: [log, ...current.diceLogs].slice(0, 30),
    }));
  };

  const clearDiceLogs = () => {
    setState((current) => ({
      ...current,
      diceLogs: [],
    }));
  };

  const setInitiative = (entry: InitiativeEntry) => {
    setState((current) => {
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
      };
    });
  };

  const reorderInitiatives = (fromIndex: number, toIndex: number) => {
    setState((current) => {
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
    setState((current) => {
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
    setState((current) => ({
      ...current,
      initiatives: [],
      activeTurnTokenId: null,
    }));
  };

  const cycleTurn = (direction: 'next' | 'previous') => {
    setState((current) => {
      if (current.initiatives.length === 0) {
        return current;
      }

      const activeIndex = current.initiatives.findIndex(
        (entry) => entry.tokenId === current.activeTurnTokenId,
      );
      const startIndex = activeIndex >= 0 ? activeIndex : 0;
      const nextIndex =
        direction === 'next'
          ? (startIndex + 1) % current.initiatives.length
          : (startIndex - 1 + current.initiatives.length) % current.initiatives.length;

      return {
        ...current,
        activeTurnTokenId: current.initiatives[nextIndex]?.tokenId ?? null,
      };
    });
  };

  const setActiveTurnToken = (tokenId: string) => {
    setState((current) => ({
      ...current,
      activeTurnTokenId: tokenId,
    }));
  };

  const resetZoom = () => setZoom(1);

  return {
    boardConfig: BOARD_CONFIG,
    state,
    setZoom,
    moveToken,
    moveTokens,
    addTokens,
    updateToken,
    removeToken,
    addDiceLog,
    clearDiceLogs,
    setInitiative,
    reorderInitiatives,
    clearInitiative,
    clearInitiatives,
    cycleTurn,
    setActiveTurnToken,
    resetZoom,
  };
}
