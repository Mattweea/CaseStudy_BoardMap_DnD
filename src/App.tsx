import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AuraPresenceBanner } from './components/AuraPresenceBanner';
import { AuthScreen } from './components/AuthScreen';
import { Board } from './components/Board';
import { Dice3DOverlay } from './components/Dice3DOverlay';
import { CharacterSheetWindow } from './components/character-sheet/CharacterSheetWindow';
import { DiceLogModal } from './components/DiceLogModal';
import { DicePanel } from './components/DicePanel';
import { DiceLogEntry } from './components/DiceLogEntry';
import { DiceResultModal } from './components/DiceResultModal';
import { EditElementModal, ElementsListModal, NewElementModal } from './components/ElementModals';
import { InitiativeRollModal } from './components/InitiativeRollModal';
import { InitiativePanel } from './components/InitiativePanel';
import { Modal } from './components/Modal';
import { CombatEmblem } from './components/CombatEmblem';
import {
  BlockIcon, BookIcon, ChatDiceIcon, CloseIcon, CrossedSwordsIcon, DashIcon, DirectionArrowIcon, GearIcon, KeyboardIcon,
  MapIcon, MoonIcon, PawnIcon, PinIcon, PlusIcon, ResumeIcon, SaveIcon, SearchIcon, SidebarIcon, SpeakerIcon, TrashIcon, UndoIcon,
} from './components/UiIcons';
import { DiceGlyph } from './components/DiceIcons';
import { CHARACTER_PROFILES, findCharacterProfileByKey, resolveCharacterPortrait } from './constants/characters';
import { useAnimatedPresence } from './hooks/useAnimatedPresence';
import { useAuthSession } from './hooks/useAuthSession';
import { isMovementBudgetActive, useBattleMapState } from './hooks/useBattleMapState';
import { useCombatAudioPreferences } from './hooks/useCombatAudioPreferences';
import { useDicePresentationPreferences } from './hooks/useDicePresentationPreferences';
import { usePageActivation } from './hooks/usePageActivation';
import { getTokenFootprint } from './utils/board';
import { findFirstAvailablePositionToRight } from './utils/tokens';
import { darkvisionToCells, isTokenInsideLight, isTokenInsideVision } from './utils/vision';
import { characterSheetApi } from './utils/characterSheetApi';
import { effectiveSpeed, movementBudget as computeMovementBudget } from '../shared/token-conditions.mjs';
import { playCombatSound } from './utils/combatAudio';
import type { CharacterSheetRosterEntry, PublicPortraitEntry } from './utils/characterSheetApi';
import type { CombatAnnouncement, DiceRollLog, GridPosition, TokenMovementBudget, UnitToken } from './types';
import avernusImage from '../media/images/avernus.jpeg';

const FULLSCREEN_TRANSITION_MS = 260;
const SIDEBAR_CONTENT_EXIT_MS = 180;
const SIDEBAR_HOVER_OPEN_DELAY_MS = 1000;
const BOOT_LOADER_DURATION_MS = 7400;
const BOOT_LOADER_STORAGE_PREFIX = 'dnd-battle-map:intro-seen';
const COMBAT_ANNOUNCEMENT_STORAGE_KEY = 'dnd-battle-map:last-combat-announcement';
const MANUAL_PDF_PATH =
  'https://drive.google.com/file/d/1v4XF37X1QjXrhEX3Y2dHouMkYnNedfGw/preview';
// Modale di modifica del token nascosta (P0.8c, design decisione 8): nessun punto d'ingresso
// della GUI la apre più finché resta `false`. `EditElementModal` e `openEditTokenModal` restano
// nel codice, pronti per essere riesposti da una capability successiva (P0.9), cambiando solo
// questo valore.
const TOKEN_EDIT_MODAL_ENABLED = false;

type SidebarSectionId = 'session' | 'actions' | 'lighting' | 'movement' | 'notes' | 'dice' | 'initiative' | 'characters' | 'settings' | 'legend';
type WorkspaceTabId = 'chat' | 'initiative' | 'characters' | 'settings' | 'legend';

const KEYBOARD_MOVEMENTS: Record<string, { dx: number; dy: number }> = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  w: { dx: 0, dy: -1 },
  W: { dx: 0, dy: -1 },
  a: { dx: -1, dy: 0 },
  A: { dx: -1, dy: 0 },
  s: { dx: 0, dy: 1 },
  S: { dx: 0, dy: 1 },
  d: { dx: 1, dy: 0 },
  D: { dx: 1, dy: 0 },
  Home: { dx: -1, dy: -1 },
  PageUp: { dx: 1, dy: -1 },
  End: { dx: -1, dy: 1 },
  PageDown: { dx: 1, dy: 1 },
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.closest('[role="dialog"]') !== null
  );
}

interface DiceResultScene {
  flavor: string;
  log: DiceRollLog;
}

interface PendingObstaclePlacement {
  name: string;
  color: string;
  isInvisible: boolean;
  cells: Array<{ x: number; y: number }>;
}

interface SessionFeedback {
  kind: 'success' | 'error';
  message: string;
}

const COMBAT_ANNOUNCEMENT_DURATION_MS = 5600;
const MOVEMENT_NOTICE_DURATION_MS = 6000;

function cellKey(cell: { x: number; y: number }) {
  return `${cell.x}:${cell.y}`;
}

function isObstacleToken(token: UnitToken) {
  return token.type === 'object' && token.blocksMovement === true;
}

function areObstacleTokensConnected(left: UnitToken, right: UnitToken) {
  const leftFootprint = getTokenFootprint(left);
  const rightFootprint = getTokenFootprint(right);
  const leftMaxX = left.position.x + leftFootprint.width - 1;
  const leftMaxY = left.position.y + leftFootprint.height - 1;
  const rightMaxX = right.position.x + rightFootprint.width - 1;
  const rightMaxY = right.position.y + rightFootprint.height - 1;

  return !(
    leftMaxX + 1 < right.position.x ||
    rightMaxX + 1 < left.position.x ||
    leftMaxY + 1 < right.position.y ||
    rightMaxY + 1 < left.position.y
  );
}

function connectedObstacleTokens(tokens: UnitToken[], tokenId: string): UnitToken[] {
  const startToken = tokens.find((token) => token.id === tokenId);
  if (!startToken || !isObstacleToken(startToken)) {
    return startToken ? [startToken] : [];
  }

  const obstacles = tokens.filter(isObstacleToken);
  const connected = new Set<string>([startToken.id]);
  const queue = [startToken];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    obstacles.forEach((candidate) => {
      if (connected.has(candidate.id) || !areObstacleTokensConnected(current, candidate)) {
        return;
      }

      connected.add(candidate.id);
      queue.push(candidate);
    });
  }

  return obstacles.filter((token) => connected.has(token.id));
}

function App() {
  const { user, isLoading, isSubmitting, error, login, logout } = useAuthSession();
  const {
    preferences: dicePresentationPreferences,
    setAnimationEnabled: setDiceAnimationEnabled,
    setSoundEnabled: setDiceSoundEnabled,
  } = useDicePresentationPreferences();
  const {
    preferences: combatAudioPreferences,
    setEnabled: setCombatAudioEnabled,
    setVolume: setCombatAudioVolume,
  } = useCombatAudioPreferences();
  const hasUserActivated = usePageActivation();
  // Gli effetti dei suoni leggono le preferenze correnti senza ripartire quando cambiano.
  const combatAudioRef = useRef({ preferences: combatAudioPreferences, hasUserActivated });
  combatAudioRef.current = { preferences: combatAudioPreferences, hasUserActivated };
  const {
    isReady: isBattleMapReady,
    isMutating,
    state,
    diceRollDeliveries,
    addTokens,
    rollDice,
    advanceTurn,
    endOwnTurn,
    endCombat,
    startRound,
    rollInitiative,
    rollAllInitiative,
    setPlayersCanEndTurn,
    clearDiceLogs,
    clearInitiative,
    moveTokens,
    moveOwnedToken,
    moveOwnedTokenBy,
    addOwnedExtraMovement,
    addLightSource,
    reorderInitiatives,
    removeToken,
    removeTokens,
    removeLightSource,
    setActiveTurnToken,
    setBoardBackgroundHidden,
    setBoardFullyLit,
    setSharedNotes,
    updateBattleMapSettings,
    startCombat,
    setInitiative,
    setInitiatives,
    undoLastAction,
    useDashAction,
    updateToken,
    updateOwnedToken,
    applyTokenCondition,
    standUpToken,
    setTokenAuraActive,
    setZoom,
    sessionStatus,
    suspendSession,
    resumeLastSession,
    ephemeralPings,
    ephemeralTemplates,
    tokenWalkEvents,
    movementNotice,
    clearMovementNotice,
    sendPing,
    sendTemplateEvent,
  } = useBattleMapState(Boolean(user));
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>(
    state.tokens[0] ? [state.tokens[0].id] : [],
  );
  const [isNewElementModalOpen, setIsNewElementModalOpen] = useState(false);
  const [isElementsListModalOpen, setIsElementsListModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(false);
  const [isDiceLogModalOpen, setIsDiceLogModalOpen] = useState(false);
  const [isInitiativeModalOpen, setIsInitiativeModalOpen] = useState(false);
  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [latestDiceResult, setLatestDiceResult] = useState<DiceResultScene | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ tokenId: string; nonce: number } | null>(null);
  const [isSidebarPinned, setIsSidebarPinned] = useState(true);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTabId>('chat');
  const [expandedDiceLogId, setExpandedDiceLogId] = useState<string | null>(null);
  const [turnNotice, setTurnNotice] = useState<'next' | 'turn' | null>(null);
  const [isSidebarHoverOpen, setIsSidebarHoverOpen] = useState(false);
  const [isBootLoading, setIsBootLoading] = useState(false);
  const [pendingObstaclePlacement, setPendingObstaclePlacement] = useState<PendingObstaclePlacement | null>(null);
  const [isLightPlacementActive, setIsLightPlacementActive] = useState(false);
  const [lightRadiusCells, setLightRadiusCells] = useState(12);
  const [measurementUnitDraft, setMeasurementUnitDraft] = useState({ label: state.measurementUnit.label, cellsValue: String(state.measurementUnit.cellsValue) });
  const [measurementUnitError, setMeasurementUnitError] = useState<string | null>(null);
  const [sessionFeedback, setSessionFeedback] = useState<SessionFeedback | null>(null);
  const [combatAnnouncement, setCombatAnnouncement] = useState<CombatAnnouncement | null>(null);
  const [isCombatAnnouncementOpen, setIsCombatAnnouncementOpen] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');
  const [characterSheets, setCharacterSheets] = useState<CharacterSheetRosterEntry[]>([]);
  const [publicPortraits, setPublicPortraits] = useState<PublicPortraitEntry[]>([]);
  const [openCharacterSheetId, setOpenCharacterSheetId] = useState<string | null>(null);
  const [boardFullscreenPhase, setBoardFullscreenPhase] = useState<
    'closed' | 'opening' | 'open' | 'closing'
  >('closed');
  const [standardBoardHost, setStandardBoardHost] = useState<HTMLDivElement | null>(null);
  const [fullscreenBoardHost, setFullscreenBoardHost] = useState<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const diceLogFeedRef = useRef<HTMLDivElement | null>(null);
  const sidebarHoverOpenTimeoutRef = useRef<number | null>(null);
  const reopenEditTimeoutRef = useRef<number | null>(null);
  const lastDicePreviewIdRef = useRef<string | null>(null);
  const lastTurnNoticeIdRef = useRef<number | null>(null);
  const lastCombatAnnouncementIdRef = useRef<string | null>(null);
  const sessionFeedbackTimeoutRef = useRef<number | null>(null);
  const combatAnnouncementTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    void characterSheetApi.publicRoster().then(({ sheets }) => setPublicPortraits(sheets)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!user) { setCharacterSheets([]); setOpenCharacterSheetId(null); return; }
    let active = true;
    void characterSheetApi.list().then(({ sheets }) => { if (active) setCharacterSheets(sheets); }).catch(console.error);
    const onPortrait = (event: Event) => {
      const detail = (event as CustomEvent).detail as { type: string; sheetId: string; ownerUserId: string; portraitUrl: string; portraitUpdatedAt: string };
      if (detail.type !== 'character-sheet-portrait') return;
      setCharacterSheets((current) => current.map((sheet) => sheet.id === detail.sheetId ? { ...sheet, portraitUrl: detail.portraitUrl, portraitUpdatedAt: detail.portraitUpdatedAt } : sheet));
    };
    window.addEventListener('vtt:character-sheet-event', onPortrait);
    return () => { active = false; window.removeEventListener('vtt:character-sheet-event', onPortrait); };
  }, [user]);

  useEffect(() => {
    if (workspaceTab !== 'chat') return;
    const frameId = window.requestAnimationFrame(() => {
      const feed = diceLogFeedRef.current;
      if (feed) feed.scrollTop = feed.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [state.diceLogs, workspaceTab]);
  useEffect(() => {
    setMeasurementUnitDraft({ label: state.measurementUnit.label, cellsValue: String(state.measurementUnit.cellsValue) });
  }, [state.measurementUnit.label, state.measurementUnit.cellsValue]);
  const canManageBattleMap = user?.role === 'master';
  const hasUnsavedNotes = draftNotes !== state.sharedNotes;
  const sessionCharacter = findCharacterProfileByKey(user?.characterKey);
  const sessionSheet = characterSheets.find((sheet) => sheet.ownerUserId === user?.id) ?? null;
  const ownedTokens = state.tokens.filter((token) => token.ownerUserId === user?.id);
  const sessionToken =
    ownedTokens.find((token) => token.type === 'player' && token.isFamiliar !== true) ??
    state.tokens.find((token) => token.id === user?.playerTokenId) ??
    null;
  const ownedFamiliarIds = ownedTokens
    .filter((token) => token.type === 'player' && token.isFamiliar === true)
    .map((token) => token.id);
  const sessionVehicle =
    sessionToken
      ? state.tokens.find(
          (token) =>
            token.type === 'vehicle' &&
            Array.isArray(token.vehicleOccupantIds) &&
            token.vehicleOccupantIds.includes(sessionToken.id),
        ) ?? null
      : null;
  const dashUsed = sessionToken ? state.dashUsedByTokenId[sessionToken.id] === true : false;
  const extraMovement = sessionToken ? state.extraMovementByTokenId[sessionToken.id] ?? 0 : 0;
  // Il budget di movimento si mostra solo quando il server lo applica: Combattimento a round avviato.
  const budgetApplies = isMovementBudgetActive(state);
  const movementBudgetByTokenId = useMemo(() => {
    const budgets: Record<string, TokenMovementBudget> = {};
    if (!budgetApplies) {
      return budgets;
    }

    state.tokens.forEach((token) => {
      if (typeof token.movementCells !== 'number') {
        return;
      }

      const hasDashed = state.dashUsedByTokenId[token.id] === true;
      const extra = state.extraMovementByTokenId[token.id] ?? 0;
      // Velocità effettiva (P0.8c) solo per una creatura: un veicolo mostra la velocità grezza del
      // conducente, invariata, come già oggi.
      const isCreatureToken = token.type === 'player' || token.type === 'enemy';
      const effectiveCells = isCreatureToken
        ? effectiveSpeed(token.movementCells, token.conditions, token.exhaustionLevel).cells
        : token.movementCells;
      budgets[token.id] = {
        usedCells: state.movementUsedByTokenId[token.id] ?? 0,
        totalCells: computeMovementBudget({ effectiveCells, dashed: hasDashed, extra }),
        diagonalParity: state.diagonalParityByTokenId[token.id] ?? 0,
      };
    });

    return budgets;
  }, [
    budgetApplies,
    state.tokens,
    state.dashUsedByTokenId,
    state.extraMovementByTokenId,
    state.movementUsedByTokenId,
    state.diagonalParityByTokenId,
  ]);
  // Scatto dal menu radiale (P0.8c): stesse condizioni del pulsante in barra laterale, ma per
  // ciascun token proprio la cui iniziativa e' quella attiva, famiglio compreso, non solo la
  // scheda principale (`sessionToken`).
  const canDashTokenIds = useMemo(() => {
    if (canManageBattleMap || !budgetApplies || !user) {
      return new Set<string>();
    }
    return new Set(
      state.tokens
        .filter((token) => token.ownerUserId === user.id && token.id === state.activeTurnTokenId)
        .map((token) => token.id),
    );
  }, [canManageBattleMap, budgetApplies, state.tokens, state.activeTurnTokenId, user]);
  // La mappa a schermo intero e quella normale muovono i token allo stesso modo: un solo
  // gestore, così le due copie non possono divergere.
  const handleBoardMoveTokens = (
    moves: Array<{ tokenId: string; x: number; y: number }>,
    anchorWaypoints?: GridPosition[],
  ) => {
    const isSinglePath = moves.length === 1 && anchorWaypoints !== undefined && anchorWaypoints.length > 1;

    // Anche un movimento singolo del Master passa dalla rotta autorevole: il ruolo resta esente
    // da budget e ostacoli, ma così il server ne trasmette la camminata come per chiunque altro.
    // I movimenti di gruppo restano un commit dello stato condiviso.
    if (canManageBattleMap) {
      if (isSinglePath) {
        void moveOwnedToken(moves[0].tokenId, moves[0].x, moves[0].y, anchorWaypoints);
        return;
      }

      moveTokens(moves);
      return;
    }

    if (
      sessionToken &&
      moves.length === 1 &&
      (moves[0].tokenId === sessionToken.id || moves[0].tokenId === sessionVehicle?.id)
    ) {
      void moveOwnedToken(moves[0].tokenId, moves[0].x, moves[0].y, anchorWaypoints);
    }
  };

  const isPlayersTurn = Boolean(sessionToken && state.activeTurnTokenId === sessionToken.id);
  const activeTurnToken =
    state.tokens.find((token) => token.id === state.activeTurnTokenId) ?? null;
  const darkvisionCells = darkvisionToCells(user?.darkvision);
  const visionBlockers = state.tokens.filter((token) => token.blocksMovement === true);
  const playerVision = !canManageBattleMap && sessionToken && !state.isBoardFullyLit
    ? {
        enabled: true,
        radiusCells: darkvisionCells,
        sourceToken: sessionToken,
        blockers: visionBlockers,
      }
    : null;
  const isSidebarCollapsed = !isSidebarPinned && !isSidebarHoverOpen;
  const expandedSidebarPresence = useAnimatedPresence(!isSidebarCollapsed, SIDEBAR_CONTENT_EXIT_MS);
  const visibleBoardTokens = canManageBattleMap
    ? state.tokens
    : state.tokens.filter((token) => {
        const obstacleCluster = isObstacleToken(token)
          ? connectedObstacleTokens(state.tokens, token.id)
          : [token];
        const canSeeTokenByVisibility = obstacleCluster.some((clusterToken) =>
          !clusterToken.isInvisible || clusterToken.ownerUserId === user?.id,
        );
        if (!canSeeTokenByVisibility) {
          return false;
        }

        if (state.isBoardFullyLit) {
          return true;
        }

        const isInsidePersonalVision = sessionToken
          ? obstacleCluster.some((clusterToken) =>
              isTokenInsideVision(sessionToken, clusterToken, darkvisionCells, visionBlockers),
            )
          : false;
        const isInsideMasterLight = state.lightSources.some((light) =>
          obstacleCluster.some((clusterToken) => isTokenInsideLight(light, clusterToken, visionBlockers)),
        );

        return isInsidePersonalVision || isInsideMasterLight;
      });
  const editableTokenIds = canManageBattleMap
    ? state.tokens.map((token) => token.id)
    : sessionToken
      ? [sessionToken.id, ...ownedFamiliarIds]
      : [];
  const movableTokenIds = canManageBattleMap
    ? state.tokens.map((token) => token.id)
    : sessionToken
      ? [sessionToken.id, ...ownedFamiliarIds, ...(sessionVehicle ? [sessionVehicle.id] : [])]
      : [];
  const selectedCreatureIds = selectedTokenIds.filter((tokenId) =>
    state.tokens.some(
      (token) =>
        token.id === tokenId &&
        (token.type === 'player' || token.type === 'enemy' || token.type === 'vehicle'),
    ),
  );

  useEffect(() => {
    setSelectedTokenIds((current) =>
      current.filter((tokenId) => state.tokens.some((token) => token.id === tokenId)),
    );

    if (editingTokenId && !state.tokens.some((token) => token.id === editingTokenId)) {
      setEditingTokenId(null);
    }
  }, [editingTokenId, state.tokens]);

  useEffect(() => {
    if (!user) {
      setIsBootLoading(false);
      return undefined;
    }

    const storageKey = `${BOOT_LOADER_STORAGE_PREFIX}:${user.id}`;
    if (window.localStorage.getItem(storageKey) === 'true') {
      setIsBootLoading(false);
      return undefined;
    }

    window.localStorage.setItem(storageKey, 'true');
    setIsBootLoading(true);

    const timeoutId = window.setTimeout(() => {
      setIsBootLoading(false);
    }, BOOT_LOADER_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [user]);

  useEffect(() => {
    return () => {
      if (reopenEditTimeoutRef.current !== null) {
        window.clearTimeout(reopenEditTimeoutRef.current);
      }
      if (sidebarHoverOpenTimeoutRef.current !== null) {
        window.clearTimeout(sidebarHoverOpenTimeoutRef.current);
      }
      if (sessionFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(sessionFeedbackTimeoutRef.current);
      }
      if (combatAnnouncementTimeoutRef.current !== null) {
        window.clearTimeout(combatAnnouncementTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (boardFullscreenPhase === 'opening') {
      const timeoutId = window.setTimeout(() => {
        setBoardFullscreenPhase('open');
      }, 30);

      return () => window.clearTimeout(timeoutId);
    }

    if (boardFullscreenPhase === 'closing') {
      const timeoutId = window.setTimeout(() => {
        setBoardFullscreenPhase('closed');
      }, FULLSCREEN_TRANSITION_MS);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [boardFullscreenPhase]);

  useEffect(() => {
    if (isSidebarCollapsed) {
      return;
    }

    sidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isSidebarCollapsed]);

  useEffect(() => {
    setDraftNotes(state.sharedNotes);
  }, [state.sharedNotes]);

  // La prima istantanea caricata fissa la base: un avviso già presente al caricamento (ricarica a
  // metà turno) non si ripropone. Da lì in poi ogni nuovo id è una transizione da mostrare, anche
  // il primo avviso della partita — che prima veniva scambiato per la base e perso.
  const turnNoticeBaselineReadyRef = useRef(false);
  useEffect(() => {
    if (!isBattleMapReady) {
      turnNoticeBaselineReadyRef.current = false;
      return;
    }
    const notice = state.turnNotice;
    if (!turnNoticeBaselineReadyRef.current) {
      turnNoticeBaselineReadyRef.current = true;
      lastTurnNoticeIdRef.current = notice?.id ?? null;
      return;
    }
    if (!notice) return;
    if (notice.id !== lastTurnNoticeIdRef.current) {
      lastTurnNoticeIdRef.current = notice.id;
      setTurnNotice(notice.kind);
      const { preferences, hasUserActivated: activated } = combatAudioRef.current;
      playCombatSound(notice.kind === 'turn' ? 'turn-now' : 'turn-next', preferences, activated);
    }
  }, [isBattleMapReady, state.turnNotice]);

  useEffect(() => {
    if (state.isBoardFullyLit) {
      setIsLightPlacementActive(false);
    }
  }, [state.isBoardFullyLit]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (sessionToken) {
      setSelectedTokenIds((current) => (current.includes(sessionToken.id) ? current : [sessionToken.id]));
      return;
    }

    if (canManageBattleMap && state.tokens[0]) {
      setSelectedTokenIds((current) => (current.length > 0 ? current : [state.tokens[0].id]));
    }
  }, [canManageBattleMap, sessionToken, state.tokens, user]);

  useEffect(() => {
    if (!state.latestDicePreview) {
      return;
    }

    if (lastDicePreviewIdRef.current === state.latestDicePreview.id) {
      return;
    }

    lastDicePreviewIdRef.current = state.latestDicePreview.id;
    const canViewPreview =
      user?.role === 'master' ||
      state.latestDicePreview.rollerUserId === user?.id ||
      (!state.latestDicePreview.rollerUserId &&
        state.latestDicePreview.log.rollerName === user?.displayName);

    setLatestDiceResult(canViewPreview ? state.latestDicePreview : null);
  }, [state.latestDicePreview, user]);

  useEffect(() => {
    if (!state.combatAnnouncement) {
      return;
    }

    const storedAnnouncementId = window.sessionStorage.getItem(COMBAT_ANNOUNCEMENT_STORAGE_KEY);
    if (
      lastCombatAnnouncementIdRef.current === state.combatAnnouncement.id ||
      storedAnnouncementId === state.combatAnnouncement.id
    ) {
      return;
    }

    lastCombatAnnouncementIdRef.current = state.combatAnnouncement.id;
    window.sessionStorage.setItem(COMBAT_ANNOUNCEMENT_STORAGE_KEY, state.combatAnnouncement.id);
    setCombatAnnouncement(state.combatAnnouncement);
    setIsCombatAnnouncementOpen(true);
    playCombatSound('combat-start', combatAudioRef.current.preferences, combatAudioRef.current.hasUserActivated);

    if (combatAnnouncementTimeoutRef.current !== null) {
      window.clearTimeout(combatAnnouncementTimeoutRef.current);
    }

    combatAnnouncementTimeoutRef.current = window.setTimeout(() => {
      setIsCombatAnnouncementOpen(false);
      combatAnnouncementTimeoutRef.current = null;
    }, COMBAT_ANNOUNCEMENT_DURATION_MS);
  }, [state.combatAnnouncement]);

  useEffect(() => {
    if (!movementNotice) return undefined;
    const timeoutId = window.setTimeout(clearMovementNotice, MOVEMENT_NOTICE_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
    // clearMovementNotice azzera solo lo stato del hook: non serve riavviare il timer a ogni render.
  }, [movementNotice]);

  // Un tiro dalla scheda o dal log rifiutato dal server non resta silenzioso: il motivo compare
  // nello stesso avviso in primo piano dei movimenti rifiutati.
  const [rollNotice, setRollNotice] = useState<{ id: string; message: string } | null>(null);
  const rollAndReport = async (request: Parameters<typeof rollDice>[0]) => {
    const result = await rollDice(request);
    setRollNotice(result.ok ? null : { id: crypto.randomUUID(), message: result.message });
  };
  useEffect(() => {
    if (!rollNotice) return undefined;
    const timeoutId = window.setTimeout(() => setRollNotice(null), MOVEMENT_NOTICE_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [rollNotice]);

  const boardInteractionRef = useRef({ standard: false, fullscreen: false });
  const handleStandardBoardInteraction = useCallback((isActive: boolean) => {
    boardInteractionRef.current.standard = isActive;
  }, []);
  const handleFullscreenBoardInteraction = useCallback((isActive: boolean) => {
    boardInteractionRef.current.fullscreen = isActive;
  }, []);

  function closeCombatAnnouncement() {
    if (combatAnnouncementTimeoutRef.current !== null) {
      window.clearTimeout(combatAnnouncementTimeoutRef.current);
      combatAnnouncementTimeoutRef.current = null;
    }
    setIsCombatAnnouncementOpen(false);
  }

  useEffect(() => {
    if (!isCombatAnnouncementOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCombatAnnouncement();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCombatAnnouncementOpen]);

  function moveSessionTokenBy(deltaX: number, deltaY: number) {
    if (!sessionToken) {
      return;
    }

    void moveOwnedTokenBy(sessionToken.id, deltaX, deltaY);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        void undoLastAction();
        return;
      }

      // Con un percorso in pianificazione, il righello o una sagoma attivi, frecce e Canc/Backspace
      // appartengono alla mappa: il token non si muove né si elimina dall'esterno.
      if (boardInteractionRef.current.standard || boardInteractionRef.current.fullscreen) {
        return;
      }

      if (canManageBattleMap && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (selectedTokenIds.length === 0) {
          return;
        }

        event.preventDefault();
        removeTokens(selectedTokenIds);
        return;
      }

      const movement = KEYBOARD_MOVEMENTS[event.key];
      if (!movement) {
        return;
      }

      if (canManageBattleMap) {
        if (selectedTokenIds.length === 0) {
          return;
        }

        const selectedMoves = selectedTokenIds.flatMap((tokenId) => {
          const token = state.tokens.find((entry) => entry.id === tokenId);
          return token
            ? [
                {
                  tokenId,
                  x: Math.max(0, token.position.x + movement.dx),
                  y: Math.max(0, token.position.y + movement.dy),
                },
              ]
            : [];
        });

        if (selectedMoves.length === 0) {
          return;
        }

        event.preventDefault();
        moveTokens(selectedMoves);
        return;
      }

      if (!sessionToken) {
        return;
      }

      event.preventDefault();
      moveSessionTokenBy(movement.dx, movement.dy);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canManageBattleMap,
    moveSessionTokenBy,
    moveTokens,
    removeTokens,
    selectedTokenIds,
    sessionToken,
    state.tokens,
    undoLastAction,
  ]);

  const locateToken = (tokenId: string) => {
    setFocusRequest({ tokenId, nonce: Date.now() });
    setSelectedTokenIds([tokenId]);
  };

  const openEditTokenModal = (tokenId: string) => {
    if (!TOKEN_EDIT_MODAL_ENABLED) {
      return;
    }

    const isOwnedEditableToken = editableTokenIds.includes(tokenId);
    if (!canManageBattleMap && !isOwnedEditableToken) {
      return;
    }

    locateToken(tokenId);
    setIsElementsListModalOpen(false);
    if (editingTokenId === tokenId) {
      setEditingTokenId(null);
      if (reopenEditTimeoutRef.current !== null) {
        window.clearTimeout(reopenEditTimeoutRef.current);
      }
      reopenEditTimeoutRef.current = window.setTimeout(() => {
        setEditingTokenId(tokenId);
      }, 0);
      return;
    }

    setEditingTokenId(tokenId);
  };

  const editingToken = state.tokens.find((token) => token.id === editingTokenId) ?? null;
  const isBoardFullscreenVisible = boardFullscreenPhase !== 'closed';
  const handleSidebarToggle = () => {
    if (isSidebarPinned) {
      setIsSidebarPinned(false);
      setIsSidebarHoverOpen(false);
      if (sidebarHoverOpenTimeoutRef.current !== null) {
        window.clearTimeout(sidebarHoverOpenTimeoutRef.current);
        sidebarHoverOpenTimeoutRef.current = null;
      }
      return;
    }

    setIsSidebarPinned(true);
    setIsSidebarHoverOpen(false);
  };

  const showSessionFeedback = (feedback: SessionFeedback) => {
    setSessionFeedback(feedback);
    if (sessionFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(sessionFeedbackTimeoutRef.current);
    }
    sessionFeedbackTimeoutRef.current = window.setTimeout(() => {
      setSessionFeedback(null);
      sessionFeedbackTimeoutRef.current = null;
    }, 3600);
  };

  const handleSuspendSession = async () => {
    try {
      if (hasUnsavedNotes) {
        await setSharedNotes(draftNotes);
      }
      await suspendSession();
      showSessionFeedback({
        kind: 'success',
        message: 'Sessione salvata. Puoi riprenderla con il pulsante Riprendi.',
      });
    } catch (error) {
      console.error(error);
      showSessionFeedback({
        kind: 'error',
        message: 'Salvataggio non riuscito. Riprova tra qualche secondo.',
      });
    }
  };

  const handleResumeLastSession = async () => {
    try {
      await resumeLastSession();
      showSessionFeedback({
        kind: 'success',
        message: 'Ultima sessione ripristinata.',
      });
    } catch (error) {
      console.error(error);
      showSessionFeedback({
        kind: 'error',
        message: 'Ripristino non riuscito. Controlla che esista un salvataggio.',
      });
    }
  };

  const addSelectedToInitiative = () => {
    if (!canManageBattleMap || selectedCreatureIds.length === 0) {
      return;
    }

    setInitiatives(
      selectedCreatureIds.flatMap((tokenId) => {
        const token = state.tokens.find((entry) => entry.id === tokenId);
        if (!token) {
          return [];
        }

        return [
          {
            tokenId,
            value: token.initiativeModifier,
            source: 'manual' as const,
          },
        ];
      }),
    );
  };

  const duplicateToken = (tokenId: string) => {
    if (!canManageBattleMap) {
      return;
    }

    const sourceToken = state.tokens.find((token) => token.id === tokenId);
    if (!sourceToken || sourceToken.type === 'player') {
      return;
    }

    const footprint = getTokenFootprint(sourceToken);
    const position = findFirstAvailablePositionToRight(
      state.tokens,
      footprint,
      {
        x: sourceToken.position.x + footprint.width,
        y: sourceToken.position.y,
      },
    );

    addTokens([
      {
        ...sourceToken,
        id: crypto.randomUUID(),
        name: `${sourceToken.name} copia`,
        position,
        isInvisible: true,
        vehicleOccupantIds: [],
        containedInVehicleId: null,
      },
    ]);
  };

  const confirmObstaclePlacement = () => {
    if (!pendingObstaclePlacement || pendingObstaclePlacement.cells.length === 0) {
      return;
    }

    const obstacleGroupId = crypto.randomUUID();
    addTokens(
      pendingObstaclePlacement.cells.map((cell) => ({
        id: crypto.randomUUID(),
        name: pendingObstaclePlacement.name,
        type: 'object' as const,
        size: 'medium' as const,
        position: cell,
        widthCells: 1,
        heightCells: 1,
        color: pendingObstaclePlacement.color,
        initiativeModifier: 0,
        initiativeMode: 'normal' as const,
        affiliation: null,
        vehicleKind: null,
        vehicleOccupantIds: [],
        showVehicleOccupants: undefined,
        containedInVehicleId: null,
        imageUrl: null,
        ownerUserId: null,
        characterKey: null,
        groupId: obstacleGroupId,
        hitPoints: null,
        maxHitPoints: null,
        isInvisible: pendingObstaclePlacement.isInvisible,
        isFamiliar: false,
        blocksMovement: true,
        excludeFromInitiative: false,
        conditions: [],
      })),
    );

    setPendingObstaclePlacement(null);
  };

  const renderSidebarSection = (sectionId: SidebarSectionId) => {
    switch (sectionId) {
      case 'session':
        return (
          <section key="session" className="sidebar__section session-panel">
            <div>
              <h2>{user?.displayName}</h2>
            </div>
            <div className="session-panel__body">
              {sessionCharacter ? (
                <img
                  src={resolveCharacterPortrait(sessionCharacter, sessionSheet?.portraitUrl)}
                  alt={user?.displayName ?? 'Profilo'}
                  className="session-panel__avatar"
                />
              ) : null}
              <div className="session-panel__facts">
                <p className="session-panel__fact">
                  <span>Round</span>
                  <strong>{state.roundNumber}</strong>
                </p>
                <p className="session-panel__fact">
                  <span>Turno Attivo</span>
                  <strong>{activeTurnToken?.name ?? 'Nessuno'}</strong>
                </p>
                {!canManageBattleMap ? (
                  <p className="session-panel__fact">
                    <span>Stato</span>
                    <strong>
                      {state.sessionMode === 'exploration'
                        ? 'Esplorazione'
                        : !state.isRoundStarted
                          ? 'Attesa Iniziativa'
                        : isPlayersTurn
                          ? 'Il Tuo Turno'
                          : 'In Attesa'}
                    </strong>
                  </p>
                ) : null}
                {sessionToken ? (
                  <p className="session-panel__fact">
                    <span>Movimento extra</span>
                    <strong>{extraMovement}</strong>
                  </p>
                ) : null}
              </div>
            </div>
            {!canManageBattleMap && sessionToken ? (
              <div className="movement-pad">
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(-1, -1)} aria-label="Muovi su a sinistra"><DirectionArrowIcon angle={315} /></button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(0, -1)} aria-label="Muovi su"><DirectionArrowIcon angle={0} /></button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(1, -1)} aria-label="Muovi su a destra"><DirectionArrowIcon angle={45} /></button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(-1, 0)} aria-label="Muovi a sinistra"><DirectionArrowIcon angle={270} /></button>
                <div className="movement-pad__center" aria-label="Controlli movimento extra">
                  <button
                    type="button"
                    className="movement-pad__button movement-pad__button--extra movement-pad__button--extra-minus"
                    onClick={() => void addOwnedExtraMovement(sessionToken.id, -1)}
                    disabled={extraMovement <= 0}
                    title={extraMovement <= 0 ? 'Nessun movimento extra da rimuovere' : 'Rimuovi 1 casella di movimento extra'}
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    className="movement-pad__button movement-pad__button--extra movement-pad__button--extra-plus"
                    onClick={() => void addOwnedExtraMovement(sessionToken.id, 1)}
                    title="Aggiungi 1 casella di movimento extra"
                  >
                    +1
                  </button>
                </div>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(1, 0)} aria-label="Muovi a destra"><DirectionArrowIcon angle={90} /></button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(-1, 1)} aria-label="Muovi giù a sinistra"><DirectionArrowIcon angle={225} /></button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(0, 1)} aria-label="Muovi giù"><DirectionArrowIcon angle={180} /></button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(1, 1)} aria-label="Muovi giù a destra"><DirectionArrowIcon angle={135} /></button>
              </div>
            ) : null}
            <div className="session-panel__controls">
              {!canManageBattleMap && budgetApplies && isPlayersTurn && sessionToken ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void useDashAction(sessionToken.id)}
                  disabled={dashUsed}
                  title={dashUsed ? 'Scatto Già Usato' : 'Usa Scatto'}
                  aria-label={dashUsed ? 'Scatto Già Usato' : 'Usa Scatto'}
                >
                  <DashIcon />
                </button>
              ) : null}
              <button
                type="button"
                className="icon-button"
                onClick={() => void undoLastAction()}
                disabled={isMutating}
                title="Undo"
                aria-label="Undo"
              >
                <UndoIcon />
              </button>
              {canManageBattleMap ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void handleSuspendSession()}
                  title="Sospendi Sessione"
                  aria-label="Sospendi Sessione"
                >
                  <SaveIcon />
                </button>
              ) : null}
              {canManageBattleMap ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void handleResumeLastSession()}
                  disabled={!sessionStatus.hasSnapshot}
                  title="Riprendi Ultima Sessione"
                  aria-label="Riprendi Ultima Sessione"
                >
                  <ResumeIcon />
                </button>
              ) : null}
              <button
                type="button"
                className="secondary-button secondary-button--small"
                onClick={() => void logout()}
              >
                Logout
              </button>
            </div>
            {sessionFeedback ? (
              <p
                className={`session-panel__feedback session-panel__feedback--${sessionFeedback.kind}`}
                role="status"
              >
                {sessionFeedback.message}
              </p>
            ) : null}
          </section>
        );
      case 'dice':
        return (
          <DicePanel key="dice" onRoll={rollDice} />
        );
      case 'settings':
        return (
          <section key="settings" className="sidebar__section settings-panel">
            <div className="panel-heading panel-heading--compact">
              <div>
                <h2>Impostazioni</h2>
              </div>
            </div>
            {/* Preferenze personali prima, impostazioni condivise poi, crediti in fondo e chiusi:
                ogni riga è etichetta a sinistra e controllo a destra, alla larghezza del pannello. */}
            <section className="settings-group" aria-labelledby="settings-dice-heading">
              <h3 id="settings-dice-heading" className="settings-group__title">Dadi</h3>
              <label className="settings-row">
                <span>Animazione 3D</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="settings-switch"
                  checked={dicePresentationPreferences.animationEnabled}
                  onChange={(event) => setDiceAnimationEnabled(event.target.checked)}
                />
              </label>
              <label className="settings-row">
                <span>Suoni dei dadi</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="settings-switch"
                  checked={dicePresentationPreferences.soundEnabled}
                  onChange={(event) => setDiceSoundEnabled(event.target.checked)}
                />
              </label>
            </section>
            <section className="settings-group" aria-labelledby="settings-combat-audio-heading">
              <h3 id="settings-combat-audio-heading" className="settings-group__title">Suoni di combattimento</h3>
              <label className="settings-row">
                <span>Attivi</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="settings-switch"
                  checked={combatAudioPreferences.enabled}
                  onChange={(event) => setCombatAudioEnabled(event.target.checked)}
                />
              </label>
              <div className="settings-row settings-row--volume" data-disabled={!combatAudioPreferences.enabled || undefined}>
                <label htmlFor="combat-audio-volume">Volume</label>
                <input
                  id="combat-audio-volume"
                  type="range"
                  className="settings-range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(combatAudioPreferences.volume * 100)}
                  disabled={!combatAudioPreferences.enabled}
                  aria-valuetext={`${Math.round(combatAudioPreferences.volume * 100)}%`}
                  onChange={(event) => setCombatAudioVolume(Number(event.target.value) / 100)}
                />
                <output htmlFor="combat-audio-volume" className="settings-row__value">
                  {Math.round(combatAudioPreferences.volume * 100)}%
                </output>
              </div>
              <button
                type="button"
                className="settings-test-button"
                disabled={!combatAudioPreferences.enabled}
                // Il click stesso è l'interazione affidabile: il suono di prova parte sempre.
                onClick={() => playCombatSound('turn-now', combatAudioPreferences, true)}
              >
                <SpeakerIcon size={15} /> Prova suono
              </button>
              <p className="settings-panel__hint">
                Dadi e suoni valgono solo per te: non cambiano cosa vedono gli altri al tavolo.
              </p>
            </section>
            <section className="settings-group" aria-labelledby="settings-session-heading">
              <h3 id="settings-session-heading" className="settings-group__title">Sessione</h3>
              {canManageBattleMap ? (
                <label className="settings-row">
                  <span>I giocatori possono terminare il proprio turno</span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="settings-switch"
                    checked={state.playersCanEndTurn}
                    onChange={(event) => void setPlayersCanEndTurn(event.target.checked)}
                  />
                </label>
              ) : (
                <p className="settings-panel__readonly">
                  {state.playersCanEndTurn
                    ? 'Il Master ti consente di terminare il tuo turno.'
                    : 'Solo il Master può far avanzare il turno.'}
                </p>
              )}
            </section>
            <details className="settings-credits">
              <summary>Crediti e licenze</summary>
              <p className="settings-panel__attribution">
                Icone dei dadi (d4-d20): set <cite>game-icons.net</cite>, di{' '}
                <a href="https://game-icons.net/1x1/skoll/d4.html" target="_blank" rel="noreferrer">Skoll</a>{' '}
                (d4, d10, d12) e{' '}
                <a href="https://game-icons.net/1x1/delapouite/cube.html" target="_blank" rel="noreferrer">Delapouite</a>{' '}
                (d6, d8, d20), sotto licenza{' '}
                <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>.
              </p>
              <p className="settings-panel__attribution">
                Emblema del combattimento: <cite>game-icons.net</cite>,{' '}
                <a href="https://game-icons.net/1x1/lorc/crossed-swords.html" target="_blank" rel="noreferrer">Crossed swords</a> di Lorc e{' '}
                <a href="https://game-icons.net/1x1/sbed/shield.html" target="_blank" rel="noreferrer">Shield</a> di sbed, sotto licenza{' '}
                <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>.
              </p>
              <p className="settings-panel__attribution">
                Icone delle condizioni: <cite>game-icons.net</cite>, di{' '}
                <a href="https://game-icons.net/1x1/delapouite/" target="_blank" rel="noreferrer">Delapouite</a>,{' '}
                <a href="https://game-icons.net/1x1/lorc/" target="_blank" rel="noreferrer">Lorc</a> e{' '}
                <a href="https://game-icons.net/1x1/sbed/" target="_blank" rel="noreferrer">sbed</a>, sotto licenza{' '}
                <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>.
              </p>
              <p className="settings-panel__attribution">
                Suoni di combattimento, tutti{' '}
                <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">CC0</a>: corno
                d'inizio da{' '}
                <a href="https://opengameart.org/content/their-coming-generic-horn-sound" target="_blank" rel="noreferrer">«Their coming» di StumpyStrust</a>{' '}
                (OpenGameArt); «Sei il prossimo!» da{' '}
                <a href="https://kenney.nl/assets/interface-sounds" target="_blank" rel="noreferrer">Interface Sounds</a> di Kenney; tamburi di
                «Tocca a te!» sintetizzati per questo progetto.
              </p>
            </details>
          </section>
        );
      case 'notes':
        return (
          <section key="notes" className="sidebar__section notes-panel">
            <div className="panel-heading panel-heading--compact">
              <div>
                <h2>Note</h2>
              </div>
              <button
                type="button"
                className="secondary-button secondary-button--tiny"
                onClick={() => setIsNotesCollapsed((current) => !current)}
                aria-expanded={!isNotesCollapsed}
              >
                {isNotesCollapsed ? 'Espandi' : 'Comprimi'}
              </button>
            </div>
            {!isNotesCollapsed ? (
              <>
                <textarea
                  className="notes-panel__textarea"
                  value={draftNotes}
                  onChange={(event) => setDraftNotes(event.target.value)}
                  placeholder="Scrivi appunti, obiettivi o promemoria visibili a tutta la sessione."
                  rows={7}
                />
                <div className="notes-panel__actions">
                  <button
                    type="button"
                    className="secondary-button secondary-button--small"
                    onClick={() => void setSharedNotes(draftNotes)}
                    disabled={!hasUnsavedNotes}
                  >
                    Salva note
                  </button>
                  <button
                    type="button"
                    className="outline-button"
                    onClick={() => setIsNotesModalOpen(true)}
                  >
                    Espandi
                  </button>
                  <span>{hasUnsavedNotes ? 'Modifiche non salvate' : 'Sincronizzate'}</span>
                </div>
                <p className="notes-panel__hint">
                  Salvate nella textbox condivisa della sessione.
                </p>
              </>
            ) : null}
          </section>
        );
      case 'actions':
        return canManageBattleMap ? (
          <section key="actions" className="sidebar__section">
            <div className="panel-heading">
              <div>
                <h2>Azioni</h2>
              </div>
            </div>
            <div className="action-card">
              <button
                type="button"
                className="primary-button"
                onClick={() => setIsNewElementModalOpen(true)}
              >
                <PlusIcon /> Nuovo elemento
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setBoardBackgroundHidden(!state.isBoardBackgroundHidden)}
              >
                {state.isBoardBackgroundHidden ? <><MapIcon /> Mostra sfondo board</> : <><MoonIcon /> Nascondi sfondo board</>}
              </button>

              {pendingObstaclePlacement ? (
                <div className="action-card__block">
                  <p className="action-card__label">Posa ostacolo libera</p>
                  <p className="action-card__meta">
                    Celle selezionate: <strong>{pendingObstaclePlacement?.cells.length ?? 0}</strong>
                  </p>
                  <div className="action-card__buttons">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={confirmObstaclePlacement}
                      disabled={(pendingObstaclePlacement?.cells.length ?? 0) === 0}
                    >
                      Conferma ostacolo
                    </button>
                    <button
                      type="button"
                      className="outline-button"
                      onClick={() => setPendingObstaclePlacement(null)}
                    >
                      Annulla posa
                    </button>
                  </div>
                </div>
              ) : null}

              {selectedTokenIds.length > 0 ? (
                <div className="action-card__block">
                  <p className="action-card__label">Selezione corrente</p>
                  <p className="action-card__meta">
                    Elementi selezionati: <strong>{selectedTokenIds.length}</strong>
                  </p>
                  <div className="action-card__buttons">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={addSelectedToInitiative}
                      disabled={selectedCreatureIds.length === 0}
                    >
                      <CrossedSwordsIcon size="1.1em" /> Aggiungi selezionati
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => removeTokens(selectedTokenIds)}
                      disabled={selectedTokenIds.length === 0}
                    >
                      <TrashIcon /> Rimuovi selezionati
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null;
      case 'lighting':
        return canManageBattleMap ? (
          <section key="lighting" className="sidebar__section">
            <div className="panel-heading">
              <div>
                <h2>Luce</h2>
              </div>
            </div>
            <div className="action-card">
              <div className="action-card__block">
                <p className="action-card__label">Buio della mappa</p>
                <p className="action-card__meta">
                  {state.isBoardFullyLit
                    ? 'La mappa e completamente illuminata per i player.'
                    : 'I player vedono solo scurovisione e luci attive.'}
                </p>
                <button
                  type="button"
                  className={state.isBoardFullyLit ? 'primary-button' : 'secondary-button'}
                  onClick={() => setBoardFullyLit(!state.isBoardFullyLit)}
                  aria-pressed={state.isBoardFullyLit}
                >
                  {state.isBoardFullyLit ? 'Riattiva buio' : 'Illumina tutto'}
                </button>
              </div>

              <div className="action-card__block">
                <p className="action-card__label">Luci puntuali</p>
                <p className="action-card__meta">
                  Luci attive: <strong>{state.lightSources.length}</strong>
                </p>
                <label className="inline-field">
                  Raggio
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={lightRadiusCells}
                    onChange={(event) => setLightRadiusCells(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
                  />
                </label>
                <div className="action-card__buttons">
                  <button
                    type="button"
                    className={isLightPlacementActive ? 'primary-button' : 'secondary-button'}
                    onClick={() => setIsLightPlacementActive((current) => !current)}
                    disabled={Boolean(pendingObstaclePlacement) || state.isBoardFullyLit}
                  >
                    {isLightPlacementActive ? 'Posa luce attiva' : 'Posa luce'}
                  </button>
                  {isLightPlacementActive ? (
                    <button
                      type="button"
                      className="outline-button"
                      onClick={() => setIsLightPlacementActive(false)}
                    >
                      Fine posa
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null;
      case 'movement':
        return canManageBattleMap ? (
          <section key="movement" className="sidebar__section">
            <div className="panel-heading">
              <div>
                <h2>Movimento e misura</h2>
              </div>
            </div>
            <div className="action-card">
              <div className="action-card__block">
                <p className="action-card__label">Regola delle diagonali</p>
                <div className="action-card__buttons">
                  <button
                    type="button"
                    className={state.diagonalRule === 'standard' ? 'primary-button' : 'secondary-button'}
                    aria-pressed={state.diagonalRule === 'standard'}
                    onClick={() => void updateBattleMapSettings({ diagonalRule: 'standard' })}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    className={state.diagonalRule === 'alternating' ? 'primary-button' : 'secondary-button'}
                    aria-pressed={state.diagonalRule === 'alternating'}
                    onClick={() => void updateBattleMapSettings({ diagonalRule: 'alternating' })}
                  >
                    Variante 5-10-5
                  </button>
                </div>
              </div>

              <div className="action-card__block">
                <p className="action-card__label">Unità di misura</p>
                <label className="inline-field">
                  Etichetta
                  <input
                    type="text"
                    value={measurementUnitDraft.label}
                    onChange={(event) => setMeasurementUnitDraft((current) => ({ ...current, label: event.target.value }))}
                  />
                </label>
                <label className="inline-field">
                  Per casella
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={measurementUnitDraft.cellsValue}
                    onChange={(event) => setMeasurementUnitDraft((current) => ({ ...current, cellsValue: event.target.value }))}
                  />
                </label>
                <div className="action-card__buttons">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={async () => {
                      const cellsValue = Number(measurementUnitDraft.cellsValue);
                      const result = await updateBattleMapSettings({
                        measurementUnit: { label: measurementUnitDraft.label, cellsValue },
                      });
                      setMeasurementUnitError(result.ok ? null : result.message ?? 'Valore non valido.');
                    }}
                  >
                    Applica unità
                  </button>
                </div>
                {measurementUnitError ? <p className="action-card__meta action-card__meta--error">{measurementUnitError}</p> : null}
              </div>
            </div>
          </section>
        ) : null;
      case 'initiative':
        return (
          <InitiativePanel
            key="initiative"
            tokens={state.tokens}
            initiatives={state.initiatives}
            activeTurnTokenId={state.activeTurnTokenId}
            roundNumber={state.roundNumber}
            sessionMode={state.sessionMode}
            isRoundStarted={state.isRoundStarted}
            playersCanEndTurn={state.playersCanEndTurn}
            currentUserId={user?.id ?? null}
            canManageInitiative={canManageBattleMap}
            onOpenRollModal={() => {
              if (canManageBattleMap) {
                setIsInitiativeModalOpen(true);
              }
            }}
            onStartCombat={startCombat}
            onEndCombat={endCombat}
            onStartRound={startRound}
            onAdvanceTurn={advanceTurn}
            onEndOwnTurn={endOwnTurn}
            onRollInitiative={(tokenId) => rollInitiative(tokenId)}
            onRollAll={rollAllInitiative}
            onSetActiveTurnToken={setActiveTurnToken}
            onClearInitiative={(tokenId) => {
              if (canManageBattleMap) {
                clearInitiative(tokenId);
              }
            }}
            onReorderInitiatives={(fromIndex, toIndex) => {
              if (canManageBattleMap) {
                reorderInitiatives(fromIndex, toIndex);
              }
            }}
            onLocateToken={locateToken}
            onOpenEditTokenModal={openEditTokenModal}
          />
        );
      case 'characters':
        return (
          <section key="characters" className="sidebar__section character-roster">
            <div className="panel-heading"><div><h2>Personaggi</h2></div></div>
            {CHARACTER_PROFILES.filter((profile) => profile.role === 'adventurer').map((profile) => {
              const token = state.tokens.find((entry) => entry.characterKey === profile.key);
              const sheet = characterSheets.find((entry) => entry.ownerUserId === profile.id);
              const canOpenSheet = Boolean(sheet && (user?.role === 'master' || user?.id === profile.id));
              return <article className="character-roster__entry" key={profile.key}>
                <img src={resolveCharacterPortrait(profile, sheet?.portraitUrl)} alt="" />
                <strong>{profile.displayName}</strong>
                <div className="character-roster__actions">
                  {token ? <button type="button" className="secondary-button secondary-button--tiny" onClick={() => locateToken(token.id)}>Localizza</button> : <span>Fuori scena</span>}
                  {canOpenSheet ? <button type="button" className="secondary-button secondary-button--tiny" onClick={() => setOpenCharacterSheetId(sheet!.id)}>Apri scheda</button> : null}
                </div>
              </article>;
            })}
          </section>
        );
      case 'legend':
        return (
          <section key="legend" className="sidebar__section">
            <div className="panel-heading">
              <div>
                <h2>Comandi</h2>
              </div>
            </div>
            <div className="command-legend">
              <div className="command-legend__group">
                <p className="command-legend__title">Comuni</p>
                <p><strong>Click</strong>: seleziona elemento.</p>
                <p><strong>Shift + click</strong>: multi-selezione.</p>
                <p><strong>Rotella</strong>: zoom.</p>
                <p><strong>Ctrl + drag</strong>: muovi visuale.</p>
                <p><strong>/r 1d20+5</strong>: tiro libero (d4, d6, d8, d10, d12, d20, d100; max 20 dadi).</p>
                <p><strong>Click / Esc</strong>: salta il tiro 3D in corso senza annullare il risultato.</p>
                <p><strong>Presentazione dadi</strong>: animazione e suoni sono preferenze locali nella tab Impostazioni.</p>
                <p><strong className="command-legend__icon" aria-label="Lista elementi"><SearchIcon /></strong>: lista elementi.</p>
                <p><strong className="command-legend__icon" aria-label="Manuale"><BookIcon /></strong>: manuale.</p>
                <p><strong>Tasto destro / S / Shift+F10</strong> su un token che puoi modificare: menu delle condizioni (nessuna interazione di mappa in corso).</p>
                <p>
                  <strong>Nel menu delle condizioni</strong>: la lettera sottolineata attiva la condizione (P Prono, A Afferrato, T Trattenuto, V Avvelenato, C Accecato, F Affascinato, D Assordato, S Spaventato, I Incapacitato, B Invisibile, R Paralizzato, E Pietrificato, O Stordito, N Privo di sensi; veicoli: R Rotto, B Ribaltato). P toglie Prono senza costo (per esempio quando un alleato aiuta a rialzarsi); <strong>L</strong>: Alzati, che costa metà del movimento; <strong>U</strong>: Aure, apre il pannello delle aure del personaggio. <strong>0–6</strong>: livello di Indebolimento.
                </p>
              </div>

              {canManageBattleMap ? (
                <div className="command-legend__group">
                  <p className="command-legend__title">Master</p>
                  <p><strong>Drag</strong>: muovi token selezionati.</p>
                  <p><strong>+</strong>: apre la card Azioni nella sidebar.</p>
                  <p><strong className="command-legend__icon" aria-label="Aggiungi selezionati"><CrossedSwordsIcon size="1.1em" /></strong>: aggiungi selezionati ai turni.</p>
                  <p><strong className="command-legend__icon" aria-label="Rimuovi selezionati"><TrashIcon /></strong>: rimuovi selezionati.</p>
                  <p><strong>Canc</strong>: rimuovi selezionati.</p>
                  <p><strong>Gestisci voci</strong>: tiro, valore manuale o rimozione per una singola creatura, nella tab Turni di iniziativa.</p>
                  <p><strong>Invisibile</strong>: nasconde token ai player.</p>
                  <p><strong className="command-legend__icon"><UndoIcon aria-label="Annulla" /> / Ctrl+Z</strong>: undo globale.</p>
                </div>
              ) : (
                <div className="command-legend__group">
                  <p className="command-legend__title">Player</p>
                  <p><strong>Frecce</strong>: muovi il tuo PG.</p>
                  <p><strong>Home / PgUp / End / PgDn</strong>: diagonali.</p>
                  <p><strong>-1 / +1</strong>: rimuovi o aggiungi movimento extra.</p>
                  <p><strong className="command-legend__icon" aria-label="Scatto"><DashIcon /></strong>: scatto.</p>
                  <p><strong>PF</strong>: aggiorna i tuoi punti ferita.</p>
                  <p><strong>Alzati</strong>: nel menu delle condizioni, solo quando sei Prono.</p>
                  <p><strong className="command-legend__icon"><UndoIcon aria-label="Annulla" /> / Ctrl+Z</strong>: undo della tua ultima azione.</p>
                </div>
              )}
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  if (isLoading && !user) {
    return (
      <div className="auth-shell auth-shell--loading">
        <p className="auth-copy">Connessione al server di sessione...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        error={error}
        isLoading={isSubmitting}
        onLogin={login}
        portraitsByOwnerId={Object.fromEntries(
          publicPortraits.filter((entry) => entry.portraitUrl).map((entry) => [entry.ownerUserId, entry.portraitUrl as string]),
        )}
      />
    );
  }

  if (!isBattleMapReady) {
    return (
      <div className="auth-shell auth-shell--loading">
        <p className="auth-copy">Sincronizzazione della sessione condivisa...</p>
      </div>
    );
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'app-shell--sidebar-collapsed' : ''}`}>
      <aside
        ref={sidebarRef}
        className={`sidebar session-workspace ${isSidebarCollapsed ? 'sidebar--collapsed' : ''}`}
        onMouseEnter={() => {
          if (!isSidebarPinned) {
            if (sidebarHoverOpenTimeoutRef.current !== null) {
              window.clearTimeout(sidebarHoverOpenTimeoutRef.current);
            }
            sidebarHoverOpenTimeoutRef.current = window.setTimeout(() => {
              setIsSidebarHoverOpen(true);
              sidebarHoverOpenTimeoutRef.current = null;
            }, SIDEBAR_HOVER_OPEN_DELAY_MS);
          }
        }}
        onMouseLeave={() => {
          if (!isSidebarPinned) {
            if (sidebarHoverOpenTimeoutRef.current !== null) {
              window.clearTimeout(sidebarHoverOpenTimeoutRef.current);
              sidebarHoverOpenTimeoutRef.current = null;
            }
            setIsSidebarHoverOpen(false);
          }
        }}
      >
        <div className="sidebar__toggle-wrap">
          <button
            type="button"
            className={`sidebar__toggle ${isSidebarPinned ? 'sidebar__toggle--active' : ''}`}
            aria-pressed={isSidebarPinned}
            aria-expanded={!isSidebarCollapsed}
            aria-label={isSidebarPinned ? 'Usa sidebar in modalita hover' : 'Tieni la sidebar aperta'}
            title={isSidebarPinned ? 'Sidebar bloccata aperta' : 'Sidebar in apertura al passaggio'}
            onClick={handleSidebarToggle}
          >
            <span aria-hidden="true">{isSidebarPinned ? <PinIcon /> : <SidebarIcon />}</span>
          </button>
        </div>

        {expandedSidebarPresence.shouldRender ? (
          <div
            className="sidebar__content"
            data-state={expandedSidebarPresence.isVisible ? 'open' : 'closed'}
          >
            <div className="workspace-tools">
              {renderSidebarSection('session')}
              {canManageBattleMap ? renderSidebarSection('actions') : null}
              {canManageBattleMap ? renderSidebarSection('lighting') : null}
              {canManageBattleMap ? renderSidebarSection('movement') : null}
            </div>
            <div className="workspace-tabs" role="tablist" aria-label="Pannello sessione">
              {([
                ['chat', 'Chat + Dadi', <ChatDiceIcon key="chat" />], ['initiative', 'Turni di iniziativa', <CrossedSwordsIcon key="initiative" size="1.1em" />], ['characters', 'Personaggi', <PawnIcon key="characters" />], ['settings', 'Impostazioni', <GearIcon key="settings" />], ['legend', 'Legenda dei comandi', <KeyboardIcon key="legend" />],
              ] as Array<[WorkspaceTabId, string, ReactNode]>).map(([id, label, icon]) => <button key={id} id={`tab-${id}`} role="tab" type="button" aria-selected={workspaceTab === id} aria-controls={`panel-${id}`} className={workspaceTab === id ? 'workspace-tab workspace-tab--active' : 'workspace-tab'} onClick={() => setWorkspaceTab(id)} title={label} aria-label={label}><span aria-hidden="true">{icon}</span></button>)}
            </div>
            <div id={`panel-${workspaceTab}`} role="tabpanel" aria-labelledby={`tab-${workspaceTab}`} className="workspace-tabpanel">
              {workspaceTab === 'chat' ? <section className="sidebar__section dice-log"><div ref={diceLogFeedRef} className="dice-log__feed" aria-live="polite">{state.diceLogs.length ? [...state.diceLogs].reverse().map((log) => <DiceLogEntry key={log.id} log={log} characterSheets={characterSheets} isExpanded={expandedDiceLogId === log.id} onToggle={() => setExpandedDiceLogId(expandedDiceLogId === log.id ? null : log.id)} onRoll={(request) => void rollAndReport(request)} />) : <p className="dice-log__empty">Il registro dei dadi apparirà qui.</p>}</div></section> : renderSidebarSection(workspaceTab)}
            </div>
            <div className="workspace-dice-dock">{renderSidebarSection('dice')}</div>
          </div>
        ) : null}
      </aside>

      <main className="app-main">
        <Board
          onPresentationHostChange={setStandardBoardHost}
          onMapInteractionChange={handleStandardBoardInteraction}
          tokens={visibleBoardTokens}
          zoom={state.zoom}
          selectedTokenIds={selectedTokenIds}
          editableTokenIds={editableTokenIds}
          focusRequest={focusRequest}
          isBackgroundHidden={state.isBoardBackgroundHidden}
          vision={playerVision}
          lightSources={state.lightSources}
          visionBlockers={visionBlockers}
          canManageTokens={canManageBattleMap}
          movableTokenIds={movableTokenIds}
          lightPlacement={
            canManageBattleMap && isLightPlacementActive && !state.isBoardFullyLit
              ? {
                  radiusCells: lightRadiusCells,
                  onPlace: (cell) => addLightSource(cell, lightRadiusCells),
                }
              : null
          }
          onRemoveLightSource={removeLightSource}
          onOpenMap={() => setIsMapModalOpen(true)}
          onToggleFullscreen={() => setBoardFullscreenPhase('opening')}
          onOpenManual={() => setIsManualModalOpen(true)}
          onOpenElementsListModal={() => setIsElementsListModalOpen(true)}
          onOpenEditTokenModal={openEditTokenModal}
          onApplyTokenCondition={applyTokenCondition}
          onStandUpToken={standUpToken}
          onSetTokenAuraActive={setTokenAuraActive}
          dashUsedByTokenId={state.dashUsedByTokenId}
          canDashTokenIds={canDashTokenIds}
          dashUnavailableReason={budgetApplies ? 'disponibile nel tuo turno' : 'disponibile a round avviato'}
          onDashToken={(tokenId) => void useDashAction(tokenId)}
          onMoveTokens={handleBoardMoveTokens}
          onSelectionChange={setSelectedTokenIds}
          onZoomChange={setZoom}
          obstaclePlacement={
            pendingObstaclePlacement
              ? {
                  color: pendingObstaclePlacement.color,
                  selectedCells: pendingObstaclePlacement.cells,
                  onToggleCell: (cell) => {
                    setPendingObstaclePlacement((current) => {
                      if (!current) {
                        return current;
                      }

                      const key = cellKey(cell);
                      const hasCell = current.cells.some((entry) => cellKey(entry) === key);
                      return {
                        ...current,
                        cells: hasCell
                          ? current.cells.filter((entry) => cellKey(entry) !== key)
                          : [...current.cells, cell],
                      };
                    });
                  },
                  onConfirm: confirmObstaclePlacement,
                  onCancel: () => setPendingObstaclePlacement(null),
                }
              : null
          }
          diagonalRule={state.diagonalRule}
          measurementUnit={state.measurementUnit}
          movementBudgetByTokenId={movementBudgetByTokenId}
          onDrawTemplate={(event) => void sendTemplateEvent(event)}
          onPlacePing={(position) => void sendPing(position)}
          ephemeralPings={ephemeralPings}
          ephemeralTemplates={ephemeralTemplates}
          tokenWalkEvents={tokenWalkEvents}
        />
      </main>

      {isBoardFullscreenVisible ? (
        <div
          className={`board-fullscreen-overlay board-fullscreen-overlay--${boardFullscreenPhase}`}
        >
          <Board
            onPresentationHostChange={setFullscreenBoardHost}
            onMapInteractionChange={handleFullscreenBoardInteraction}
            tokens={visibleBoardTokens}
            zoom={state.zoom}
            selectedTokenIds={selectedTokenIds}
            editableTokenIds={editableTokenIds}
            focusRequest={focusRequest}
            isFullscreen
            isBackgroundHidden={state.isBoardBackgroundHidden}
            vision={playerVision}
            lightSources={state.lightSources}
            visionBlockers={visionBlockers}
            canManageTokens={canManageBattleMap}
            movableTokenIds={movableTokenIds}
            lightPlacement={
              canManageBattleMap && isLightPlacementActive && !state.isBoardFullyLit
                ? {
                    radiusCells: lightRadiusCells,
                    onPlace: (cell) => addLightSource(cell, lightRadiusCells),
                  }
                : null
            }
            onRemoveLightSource={removeLightSource}
            onOpenMap={() => setIsMapModalOpen(true)}
            onToggleFullscreen={() => setBoardFullscreenPhase('closing')}
            onOpenManual={() => setIsManualModalOpen(true)}
            onOpenElementsListModal={() => setIsElementsListModalOpen(true)}
            onOpenEditTokenModal={openEditTokenModal}
            onApplyTokenCondition={applyTokenCondition}
            onStandUpToken={standUpToken}
            onSetTokenAuraActive={setTokenAuraActive}
            dashUsedByTokenId={state.dashUsedByTokenId}
            canDashTokenIds={canDashTokenIds}
            dashUnavailableReason={budgetApplies ? 'disponibile nel tuo turno' : 'disponibile a round avviato'}
            onDashToken={(tokenId) => void useDashAction(tokenId)}
            onMoveTokens={handleBoardMoveTokens}
            onSelectionChange={setSelectedTokenIds}
            onZoomChange={setZoom}
            obstaclePlacement={
              pendingObstaclePlacement
                ? {
                    color: pendingObstaclePlacement.color,
                    selectedCells: pendingObstaclePlacement.cells,
                    onToggleCell: (cell) => {
                      setPendingObstaclePlacement((current) => {
                        if (!current) {
                          return current;
                        }

                        const key = cellKey(cell);
                        const hasCell = current.cells.some((entry) => cellKey(entry) === key);
                        return {
                          ...current,
                          cells: hasCell
                            ? current.cells.filter((entry) => cellKey(entry) !== key)
                            : [...current.cells, cell],
                        };
                      });
                    },
                    onConfirm: confirmObstaclePlacement,
                    onCancel: () => setPendingObstaclePlacement(null),
                  }
                : null
            }
            diagonalRule={state.diagonalRule}
            measurementUnit={state.measurementUnit}
            movementBudgetByTokenId={movementBudgetByTokenId}
            onDrawTemplate={(event) => void sendTemplateEvent(event)}
            onPlacePing={(position) => void sendPing(position)}
            ephemeralPings={ephemeralPings}
            ephemeralTemplates={ephemeralTemplates}
            tokenWalkEvents={tokenWalkEvents}
          />
        </div>
      ) : null}

      {canManageBattleMap ? (
        <NewElementModal
          isOpen={isNewElementModalOpen}
          tokens={state.tokens}
          tokenCount={state.tokens.length}
          onClose={() => setIsNewElementModalOpen(false)}
          onAddTokens={addTokens}
          onStartObstaclePlacement={({ name, color, isInvisible }) => {
            setPendingObstaclePlacement({
              name,
              color,
              isInvisible,
              cells: [],
            });
          }}
        />
      ) : null}

      <EditElementModal
        isOpen={editingToken !== null}
        token={editingToken}
        tokens={state.tokens}
        canManageStructure={canManageBattleMap}
        canManageVisibility={canManageBattleMap}
        canRemoveToken={canManageBattleMap}
        onClose={() => setEditingTokenId(null)}
        onAddTokens={addTokens}
        onSaveToken={(tokenId, updates) => {
          updateToken(tokenId, updates);

          if (typeof updates.isInvisible !== 'boolean') {
            return;
          }

          connectedObstacleTokens(state.tokens, tokenId)
            .filter((connectedToken) => connectedToken.id !== tokenId)
            .forEach((connectedToken) => {
              updateToken(connectedToken.id, { isInvisible: updates.isInvisible });
            });
        }}
        onSaveOwnedToken={(tokenId, updates) => void updateOwnedToken(tokenId, updates)}
        onRemoveToken={(tokenId) => {
          if (canManageBattleMap) {
            removeToken(tokenId);
          }
          setEditingTokenId(null);
        }}
        onDuplicateToken={(tokenId) => duplicateToken(tokenId)}
      />

      <ElementsListModal
        isOpen={isElementsListModalOpen}
        tokens={visibleBoardTokens}
        readOnly={!canManageBattleMap}
        onClose={() => setIsElementsListModalOpen(false)}
        onRemoveToken={(tokenId) => {
          if (canManageBattleMap) {
            removeToken(tokenId);
          }
        }}
        onLocateToken={locateToken}
        onEditToken={TOKEN_EDIT_MODAL_ENABLED ? openEditTokenModal : undefined}
        onToggleVisibility={(tokenId) => {
          if (!canManageBattleMap) {
            return;
          }
          const token = state.tokens.find((entry) => entry.id === tokenId);
          if (!token) {
            return;
          }
          const nextIsInvisible = !token.isInvisible;
          connectedObstacleTokens(state.tokens, tokenId).forEach((connectedToken) => {
            updateToken(connectedToken.id, { isInvisible: nextIsInvisible });
          });
        }}
        onDuplicateToken={(tokenId) => duplicateToken(tokenId)}
      />

      <CharacterSheetWindow
        sheetId={openCharacterSheetId}
        isOpen={openCharacterSheetId !== null}
        title={CHARACTER_PROFILES.find((profile) => characterSheets.find((sheet) => sheet.id === openCharacterSheetId)?.ownerUserId === profile.id)?.displayName ?? 'Scheda del personaggio'}
        onClose={() => setOpenCharacterSheetId(null)}
        onRoll={(request) => void rollAndReport(request)}
        diceLogs={state.diceLogs}
        sessionMode={state.sessionMode}
        measurementUnit={state.measurementUnit}
      />

      <div className="combat-announcement-overlay" data-state={isCombatAnnouncementOpen ? 'open' : 'closed'}>
        <div
          className="combat-announcement-card"
          data-state={isCombatAnnouncementOpen ? 'open' : 'closed'}
          role={isCombatAnnouncementOpen ? 'alertdialog' : undefined}
          aria-hidden={!isCombatAnnouncementOpen}
          aria-label={combatAnnouncement?.title ?? 'Il combattimento ha inizio'}
        >
          <CombatEmblem size={104} />
          <p>{combatAnnouncement?.title ?? 'Il combattimento ha inizio'}</p>
          <strong>{combatAnnouncement?.message ?? '"C vol la iaul? C VOL LA IAAAAAUL!?!?"'}</strong>
          {isCombatAnnouncementOpen ? (
            <button type="button" className="secondary-button secondary-button--small combat-announcement-card__close" onClick={closeCombatAnnouncement}>
              Chiudi
            </button>
          ) : null}
        </div>
      </div>

      <Modal
        title="Note condivise"
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        className="modal-card--notes"
      >
        <div className="notes-modal">
          <textarea
            className="notes-modal__textarea"
            value={draftNotes}
            onChange={(event) => setDraftNotes(event.target.value)}
            placeholder="Scrivi appunti, obiettivi o promemoria visibili a tutta la sessione."
          />
          <div className="notes-modal__footer">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void setSharedNotes(draftNotes)}
              disabled={!hasUnsavedNotes}
            >
              Salva note
            </button>
            <span>{hasUnsavedNotes ? 'Modifiche non salvate' : 'Sincronizzate'}</span>
          </div>
        </div>
      </Modal>

      <Modal
        title="Manuale"
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        className="modal-card--manual"
      >
        <div className="manual-preview">
          <iframe
            title="Anteprima manuale PDF"
            src={MANUAL_PDF_PATH}
            className="manual-preview__frame"
          />
        </div>
      </Modal>

      <Modal
        title="Mappa dell'Averno"
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        className="modal-card--map"
      >
        <div className="map-preview">
          <img src={avernusImage} alt="Mappa dell'Averno" className="map-preview__image" />
        </div>
      </Modal>

      <DiceLogModal
        isOpen={isDiceLogModalOpen}
        logs={state.diceLogs}
        onClose={() => setIsDiceLogModalOpen(false)}
        onClear={clearDiceLogs}
      />

      <Dice3DOverlay
        host={isBoardFullscreenVisible ? fullscreenBoardHost : standardBoardHost}
        deliveries={diceRollDeliveries}
        animationEnabled={dicePresentationPreferences.animationEnabled}
        soundEnabled={dicePresentationPreferences.soundEnabled}
        hasUserActivated={hasUserActivated}
      />

      {!canManageBattleMap && user ? (
        <AuraPresenceBanner
          host={isBoardFullscreenVisible ? fullscreenBoardHost : standardBoardHost}
          state={state}
          userId={user.id}
        />
      ) : null}

      <InitiativeRollModal
        isOpen={isInitiativeModalOpen}
        tokens={state.tokens}
        initiatives={state.initiatives}
        sessionMode={state.sessionMode}
        canManage={canManageBattleMap}
        onClose={() => setIsInitiativeModalOpen(false)}
        onRollInitiative={rollInitiative}
        onSetInitiative={(entry) => {
          if (canManageBattleMap) {
            setInitiative(entry);
          }
        }}
        onClearInitiative={(tokenId) => {
          if (canManageBattleMap) {
            clearInitiative(tokenId);
          }
        }}
        onLocateToken={locateToken}
      />

      {/* Disattivata su richiesta: il dettaglio del tiro si legge già nella card del log
          (P0.7.5). Codice e stato restano intatti, così da poterla riattivare senza riscriverla. */}
      {false ? <DiceResultModal result={latestDiceResult} onClose={() => setLatestDiceResult(null)} /> : null}

      {movementNotice || rollNotice ? (
        // Un movimento o un tiro rifiutati non restano mai silenziosi: l'avviso è in primo piano
        // sopra la mappa, a schermo intero compreso, finché non scade.
        <div className="app-toasts">
          {movementNotice ? (
            <div className="movement-toast" role="alert" key={movementNotice.id}>
              <BlockIcon aria-hidden="true" />
              <p>{movementNotice.message}</p>
              <button type="button" onClick={clearMovementNotice} aria-label="Chiudi l'avviso di movimento rifiutato"><CloseIcon size="0.9em" /></button>
            </div>
          ) : null}
          {rollNotice ? (
            <div className="movement-toast" role="alert" key={rollNotice.id}>
              <DiceGlyph type="d20" size="1.1em" />
              <p>{rollNotice.message}</p>
              <button type="button" onClick={() => setRollNotice(null)} aria-label="Chiudi l'avviso di tiro rifiutato"><CloseIcon size="0.9em" /></button>
            </div>
          ) : null}
        </div>
      ) : null}

      {turnNotice ? <div className="turn-notice" role="dialog" aria-modal="true" aria-label="Avviso turno"><div><h2>{turnNotice === 'turn' ? 'Tocca a te!' : 'Sei il prossimo!'}</h2><button type="button" className="primary-button" autoFocus onClick={() => setTurnNotice(null)}>Capito</button></div></div> : null}

      {isBootLoading ? (
        <div className="boot-loader" role="status" aria-live="polite">
          <img className="boot-loader__image" src={avernusImage} alt="" aria-hidden="true" />
          <div className="boot-loader__shade" aria-hidden="true" />
          <div className="boot-loader__card">
            <h1 className="boot-loader__title">Gli ammazza-keebler</h1>
            <p className="boot-loader__aside">(Di ghigno)</p>
            <h2 className="boot-loader__subtitle">nell&apos;Averno</h2>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
