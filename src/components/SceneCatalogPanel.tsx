import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { BoardDimensions, SceneDrawing } from '../types';
import { useSceneCatalog } from '../hooks/useSceneCatalog';
import { sceneBackgroundUrl } from '../utils/sceneApi';

const DEFAULT_CALIBRATION = { scale: 1, offsetX: 0, offsetY: 0 };
const CELL_SIZE = 48;
const ERASER_RADIUS_CELLS = 0.35;
type DrawingPoint = SceneDrawing['points'][number];
type DrawingGesture = { mode: 'pencil'; pointerId: number; points: DrawingPoint[] }
  | { mode: 'eraser'; pointerId: number; points: DrawingPoint[]; ids: string[] };

function distanceToSegment(point: DrawingPoint, start: DrawingPoint, end: DrawingPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const factor = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - start.x - factor * dx, point.y - start.y - factor * dy);
}

function touchedDrawingIds(point: DrawingPoint, drawings: SceneDrawing[]) {
  return drawings.filter((drawing) => drawing.points.some((current, index) =>
    distanceToSegment(point, drawing.points[Math.max(0, index - 1)], current)
      <= ERASER_RADIUS_CELLS + drawing.widthCells / 2)).map((drawing) => drawing.id);
}

function touchedAlongGesture(start: DrawingPoint, end: DrawingPoint, drawings: SceneDrawing[]) {
  const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 0.2));
  const ids = new Set<string>();
  for (let index = 1; index <= steps; index += 1) {
    const point = { x: start.x + (end.x - start.x) * index / steps, y: start.y + (end.y - start.y) * index / steps };
    touchedDrawingIds(point, drawings).forEach((id) => ids.add(id));
  }
  return [...ids];
}

function sceneCalibration(scene: ReturnType<typeof useSceneCatalog>['selectedScene']) {
  return scene?.document.background.kind === 'image'
    ? {
        scale: scene.document.background.scale,
        offsetX: scene.document.background.offsetX,
        offsetY: scene.document.background.offsetY,
      }
    : DEFAULT_CALIBRATION;
}

interface SceneCatalogPanelProps {
  isActiveSceneBackgroundHidden: boolean;
  onActiveSceneBackgroundVisibilityChange: (hidden: boolean) => Promise<void>;
}

export function SceneCatalogPanel({
  isActiveSceneBackgroundHidden,
  onActiveSceneBackgroundVisibilityChange,
}: SceneCatalogPanelProps) {
  const {
    catalog,
    selectedScene,
    isLoading,
    isMutating,
    error,
    reload,
    selectScene,
    createScene,
    updateScene,
    addDrawing,
    eraseDrawings,
    undoDrawing,
    redoDrawing,
  } = useSceneCatalog(true);
  const [newName, setNewName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [backgroundDraft, setBackgroundDraft] = useState<File | 'blank' | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [calibrationDraft, setCalibrationDraft] = useState(DEFAULT_CALIBRATION);
  const [previewImageSize, setPreviewImageSize] = useState<{ width: number; height: number } | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [previewSpace, setPreviewSpace] = useState({ width: 0, height: 0 });
  const [isChangingVisibility, setIsChangingVisibility] = useState(false);
  const [boardDimensionsDraft, setBoardDimensionsDraft] = useState({ columns: '', rows: '' });
  const [dimensionsError, setDimensionsError] = useState<string | null>(null);
  const [drawingTool, setDrawingTool] = useState<'pencil' | 'eraser' | null>(null);
  const [drawingColor, setDrawingColor] = useState('#f36f3d');
  const [drawingWidth, setDrawingWidth] = useState(0.12);
  const [drawingGesture, setDrawingGesture] = useState<DrawingGesture | null>(null);
  const drawingGestureRef = useRef<DrawingGesture | null>(null);
  const [pendingDrawing, setPendingDrawing] = useState<SceneDrawing | null>(null);
  const [pendingEraseIds, setPendingEraseIds] = useState<string[]>([]);
  const [eraserPreviewPoint, setEraserPreviewPoint] = useState<DrawingPoint | null>(null);

  useEffect(() => {
    setNameDraft(selectedScene?.name ?? '');
    setBackgroundDraft(null);
    setCalibrationDraft(sceneCalibration(selectedScene));
    setDimensionsError(null);
  }, [selectedScene]);

  useEffect(() => {
    drawingGestureRef.current = null;
    setDrawingGesture(null);
    setPendingDrawing(null);
    setPendingEraseIds([]);
    setEraserPreviewPoint(null);
  }, [selectedScene?.id]);

  useEffect(() => {
    if (!drawingGesture) return undefined;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      drawingGestureRef.current = null;
      setDrawingGesture(null);
    };
    window.addEventListener('keydown', cancelOnEscape, true);
    return () => window.removeEventListener('keydown', cancelOnEscape, true);
  }, [drawingGesture]);

  useEffect(() => {
    const dimensions = selectedScene?.document.board.dimensions;
    if (dimensions) setBoardDimensionsDraft({ columns: String(dimensions.columns), rows: String(dimensions.rows) });
  }, [selectedScene]);

  useEffect(() => {
    if (!(backgroundDraft instanceof File)) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(backgroundDraft);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [backgroundDraft]);

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (await createScene(newName)) setNewName('');
  };

  const submitUpdate = async (event: FormEvent) => {
    event.preventDefault();
    const dimensions = parseBoardDimensions(boardDimensionsDraft);
    if (!dimensions) {
      setDimensionsError('Inserisci dimensioni intere positive oppure 0 × 0 per una board illimitata.');
      return;
    }
    setDimensionsError(null);
    const hasImage = backgroundDraft instanceof File
      || (backgroundDraft !== 'blank' && selectedScene?.document.background.kind === 'image');
    if (await updateScene(nameDraft, backgroundDraft, hasImage ? calibrationDraft : null, dimensions)) {
      setBackgroundDraft(null);
    }
  };

  const persistedCalibration = sceneCalibration(selectedScene);
  const calibrationChanged = calibrationDraft.scale !== persistedCalibration.scale
    || calibrationDraft.offsetX !== persistedCalibration.offsetX
    || calibrationDraft.offsetY !== persistedCalibration.offsetY;
  const imageSource = previewUrl ?? (backgroundDraft === 'blank' || !selectedScene
    ? null
    : sceneBackgroundUrl(selectedScene));
  const hasImage = backgroundDraft instanceof File
    || (backgroundDraft !== 'blank' && selectedScene?.document.background.kind === 'image');
  const hasDraftChanges = selectedScene !== null && (
    nameDraft.trim() !== selectedScene.name
    || backgroundDraft !== null
    || (hasImage && calibrationChanged)
    || boardDimensionsDraft.columns !== String(selectedScene.document.board.dimensions.columns)
    || boardDimensionsDraft.rows !== String(selectedScene.document.board.dimensions.rows)
  );
  const requestedDimensions = parseBoardDimensions(boardDimensionsDraft);
  const previewBoard = requestedDimensions ?? selectedScene?.document.board.dimensions ?? { columns: 30, rows: 30 };
  const isPreviewUnlimited = previewBoard.columns === 0 && previewBoard.rows === 0;
  const previewColumns = isPreviewUnlimited ? 30 : previewBoard.columns;
  const previewRows = isPreviewUnlimited ? 20 : previewBoard.rows;
  const boardLeft = 0;
  const boardTop = 0;
  const boardRight = previewColumns * 48;
  const boardBottom = previewRows * 48;
  const imageLeft = previewImageSize ? calibrationDraft.offsetX : 0;
  const imageTop = previewImageSize ? calibrationDraft.offsetY : 0;
  const imageRight = previewImageSize
    ? calibrationDraft.offsetX + previewImageSize.width * calibrationDraft.scale
    : boardRight;
  const imageBottom = previewImageSize
    ? calibrationDraft.offsetY + previewImageSize.height * calibrationDraft.scale
    : boardBottom;
  const previewLeft = Math.min(boardLeft, imageLeft);
  const previewTop = Math.min(boardTop, imageTop);
  const previewRight = Math.max(boardRight, imageRight);
  const previewBottom = Math.max(boardBottom, imageBottom);
  const previewWidth = Math.max(48, previewRight - previewLeft);
  const previewHeight = Math.max(48, previewBottom - previewTop);
  const previewScale = previewSpace.width > 0 && previewSpace.height > 0
    ? Math.min(previewSpace.width / previewWidth, previewSpace.height / previewHeight)
    : 0;
  const previewCellSize = 48 * previewScale;
  const drawingEnabled = Boolean(selectedScene && drawingTool && previewScale > 0 && !hasDraftChanges && !isMutating && !isLoading);
  const historyEnabled = Boolean(selectedScene && !hasDraftChanges && !isMutating && !isLoading && !drawingGesture);
  const canUndoDrawing = historyEnabled && Boolean(selectedScene?.drawingHistory?.canUndo);
  const canRedoDrawing = historyEnabled && Boolean(selectedScene?.drawingHistory?.canRedo);
  const previewPointFromPointer = (event: ReactPointerEvent<HTMLDivElement>): DrawingPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / previewScale + previewLeft) / CELL_SIZE;
    const y = ((event.clientY - rect.top) / previewScale + previewTop) / CELL_SIZE;
    return {
      x: Math.round(Math.max(0, Math.min(previewColumns, x)) * 100) / 100,
      y: Math.round(Math.max(0, Math.min(previewRows, y)) * 100) / 100,
    };
  };
  const pointInsideBoard = (point: DrawingPoint) => point.x >= 0 && point.y >= 0
    && point.x <= previewColumns && point.y <= previewRows;
  const drawingPath = (points: DrawingPoint[]) => points.map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${point.x * CELL_SIZE - previewLeft} ${point.y * CELL_SIZE - previewTop}`).join(' ')
    + (points.length === 1 ? ' l 0.001 0' : '');
  const setGesture = (gesture: DrawingGesture | null) => {
    drawingGestureRef.current = gesture;
    setDrawingGesture(gesture);
  };
  const handleDrawingPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawingEnabled || !drawingTool || event.button !== 0 || drawingGestureRef.current) return;
    const rawX = ((event.clientX - event.currentTarget.getBoundingClientRect().left) / previewScale + previewLeft) / CELL_SIZE;
    const rawY = ((event.clientY - event.currentTarget.getBoundingClientRect().top) / previewScale + previewTop) / CELL_SIZE;
    if (!pointInsideBoard({ x: rawX, y: rawY })) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = previewPointFromPointer(event);
    setGesture(drawingTool === 'pencil'
      ? { mode: 'pencil', pointerId: event.pointerId, points: [point] }
      : { mode: 'eraser', pointerId: event.pointerId, points: [point], ids: touchedDrawingIds(point, selectedScene?.document.drawings ?? []) });
  };
  const handleDrawingPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawingTool) return;
    const point = previewPointFromPointer(event);
    if (drawingTool === 'eraser') setEraserPreviewPoint(point);
    const current = drawingGestureRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const lastPoint = current.points[current.points.length - 1];
    if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 0.04) return;
    if (current.points.length >= 20000) return;
    if (current.mode === 'pencil') setGesture({ ...current, points: [...current.points, point] });
    else {
      const touched = touchedAlongGesture(lastPoint, point, selectedScene?.document.drawings ?? []);
      setGesture({ ...current, points: [...current.points, point], ids: [...new Set([...current.ids, ...touched])] });
    }
  };
  const handleDrawingPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drawingGestureRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setGesture(null);
    const finalPoint = previewPointFromPointer(event);
    const lastPoint = current.points[current.points.length - 1];
    const moved = Math.hypot(finalPoint.x - lastPoint.x, finalPoint.y - lastPoint.y) >= 0.04;
    if (current.mode === 'pencil') {
      const points = moved && current.points.length < 20000 ? [...current.points, finalPoint] : current.points;
      const drawing: SceneDrawing = { id: crypto.randomUUID(), points, color: drawingColor, widthCells: drawingWidth };
      setPendingDrawing(drawing);
      void addDrawing(drawing).finally(() => setPendingDrawing(null));
    } else {
      const ids = moved
        ? [...new Set([...current.ids, ...touchedAlongGesture(lastPoint, finalPoint, selectedScene?.document.drawings ?? [])])]
        : current.ids;
      if (ids.length === 0) return;
      setPendingEraseIds(ids);
      void eraseDrawings(ids).finally(() => setPendingEraseIds([]));
    }
  };

  const changeActiveBackgroundVisibility = async () => {
    if (!selectedScene?.isActive || hasDraftChanges) return;
    const sceneId = selectedScene.id;
    setIsChangingVisibility(true);
    try {
      await onActiveSceneBackgroundVisibilityChange(!isActiveSceneBackgroundHidden);
      await selectScene(sceneId);
    } finally {
      setIsChangingVisibility(false);
    }
  };

  useEffect(() => {
    setPreviewImageSize(null);
  }, [imageSource]);

  useEffect(() => {
    const node = previewFrameRef.current;
    if (!node) return undefined;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setPreviewSpace({ width: rect.width, height: rect.height });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [selectedScene?.id]);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!panelRef.current?.closest('.modal-card--scene-catalog[data-state="open"]')) return;
      if ((!event.ctrlKey && !event.metaKey) || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return;
      const key = event.key.toLowerCase();
      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
      if (!isUndo && !isRedo) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isUndo && canUndoDrawing) void undoDrawing();
      if (isRedo && canRedoDrawing) void redoDrawing();
    };
    window.addEventListener('keydown', handleHistoryShortcut, true);
    return () => window.removeEventListener('keydown', handleHistoryShortcut, true);
  }, [canUndoDrawing, canRedoDrawing, undoDrawing, redoDrawing]);

  return (
    <section className="scene-catalog" ref={panelRef} aria-label="Catalogo e preparazione delle scene">
      <aside className="scene-catalog__rail" aria-labelledby="scene-catalog-list-heading">
        <div className="scene-catalog__rail-heading">
          <div>
            <p className="scene-catalog__eyebrow">Archivio del Master</p>
            <h3 id="scene-catalog-list-heading">Catalogo</h3>
          </div>
          <button type="button" className="scene-catalog__refresh" onClick={() => void reload()} disabled={isLoading || isMutating}>
            Aggiorna
          </button>
        </div>

        <form className="scene-catalog__create" onSubmit={(event) => void submitCreate(event)}>
          <label htmlFor="new-scene-name">Nuova scena</label>
          <div className="scene-catalog__inline-form">
            <input
              id="new-scene-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Es. Cripta sommersa"
              maxLength={120}
              disabled={isMutating}
            />
            <button type="submit" className="primary-button" disabled={isMutating || newName.trim().length === 0}>
              Crea
            </button>
          </div>
        </form>

        {error ? <p className="scene-catalog__error" role="alert">{error}</p> : null}
        {isLoading ? <p className="scene-catalog__status" role="status">Caricamento scene...</p> : null}

        {!isLoading && catalog.length === 0 ? (
          <p className="scene-catalog__empty">Crea la prima scena per iniziare a preparare la campagna.</p>
        ) : (
          <ul className="scene-catalog__list" aria-label="Catalogo scene">
            {catalog.map((scene) => (
              <li key={scene.id}>
                <button
                  type="button"
                  className={selectedScene?.id === scene.id ? 'scene-catalog__item scene-catalog__item--selected' : 'scene-catalog__item'}
                  aria-pressed={selectedScene?.id === scene.id}
                  onClick={() => void selectScene(scene.id)}
                  disabled={isLoading || isMutating}
                >
                  <span>{scene.name}</span>
                  <small>{scene.isActive ? 'Attiva' : `v${scene.version}`}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="scene-catalog__workspace">
        {selectedScene ? (
          <form className="scene-catalog__detail" onSubmit={(event) => void submitUpdate(event)}>
            <div className="scene-catalog__detail-heading">
              <div>
                <p>Scena selezionata</p>
                <strong>{selectedScene.name}</strong>
              </div>
              <span>Versione {selectedScene.version}</span>
            </div>
            <label htmlFor="scene-name-draft">Nome della scena</label>
            <input
              id="scene-name-draft"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              maxLength={120}
              disabled={isMutating}
            />
            <fieldset className="scene-catalog__background">
              <legend>Sfondo e allineamento</legend>
              <div className="scene-catalog__calibration-preview-frame">
                <div className="scene-catalog__calibration-preview-viewport" ref={previewFrameRef}>
                  <div
                    className="scene-catalog__calibration-preview"
                    style={{
                      width: previewWidth * previewScale,
                      height: previewHeight * previewScale,
                      visibility: previewScale > 0 ? 'visible' : 'hidden',
                    }}
                  >
                    {imageSource ? (
                      <img
                        src={imageSource}
                        alt="Anteprima dello sfondo calibrato rispetto alla griglia"
                        onLoad={(event) => setPreviewImageSize({
                          width: event.currentTarget.naturalWidth,
                          height: event.currentTarget.naturalHeight,
                        })}
                        style={{
                          left: `${(imageLeft - previewLeft) / previewWidth * 100}%`,
                          top: `${(imageTop - previewTop) / previewHeight * 100}%`,
                          width: previewImageSize
                            ? `${previewImageSize.width * calibrationDraft.scale / previewWidth * 100}%`
                            : 'auto',
                          height: previewImageSize
                            ? `${previewImageSize.height * calibrationDraft.scale / previewHeight * 100}%`
                            : 'auto',
                        }}
                      />
                    ) : <span className="scene-catalog__blank-preview-label">Board bianca</span>}
                    <span
                      className="scene-catalog__grid-overlay"
                      aria-hidden="true"
                      style={{
                        backgroundSize: `${previewCellSize}px ${previewCellSize}px`,
                        backgroundPosition: `${-previewLeft * previewScale}px ${-previewTop * previewScale}px`,
                      }}
                    />
                    {!isPreviewUnlimited ? (
                      <span
                        className="scene-catalog__board-boundary"
                        aria-hidden="true"
                        style={{
                          left: `${(boardLeft - previewLeft) / previewWidth * 100}%`,
                          top: `${(boardTop - previewTop) / previewHeight * 100}%`,
                          width: `${(boardRight - boardLeft) / previewWidth * 100}%`,
                          height: `${(boardBottom - boardTop) / previewHeight * 100}%`,
                        }}
                      />
                    ) : null}
                    <svg className="scene-catalog__drawing-layer" width={previewWidth * previewScale} height={previewHeight * previewScale}
                      viewBox={`0 0 ${previewWidth} ${previewHeight}`} aria-hidden="true">
                      {selectedScene.document.drawings.filter((drawing) => !pendingEraseIds.includes(drawing.id) && !(drawingGesture?.mode === 'eraser' && drawingGesture.ids.includes(drawing.id))).map((drawing) => (
                        <path key={drawing.id} d={drawingPath(drawing.points)} fill="none" stroke={drawing.color}
                          strokeWidth={drawing.widthCells * CELL_SIZE} strokeLinecap="round" strokeLinejoin="round" />
                      ))}
                      {pendingDrawing && !selectedScene.document.drawings.some((drawing) => drawing.id === pendingDrawing.id) ? <path d={drawingPath(pendingDrawing.points)} fill="none" stroke={pendingDrawing.color}
                        strokeWidth={pendingDrawing.widthCells * CELL_SIZE} strokeLinecap="round" strokeLinejoin="round" /> : null}
                      {drawingGesture?.mode === 'pencil' ? <path d={drawingPath(drawingGesture.points)} fill="none" stroke={drawingColor}
                        strokeWidth={drawingWidth * CELL_SIZE} strokeLinecap="round" strokeLinejoin="round" opacity="0.8" /> : null}
                      {drawingTool === 'eraser' && eraserPreviewPoint ? <circle
                        cx={eraserPreviewPoint.x * CELL_SIZE - previewLeft} cy={eraserPreviewPoint.y * CELL_SIZE - previewTop}
                        r={ERASER_RADIUS_CELLS * CELL_SIZE} fill="rgba(255,255,255,.23)" stroke="#9d3729"
                        strokeWidth={2 / previewScale} strokeDasharray={`${4 / previewScale} ${3 / previewScale}`} /> : null}
                    </svg>
                    {drawingEnabled ? <div className="scene-catalog__drawing-capture" role="presentation"
                      onPointerDown={handleDrawingPointerDown} onPointerMove={handleDrawingPointerMove}
                      onPointerUp={handleDrawingPointerUp} onPointerCancel={() => { setGesture(null); setEraserPreviewPoint(null); }}
                      onPointerLeave={() => { if (!drawingGestureRef.current) setEraserPreviewPoint(null); }} /> : null}
                  </div>
                </div>
                <div className="scene-catalog__drawing-tools" role="group" aria-label="Disegno della scena">
                  <button type="button" className="scene-catalog__drawing-tool" aria-pressed={drawingTool === 'pencil'}
                    disabled={isLoading || isMutating || hasDraftChanges} onClick={() => setDrawingTool(drawingTool === 'pencil' ? null : 'pencil')}>✎ <span>Matita</span></button>
                  <button type="button" className="scene-catalog__drawing-tool" aria-pressed={drawingTool === 'eraser'}
                    disabled={isLoading || isMutating || hasDraftChanges} onClick={() => setDrawingTool(drawingTool === 'eraser' ? null : 'eraser')}>⌫ <span>Gomma</span></button>
                  <div className="scene-catalog__history-tools" role="group" aria-label="Cronologia disegni della scena">
                    <button type="button" className="scene-catalog__drawing-tool" disabled={!canUndoDrawing}
                      title="Annulla l’ultima operazione di disegno (Ctrl+Z)" aria-label="Annulla disegno, Ctrl+Z"
                      onClick={() => void undoDrawing()}>↶ <span>Annulla</span></button>
                    <button type="button" className="scene-catalog__drawing-tool" disabled={!canRedoDrawing}
                      title="Ripeti l’ultima operazione di disegno (Ctrl+Maiusc+Z)" aria-label="Ripeti disegno, Ctrl+Maiusc+Z"
                      onClick={() => void redoDrawing()}>↷ <span>Ripeti</span></button>
                  </div>
                  {drawingTool === 'pencil' ? <div className="scene-catalog__brush-settings" role="group" aria-label="Impostazioni matita">
                    <label className="scene-catalog__brush-size">Spessore
                      <span className="scene-catalog__brush-preview" aria-hidden="true"><span style={{ width: Math.max(4, drawingWidth * CELL_SIZE), height: Math.max(4, drawingWidth * CELL_SIZE), backgroundColor: drawingColor }} /></span>
                      <input type="range" min="0.05" max="0.5" step="0.01" value={drawingWidth}
                        onChange={(event) => setDrawingWidth(Number(event.target.value))} disabled={isMutating || hasDraftChanges}
                        aria-label="Spessore pennello" aria-valuetext={`${Math.round(drawingWidth * 100)}% di una casella`}
                        style={{ '--brush-thumb-size': `${Math.max(14, drawingWidth * CELL_SIZE)}px`, '--brush-color': drawingColor } as CSSProperties} />
                      <output>{Math.round(drawingWidth * 100)}%</output>
                    </label>
                    <label className="scene-catalog__brush-color">Colore
                      <span className="scene-catalog__brush-swatch" style={{ backgroundColor: drawingColor }} aria-hidden="true" />
                      <input type="color" value={drawingColor} onChange={(event) => setDrawingColor(event.target.value)}
                        disabled={isMutating || hasDraftChanges} aria-label="Colore matita" />
                    </label>
                  </div> : null}
                </div>
                <small className="scene-catalog__drawing-hint" role="status">{hasDraftChanges
                  ? 'Salva o annulla le modifiche alla scena prima di disegnare.'
                  : drawingTool === 'pencil' ? 'Trascina sulla preview: il tratto si salva al rilascio. Esc annulla il gesto.'
                    : drawingTool === 'eraser' ? 'Trascina sui tratti da cancellare. Esc annulla il gesto.'
                      : 'Scegli matita o gomma per preparare la mappa. La board live non è modificabile.'}</small>
                <small className="scene-catalog__preview-caption">
                  {isPreviewUnlimited ? '0 × 0 · griglia illimitata, anteprima parziale' : `${previewBoard.columns} × ${previewBoard.rows} · bordo della board evidenziato`}
                </small>
              </div>
              <div className="scene-catalog__background-actions">
                <label className="secondary-button">
                  Scegli immagine
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={isMutating}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setBackgroundDraft(file);
                      event.target.value = '';
                    }}
                  />
                </label>
                <button type="button" className="secondary-button" disabled={isMutating} onClick={() => setBackgroundDraft('blank')}>
                  Usa board bianca
                </button>
              </div>
              <div className="scene-catalog__calibration-controls" aria-label="Calibrazione sfondo sulla griglia">
                <label>
                  Scala
                  <input type="number" min="0.05" max="20" step="0.05" value={calibrationDraft.scale} disabled={isMutating || !hasImage} onChange={(event) => setCalibrationDraft((current) => ({ ...current, scale: Number(event.target.value) }))} />
                </label>
                <label>
                  Offset X (px)
                  <input type="number" min="-1000000" max="1000000" step="1" value={calibrationDraft.offsetX} disabled={isMutating || !hasImage} onChange={(event) => setCalibrationDraft((current) => ({ ...current, offsetX: Number(event.target.value) }))} />
                </label>
                <label>
                  Offset Y (px)
                  <input type="number" min="-1000000" max="1000000" step="1" value={calibrationDraft.offsetY} disabled={isMutating || !hasImage} onChange={(event) => setCalibrationDraft((current) => ({ ...current, offsetY: Number(event.target.value) }))} />
                </label>
              </div>
              <small>JPEG, PNG o WebP · massimo 10 MB. La scelta resta in bozza fino al salvataggio.</small>
            </fieldset>
            <div className="scene-catalog__dimensions">
              <div>
                <span className="scene-catalog__visibility-label">Dimensioni della board</span>
                <p>{isPreviewUnlimited
                  ? 'Illimitata: la griglia continua oltre i bordi della mappa.'
                  : 'Il bordo evidenziato mostra l’area della board; la zona ombreggiata resta fuori.'}</p>
              </div>
              <div className="scene-catalog__dimensions-controls">
                <label>Colonne
                  <input type="number" min="0" max="500" step="1" value={boardDimensionsDraft.columns} disabled={isMutating} onChange={(event) => { setBoardDimensionsDraft((current) => ({ ...current, columns: event.target.value })); setDimensionsError(null); }} />
                </label>
                <label>Righe
                  <input type="number" min="0" max="500" step="1" value={boardDimensionsDraft.rows} disabled={isMutating} onChange={(event) => { setBoardDimensionsDraft((current) => ({ ...current, rows: event.target.value })); setDimensionsError(null); }} />
                </label>
                {dimensionsError ? <p role="alert" className="scene-catalog__error">{dimensionsError}</p> : null}
              </div>
            </div>
            <div className={`scene-catalog__visibility ${selectedScene.isActive ? 'scene-catalog__visibility--active' : ''}`}>
              <div>
                <span className="scene-catalog__visibility-label">Visibilità sulla board</span>
                <strong>
                  {selectedScene.isActive
                    ? isActiveSceneBackgroundHidden ? 'Sfondo nascosto' : 'Sfondo visibile'
                    : 'Scena non attiva'}
                </strong>
                <p>
                  {selectedScene.isActive
                    ? isActiveSceneBackgroundHidden
                      ? 'La griglia resta disponibile, ma l’immagine non è mostrata ai partecipanti.'
                      : 'L’immagine salvata è mostrata sulla board del Master e dei Player.'
                    : 'La visibilità può essere cambiata soltanto per la scena attualmente attiva.'}
                </p>
              </div>
              {selectedScene.isActive ? (
                <button
                  type="button"
                  className={isActiveSceneBackgroundHidden ? 'primary-button' : 'secondary-button'}
                  aria-pressed={!isActiveSceneBackgroundHidden}
                  disabled={isMutating || isChangingVisibility || hasDraftChanges || selectedScene.document.background.kind !== 'image'}
                  title={selectedScene.document.background.kind !== 'image'
                    ? 'Salva prima un’immagine di sfondo'
                    : hasDraftChanges
                      ? 'Salva o annulla le modifiche prima di cambiare la visibilità'
                      : undefined}
                  onClick={() => void changeActiveBackgroundVisibility()}
                >
                  {isChangingVisibility
                    ? 'Aggiornamento...'
                    : isActiveSceneBackgroundHidden ? 'Mostra sfondo' : 'Nascondi sfondo'}
                </button>
              ) : null}
            </div>
            <p className="scene-catalog__hint">Le modifiche alla scena attiva si applicano alla board al salvataggio; le altre restano preparazione finché non vengono attivate.</p>
            <div className="scene-catalog__draft-actions">
              <button type="button" className="secondary-button" disabled={isMutating || !hasDraftChanges} onClick={() => { setNameDraft(selectedScene.name); setBackgroundDraft(null); setCalibrationDraft(sceneCalibration(selectedScene)); setBoardDimensionsDraft({ columns: String(selectedScene.document.board.dimensions.columns), rows: String(selectedScene.document.board.dimensions.rows) }); setDimensionsError(null); }}>
                Annulla
              </button>
              <button type="submit" className="primary-button" disabled={isMutating || nameDraft.trim().length === 0 || !hasDraftChanges}>
                {isMutating ? 'Salvataggio...' : 'Salva modifiche'}
              </button>
            </div>
          </form>
        ) : (
          <div className="scene-catalog__empty-workspace">
            <span aria-hidden="true">⌖</span>
            <strong>Scegli una scena dal catalogo</strong>
            <p>Qui avrai spazio per rinominarla, sostituire lo sfondo e allinearlo alla griglia.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function parseBoardDimensions(value: { columns: string; rows: string }): BoardDimensions | null {
  if (value.columns.trim() === '' || value.rows.trim() === '') return null;
  const columns = Number(value.columns);
  const rows = Number(value.rows);
  if (!Number.isSafeInteger(columns) || !Number.isSafeInteger(rows)
    || columns < 0 || columns > 500 || rows < 0 || rows > 500
    || ((columns === 0) !== (rows === 0))) return null;
  return { columns, rows };
}
