import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent } from 'react';
import { BOARD_CONFIG } from '../constants/board';
import type { GridPosition, UnitToken } from '../types';
import {
  boardPixelSize,
  clampZoom,
  getTokenFootprint,
  gridRowToLabel,
  sizeToCells,
  viewportPointToWorldCell,
} from '../utils/board';
import { Token } from './Token';

interface BoardProps {
  tokens: UnitToken[];
  zoom: number;
  selectedTokenIds: string[];
  focusRequest: { tokenId: string; nonce: number } | null;
  isFullscreen?: boolean;
  onOpenManual: () => void;
  onOpenNewElementModal: () => void;
  onOpenElementsListModal: () => void;
  onOpenEditTokenModal: (tokenId: string) => void;
  onToggleFullscreen: () => void;
  onMoveTokens: (moves: Array<{ tokenId: string; x: number; y: number }>) => void;
  onSelectionChange: (tokenIds: string[]) => void;
  onZoomChange: (zoom: number) => void;
}

const INITIAL_CAMERA = { x: 0, y: 0 };
const BOARD_GUTTER = 30;
const DRAG_THRESHOLD = 6;

function clampCamera(position: GridPosition): GridPosition {
  return {
    x: Math.max(0, position.x),
    y: Math.max(0, position.y),
  };
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

type InteractionState = PanInteraction | PendingTokenInteraction | DragInteraction | SelectBoxInteraction;

export function Board({
  tokens,
  zoom,
  selectedTokenIds,
  focusRequest,
  isFullscreen = false,
  onOpenManual,
  onOpenNewElementModal,
  onOpenElementsListModal,
  onOpenEditTokenModal,
  onToggleFullscreen,
  onMoveTokens,
  onSelectionChange,
  onZoomChange,
}: BoardProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [camera, setCamera] = useState<GridPosition>(INITIAL_CAMERA);
  const [viewportCells, setViewportCells] = useState<{ columns: number; rows: number }>({
    columns: BOARD_CONFIG.minVisibleColumns,
    rows: BOARD_CONFIG.minVisibleRows,
  });

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
            selectedTokenIds.includes(interaction.tokenId)
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
  }, [camera, interaction, onMoveTokens, onSelectionChange, selectedTokenIds, tokens, zoom]);

  const handlePiecePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    token: UnitToken,
  ) => {
    if (!stageRef.current) {
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

    const additive = event.shiftKey;
    const selection =
      additive || selectedTokenIds.includes(token.id)
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

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
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

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? BOARD_CONFIG.zoomStep : -BOARD_CONFIG.zoomStep;
    onZoomChange(clampZoom(zoom + delta));
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
      .filter((token) => !hiddenOccupantIds.has(token.id))
      .sort((left, right) => {
      const leftContained = left.containedInVehicleId ? 1 : 0;
      const rightContained = right.containedInVehicleId ? 1 : 0;
      if (leftContained !== rightContained) {
        return leftContained - rightContained;
      }

      return 0;
      });

    return baseTokens;
  }, [tokens]);

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
          <button type="button" onClick={onOpenNewElementModal}>
            ➕ Nuovo elemento
          </button>
          <button type="button" onClick={onOpenElementsListModal}>
            🔎 Elementi in mappa
          </button>
          <button type="button" onClick={onOpenManual}>
            📖 Manuale
          </button>
        </div>
      </div>

      <div className="board-panel__header board-panel__header--subtle">
        <p className="board-panel__hint">
          Click per selezionare/deselezionare, Shift+click per multiselezione, trascina per muovere i selezionati. Trascina sullo sfondo per una selezione ad area.
        </p>
      </div>

      <div ref={shellRef} className="board-shell" onWheel={handleWheel}>
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
          >
            {interaction?.mode === 'drag' ? (
              <div
                className="board-highlight"
                style={{
                  width: sizeToCells(tokens.find((item) => item.id === interaction.anchorTokenId)?.size ?? 'medium') * BOARD_CONFIG.cellSize * zoom,
                  height: sizeToCells(tokens.find((item) => item.id === interaction.anchorTokenId)?.size ?? 'medium') * BOARD_CONFIG.cellSize * zoom,
                  transform: `translate(${(interaction.hoverCell.x - camera.x) * BOARD_CONFIG.cellSize * zoom}px, ${
                    (interaction.hoverCell.y - camera.y) * BOARD_CONFIG.cellSize * zoom
                  }px)`,
                }}
              />
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
                  displayPosition={{
                    x: worldPosition.x - camera.x,
                    y: worldPosition.y - camera.y,
                  }}
                  footprint={footprint}
                  zoom={zoom}
                  onPointerDown={handlePiecePointerDown}
                  onEdit={onOpenEditTokenModal}
                />
              );
            })}

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
