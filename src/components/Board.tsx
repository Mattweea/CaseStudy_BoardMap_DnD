import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { BOARD_CONFIG } from '../constants/board';
import type { GridPosition, LightSource, UnitToken } from '../types';
import {
  boardPixelSize,
  clampZoom,
  getTokenFootprint,
  gridRowToLabel,
  viewportPointToWorldCell,
} from '../utils/board';
import { buildVisionPolygon, buildVisionPolygonFromPoint } from '../utils/vision';
import { Token } from './Token';

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
  onToggleFullscreen: () => void;
  onMoveTokens: (moves: Array<{ tokenId: string; x: number; y: number }>) => void;
  onSelectionChange: (tokenIds: string[]) => void;
  onZoomChange: (zoom: number) => void;
  obstaclePlacement?: {
    color: string;
    selectedCells: GridPosition[];
    onToggleCell: (cell: GridPosition) => void;
    onConfirm: () => void;
    onCancel: () => void;
  } | null;
}

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

type DragInteraction = {
  mode: 'drag';
  pointerId: number;
  anchorTokenId: string;
  hoverCell: GridPosition;
  grabOffset: GridPosition;
  offsets: Array<{ tokenId: string; deltaX: number; deltaY: number }>;
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
  | DragInteraction
  | SelectBoxInteraction
  | ObstaclePaintInteraction;

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
  onToggleFullscreen,
  onMoveTokens,
  onSelectionChange,
  onZoomChange,
  obstaclePlacement = null,
}: BoardProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [lightPreviewCell, setLightPreviewCell] = useState<GridPosition | null>(null);
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

  const draggedPositions = useMemo(() => {
    if (interaction?.mode !== 'drag') {
      return new Map<string, GridPosition>();
    }

    return new Map(
      interaction.offsets.map((offset) => [
        offset.tokenId,
        {
          x: interaction.hoverCell.x + offset.deltaX,
          y: interaction.hoverCell.y + offset.deltaY,
        },
      ]),
    );
  }, [interaction]);
  const auraCircles = useMemo(
    () =>
      tokens.flatMap((token) => {
        if (
          (token.type !== 'player' && token.type !== 'enemy') ||
          token.containedInVehicleId ||
          !token.auras?.some((aura) => aura.isVisible)
        ) {
          return [];
        }

        const position = draggedPositions.get(token.id) ?? token.position;
        const footprint = getTokenFootprint(token);
        return token.auras.flatMap((aura) => aura.isVisible ? [{
          id: `${token.id}-${aura.id}`,
          color: aura.color,
          cx: (position.x + footprint.width / 2 - camera.x) * BOARD_CONFIG.cellSize * zoom,
          cy: (position.y + footprint.height / 2 - camera.y) * BOARD_CONFIG.cellSize * zoom,
          r: Math.max(0, Math.floor(aura.radiusCells)) * BOARD_CONFIG.cellSize * zoom,
        }] : []);
      }),
    [camera.x, camera.y, draggedPositions, tokens, zoom],
  );
  const visibleTokenMaskRects = useMemo(() => {
    if (!effectiveVision) {
      return [];
    }

    return tokens.filter((token) => token.type === 'player').map((token) => {
      const position = draggedPositions.get(token.id) ?? token.position;
      const footprint = getTokenFootprint(token);

      return {
        id: token.id,
        x: (position.x - camera.x) * BOARD_CONFIG.cellSize * zoom,
        y: (position.y - camera.y) * BOARD_CONFIG.cellSize * zoom,
        width: footprint.width * BOARD_CONFIG.cellSize * zoom,
        height: footprint.height * BOARD_CONFIG.cellSize * zoom,
      };
    });
  }, [camera.x, camera.y, draggedPositions, effectiveVision, tokens, zoom]);

  const hasInvalidDragOverlap = useMemo(() => {
    if (interaction?.mode !== 'drag') {
      return false;
    }

    const simulatedTokens = tokens.map((token) => {
      const draggedPosition = draggedPositions.get(token.id);
      return draggedPosition ? { ...token, position: draggedPosition } : token;
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
  }, [draggedPositions, interaction, tokens]);

  useEffect(() => {
    if (!interaction) {
      return undefined;
    }

    const completeDrag = (dragInteraction: DragInteraction) => {
      onMoveTokens(
        dragInteraction.offsets.map((offset) => ({
          tokenId: offset.tokenId,
          x: dragInteraction.hoverCell.x + offset.deltaX,
          y: dragInteraction.hoverCell.y + offset.deltaY,
        })),
      );
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

        const deltaX = event.clientX - interaction.startX;
        const deltaY = event.clientY - interaction.startY;

        if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) {
          return;
        }

        const hoverCell = viewportPointToWorldCell(
          event.clientX,
          event.clientY,
          stageRef.current.getBoundingClientRect(),
          zoom,
          camera,
        );

        setInteraction({
          mode: 'drag',
          pointerId: interaction.pointerId,
          anchorTokenId: interaction.tokenId,
          hoverCell: {
            x: hoverCell.x - interaction.grabOffset.x,
            y: hoverCell.y - interaction.grabOffset.y,
          },
          grabOffset: interaction.grabOffset,
          offsets: interaction.offsets,
        });
        return;
      }

      if (interaction.mode === 'drag') {
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

        setInteraction({
          ...interaction,
          hoverCell: {
            x: hoverCell.x - interaction.grabOffset.x,
            y: hoverCell.y - interaction.grabOffset.y,
          },
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
        } else {
          onSelectionChange(
            interaction.selectGroupOnClick
              ? interaction.selection
              : selectedTokenIds.includes(interaction.tokenId)
              ? selectedTokenIds.filter((tokenId) => tokenId !== interaction.tokenId)
              : [interaction.tokenId],
          );
        }
        setInteraction(null);
        return;
      }

      if (interaction.mode === 'drag') {
        if (event.pointerId !== interaction.pointerId) {
          return;
        }

        completeDrag(interaction);
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

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', completeInteraction);
    window.addEventListener('pointercancel', completeInteraction);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', completeInteraction);
      window.removeEventListener('pointercancel', completeInteraction);
    };
  }, [camera, interaction, obstaclePlacement, onMoveTokens, onSelectionChange, selectedTokenIds, tokens, zoom]);

  const handlePiecePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    token: UnitToken,
  ) => {
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

    setInteraction({
      mode: 'pending-token',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      tokenId: token.id,
      selection,
      selectGroupOnClick: false,
      grabOffset: {
        x: pointerCell.x - token.position.x,
        y: pointerCell.y - token.position.y,
      },
      offsets: selection
        .map((tokenId) => tokens.find((item) => item.id === tokenId))
        .filter((item): item is UnitToken => Boolean(item))
        .map((item) => ({
          tokenId: item.id,
          deltaX: item.position.x - anchor.x,
          deltaY: item.position.y - anchor.y,
        })),
      additive,
    });
  };

  const handleObstacleClusterPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    cluster: ObstacleCluster,
  ) => {
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

    setInteraction({
      mode: 'pending-token',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      tokenId: anchorToken.id,
      selection,
      selectGroupOnClick: true,
      grabOffset: {
        x: pointerCell.x - anchorToken.position.x,
        y: pointerCell.y - anchorToken.position.y,
      },
      offsets: selection
        .map((tokenId) => tokens.find((item) => item.id === tokenId))
        .filter((item): item is UnitToken => Boolean(item))
        .map((item) => ({
          tokenId: item.id,
          deltaX: item.position.x - anchorToken.position.x,
          deltaY: item.position.y - anchorToken.position.y,
        })),
      additive,
    });
  };

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
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
    if (!lightPlacement || !stageRef.current) {
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
          <p className="eyebrow">Interactive board</p>
          <h2 className="board-title">
            <span className="board-title__campaign">Gli ammazza-keebler</span>
            <span className="board-title__aside">(di ghigno)</span>
          </h2>
        </div>
        <div className="board-actions">
          <button type="button" onClick={onToggleFullscreen}>
            🤓 {isFullscreen ? 'Chiudi full screen' : 'Full screen'}
          </button>
          <button type="button" onClick={onOpenElementsListModal}>
            🔎 Elementi in mappa
          </button>
          <button type="button" onClick={onOpenMap}>
            🗺️ Averno
          </button>
          <button type="button" onClick={onOpenManual}>
            📖 Manuale
          </button>
        </div>
      </div>

      <div ref={shellRef} className={`board-shell ${isBackgroundHidden ? 'board-shell--hidden-map' : ''}`}>
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
            {interaction?.mode === 'drag' ? (
              <div
                className={`board-highlight ${hasInvalidDragOverlap ? 'board-highlight--invalid' : ''}`}
                style={{
                  width: getTokenFootprint(tokens.find((item) => item.id === interaction.anchorTokenId) ?? {
                    size: 'medium',
                  } as UnitToken).width * BOARD_CONFIG.cellSize * zoom,
                  height: getTokenFootprint(tokens.find((item) => item.id === interaction.anchorTokenId) ?? {
                    size: 'medium',
                  } as UnitToken).height * BOARD_CONFIG.cellSize * zoom,
                  transform: `translate(${(interaction.hoverCell.x - camera.x) * BOARD_CONFIG.cellSize * zoom}px, ${
                    (interaction.hoverCell.y - camera.y) * BOARD_CONFIG.cellSize * zoom
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

            {auraCircles.length > 0 ? (
              <svg
                className="board-aura-layer"
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                aria-hidden="true"
              >
                {auraCircles.map((aura) => (
                  <circle
                    key={`aura-${aura.id}`}
                    className="board-aura-layer__circle"
                    cx={aura.cx}
                    cy={aura.cy}
                    r={aura.r}
                    style={{ '--aura-color': aura.color } as CSSProperties}
                  />
                ))}
              </svg>
            ) : null}

            {orderedTokens.map((token) => {
              const worldPosition = draggedPositions.get(token.id) ?? token.position;
              const footprint = getTokenFootprint(token);
              const isSelected = selectedTokenIds.includes(token.id);

              return (
                <Token
                  key={token.id}
                  token={token}
                  tokens={tokens}
                  isSelected={isSelected}
                  isDragging={draggedPositions.has(token.id)}
                  isGhost={canManageTokens && token.isInvisible === true}
                  displayPosition={{
                    x: worldPosition.x - camera.x,
                    y: worldPosition.y - camera.y,
                  }}
                  footprint={footprint}
                  zoom={zoom}
                  canEdit={canManageTokens || editableTokenIdSet.has(token.id)}
                  onPointerDown={handlePiecePointerDown}
                  onEdit={onOpenEditTokenModal}
                />
              );
            })}

            {obstacleClusters.map((cluster) => {
              const displayCells = cluster.tokenIds
                .map((tokenId) => {
                  const token = tokens.find((item) => item.id === tokenId);
                  const position = draggedPositions.get(tokenId) ?? token?.position;
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
                  ✦
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
          </div>
        </div>
      </div>
    </section>
  );
}
