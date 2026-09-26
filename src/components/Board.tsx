import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BlockIcon, BookIcon, CircleTemplateIcon, CloseIcon, CollapseIcon, ConeTemplateIcon, ExpandIcon, LineTemplateIcon, MapIcon,
  PingIcon, RulerIcon, SearchIcon, SparkIcon,
} from './UiIcons';
import type { CSSProperties } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { BOARD_CONFIG } from '../constants/board';
import type {
  DiagonalParity,
  DiagonalRule,
  EphemeralPing,
  EphemeralTemplate,
  GridPosition,
  LightSource,
  MeasurementUnit,
  MovementNotice,
  TemplateShape,
  TokenCondition,
  TokenMovementBudget,
  TokenWalkEvent,
  UnitToken,
} from '../types';
import {
  boardPixelSize,
  clampZoom,
  getTokenFootprint,
  gridRowToLabel,
  gridToPixels,
  viewportPointToWorldCell,
} from '../utils/board';
import { buildVisionPolygon, buildVisionPolygonFromPoint } from '../utils/vision';
import { cellsToUnit, pathCost } from '../../shared/grid-movement';
import { effectiveSpeed } from '../../shared/token-conditions.mjs';
import { auraRect } from '../../shared/token-auras.mjs';
import { conditionLabel } from '../utils/tokens';
import { Token } from './Token';
import { TokenRadialMenu } from './TokenRadialMenu';

function formatNumber(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

const FEET_PER_METER = 3.28084;

// I piedi sono una conversione dei metri misurati, non un secondo righello con una scala propria:
// il valore per casella scelto dal Master resta l'unica misura di riferimento, e la colonna in
// piedi lo segue invece di contraddirlo.
function formatRulerMeasurement(cells: number, unit: MeasurementUnit): string {
  const converted = cellsToUnit(cells, unit.cellsValue);
  const cellsLabel = `${cells} casell${cells === 1 ? 'a' : 'e'}`;
  if (converted === null) {
    return cellsLabel;
  }

  const isMetric = unit.label.trim().toLowerCase() === 'm';
  const measurement = isMetric
    ? `${formatNumber(converted)}m | ${formatNumber(converted * FEET_PER_METER)}ft`
    : `${formatNumber(converted)} ${unit.label}`;
  return `${cellsLabel} (${measurement})`;
}

interface BoardProps {
  tokens: UnitToken[];
  zoom: number;
  selectedTokenIds: string[];
  editableTokenIds?: string[];
  focusRequest: { tokenId: string; nonce: number } | null;
  isFullscreen?: boolean;
  isBackgroundHidden?: boolean;
  vision?: {
    enabled: boolean;
    radiusCells: number;
    sourceToken: UnitToken;
    blockers: UnitToken[];
  } | null;
  lightSources?: LightSource[];
  visionBlockers?: UnitToken[];
  canManageTokens?: boolean;
  movableTokenIds?: string[];
  lightPlacement?: {
    radiusCells: number;
    onPlace: (cell: GridPosition) => void;
  } | null;
  onRemoveLightSource?: (lightId: string) => void;
  onOpenMap: () => void;
  onOpenManual: () => void;
  onOpenElementsListModal: () => void;
  onOpenEditTokenModal: (tokenId: string) => void;
  // Menu radiale delle condizioni (P0.8c): unica superficie di modifica delle condizioni dopo che
  // la modale di modifica è stata nascosta. `onApplyTokenCondition`/`onStandUpToken` restano
  // opzionali per non rompere un consumatore di test che non li passa.
  onApplyTokenCondition?: (
    tokenId: string,
    op:
      | { type: 'add'; condition: TokenCondition }
      | { type: 'remove'; condition: TokenCondition }
      | { type: 'set-exhaustion'; level: number },
  ) => void;
  onStandUpToken?: (tokenId: string) => void;
  // Aure (P0.8d): interruttore dal pannello «Aure» del menu radiale.
  onSetTokenAuraActive?: (tokenId: string, auraId: string, active: boolean) => void;
  // Scatto (P0.8c): il pulsante in barra laterale seguiva solo il personaggio principale
  // dell'Adventurer; il menu radiale lo espone anche sul famiglio quando è il suo turno.
  dashUsedByTokenId?: Record<string, boolean>;
  canDashTokenIds?: ReadonlySet<string>;
  dashUnavailableReason?: string;
  onDashToken?: (tokenId: string) => void;
  onToggleFullscreen: () => void;
  onMoveTokens: (moves: Array<{ tokenId: string; x: number; y: number }>, anchorWaypoints?: GridPosition[]) => void;
  onSelectionChange: (tokenIds: string[]) => void;
  onZoomChange: (zoom: number) => void;
  obstaclePlacement?: {
    color: string;
    selectedCells: GridPosition[];
    onToggleCell: (cell: GridPosition) => void;
    onConfirm: () => void;
    onCancel: () => void;
  } | null;
  diagonalRule: DiagonalRule;
  measurementUnit: MeasurementUnit;
  movementBudgetByTokenId?: Record<string, TokenMovementBudget>;
  onDrawTemplate?: (event: {
    id: string;
    phase: 'update' | 'end';
    shape: TemplateShape;
    origin: GridPosition;
    target: GridPosition;
    color: string;
  }) => void;
  onPlacePing?: (position: GridPosition) => void;
  ephemeralPings?: EphemeralPing[];
  ephemeralTemplates?: EphemeralTemplate[];
  tokenWalkEvents?: TokenWalkEvent[];
  movementNotice?: MovementNotice | null;
  onDismissMovementNotice?: () => void;
  // Segnala quando la tastiera appartiene alla mappa (pianificazione di un percorso, righello,
  // sagome): in quel momento le frecce non devono muovere token dall'esterno.
  onMapInteractionChange?: (isActive: boolean) => void;
  onPresentationHostChange?: (host: HTMLDivElement | null) => void;
}

const TEMPLATE_COLORS: Record<TemplateShape, string> = {
  circle: '#ff8a3d',
  cone: '#ffb84d',
  line: '#ff5d73',
};

type MapTool = 'ruler' | 'ping' | 'template-circle' | 'template-cone' | 'template-line';

// Un solo ritmo per l'animazione di cammino, uguale per chi muove il token e per chiunque lo
// osservi altrove: lo stesso movimento fisico deve apparire identico a tutti.
const WALK_PACE = { msPerCell: 180, minDuration: 300, maxDuration: 2500 };

const INITIAL_CAMERA = { x: 0, y: 0 };
const BOARD_GUTTER = 30;
const DRAG_THRESHOLD = 6;

function tokenCenter(token: UnitToken): { x: number; y: number } {
  const footprint = getTokenFootprint(token);

  return {
    x: token.position.x + footprint.width / 2,
    y: token.position.y + footprint.height / 2,
  };
}

function clampCamera(position: GridPosition): GridPosition {
  return {
    x: Math.max(0, position.x),
    y: Math.max(0, position.y),
  };
}

function isCreatureToken(token: UnitToken) {
  return token.type === 'player' || token.type === 'enemy';
}

function isObstacleToken(token: UnitToken) {
  return token.type === 'object' && token.blocksMovement === true;
}

function tokensOverlap(left: UnitToken, right: UnitToken): boolean {
  const leftFootprint = getTokenFootprint(left);
  const rightFootprint = getTokenFootprint(right);

  return !(
    left.position.x + leftFootprint.width - 1 < right.position.x ||
    right.position.x + rightFootprint.width - 1 < left.position.x ||
    left.position.y + leftFootprint.height - 1 < right.position.y ||
    right.position.y + rightFootprint.height - 1 < left.position.y
  );
}

interface ObstacleCluster {
  id: string;
  name: string;
  color: string;
  tokenIds: string[];
  anchorTokenId: string;
  cells: GridPosition[];
}

function tokenCells(token: UnitToken): GridPosition[] {
  const footprint = getTokenFootprint(token);
  const cells: GridPosition[] = [];

  for (let y = 0; y < footprint.height; y += 1) {
    for (let x = 0; x < footprint.width; x += 1) {
      cells.push({
        x: token.position.x + x,
        y: token.position.y + y,
      });
    }
  }

  return cells;
}

function buildObstacleClusters(tokens: UnitToken[]): ObstacleCluster[] {
  const obstacleTokens = tokens.filter(isObstacleToken);
  const cellMap = new Map<
    string,
    {
      tokenId: string;
      name: string;
      color: string;
      groupId: string | null;
      cell: GridPosition;
    }
  >();

  obstacleTokens.forEach((token) => {
    tokenCells(token).forEach((cell) => {
      cellMap.set(`${cell.x}:${cell.y}`, {
        tokenId: token.id,
        name: token.name,
        color: token.color,
        groupId: token.groupId ?? null,
        cell,
      });
    });
  });

  const visited = new Set<string>();
  const clusters: ObstacleCluster[] = [];

  cellMap.forEach((entry, key) => {
    if (visited.has(key)) {
      return;
    }

    const queue = [entry];
    const clusterCells: GridPosition[] = [];
    const tokenIds = new Set<string>();
    visited.add(key);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      clusterCells.push(current.cell);
      tokenIds.add(current.tokenId);

      [
        { x: current.cell.x + 1, y: current.cell.y },
        { x: current.cell.x - 1, y: current.cell.y },
        { x: current.cell.x, y: current.cell.y + 1 },
        { x: current.cell.x, y: current.cell.y - 1 },
      ].forEach((neighbor) => {
        const neighborKey = `${neighbor.x}:${neighbor.y}`;
        const neighborEntry = cellMap.get(neighborKey);
        if (
          neighborEntry &&
          !visited.has(neighborKey) &&
          (
            entry.groupId
              ? neighborEntry.groupId === entry.groupId
              : neighborEntry.name === entry.name && neighborEntry.color === entry.color
          )
        ) {
          visited.add(neighborKey);
          queue.push(neighborEntry);
        }
      });
    }

    clusters.push({
      id: `${entry.name}-${entry.color}-${key}`,
      name: entry.name,
      color: entry.color,
      tokenIds: Array.from(tokenIds),
      anchorTokenId: entry.tokenId,
      cells: clusterCells,
    });
  });

  return clusters;
}

function cellKey(cell: GridPosition) {
  return `${cell.x}:${cell.y}`;
}

type PanInteraction = {
  mode: 'pan';
  pointerId: number;
  startX: number;
  startY: number;
  startCamera: GridPosition;
};

type PendingTokenInteraction = {
  mode: 'pending-token';
  pointerId: number;
  startX: number;
  startY: number;
  tokenId: string;
  selection: string[];
  selectGroupOnClick: boolean;
  grabOffset: GridPosition;
  offsets: Array<{ tokenId: string; deltaX: number; deltaY: number }>;
  additive: boolean;
};

// Unica modalità di movimento, identica per Master e Player: il token resta fermo alla posizione
// di partenza (elemento 0 di waypoints) e il percorso misurato segue il puntatore finché non si
// conferma.
//
// Il click ha un solo significato, aggiungere un waypoint: quello sul token apre la
// pianificazione, quelli successivi spezzano il percorso. La destinazione non si clicca, è la
// casella sotto il puntatore nel momento in cui si preme `Spazio`, che è l'unico gesto di
// conferma. Nessun rilascio del pointer conferma un movimento. `Backspace` toglie l'ultimo
// waypoint, `Esc` annulla senza inviare nulla.
type PlanInteraction = {
  mode: 'plan';
  tokenId: string;
  waypoints: GridPosition[];
  hoverCell: GridPosition | null;
  grabOffset: GridPosition;
  offsets: Array<{ tokenId: string; deltaX: number; deltaY: number }>;
};

type TemplateDrawInteraction = {
  mode: 'template-draw';
  pointerId: number;
  templateId: string;
  shape: TemplateShape;
  color: string;
  origin: GridPosition;
  hoverCell: GridPosition;
};

type SelectBoxInteraction = {
  mode: 'select-box';
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
};

type ObstaclePaintInteraction = {
  mode: 'obstacle-paint';
  pointerId: number;
  paintedCellKeys: string[];
};

type InteractionState =
  | PanInteraction
  | PendingTokenInteraction
  | PlanInteraction
  | SelectBoxInteraction
  | ObstaclePaintInteraction
  | TemplateDrawInteraction;

// Stesso footprint AABB usato da findBlockedMovement lato server, riprodotto qui solo per
// l'avviso ottimistico durante il trascinamento: il server resta l'unica autorità sull'esito.
function isMovementBlockingToken(token: UnitToken): boolean {
  return token.blocksMovement === true;
}

function footprintsOverlap(
  position: GridPosition,
  footprint: { width: number; height: number },
  other: UnitToken,
): boolean {
  const otherFootprint = getTokenFootprint(other);
  return !(
    position.x + footprint.width - 1 < other.position.x ||
    other.position.x + otherFootprint.width - 1 < position.x ||
    position.y + footprint.height - 1 < other.position.y ||
    other.position.y + otherFootprint.height - 1 < position.y
  );
}

function isSegmentBlocked(
  allTokens: UnitToken[],
  movingTokenId: string,
  footprint: { width: number; height: number },
  from: GridPosition,
  to: GridPosition,
): boolean {
  const stepX = Math.sign(to.x - from.x);
  const stepY = Math.sign(to.y - from.y);
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  let x = from.x;
  let y = from.y;

  for (let index = 0; index < steps; index += 1) {
    if (x !== to.x) x += stepX;
    if (y !== to.y) y += stepY;

    const blocked = allTokens.some(
      (candidate) =>
        candidate.id !== movingTokenId &&
        isMovementBlockingToken(candidate) &&
        footprintsOverlap({ x, y }, footprint, candidate),
    );
    if (blocked) {
      return true;
    }
  }

  return false;
}

// Il costo di ogni singolo segmento, non solo il totale: con la variante 5-10-5 due segmenti
// identici possono costare diverso a seconda di quante diagonali li precedono, quindi l'alternanza
// va portata avanti di segmento in segmento esattamente come fa il server.
function segmentCosts(
  waypoints: GridPosition[],
  rule: DiagonalRule,
  startParity: DiagonalParity,
  stepCostMultiplier = 1,
): number[] {
  const costs: number[] = [];
  let parity = startParity;

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const result = pathCost([waypoints[index], waypoints[index + 1]], { rule, diagonalParity: parity, stepCostMultiplier });
    costs.push(result.cells);
    parity = result.nextDiagonalParity;
  }

  return costs;
}

function isPathBlocked(
  allTokens: UnitToken[],
  movingTokenId: string,
  footprint: { width: number; height: number },
  waypoints: GridPosition[],
): boolean {
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    if (isSegmentBlocked(allTokens, movingTokenId, footprint, waypoints[index], waypoints[index + 1])) {
      return true;
    }
  }

  return false;
}

export function Board({
  tokens,
  zoom,
  selectedTokenIds,
  editableTokenIds = [],
  focusRequest,
  isFullscreen = false,
  isBackgroundHidden = false,
  vision = null,
  lightSources = [],
  visionBlockers = [],
  canManageTokens = true,
  movableTokenIds = [],
  lightPlacement = null,
  onRemoveLightSource,
  onOpenMap,
  onOpenManual,
  onOpenElementsListModal,
  onOpenEditTokenModal,
  onApplyTokenCondition,
  onStandUpToken,
  onSetTokenAuraActive,
  dashUsedByTokenId,
  canDashTokenIds,
  dashUnavailableReason,
  onDashToken,
  onToggleFullscreen,
  onMoveTokens,
  onSelectionChange,
  onZoomChange,
  obstaclePlacement = null,
  diagonalRule,
  measurementUnit,
  movementBudgetByTokenId = {},
  onDrawTemplate,
  onPlacePing,
  ephemeralPings = [],
  tokenWalkEvents = [],
  ephemeralTemplates = [],
  movementNotice = null,
  onDismissMovementNotice,
  onMapInteractionChange,
  onPresentationHostChange,
}: BoardProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  // Menu radiale delle condizioni (P0.8c): un solo token alla volta, chiuso non appena una
  // pianificazione, un righello o una sagoma prendono la tastiera/il pointer della mappa.
  const [radialMenuTokenId, setRadialMenuTokenId] = useState<string | null>(null);
  // Vero tra il pointerdown destro che annulla una pianificazione e il suo `contextmenu`: quel
  // `contextmenu` arriva quando l'interazione è già chiusa e non deve aprire né il menu radiale
  // né quello del browser. Si azzera al pointerdown successivo (in cattura), così un secondo
  // click destro voluto apre il menu normalmente.
  const suppressNextTokenMenuRef = useRef(false);
  useEffect(() => {
    const clear = () => {
      suppressNextTokenMenuRef.current = false;
    };
    window.addEventListener('pointerdown', clear, true);
    return () => window.removeEventListener('pointerdown', clear, true);
  }, []);
  useEffect(() => {
    if (interaction) {
      setRadialMenuTokenId(null);
    }
  }, [interaction]);
  const [lightPreviewCell, setLightPreviewCell] = useState<GridPosition | null>(null);
  const [activeTool, setActiveTool] = useState<MapTool | null>(null);
  const [rulerWaypoints, setRulerWaypoints] = useState<GridPosition[]>([]);
  const [rulerHoverCell, setRulerHoverCell] = useState<GridPosition | null>(null);
  const isRulerActive = activeTool === 'ruler';
  const isPingToolActive = activeTool === 'ping';
  const activeTemplateShape: TemplateShape | null =
    activeTool === 'template-circle' ? 'circle' : activeTool === 'template-cone' ? 'cone' : activeTool === 'template-line' ? 'line' : null;

  const exitActiveTool = () => {
    setActiveTool(null);
    setRulerWaypoints([]);
    setRulerHoverCell(null);
  };

  // Gli strumenti di mappa si raggiungono da tastiera come i pulsanti che li attivano: le
  // scorciatoie valgono solo quando il fuoco non è in un campo di testo e non c'è già
  // un'interazione in corso, perché quella ha le proprie regole di conferma e annullamento.
  const TOOL_SHORTCUTS: Record<string, MapTool> = {
    KeyR: 'ruler',
    KeyP: 'ping',
    KeyC: 'template-circle',
    KeyO: 'template-cone',
    KeyL: 'template-line',
  };

  useEffect(() => {
    if (interaction) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeTool) {
        event.preventDefault();
        exitActiveTool();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      // Menu radiale delle condizioni (P0.8c): `S` o `Shift+F10` sul token che ha il fuoco da
      // tastiera, alle stesse condizioni del click destro (nessuna interazione di mappa in corso,
      // già garantito dal primo `return` dell'effetto quando `interaction` è valorizzato). `S`
      // senza un token a fuoco resta libero per lo spostamento WASD esistente in `App.tsx`
      // (KEYBOARD_MOVEMENTS): la propagazione si interrompe solo quando il menu apre davvero,
      // altrimenti il tasto raggiunge normalmente quel gestore.
      if (event.code === 'KeyS' || (event.key === 'F10' && event.shiftKey)) {
        const activeElement = document.activeElement;
        const focusedTokenId =
          activeElement instanceof HTMLElement ? activeElement.getAttribute('data-token-id') : null;
        if (focusedTokenId && (canManageTokens || editableTokenIdSet.has(focusedTokenId))) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setRadialMenuTokenId(focusedTokenId);
        }
        return;
      }

      const shortcutTool = TOOL_SHORTCUTS[event.code];
      if (!shortcutTool) {
        return;
      }

      event.preventDefault();
      if (activeTool === shortcutTool) {
        exitActiveTool();
        return;
      }

      setRulerWaypoints([]);
      setRulerHoverCell(null);
      setActiveTool(shortcutTool);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, interaction]);
  const [camera, setCamera] = useState<GridPosition>(INITIAL_CAMERA);
  const [viewportCells, setViewportCells] = useState<{ columns: number; rows: number }>({
    columns: BOARD_CONFIG.minVisibleColumns,
    rows: BOARD_CONFIG.minVisibleRows,
  });
  const movableTokenIdSet = useMemo(() => new Set(movableTokenIds), [movableTokenIds]);
  const editableTokenIdSet = useMemo(() => new Set(editableTokenIds), [editableTokenIds]);
  const obstacleClusters = useMemo(() => buildObstacleClusters(tokens), [tokens]);
  const obstacleTokenIdSet = useMemo(
    () => new Set(obstacleClusters.flatMap((cluster) => cluster.tokenIds)),
    [obstacleClusters],
  );
  const effectiveVision = vision?.enabled ? vision : null;
  const visionPolygonPoints = useMemo(() => {
    if (!effectiveVision) {
      return [];
    }

    return buildVisionPolygon(
      effectiveVision.sourceToken,
      effectiveVision.radiusCells,
      effectiveVision.blockers,
    ).map((point) => ({
      x: (point.x - camera.x) * BOARD_CONFIG.cellSize * zoom,
      y: (point.y - camera.y) * BOARD_CONFIG.cellSize * zoom,
    }));
  }, [camera.x, camera.y, effectiveVision, zoom]);
  const lightPolygonPoints = useMemo(
    () =>
      lightSources.map((light) => ({
        id: light.id,
        points: buildVisionPolygonFromPoint(
          { x: light.position.x + 0.5, y: light.position.y + 0.5 },
          light.radiusCells,
          visionBlockers,
        ).map((point) => ({
          x: (point.x - camera.x) * BOARD_CONFIG.cellSize * zoom,
          y: (point.y - camera.y) * BOARD_CONFIG.cellSize * zoom,
        })),
      })),
    [camera.x, camera.y, lightSources, visionBlockers, zoom],
  );
  const lightPreviewPolygonPoints = useMemo(() => {
    if (!lightPlacement || !lightPreviewCell) {
      return [];
    }

    return buildVisionPolygonFromPoint(
      { x: lightPreviewCell.x + 0.5, y: lightPreviewCell.y + 0.5 },
      lightPlacement.radiusCells,
      visionBlockers,
    ).map((point) => ({
      x: (point.x - camera.x) * BOARD_CONFIG.cellSize * zoom,
      y: (point.y - camera.y) * BOARD_CONFIG.cellSize * zoom,
    }));
  }, [camera.x, camera.y, lightPlacement, lightPreviewCell, visionBlockers, zoom]);
  const visionPolygonPath = visionPolygonPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const lightPolygonPaths = lightPolygonPoints.map((light) => ({
    id: light.id,
    path: light.points.map((point) => `${point.x},${point.y}`).join(' '),
  }));
  const lightPreviewPolygonPath = lightPreviewPolygonPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const visionCenter = effectiveVision
    ? tokenCenter(effectiveVision.sourceToken)
    : null;
  const visionScreenCenter = visionCenter
    ? {
        x: (visionCenter.x - camera.x) * BOARD_CONFIG.cellSize * zoom,
        y: (visionCenter.y - camera.y) * BOARD_CONFIG.cellSize * zoom,
      }
    : null;

  useEffect(() => {
    onPresentationHostChange?.(shellRef.current);
    return () => onPresentationHostChange?.(null);
  }, [onPresentationHostChange]);

  useEffect(() => {
    const node = shellRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry.contentRect.width - BOARD_GUTTER;
      const height = entry.contentRect.height - BOARD_GUTTER;
      const screenCell = BOARD_CONFIG.cellSize * zoom;

      setViewportCells({
        columns: Math.max(BOARD_CONFIG.minVisibleColumns, Math.ceil(width / screenCell) + 2),
        rows: Math.max(BOARD_CONFIG.minVisibleRows, Math.ceil(height / screenCell) + 2),
      });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [zoom]);

  useEffect(() => {
    const node = shellRef.current;
    if (!node) {
      return undefined;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? BOARD_CONFIG.zoomStep : -BOARD_CONFIG.zoomStep;
      onZoomChange(clampZoom(zoom + delta));
    };

    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [onZoomChange, zoom]);

  const { width, height } = boardPixelSize(viewportCells.columns, viewportCells.rows);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    const token = tokens.find((item) => item.id === focusRequest.tokenId);
    if (!token) {
      return;
    }

    const footprint = getTokenFootprint(token);
    setCamera(
      clampCamera({
        x: token.position.x - Math.floor((viewportCells.columns - footprint.width) / 2),
        y: token.position.y - Math.floor((viewportCells.rows - footprint.height) / 2),
      }),
    );
  }, [focusRequest, tokens, viewportCells.columns, viewportCells.rows]);

  const planInteraction = interaction?.mode === 'plan' ? interaction : null;
  const isMapInteractionActive = planInteraction !== null || isRulerActive || activeTemplateShape !== null;
  useEffect(() => {
    onMapInteractionChange?.(isMapInteractionActive);
  }, [isMapInteractionActive, onMapInteractionChange]);
  useEffect(() => () => onMapInteractionChange?.(false), [onMapInteractionChange]);
  // Durante la pianificazione il pezzo resta disegnato alla posizione di partenza: la destinazione
  // la mostrano il percorso e l'evidenziazione, non lo spostamento del pezzo, così si vede da dove
  // si è partiti. Queste posizioni servono solo a sapere in anticipo se il percorso finirebbe
  // sopra un'altra creatura.
  const planEndCell = planInteraction
    ? planInteraction.hoverCell ?? planInteraction.waypoints[planInteraction.waypoints.length - 1]
    : null;
  const planDestinations = useMemo(() => {
    if (!planInteraction || !planEndCell) {
      return new Map<string, GridPosition>();
    }

    return new Map(
      planInteraction.offsets.map((offset) => [
        offset.tokenId,
        {
          x: planEndCell.x + offset.deltaX,
          y: planEndCell.y + offset.deltaY,
        },
      ]),
    );
  }, [planInteraction, planEndCell]);
  // Rettangoli secondo la griglia del PHB (design, decisione 6): l'ingombro del token allargato
  // del raggio su ogni lato, sempre, anche con la variante 5-10-5 per il movimento.
  const auraRects = useMemo(
    () =>
      tokens.flatMap((token) => {
        if (
          (token.type !== 'player' && token.type !== 'enemy') ||
          token.containedInVehicleId ||
          !token.auras?.some((aura) => aura.active)
        ) {
          return [];
        }

        return token.auras.flatMap((aura) => {
          if (!aura.active) {
            return [];
          }
          const rect = auraRect(token, aura.radiusCells);
          return [{
            id: `${token.id}-${aura.id}`,
            color: aura.color,
            x: (rect.x - camera.x) * BOARD_CONFIG.cellSize * zoom,
            y: (rect.y - camera.y) * BOARD_CONFIG.cellSize * zoom,
            width: rect.width * BOARD_CONFIG.cellSize * zoom,
            height: rect.height * BOARD_CONFIG.cellSize * zoom,
          }];
        });
      }),
    [camera.x, camera.y, tokens, zoom],
  );
  const visibleTokenMaskRects = useMemo(() => {
    if (!effectiveVision) {
      return [];
    }

    return tokens.filter((token) => token.type === 'player').map((token) => {
      const position = token.position;
      const footprint = getTokenFootprint(token);

      return {
        id: token.id,
        x: (position.x - camera.x) * BOARD_CONFIG.cellSize * zoom,
        y: (position.y - camera.y) * BOARD_CONFIG.cellSize * zoom,
        width: footprint.width * BOARD_CONFIG.cellSize * zoom,
        height: footprint.height * BOARD_CONFIG.cellSize * zoom,
      };
    });
  }, [camera.x, camera.y, effectiveVision, tokens, zoom]);

  const hasInvalidPlanOverlap = useMemo(() => {
    if (planDestinations.size === 0) {
      return false;
    }

    const simulatedTokens = tokens.map((token) => {
      const plannedPosition = planDestinations.get(token.id);
      return plannedPosition ? { ...token, position: plannedPosition } : token;
    });

    const visibleCreatures = simulatedTokens.filter(
      (token) => isCreatureToken(token) && !token.containedInVehicleId,
    );

    for (let index = 0; index < visibleCreatures.length; index += 1) {
      const current = visibleCreatures[index];

      for (let comparisonIndex = index + 1; comparisonIndex < visibleCreatures.length; comparisonIndex += 1) {
        const other = visibleCreatures[comparisonIndex];
        if (tokensOverlap(current, other)) {
          return true;
        }
      }
    }

    return false;
  }, [planDestinations, tokens]);

  const rulerPath = rulerWaypoints.length === 0 ? null : rulerHoverCell ? [...rulerWaypoints, rulerHoverCell] : rulerWaypoints;
  const rulerPathCost = useMemo(() => {
    if (!rulerPath) {
      return null;
    }
    return pathCost(rulerPath, { rule: diagonalRule, diagonalParity: 0 });
  }, [rulerPath, diagonalRule]);

  const planTargetToken = planInteraction ? tokens.find((token) => token.id === planInteraction.tokenId) ?? null : null;
  const planPath = planInteraction
    ? planInteraction.hoverCell
      ? [...planInteraction.waypoints, planInteraction.hoverCell]
      : planInteraction.waypoints
    : null;
  const planBudget = planTargetToken ? movementBudgetByTokenId[planTargetToken.id] ?? null : null;
  // Velocità effettiva e strisciare (P0.8c): solo per una creatura mossa dall'Adventurer, mai per
  // un veicolo o per il Master, che restano liberi come oggi.
  const planIsAdventurerCreatureMove = !canManageTokens && Boolean(planTargetToken) && planTargetToken?.type !== 'vehicle';
  const planEffectiveSpeed =
    planIsAdventurerCreatureMove && planTargetToken
      ? effectiveSpeed(planTargetToken.movementCells ?? null, planTargetToken.conditions, planTargetToken.exhaustionLevel)
      : null;
  const planIsCrawling = Boolean(planIsAdventurerCreatureMove && planTargetToken?.conditions.includes('prone'));
  const planStepCostMultiplier = planIsCrawling ? 2 : 1;
  const planPathCost = useMemo(() => {
    if (!planPath) {
      return null;
    }
    return pathCost(planPath, {
      rule: diagonalRule,
      diagonalParity: planBudget?.diagonalParity ?? 0,
      stepCostMultiplier: planStepCostMultiplier,
    });
  }, [planPath, diagonalRule, planBudget, planStepCostMultiplier]);
  const planConditionText = planIsCrawling
    ? 'Stai strisciando: il percorso costa il doppio.'
    : planEffectiveSpeed?.reason
      ? `Velocità ridotta: ${planEffectiveSpeed.reason === 'exhaustion' ? 'Indebolimento' : conditionLabel(planEffectiveSpeed.reason as Parameters<typeof conditionLabel>[0])}.`
      : null;
  const planIsBlocked = useMemo(() => {
    if (!planPath || !planTargetToken) {
      return false;
    }
    return isPathBlocked(tokens, planTargetToken.id, getTokenFootprint(planTargetToken), planPath);
  }, [planPath, planTargetToken, tokens]);
  const planExceedsBudget =
    planBudget?.totalCells != null && planPathCost ? planBudget.usedCells + planPathCost.cells > planBudget.totalCells : false;

  // Tutto quel che va detto a parole sul gesto in corso passa di qui: il percorso disegnato usa
  // colore e icone, che da soli non raggiungono chi non li vede. La stessa riga fa da live region
  // per blocco, budget e destinazione occupata.
  const planHintText = planInteraction
    ? 'Spazio muove il token dove punti · Click su una casella aggiunge un waypoint · Click su un token lo seleziona · Backspace toglie l’ultimo · Esc o tasto destro annulla'
    : null;
  const planWarningText = !planInteraction
    ? null
    : planIsBlocked
      ? 'Percorso bloccato: un segmento attraversa un ostacolo.'
      : planExceedsBudget
        ? 'Fuori budget: il percorso supera il movimento rimasto in questo turno.'
        : hasInvalidPlanOverlap
          ? 'Destinazione occupata da un’altra creatura.'
          : null;
  const planMeasureText =
    planPathCost && planPath && planPath.length > 1
      ? // La distanza percorsa e' il numero di caselle attraversate (`steps.length`), non il costo
        // (`cells`): quando si striscia il costo raddoppia ma la distanza fisica resta la stessa,
        // altrimenti l'etichetta mostrerebbe il doppio dei metri realmente percorsi. Lo stesso vale
        // per il residuo: il budget che avanza è in unità di costo, quindi va diviso per il
        // moltiplicatore per dire quante caselle fisiche restano davvero percorribili.
        `Percorso ${formatRulerMeasurement(planPathCost.steps.length, measurementUnit)}${
          planBudget?.totalCells != null
            ? `, residuo ${formatRulerMeasurement(
                Math.floor(
                  Math.max(0, planBudget.totalCells - planBudget.usedCells - planPathCost.cells) /
                    planStepCostMultiplier,
                ),
                measurementUnit,
              )}`
            : ''
        }`
      : null;
  const toolHintText = isRulerActive
    ? 'Righello: ogni click aggiunge un waypoint, Esc chiude la misura.'
    : isPingToolActive
      ? 'Ping: un click segnala il punto a tutti i partecipanti.'
      : activeTemplateShape
        ? 'Sagoma: trascina dall’origine verso la direzione, rilascia per farla sparire.'
        : null;
  // La guida di base resta visibile anche senza selezione: un click sulla mappa vuota deseleziona,
  // ma il gesto per iniziare un movimento non cambia. Manca solo a chi non ha token da muovere.
  const canMoveAnyToken = canManageTokens || movableTokenIdSet.size > 0;
  const boardHintText = planInteraction
    ? [planConditionText, planWarningText, planHintText].filter(Boolean).join(' — ')
    : toolHintText ??
      (canMoveAnyToken
        ? 'Clicca un token che puoi muovere per pianificarne il movimento.'
        : null);

  // L'animazione di cammino è puramente visiva: segue i passi unitari del percorso a velocità
  // costante e sovrascrive la posizione mostrata finché non termina. Parte sempre dall'evento
  // token-walk, cioè da un movimento già accettato, mai dalla richiesta. Più token possono
  // camminare insieme (il proprio più quelli mossi da altri partecipanti), quindi le animazioni
  // vivono in un dizionario per tokenId dentro un ref, aggiornato da un unico loop rAF
  // permanente: le posizioni interpolate restano in stato solo per pilotare il render.
  const walkAnimationsRef = useRef<Record<string, { points: GridPosition[]; startedAt: number; duration: number }>>({});
  const [walkAnimatedPositions, setWalkAnimatedPositions] = useState<Record<string, GridPosition>>({});
  // Il binario resta visibile finché il token non arriva a destinazione, non solo durante la
  // pianificazione: per questo vive separato da planPath, con la stessa durata dell'animazione.
  const [walkTrackPaths, setWalkTrackPaths] = useState<Record<string, GridPosition[]>>({});
  const processedTokenWalkEventIdsRef = useRef<Set<string>>(new Set());

  const walkPathPoints = (waypoints: GridPosition[]): GridPosition[] => {
    const cost = pathCost(waypoints, { rule: diagonalRule });
    return [waypoints[0], ...cost.steps.map((step) => ({ x: step.x, y: step.y }))];
  };

  const startWalkAnimation = (
    tokenId: string,
    points: GridPosition[],
    { msPerCell, minDuration, maxDuration }: { msPerCell: number; minDuration: number; maxDuration: number },
    showTrack = true,
  ) => {
    if (points.length < 2) {
      return;
    }
    walkAnimationsRef.current = {
      ...walkAnimationsRef.current,
      [tokenId]: {
        points,
        startedAt: performance.now(),
        duration: Math.min(maxDuration, Math.max(minDuration, (points.length - 1) * msPerCell)),
      },
    };
    setWalkTrackPaths((current) => {
      if (showTrack) return { ...current, [tokenId]: points };
      if (!(tokenId in current)) return current;
      const next = { ...current };
      delete next[tokenId];
      return next;
    });
  };

  useEffect(() => {
    let frameId: number;
    const step = () => {
      const animations = walkAnimationsRef.current;
      const tokenIds = Object.keys(animations);

      if (tokenIds.length > 0) {
        const now = performance.now();
        const nextPositions: Record<string, GridPosition> = {};
        const stillRunning: typeof animations = {};
        const finishedTokenIds: string[] = [];

        for (const tokenId of tokenIds) {
          const animation = animations[tokenId];
          const t = Math.min(1, (now - animation.startedAt) / animation.duration);
          const segments = animation.points.length - 1;
          const scaled = t * segments;
          const index = Math.min(Math.max(segments - 1, 0), Math.floor(scaled));
          const localT = segments === 0 ? 1 : scaled - index;
          const from = animation.points[index];
          const to = animation.points[index + 1] ?? from;
          // Un'animazione conclusa esce anche dalle posizioni mostrate: il token torna a seguire la
          // posizione dello stato condiviso. Lasciarla lì bloccava il token sull'ultimo arrivo,
          // ignorando ogni aggiornamento successivo senza animazione (undo, rifiuto, mosse di gruppo).
          if (t < 1) {
            nextPositions[tokenId] = {
              x: from.x + (to.x - from.x) * localT,
              y: from.y + (to.y - from.y) * localT,
            };
            stillRunning[tokenId] = animation;
          } else {
            finishedTokenIds.push(tokenId);
          }
        }

        walkAnimationsRef.current = stillRunning;
        setWalkAnimatedPositions(nextPositions);
        if (finishedTokenIds.length > 0) {
          setWalkTrackPaths((current) => {
            const next = { ...current };
            finishedTokenIds.forEach((tokenId) => delete next[tokenId]);
            return next;
          });
        }
      }

      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // L'animazione parte solo dall'evento token-walk, che il server trasmette dopo aver accettato
  // il movimento — anche a chi lo ha richiesto. Anticiparla in locale farebbe camminare il token
  // per intero anche quando la mossa viene poi rifiutata, e il ritorno indietro sembrerebbe un
  // errore invece di un rifiuto.
  useEffect(() => {
    for (const event of tokenWalkEvents) {
      if (processedTokenWalkEventIdsRef.current.has(event.id)) {
        continue;
      }
      processedTokenWalkEventIdsRef.current.add(event.id);
      startWalkAnimation(event.tokenId, walkPathPoints(event.waypoints), WALK_PACE, event.showTrack);
    }
  }, [tokenWalkEvents]);

  const confirmPlan = (plan: PlanInteraction) => {
    // La destinazione e' la casella sotto il puntatore, non un waypoint da cliccare.
    const path = plan.hoverCell ? [...plan.waypoints, plan.hoverCell] : plan.waypoints;
    if (path.length < 2) {
      // Spazio premuto senza aver ancora scelto una casella diversa dalla partenza: la
      // pianificazione resta aperta invece di chiudersi senza spiegazione.
      return;
    }

    const destination = path[path.length - 1];
    onMoveTokens(
      plan.offsets.length > 0
        ? plan.offsets.map((offset) => ({
            tokenId: offset.tokenId,
            x: destination.x + offset.deltaX,
            y: destination.y + offset.deltaY,
          }))
        : [{ tokenId: plan.tokenId, x: destination.x, y: destination.y }],
      path,
    );
    setInteraction(null);
  };

  const addPlanWaypoint = (plan: PlanInteraction, event: ReactPointerEvent<Element>) => {
    // Il tasto destro annulla la pianificazione come `Esc`, ovunque cada (mappa, token, ostacoli),
    // senza aprire il menu radiale sul token cliccato (vedi suppressNextTokenMenuRef).
    if (event.button === 2) {
      suppressNextTokenMenuRef.current = true;
      setInteraction(null);
      return;
    }
    if (event.button !== 0) {
      return;
    }
    if (!stageRef.current) {
      return;
    }

    const cell = viewportPointToWorldCell(
      event.clientX,
      event.clientY,
      stageRef.current.getBoundingClientRect(),
      zoom,
      camera,
    );
    const waypoint = { x: cell.x - plan.grabOffset.x, y: cell.y - plan.grabOffset.y };
    const last = plan.waypoints[plan.waypoints.length - 1];
    if (last && last.x === waypoint.x && last.y === waypoint.y) {
      return;
    }

    setInteraction({ ...plan, waypoints: [...plan.waypoints, waypoint], hoverCell: waypoint });
  };

  useEffect(() => {
    if (!planInteraction) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Spazio e Backspace sono tasti di scrittura: se il fuoco è in un campo di testo la
      // pianificazione non deve intercettarli.
      const target = event.target as HTMLElement | null;
      const isTextEntry =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');

      if (event.key === 'Escape') {
        event.preventDefault();
        setInteraction(null);
        return;
      }

      if (isTextEntry) {
        return;
      }

      if (event.code === 'Backspace' && planInteraction.waypoints.length > 1) {
        event.preventDefault();
        setInteraction({ ...planInteraction, waypoints: planInteraction.waypoints.slice(0, -1) });
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        confirmPlan(planInteraction);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [planInteraction]);


  useEffect(() => {
    if (!interaction) {
      return undefined;
    }

    const completeTemplateDraw = (templateInteraction: TemplateDrawInteraction) => {
      onDrawTemplate?.({
        id: templateInteraction.templateId,
        phase: 'end',
        shape: templateInteraction.shape,
        origin: templateInteraction.origin,
        target: templateInteraction.hoverCell,
        color: templateInteraction.color,
      });
      setInteraction(null);
    };

    const completeSelectionBox = (selectionInteraction: SelectBoxInteraction) => {
      if (!stageRef.current) {
        setInteraction(null);
        return;
      }

      const rect = stageRef.current.getBoundingClientRect();
      const minX = Math.min(selectionInteraction.startX, selectionInteraction.currentX);
      const maxX = Math.max(selectionInteraction.startX, selectionInteraction.currentX);
      const minY = Math.min(selectionInteraction.startY, selectionInteraction.currentY);
      const maxY = Math.max(selectionInteraction.startY, selectionInteraction.currentY);

      const startCell = viewportPointToWorldCell(minX, minY, rect, zoom, camera);
      const endCell = viewportPointToWorldCell(maxX, maxY, rect, zoom, camera);
      const selected = tokens
        .filter((token) => {
          const footprint = getTokenFootprint(token);
          const tokenMaxX = token.position.x + footprint.width - 1;
          const tokenMaxY = token.position.y + footprint.height - 1;

          return !(
            token.position.x > endCell.x ||
            tokenMaxX < startCell.x ||
            token.position.y > endCell.y ||
            tokenMaxY < startCell.y
          );
        })
        .map((token) => token.id);

      onSelectionChange(
        selectionInteraction.additive
          ? Array.from(new Set([...selectedTokenIds, ...selected]))
          : selected,
      );
      setInteraction(null);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!stageRef.current) {
        return;
      }

      if (interaction.mode === 'obstacle-paint') {
        if (event.pointerId !== interaction.pointerId || !obstaclePlacement) {
          return;
        }

        const hoverCell = viewportPointToWorldCell(
          event.clientX,
          event.clientY,
          stageRef.current.getBoundingClientRect(),
          zoom,
          camera,
        );
        const key = cellKey(hoverCell);

        if (interaction.paintedCellKeys.includes(key)) {
          return;
        }

        obstaclePlacement.onToggleCell(hoverCell);
        setInteraction({
          ...interaction,
          paintedCellKeys: [...interaction.paintedCellKeys, key],
        });
        return;
      }

      if (interaction.mode === 'pan') {
        if (event.pointerId !== interaction.pointerId) {
          return;
        }

        const deltaX = event.clientX - interaction.startX;
        const deltaY = event.clientY - interaction.startY;
        const cellsX = Math.round(deltaX / (BOARD_CONFIG.cellSize * zoom));
        const cellsY = Math.round(deltaY / (BOARD_CONFIG.cellSize * zoom));

        setCamera(
          clampCamera({
            x: interaction.startCamera.x - cellsX,
            y: interaction.startCamera.y - cellsY,
          }),
        );
        return;
      }

      if (interaction.mode === 'pending-token') {
        if (event.pointerId !== interaction.pointerId) {
          return;
        }

        // Un token che si puo' muovere entra in pianificazione gia' al pointerdown, quindi qui
        // resta solo la selezione: trascinare non muove nulla e non conferma nulla.
        return;
      }

      if (interaction.mode === 'plan') {
        const hoverCell = viewportPointToWorldCell(
          event.clientX,
          event.clientY,
          stageRef.current.getBoundingClientRect(),
          zoom,
          camera,
        );

        setInteraction({
          ...interaction,
          hoverCell: {
            x: hoverCell.x - interaction.grabOffset.x,
            y: hoverCell.y - interaction.grabOffset.y,
          },
        });
        return;
      }

      if (interaction.mode === 'template-draw') {
        if (event.pointerId !== interaction.pointerId) {
          return;
        }

        const hoverCell = viewportPointToWorldCell(
          event.clientX,
          event.clientY,
          stageRef.current.getBoundingClientRect(),
          zoom,
          camera,
        );

        if (hoverCell.x === interaction.hoverCell.x && hoverCell.y === interaction.hoverCell.y) {
          return;
        }

        setInteraction({ ...interaction, hoverCell });
        onDrawTemplate?.({
          id: interaction.templateId,
          phase: 'update',
          shape: interaction.shape,
          origin: interaction.origin,
          target: hoverCell,
          color: interaction.color,
        });
        return;
      }

      if (event.pointerId !== interaction.pointerId) {
        return;
      }

      setInteraction({
        ...interaction,
        currentX: event.clientX,
        currentY: event.clientY,
      });
    };

    const completeInteraction = (event: PointerEvent) => {
      if (interaction.mode === 'obstacle-paint') {
        if (event.pointerId === interaction.pointerId) {
          setInteraction(null);
        }
        return;
      }

      if (interaction.mode === 'pan') {
        if (event.pointerId === interaction.pointerId) {
          setInteraction(null);
        }
        return;
      }

      if (interaction.mode === 'pending-token') {
        if (event.pointerId !== interaction.pointerId) {
          return;
        }

        if (interaction.additive) {
          onSelectionChange(
            selectedTokenIds.includes(interaction.tokenId)
              ? selectedTokenIds.filter((tokenId) => tokenId !== interaction.tokenId)
              : [...selectedTokenIds, interaction.tokenId],
          );
          setInteraction(null);
          return;
        }

        onSelectionChange(
          interaction.selectGroupOnClick ? interaction.selection : [interaction.tokenId],
        );
        setInteraction(null);
        return;
      }

      if (interaction.mode === 'plan') {
        // Il rilascio del pointer non conferma: la conferma e' solo Spazio, cosi il click resta
        // un gesto con un unico significato, aggiungere un waypoint.
        return;
      }

      if (interaction.mode === 'template-draw') {
        if (event.pointerId !== interaction.pointerId) {
          return;
        }

        completeTemplateDraw(interaction);
        return;
      }

      if (event.pointerId !== interaction.pointerId) {
        return;
      }

      const deltaX = event.clientX - interaction.startX;
      const deltaY = event.clientY - interaction.startY;

      if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) {
        if (!interaction.additive) {
          onSelectionChange([]);
        }
        setInteraction(null);
        return;
      }

      completeSelectionBox(interaction);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (interaction.mode === 'pan' || interaction.mode === 'select-box') {
          event.preventDefault();
          setInteraction(null);
          return;
        }

        if (interaction.mode === 'template-draw') {
          event.preventDefault();
          onDrawTemplate?.({
            id: interaction.templateId,
            phase: 'end',
            shape: interaction.shape,
            origin: interaction.origin,
            target: interaction.hoverCell,
            color: interaction.color,
          });
          setInteraction(null);
          setActiveTool(null);
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', completeInteraction);
    window.addEventListener('pointercancel', completeInteraction);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', completeInteraction);
      window.removeEventListener('pointercancel', completeInteraction);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [camera, interaction, obstaclePlacement, onDrawTemplate, onMoveTokens, onSelectionChange, selectedTokenIds, tokens, zoom]);

  // Righello, ping e sagome sono indipendenti dai permessi sui token: quando uno di questi
  // strumenti è attivo intercetta il click prima della selezione o del trascinamento normale,
  // sullo stesso modello già usato da lightPlacement.
  const handleMapToolPointerDown = (event: ReactPointerEvent<HTMLElement>, cell: GridPosition): boolean => {
    if (isRulerActive) {
      if (event.button !== 0) {
        return true;
      }
      event.preventDefault();
      event.stopPropagation();
      setRulerWaypoints((current) => [...current, cell]);
      return true;
    }

    if (isPingToolActive) {
      if (event.button !== 0) {
        return true;
      }
      event.preventDefault();
      event.stopPropagation();
      onPlacePing?.(cell);
      exitActiveTool();
      return true;
    }

    if (activeTemplateShape) {
      if (event.button !== 0) {
        return true;
      }
      event.preventDefault();
      event.stopPropagation();
      const templateId = crypto.randomUUID();
      const color = TEMPLATE_COLORS[activeTemplateShape];
      setInteraction({
        mode: 'template-draw',
        pointerId: event.pointerId,
        templateId,
        shape: activeTemplateShape,
        color,
        origin: cell,
        hoverCell: cell,
      });
      onDrawTemplate?.({ id: templateId, phase: 'update', shape: activeTemplateShape, origin: cell, target: cell, color });
      return true;
    }

    return false;
  };

  const handlePiecePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    token: UnitToken,
  ) => {
    // Mentre si pianifica, il pointer sulla mappa appartiene al percorso: lasciar passare il
    // trascinamento della visuale sostituirebbe l'interazione e butterebbe via i waypoint scelti.
    // I pulsanti di zoom restano comunque raggiungibili fuori dalla mappa.
    // Durante la pianificazione un click su un token lo seleziona, non aggiunge un waypoint: i
    // punti del percorso si mettono solo sulle caselle. Sul token (o gruppo) che si sta muovendo
    // non succede nulla; su un altro token la pianificazione corrente si chiude e il click
    // prosegue come selezione normale, che su un token muovibile riapre il percorso da lì.
    if (interaction?.mode === 'plan') {
      event.preventDefault();
      event.stopPropagation();
      // Il click destro su un token annulla la pianificazione come `Esc` (vedi addPlanWaypoint) e
      // non apre il menu radiale: il menu si apre solo con un altro click destro a mappa libera.
      if (event.button === 2) {
        addPlanWaypoint(interaction, event);
        return;
      }
      const isPlannedToken =
        token.id === interaction.tokenId || interaction.offsets.some((offset) => offset.tokenId === token.id);
      if (isPlannedToken) {
        return;
      }
      setInteraction(null);
    }

    if ((isRulerActive || isPingToolActive || activeTemplateShape) && stageRef.current) {
      const cell = viewportPointToWorldCell(
        event.clientX,
        event.clientY,
        stageRef.current.getBoundingClientRect(),
        zoom,
        camera,
      );
      if (handleMapToolPointerDown(event, cell)) {
        return;
      }
    }

    if (lightPlacement && stageRef.current) {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      lightPlacement.onPlace(
        viewportPointToWorldCell(
          event.clientX,
          event.clientY,
          stageRef.current.getBoundingClientRect(),
          zoom,
          camera,
        ),
      );
      return;
    }

    if (obstaclePlacement) {
      return;
    }

    if (!stageRef.current) {
      return;
    }

    if (event.button === 2) {
      const additive = canManageTokens ? event.shiftKey : false;
      onSelectionChange(
        additive
          ? selectedTokenIds.includes(token.id)
            ? selectedTokenIds
            : [...selectedTokenIds, token.id]
          : [token.id],
      );
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.ctrlKey || event.button === 1) {
      setInteraction({
        mode: 'pan',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startCamera: camera,
      });
      return;
    }

    const canMoveThisToken = canManageTokens || movableTokenIdSet.has(token.id);

    if (!canMoveThisToken) {
      const additive = event.shiftKey;
      onSelectionChange(
        additive
          ? selectedTokenIds.includes(token.id)
            ? selectedTokenIds.filter((tokenId) => tokenId !== token.id)
            : [...selectedTokenIds, token.id]
          : [token.id],
      );
      return;
    }

    const additive = canManageTokens ? event.shiftKey : false;
    const selection =
      canManageTokens && (additive || selectedTokenIds.includes(token.id))
        ? Array.from(new Set([...selectedTokenIds, token.id]))
        : [token.id];
    const anchor = token.position;
    const pointerCell = viewportPointToWorldCell(
      event.clientX,
      event.clientY,
      stageRef.current.getBoundingClientRect(),
      zoom,
      camera,
    );
    const offsets = selection
      .map((tokenId) => tokens.find((item) => item.id === tokenId))
      .filter((item): item is UnitToken => Boolean(item))
      .map((item) => ({
        tokenId: item.id,
        deltaX: item.position.x - anchor.x,
        deltaY: item.position.y - anchor.y,
      }));

    if (additive) {
      // Shift serve a comporre una selezione, non a muoverla: resta una selezione e basta.
      setInteraction({
        mode: 'pending-token',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        tokenId: token.id,
        selection,
        selectGroupOnClick: false,
        grabOffset: { x: pointerCell.x - anchor.x, y: pointerCell.y - anchor.y },
        offsets,
        additive,
      });
      return;
    }

    // Il click su un token che si puo' muovere lo seleziona e apre subito la pianificazione: da
    // qui in poi basta puntare la casella e premere Spazio, senza un ultimo click sulla
    // destinazione. Lo scostamento di presa tiene conto di dove si e' cliccato dentro un token
    // grande, cosi il pezzo non salta quando il percorso parte.
    onSelectionChange(selection);
    setInteraction({
      mode: 'plan',
      tokenId: token.id,
      waypoints: [anchor],
      hoverCell: null,
      grabOffset: { x: pointerCell.x - anchor.x, y: pointerCell.y - anchor.y },
      offsets,
    });
  };

  const handleObstacleClusterPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    cluster: ObstacleCluster,
  ) => {
    // Mentre si pianifica, il pointer sulla mappa appartiene al percorso: lasciar passare il
    // trascinamento della visuale sostituirebbe l'interazione e butterebbe via i waypoint scelti.
    // I pulsanti di zoom restano comunque raggiungibili fuori dalla mappa.
    if (interaction?.mode === 'plan') {
      event.preventDefault();
      event.stopPropagation();
      addPlanWaypoint(interaction, event);
      return;
    }

    if ((isRulerActive || isPingToolActive || activeTemplateShape) && stageRef.current) {
      const cell = viewportPointToWorldCell(
        event.clientX,
        event.clientY,
        stageRef.current.getBoundingClientRect(),
        zoom,
        camera,
      );
      if (handleMapToolPointerDown(event, cell)) {
        return;
      }
    }

    if (lightPlacement && stageRef.current) {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      lightPlacement.onPlace(
        viewportPointToWorldCell(
          event.clientX,
          event.clientY,
          stageRef.current.getBoundingClientRect(),
          zoom,
          camera,
        ),
      );
      return;
    }

    if (obstaclePlacement || !stageRef.current) {
      return;
    }

    if (event.button === 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.ctrlKey || event.button === 1) {
      setInteraction({
        mode: 'pan',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startCamera: camera,
      });
      return;
    }

    const anchorToken = tokens.find((token) => token.id === cluster.anchorTokenId);
    if (!anchorToken) {
      return;
    }

    const canMoveCluster = canManageTokens || cluster.tokenIds.some((tokenId) => movableTokenIdSet.has(tokenId));
    if (!canMoveCluster) {
      onSelectionChange(cluster.tokenIds);
      return;
    }

    const additive = canManageTokens ? event.shiftKey : false;
    const isClusterSelected = cluster.tokenIds.some((tokenId) => selectedTokenIds.includes(tokenId));
    const selection =
      canManageTokens && (additive || isClusterSelected)
        ? Array.from(new Set([...selectedTokenIds, ...cluster.tokenIds]))
        : cluster.tokenIds;
    const pointerCell = viewportPointToWorldCell(
      event.clientX,
      event.clientY,
      stageRef.current.getBoundingClientRect(),
      zoom,
      camera,
    );

    const grabOffset = {
      x: pointerCell.x - anchorToken.position.x,
      y: pointerCell.y - anchorToken.position.y,
    };
    const offsets = selection
      .map((tokenId) => tokens.find((item) => item.id === tokenId))
      .filter((item): item is UnitToken => Boolean(item))
      .map((item) => ({
        tokenId: item.id,
        deltaX: item.position.x - anchorToken.position.x,
        deltaY: item.position.y - anchorToken.position.y,
      }));

    if (additive) {
      setInteraction({
        mode: 'pending-token',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        tokenId: anchorToken.id,
        selection,
        selectGroupOnClick: true,
        grabOffset,
        offsets,
        additive,
      });
      return;
    }

    // Un cluster di ostacoli si sposta con lo stesso gesto di un token: click per aprire il
    // percorso, Spazio per portarlo dove punta il cursore.
    onSelectionChange(selection);
    setInteraction({
      mode: 'plan',
      tokenId: anchorToken.id,
      waypoints: [anchorToken.position],
      hoverCell: null,
      grabOffset,
      offsets,
    });
  };

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Mentre si pianifica, il pointer sulla mappa appartiene al percorso: lasciar passare il
    // trascinamento della visuale sostituirebbe l'interazione e butterebbe via i waypoint scelti.
    // I pulsanti di zoom restano comunque raggiungibili fuori dalla mappa.
    if (interaction?.mode === 'plan') {
      event.preventDefault();
      event.stopPropagation();
      addPlanWaypoint(interaction, event);
      return;
    }

    if ((isRulerActive || isPingToolActive || activeTemplateShape) && stageRef.current) {
      const cell = viewportPointToWorldCell(
        event.clientX,
        event.clientY,
        stageRef.current.getBoundingClientRect(),
        zoom,
        camera,
      );
      if (handleMapToolPointerDown(event, cell)) {
        return;
      }
    }

    if (lightPlacement && stageRef.current) {
      if (event.button !== 0) {
        return;
      }

      const cell = viewportPointToWorldCell(
        event.clientX,
        event.clientY,
        stageRef.current.getBoundingClientRect(),
        zoom,
        camera,
      );
      lightPlacement.onPlace(cell);
      return;
    }

    if (event.target !== event.currentTarget) {
      return;
    }

    if (obstaclePlacement && stageRef.current) {
      if (event.button !== 0) {
        return;
      }

      const cell = viewportPointToWorldCell(
        event.clientX,
        event.clientY,
        stageRef.current.getBoundingClientRect(),
        zoom,
        camera,
      );
      obstaclePlacement.onToggleCell(cell);
      setInteraction({
        mode: 'obstacle-paint',
        pointerId: event.pointerId,
        paintedCellKeys: [cellKey(cell)],
      });
      return;
    }

    if (event.ctrlKey || event.button === 1) {
      event.preventDefault();
      setInteraction({
        mode: 'pan',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startCamera: camera,
      });
      return;
    }

    if (event.button !== 0) {
      return;
    }

    setInteraction({
      mode: 'select-box',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      additive: event.shiftKey,
    });
  };

  const handleBoardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!stageRef.current) {
      return;
    }

    if (isRulerActive) {
      setRulerHoverCell(
        viewportPointToWorldCell(
          event.clientX,
          event.clientY,
          stageRef.current.getBoundingClientRect(),
          zoom,
          camera,
        ),
      );
      return;
    }

    if (!lightPlacement) {
      return;
    }

    setLightPreviewCell(
      viewportPointToWorldCell(
        event.clientX,
        event.clientY,
        stageRef.current.getBoundingClientRect(),
        zoom,
        camera,
      ),
    );
  };

  const topLabels = Array.from({ length: viewportCells.columns }, (_, index) => camera.x + index);
  const leftLabels = Array.from({ length: viewportCells.rows }, (_, index) => camera.y + index);
  const orderedTokens = useMemo(() => {
    const hiddenOccupantIds = new Set(
      tokens
        .filter((token) => token.type === 'vehicle' && token.showVehicleOccupants === false)
        .flatMap((token) => token.vehicleOccupantIds ?? []),
    );

    const baseTokens = [...tokens]
      .filter((token) => !hiddenOccupantIds.has(token.id) && !obstacleTokenIdSet.has(token.id))
      .sort((left, right) => {
      const leftContained = left.containedInVehicleId ? 1 : 0;
      const rightContained = right.containedInVehicleId ? 1 : 0;
      if (leftContained !== rightContained) {
        return leftContained - rightContained;
      }

      return 0;
      });

    return baseTokens;
  }, [obstacleTokenIdSet, tokens]);

  return (
    <section className={`board-panel ${isFullscreen ? 'board-panel--fullscreen' : ''}`}>
      <div className="board-panel__header">
        <div>
          <h2 className="board-title">
            <span className="board-title__campaign">Gli ammazza-keebler</span>
            <span className="board-title__aside">(di ghigno)</span>
          </h2>
        </div>
        <div className="board-actions">
          <button type="button" onClick={onToggleFullscreen}>
            {isFullscreen ? <><CollapseIcon /> Chiudi full screen</> : <><ExpandIcon /> Full screen</>}
          </button>
          <button type="button" onClick={onOpenElementsListModal}>
            <SearchIcon /> Elementi in mappa
          </button>
          <button type="button" onClick={onOpenMap}>
            <MapIcon /> Averno
          </button>
          <button type="button" onClick={onOpenManual}>
            <BookIcon /> Manuale
          </button>
        </div>
      </div>

      <div
        ref={shellRef}
        className={`board-shell ${isBackgroundHidden ? 'board-shell--hidden-map' : ''}`}
        onContextMenuCapture={(event) => {
          // Il pointerdown ha già chiuso il piano quando arriva `contextmenu`; il ref conserva
          // l'origine del gesto fino al pointerdown seguente. La cattura precede anche i menu
          // contestuali di token e ostacoli.
          if (planInteraction || suppressNextTokenMenuRef.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <div className="board-zoom-controls">
          <button
            type="button"
            className="board-zoom-button"
            onClick={() => onZoomChange(clampZoom(zoom - BOARD_CONFIG.zoomStep))}
            aria-label="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            className="board-zoom-button"
            onClick={() => onZoomChange(clampZoom(zoom + BOARD_CONFIG.zoomStep))}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
        <div className="board-tool-controls" role="group" aria-label="Strumenti di mappa">
          <button
            type="button"
            className="board-tool-button"
            aria-pressed={isRulerActive}
            onClick={() => (isRulerActive ? exitActiveTool() : setActiveTool('ruler'))}
            title="Righello: misura una distanza senza spostare token (R)"
            aria-label="Righello, misura una distanza senza spostare token. Scorciatoia R"
          >
            <RulerIcon />
          </button>
          <button
            type="button"
            className="board-tool-button"
            aria-pressed={isPingToolActive}
            onClick={() => (isPingToolActive ? exitActiveTool() : setActiveTool('ping'))}
            title="Ping: segnala un punto della mappa a tutti (P)"
            aria-label="Ping, segnala un punto della mappa a tutti. Scorciatoia P"
          >
            <PingIcon />
          </button>
          <button
            type="button"
            className="board-tool-button"
            aria-pressed={activeTemplateShape === 'circle'}
            onClick={() => (activeTemplateShape === 'circle' ? exitActiveTool() : setActiveTool('template-circle'))}
            title="Sagoma cerchio (C)"
            aria-label="Sagoma cerchio. Scorciatoia C"
          >
            <CircleTemplateIcon />
          </button>
          <button
            type="button"
            className="board-tool-button"
            aria-pressed={activeTemplateShape === 'cone'}
            onClick={() => (activeTemplateShape === 'cone' ? exitActiveTool() : setActiveTool('template-cone'))}
            title="Sagoma cono (O)"
            aria-label="Sagoma cono. Scorciatoia O"
          >
            <ConeTemplateIcon />
          </button>
          <button
            type="button"
            className="board-tool-button"
            aria-pressed={activeTemplateShape === 'line'}
            onClick={() => (activeTemplateShape === 'line' ? exitActiveTool() : setActiveTool('template-line'))}
            title="Sagoma linea (L)"
            aria-label="Sagoma linea. Scorciatoia L"
          >
            <LineTemplateIcon />
          </button>
          {activeTool ? (
            <button
              type="button"
              className="board-tool-button board-tool-button--exit"
              onClick={exitActiveTool}
              title="Esci dallo strumento (Esc)"
              aria-label="Esci dallo strumento attivo. Scorciatoia Esc"
            >
              <CloseIcon size="0.9em" />
            </button>
          ) : null}
          {/* La guida dei gesti sta accanto agli strumenti. Distanza e residuo sono già scritti
              sul percorso, quindi a video la guida li omette; restano nella stessa live region,
              nascosti alla vista, perché le etichette del percorso non vengono annunciate. */}
          <p className="board-hint board-hint--guide" role="status" aria-live="polite">
            {planMeasureText && planInteraction ? <span className="visually-hidden">{planMeasureText} — </span> : null}
            {boardHintText ?? ''}
          </p>
        </div>
        <div className="board-hint-bar">
          {movementNotice ? (
            <p className="board-hint board-hint--rejected" role="alert">
              <BlockIcon />
              {movementNotice.message}
              <button
                type="button"
                className="board-hint__dismiss"
                onClick={() => onDismissMovementNotice?.()}
                aria-label="Chiudi l'avviso di movimento rifiutato"
              >
                <CloseIcon size="0.9em" />
              </button>
            </p>
          ) : null}
        </div>
        <div className="board-corner" aria-hidden="true" />
        <div className="board-axis board-axis--top" aria-hidden="true">
          {topLabels.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="board-axis__cell"
              style={{ width: BOARD_CONFIG.cellSize * zoom }}
            >
              {Math.max(1, value + 1)}
            </span>
          ))}
        </div>
        <div className="board-axis board-axis--left" aria-hidden="true">
          {leftLabels.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="board-axis__cell"
              style={{ height: BOARD_CONFIG.cellSize * zoom }}
            >
              {gridRowToLabel(value)}
            </span>
          ))}
        </div>

        <div
          className="board-stage-wrap"
          style={{
            left: BOARD_GUTTER,
            top: BOARD_GUTTER,
          }}
        >
          <div
            ref={stageRef}
            className="board-stage board-stage--virtual"
            style={{
              width,
              height,
              backgroundSize: `${BOARD_CONFIG.cellSize * zoom}px ${BOARD_CONFIG.cellSize * zoom}px`,
            }}
            onPointerDown={handleBoardPointerDown}
            onPointerMove={handleBoardPointerMove}
            onPointerLeave={() => setLightPreviewCell(null)}
          >
            {planInteraction && planEndCell ? (
              <div
                className={`board-highlight ${
                  hasInvalidPlanOverlap || planIsBlocked || planExceedsBudget ? 'board-highlight--invalid' : ''
                }`}
                style={{
                  width: getTokenFootprint(planTargetToken ?? ({ size: 'medium' } as UnitToken)).width *
                    BOARD_CONFIG.cellSize * zoom,
                  height: getTokenFootprint(planTargetToken ?? ({ size: 'medium' } as UnitToken)).height *
                    BOARD_CONFIG.cellSize * zoom,
                  transform: `translate(${(planEndCell.x - camera.x) * BOARD_CONFIG.cellSize * zoom}px, ${
                    (planEndCell.y - camera.y) * BOARD_CONFIG.cellSize * zoom
                  }px)`,
                }}
              />
            ) : null}

            {obstaclePlacement?.selectedCells.map((cell) => (
              <div
                key={`obstacle-placement-${cell.x}-${cell.y}`}
                className="board-highlight"
                style={{
                  width: BOARD_CONFIG.cellSize * zoom,
                  height: BOARD_CONFIG.cellSize * zoom,
                  background: obstaclePlacement.color,
                  opacity: 0.45,
                  transform: `translate(${(cell.x - camera.x) * BOARD_CONFIG.cellSize * zoom}px, ${
                    (cell.y - camera.y) * BOARD_CONFIG.cellSize * zoom
                  }px)`,
                }}
              />
            ))}

            {effectiveVision ? (
              <svg
                className="board-darkness-layer"
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                aria-hidden="true"
              >
                <defs>
                  <mask id={`vision-mask-${isFullscreen ? 'fullscreen' : 'main'}`}>
                    <rect width={width} height={height} fill="white" />
                    {visionPolygonPath ? <polygon points={visionPolygonPath} fill="black" /> : null}
                    {visionPolygonPath ? (
                      <polygon
                        points={visionPolygonPath}
                        fill="none"
                        stroke="black"
                        strokeWidth={BOARD_CONFIG.cellSize * zoom * 1.25}
                        strokeLinejoin="round"
                      />
                    ) : null}
                    {lightPolygonPaths.map((light) => (
                      <polygon key={`mask-light-${light.id}`} points={light.path} fill="black" />
                    ))}
                    {lightPolygonPaths.map((light) => (
                      <polygon
                        key={`mask-light-soft-${light.id}`}
                        points={light.path}
                        fill="none"
                        stroke="black"
                        strokeWidth={BOARD_CONFIG.cellSize * zoom * 1.25}
                        strokeLinejoin="round"
                      />
                    ))}
                    {visibleTokenMaskRects.map((rect) => (
                      <rect
                        key={`mask-token-${rect.id}`}
                        x={rect.x}
                        y={rect.y}
                        width={rect.width}
                        height={rect.height}
                        fill="black"
                      />
                    ))}
                  </mask>
                  <radialGradient id={`vision-warmth-${isFullscreen ? 'fullscreen' : 'main'}`}>
                    <stop offset="0%" stopColor="rgba(255, 181, 102, 0.18)" />
                    <stop offset="60%" stopColor="rgba(255, 181, 102, 0.06)" />
                    <stop offset="100%" stopColor="rgba(255, 181, 102, 0)" />
                  </radialGradient>
                </defs>
                <rect
                  width={width}
                  height={height}
                  className="board-darkness-layer__shade"
                  mask={`url(#vision-mask-${isFullscreen ? 'fullscreen' : 'main'})`}
                />
                {visionPolygonPath ? <polygon points={visionPolygonPath} className="board-darkness-layer__edge" /> : null}
                {visionScreenCenter && effectiveVision ? (
                  <circle
                    cx={visionScreenCenter.x}
                    cy={visionScreenCenter.y}
                    r={Math.max(BOARD_CONFIG.cellSize * zoom, effectiveVision.radiusCells * BOARD_CONFIG.cellSize * zoom)}
                    fill={`url(#vision-warmth-${isFullscreen ? 'fullscreen' : 'main'})`}
                  />
                ) : null}
                {lightPolygonPaths.map((light) => (
                  <polygon key={`light-edge-${light.id}`} points={light.path} className="board-light-layer__edge" />
                ))}
              </svg>
            ) : null}

            {canManageTokens && (lightPolygonPaths.length > 0 || lightPreviewPolygonPath) ? (
              <svg
                className="board-light-preview-layer"
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                aria-hidden="true"
              >
                {lightPolygonPaths.map((light) => (
                  <polygon key={`placed-light-${light.id}`} points={light.path} className="board-light-preview-layer__placed" />
                ))}
                {lightPreviewPolygonPath ? (
                  <polygon points={lightPreviewPolygonPath} className="board-light-preview-layer__candidate" />
                ) : null}
              </svg>
            ) : null}

            {auraRects.length > 0 ? (
              <svg
                className="board-aura-layer"
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                aria-hidden="true"
              >
                <g className="board-aura-layer__fills">
                  {auraRects.map((aura) => (
                    <rect
                      key={`aura-fill-${aura.id}`}
                      className="board-aura-layer__fill"
                      x={aura.x}
                      y={aura.y}
                      width={aura.width}
                      height={aura.height}
                      style={{ '--aura-color': aura.color } as CSSProperties}
                    />
                  ))}
                </g>
                {auraRects.map((aura) => (
                  <rect
                    key={`aura-border-${aura.id}`}
                    className="board-aura-layer__border"
                    x={aura.x}
                    y={aura.y}
                    width={aura.width}
                    height={aura.height}
                    style={{ '--aura-color': aura.color } as CSSProperties}
                  />
                ))}
              </svg>
            ) : null}

            {orderedTokens.map((token) => {
              const walkingPosition = walkAnimatedPositions[token.id];
              const isWalking = walkingPosition !== undefined;
              const worldPosition = isWalking ? walkingPosition : token.position;
              const footprint = getTokenFootprint(token);
              const isSelected = selectedTokenIds.includes(token.id);

              return (
                <Token
                  key={token.id}
                  token={token}
                  tokens={tokens}
                  isSelected={isSelected}
                  isDragging={isWalking}
                  isGhost={canManageTokens && token.isInvisible === true}
                  displayPosition={{
                    x: worldPosition.x - camera.x,
                    y: worldPosition.y - camera.y,
                  }}
                  footprint={footprint}
                  zoom={zoom}
                  canEdit={canManageTokens || editableTokenIdSet.has(token.id)}
                  mapInteractionActive={Boolean(interaction)}
                  onPointerDown={handlePiecePointerDown}
                  onOpenMenu={(tokenId) => {
                    if (interaction) {
                      return;
                    }
                    // Lo stesso click destro che ha appena annullato una pianificazione non apre
                    // anche il menu: il suo `contextmenu` arriva quando l'interazione è già chiusa.
                    if (suppressNextTokenMenuRef.current) {
                      suppressNextTokenMenuRef.current = false;
                      return;
                    }
                    setRadialMenuTokenId(tokenId);
                  }}
                />
              );
            })}

            {radialMenuTokenId
              ? (() => {
                  const menuToken = tokens.find((candidate) => candidate.id === radialMenuTokenId);
                  if (!menuToken) {
                    return null;
                  }
                  const canEditMenuToken = canManageTokens || editableTokenIdSet.has(menuToken.id);
                  if (!canEditMenuToken) {
                    return null;
                  }
                  const menuFootprint = getTokenFootprint(menuToken);
                  const menuPixelPosition = gridToPixels({
                    x: menuToken.position.x - camera.x,
                    y: menuToken.position.y - camera.y,
                  });
                  const screenPosition = {
                    x: (menuPixelPosition.x + (menuFootprint.width * BOARD_CONFIG.cellSize) / 2) * zoom,
                    y: (menuPixelPosition.y + (menuFootprint.height * BOARD_CONFIG.cellSize) / 2) * zoom,
                  };

                  return (
                    <TokenRadialMenu
                      key={menuToken.id}
                      token={menuToken}
                      screenPosition={screenPosition}
                      tokenRadius={
                        (Math.max(menuFootprint.width, menuFootprint.height) * BOARD_CONFIG.cellSize * zoom) / 2
                      }
                      onClose={() => {
                        setRadialMenuTokenId(null);
                        const tokenButton = stageRef.current?.querySelector<HTMLButtonElement>(
                          `[data-token-id="${menuToken.id}"]`,
                        );
                        tokenButton?.focus();
                      }}
                      onToggleCondition={(condition) => {
                        const hasCondition = menuToken.conditions.includes(condition);
                        onApplyTokenCondition?.(
                          menuToken.id,
                          hasCondition ? { type: 'remove', condition } : { type: 'add', condition },
                        );
                      }}
                      onSetExhaustion={(level) => {
                        onApplyTokenCondition?.(menuToken.id, { type: 'set-exhaustion', level });
                      }}
                      onStandUp={() => onStandUpToken?.(menuToken.id)}
                      showDash={!canManageTokens && editableTokenIdSet.has(menuToken.id) && menuToken.type === 'player' && Boolean(onDashToken)}
                      canDash={canDashTokenIds?.has(menuToken.id) ?? false}
                      dashUsed={dashUsedByTokenId?.[menuToken.id] === true}
                      dashUnavailableReason={dashUnavailableReason}
                      onDash={() => onDashToken?.(menuToken.id)}
                      onToggleAura={(auraId, active) => onSetTokenAuraActive?.(menuToken.id, auraId, active)}
                    />
                  );
                })()
              : null}

            {obstacleClusters.map((cluster) => {
              const displayCells = cluster.tokenIds
                .map((tokenId) => {
                  const token = tokens.find((item) => item.id === tokenId);
                  const position = token?.position;
                  return position ?? null;
                })
                .filter((cell): cell is GridPosition => Boolean(cell));

              if (displayCells.length === 0) {
                return null;
              }

              const minX = Math.min(...displayCells.map((cell) => cell.x));
              const minY = Math.min(...displayCells.map((cell) => cell.y));
              const maxX = Math.max(...displayCells.map((cell) => cell.x));
              const maxY = Math.max(...displayCells.map((cell) => cell.y));
              const clusterCellKeySet = new Set(displayCells.map((cell) => cellKey(cell)));

              return (
                <button
                  key={cluster.id}
                  type="button"
                  className={`obstacle-cluster ${selectedTokenIds.some((id) => cluster.tokenIds.includes(id)) ? 'obstacle-cluster--selected' : ''}`}
                  style={{
                    width: (maxX - minX + 1) * BOARD_CONFIG.cellSize * zoom,
                    height: (maxY - minY + 1) * BOARD_CONFIG.cellSize * zoom,
                    left: (minX - camera.x) * BOARD_CONFIG.cellSize * zoom,
                    top: (minY - camera.y) * BOARD_CONFIG.cellSize * zoom,
                    '--obstacle-color': cluster.color,
                  } as CSSProperties}
                  onPointerDown={(event) => handleObstacleClusterPointerDown(event, cluster)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (canManageTokens) {
                      onSelectionChange(cluster.tokenIds);
                      onOpenEditTokenModal(cluster.anchorTokenId);
                    }
                  }}
                >
                  {displayCells.map((cell) => (
                    <span
                      key={`${cluster.id}-${cell.x}-${cell.y}`}
                      className="obstacle-cluster__cell"
                      style={{
                        width: BOARD_CONFIG.cellSize * zoom,
                        height: BOARD_CONFIG.cellSize * zoom,
                        left: (cell.x - minX) * BOARD_CONFIG.cellSize * zoom,
                        top: (cell.y - minY) * BOARD_CONFIG.cellSize * zoom,
                        borderTop: clusterCellKeySet.has(cellKey({ x: cell.x, y: cell.y - 1 }))
                          ? '0'
                          : '2px solid rgba(255, 245, 236, 0.34)',
                        borderRight: clusterCellKeySet.has(cellKey({ x: cell.x + 1, y: cell.y }))
                          ? '0'
                          : '2px solid rgba(255, 245, 236, 0.34)',
                        borderBottom: clusterCellKeySet.has(cellKey({ x: cell.x, y: cell.y + 1 }))
                          ? '0'
                          : '2px solid rgba(255, 245, 236, 0.34)',
                        borderLeft: clusterCellKeySet.has(cellKey({ x: cell.x - 1, y: cell.y }))
                          ? '0'
                          : '2px solid rgba(255, 245, 236, 0.34)',
                      }}
                    />
                  ))}
                  <span className="obstacle-cluster__label">{cluster.name}</span>
                </button>
              );
            })}

            {canManageTokens ? (
              lightSources.map((light) => (
                <button
                  key={light.id}
                  type="button"
                  className="board-light-source"
                  style={{
                    transform: `translate(${(light.position.x - camera.x) * BOARD_CONFIG.cellSize * zoom}px, ${
                      (light.position.y - camera.y) * BOARD_CONFIG.cellSize * zoom
                    }px)`,
                    width: BOARD_CONFIG.cellSize * zoom,
                    height: BOARD_CONFIG.cellSize * zoom,
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemoveLightSource?.(light.id);
                  }}
                  title={`Rimuovi luce raggio ${light.radiusCells} caselle`}
                  aria-label={`Rimuovi luce raggio ${light.radiusCells} caselle`}
                >
                  <SparkIcon />
                </button>
              ))
            ) : null}

            {interaction?.mode === 'select-box' ? (
              <div
                className="board-selection-box"
                style={{
                  left: Math.min(interaction.startX, interaction.currentX) - (stageRef.current?.getBoundingClientRect().left ?? 0),
                  top: Math.min(interaction.startY, interaction.currentY) - (stageRef.current?.getBoundingClientRect().top ?? 0),
                  width: Math.abs(interaction.currentX - interaction.startX),
                  height: Math.abs(interaction.currentY - interaction.startY),
                }}
              />
            ) : null}

            {planPath || rulerPath ? (
              <svg
                className="board-path-layer"
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                aria-hidden="true"
              >
                {(() => {
                  const path = (planPath ?? rulerPath) as GridPosition[];
                  const cost = planPath ? planPathCost : rulerPathCost;
                  const points = path.map((cell) => ({
                    x: (cell.x - camera.x + 0.5) * BOARD_CONFIG.cellSize * zoom,
                    y: (cell.y - camera.y + 0.5) * BOARD_CONFIG.cellSize * zoom,
                  }));
                  const isWarning = planPath ? planIsBlocked || planExceedsBudget : false;
                  const tip = points[points.length - 1];
                  const residualCells =
                    planPath && planBudget?.totalCells != null && cost
                      ? // Il residuo e' in caselle fisiche, non in unita' di costo: vedi la stessa
                        // nota su `planMeasureText`.
                        Math.floor(
                          Math.max(0, planBudget.totalCells - planBudget.usedCells - cost.cells) /
                            planStepCostMultiplier,
                        )
                      : null;

                  const variantClass = planPath ? 'board-path-layer__line--plan' : 'board-path-layer__line--ruler';
                  // Il costo di ogni segmento sta accanto al segmento stesso: su un percorso
                  // spezzato il solo totale non dice quale tratto è costato quanto.
                  const perSegment =
                    points.length > 2
                      ? segmentCosts(
                          path,
                          diagonalRule,
                          planPath ? planBudget?.diagonalParity ?? 0 : 0,
                          planPath ? planStepCostMultiplier : 1,
                        )
                      : [];

                  return (
                    <>
                      <polyline
                        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                        className={`board-path-layer__line ${isWarning ? 'board-path-layer__line--warning' : variantClass}`}
                      />
                      {points.map((point, index) => (
                        <circle
                          key={`path-point-${index}`}
                          cx={point.x}
                          cy={point.y}
                          r={5}
                          className={`board-path-layer__waypoint ${isWarning ? 'board-path-layer__waypoint--warning' : planPath ? 'board-path-layer__waypoint--plan' : 'board-path-layer__waypoint--ruler'}`}
                        />
                      ))}
                      {perSegment.map((segmentCells, index) => (
                        <text
                          key={`path-segment-${index}`}
                          x={(points[index].x + points[index + 1].x) / 2}
                          y={(points[index].y + points[index + 1].y) / 2 - 6}
                          textAnchor="middle"
                          className="board-path-layer__label board-path-layer__label--segment"
                        >
                          {segmentCells}
                        </text>
                      ))}
                      {tip && cost ? (
                        <>
                          <text x={tip.x} y={tip.y - 16} textAnchor="middle" className="board-path-layer__label">
                            {planIsBlocked
                              ? 'Percorso bloccato'
                              : planExceedsBudget
                                ? 'Fuori budget'
                                : // Distanza fisica (caselle attraversate), non il costo: vedi la
                                  // stessa nota su `planMeasureText`.
                                  formatRulerMeasurement(cost.steps.length, measurementUnit)}
                          </text>
                          {residualCells !== null && !isWarning ? (
                            <text x={tip.x} y={tip.y - 34} textAnchor="middle" className="board-path-layer__label board-path-layer__label--secondary">
                              residuo {formatRulerMeasurement(residualCells, measurementUnit)}
                            </text>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  );
                })()}
              </svg>
            ) : null}

            {Object.keys(walkTrackPaths).length > 0 ? (
              <svg
                className="board-path-layer"
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                aria-hidden="true"
              >
                {Object.entries(walkTrackPaths).map(([tokenId, track]) => {
                  const points = track.map((cell) => ({
                    x: (cell.x - camera.x + 0.5) * BOARD_CONFIG.cellSize * zoom,
                    y: (cell.y - camera.y + 0.5) * BOARD_CONFIG.cellSize * zoom,
                  }));

                  return (
                    <g key={`walk-track-${tokenId}`}>
                      <polyline
                        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                        className="board-path-layer__line board-path-layer__line--plan"
                      />
                      {points.map((point, index) => (
                        <circle
                          key={`walk-track-${tokenId}-${index}`}
                          cx={point.x}
                          cy={point.y}
                          r={4}
                          className="board-path-layer__waypoint board-path-layer__waypoint--plan"
                        />
                      ))}
                    </g>
                  );
                })}
              </svg>
            ) : null}

            {ephemeralTemplates.length > 0 ? (
              <svg
                className="board-template-layer"
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                aria-hidden="true"
              >
                {ephemeralTemplates.map((template) => {
                  const originPx = {
                    x: (template.origin.x - camera.x + 0.5) * BOARD_CONFIG.cellSize * zoom,
                    y: (template.origin.y - camera.y + 0.5) * BOARD_CONFIG.cellSize * zoom,
                  };
                  const sizeCells = pathCost([template.origin, template.target], { rule: diagonalRule }).cells;
                  const sizePx = Math.max(1, sizeCells) * BOARD_CONFIG.cellSize * zoom;
                  const angle = Math.atan2(template.target.y - template.origin.y, template.target.x - template.origin.x);
                  const labelPoint = {
                    x: originPx.x + Math.cos(angle) * sizePx,
                    y: originPx.y + Math.sin(angle) * sizePx,
                  };
                  const label = (
                    <text
                      key={`${template.id}-label`}
                      x={labelPoint.x}
                      y={labelPoint.y - 10}
                      textAnchor="middle"
                      className="board-template-layer__label"
                    >
                      {formatRulerMeasurement(sizeCells, measurementUnit)}
                    </text>
                  );
                  // Il centro della sagoma e' segnato sempre, per tutte e tre le forme: e' il
                  // punto da cui si misura ogni effetto, e su un cerchio ampio o su un cono
                  // riempito di colore non si distingue dal resto dell'area.
                  const cellPx = BOARD_CONFIG.cellSize * zoom;
                  const originMarker = (
                    <g key={`${template.id}-origin`}>
                      <rect
                        x={originPx.x - cellPx / 2}
                        y={originPx.y - cellPx / 2}
                        width={cellPx}
                        height={cellPx}
                        className="board-template-layer__origin-cell"
                      />
                      <line
                        x1={originPx.x - cellPx * 0.3}
                        y1={originPx.y}
                        x2={originPx.x + cellPx * 0.3}
                        y2={originPx.y}
                        className="board-template-layer__origin-tick"
                      />
                      <line
                        x1={originPx.x}
                        y1={originPx.y - cellPx * 0.3}
                        x2={originPx.x}
                        y2={originPx.y + cellPx * 0.3}
                        className="board-template-layer__origin-tick"
                      />
                      <circle
                        cx={originPx.x}
                        cy={originPx.y}
                        r={Math.max(3, cellPx * 0.11)}
                        className="board-template-layer__origin-dot"
                      />
                    </g>
                  );

                  if (template.shape === 'circle') {
                    return (
                      <g key={template.id}>
                        <circle
                          cx={originPx.x}
                          cy={originPx.y}
                          r={sizePx}
                          className="board-template-layer__shape"
                          style={{ '--template-color': template.color } as CSSProperties}
                        />
                        {originMarker}
                        {label}
                      </g>
                    );
                  }

                  if (template.shape === 'line') {
                    const endPx = { x: originPx.x + Math.cos(angle) * sizePx, y: originPx.y + Math.sin(angle) * sizePx };
                    return (
                      <g key={template.id}>
                        <line
                          x1={originPx.x}
                          y1={originPx.y}
                          x2={endPx.x}
                          y2={endPx.y}
                          strokeWidth={BOARD_CONFIG.cellSize * zoom}
                          className="board-template-layer__shape board-template-layer__shape--line"
                          style={{ '--template-color': template.color } as CSSProperties}
                        />
                        {originMarker}
                        {label}
                      </g>
                    );
                  }

                  const leftAngle = angle - Math.PI / 4;
                  const rightAngle = angle + Math.PI / 4;
                  const leftPoint = { x: originPx.x + Math.cos(leftAngle) * sizePx, y: originPx.y + Math.sin(leftAngle) * sizePx };
                  const rightPoint = { x: originPx.x + Math.cos(rightAngle) * sizePx, y: originPx.y + Math.sin(rightAngle) * sizePx };
                  return (
                    <g key={template.id}>
                      <polygon
                        points={`${originPx.x},${originPx.y} ${leftPoint.x},${leftPoint.y} ${rightPoint.x},${rightPoint.y}`}
                        className="board-template-layer__shape"
                        style={{ '--template-color': template.color } as CSSProperties}
                      />
                      {originMarker}
                      {label}
                    </g>
                  );
                })}
              </svg>
            ) : null}

            {ephemeralPings.map((ping) => (
              <div
                key={ping.id}
                className="board-ping"
                style={{
                  transform: `translate(${(ping.position.x - camera.x + 0.5) * BOARD_CONFIG.cellSize * zoom}px, ${
                    (ping.position.y - camera.y + 0.5) * BOARD_CONFIG.cellSize * zoom
                  }px)`,
                }}
              >
                <span className="board-ping__marker" aria-hidden="true" />
                <span className="board-ping__label">{ping.authorName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
