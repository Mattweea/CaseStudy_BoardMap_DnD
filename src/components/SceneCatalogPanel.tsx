import { SceneVisionPreview } from './SceneVisionPreview';
import { SceneDraftContext, type SceneDraft } from './SceneDraftContext';
import { ScenePreparationPreview } from './ScenePreparationPreview';
import { SceneWizardNavigation, SCENE_STEPS } from './SceneWizardNavigation';
import { SceneLightEditor } from './SceneLightEditor';
import { SceneCellWallEditor } from './SceneCellWallEditor';
import { WallCellsLayer } from './WallCellsLayer';
import { SceneWallEditor } from './SceneWallEditor';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { BoardDimensions, SceneDrawing } from '../types';
import { useSceneCatalog } from '../hooks/useSceneCatalog';
import { sceneBackgroundUrl } from '../utils/sceneApi';
import { SceneElementEditor } from './SceneElementEditor';
import { SceneEncounterSection } from './SceneEncounterSection';

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
  closeRequestRef?: React.MutableRefObject<(() => void) | null>;
  onRequestClose: () => void;
  onOpenCreatureSheet?: (sceneId:string,tokenId:string)=>void;
  isActiveSceneBackgroundHidden: boolean;
  onActiveSceneBackgroundVisibilityChange: (hidden: boolean) => Promise<void>;
}

export function SceneCatalogPanel({ onOpenCreatureSheet, closeRequestRef, onRequestClose,
  isActiveSceneBackgroundHidden,
  onActiveSceneBackgroundVisibilityChange,
}: SceneCatalogPanelProps) {
  const {
    mutateWall,
    mutateWallCells,
    saveLights,
    undoPlacement,
    catalog,
    selectedScene,
    isLoading,
    isMutating,
    error,
    transferPreview,
    transferNotice,
    transferError,
    reload,
    selectScene,
    createScene,
    activateScene,
    previewPartyTransfer,
    commitPartyTransfer,
    clearTransferPreview,
    updateScene,
    addDrawing,
    eraseDrawings,
    undoDrawing,
    redoDrawing,
    addElement,
    updateElement,
    removeElement,
    createEncounter,
    updateEncounter,
    removeEncounter,
    createEncounterEntity,
    updateEncounterEntity,
    createEncounterPlacement,
    updateEncounterPlacement,
    removeEncounterPlacement,
  } = useSceneCatalog(true);
  const encounterDrafts = useRef(new Map<string, SceneDraft>());
  const [encounterDirty, setEncounterDirty] = useState(false);
  const draftContext = useMemo(() => ({ register: (id: string, draft: SceneDraft | null) => {
    if (draft) encounterDrafts.current.set(id, draft); else encounterDrafts.current.delete(id);
    setEncounterDirty(encounterDrafts.current.size > 0);
  } }), []);
  const [step, setStep] = useState(0);
  const [origin, setOrigin] = useState<'scratch' | 'image'>('scratch');
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const stayButtonRef = useRef<HTMLButtonElement | null>(null);
  const leaveTriggerRef = useRef<HTMLElement | null>(null);
  const navigationSaving = useRef(false);
  useEffect(() => { setStep(0); setOrigin(selectedScene?.document.background.kind === 'image' ? 'image' : 'scratch'); }, [selectedScene?.id]);
  const [newName, setNewName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [backgroundDraft, setBackgroundDraft] = useState<File | 'blank' | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [calibrationDraft, setCalibrationDraft] = useState(DEFAULT_CALIBRATION);
  const [previewImageSize, setPreviewImageSize] = useState<{ width: number; height: number } | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const [previewHost, setPreviewHost] = useState<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [previewSpace, setPreviewSpace] = useState({ width: 0, height: 0 });
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [isPreviewPanMode, setIsPreviewPanMode] = useState(false);
  const panGestureRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [isChangingVisibility, setIsChangingVisibility] = useState(false);
  const [boardDimensionsDraft, setBoardDimensionsDraft] = useState({ columns: '', rows: '' });
  const [isDarknessEnabledDraft, setIsDarknessEnabledDraft] = useState(true);
  const [dimensionsError, setDimensionsError] = useState<string | null>(null);
  const [transferAnchor, setTransferAnchor] = useState({ x: '0', y: '0' });
  const [transferAnchorError, setTransferAnchorError] = useState<string | null>(null);
  const [wallActive,setWallActive]=useState(false);
  const [lightDraft, setLightDraft] = useState<import('../types').LightSource[]>([]);
  const [lightActive, setLightActive] = useState(false);
  const [observerEnabled, setObserverEnabled] = useState(false);
  useEffect(() => { setObserverEnabled(false); setLightActive(false); }, [selectedScene?.id]);
  const lightsDirty = JSON.stringify(lightDraft) !== JSON.stringify(selectedScene?.document.board.lightSources ?? []);
  useEffect(() => { setLightDraft(selectedScene?.document.board.lightSources ?? []); }, [selectedScene]);
  const [cellActive, setCellActive] = useState(false);
  useEffect(() => { setCellActive(false); }, [selectedScene?.id]);
  useEffect(()=>{setWallActive(false);},[selectedScene?.id]);
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
    setIsDarknessEnabledDraft(!(selectedScene?.document.board.isFullyLit ?? false));
    setDimensionsError(null);
  }, [selectedScene]);

  useEffect(() => {
    drawingGestureRef.current = null;
    setDrawingGesture(null);
    setPendingDrawing(null);
    setPendingEraseIds([]);
    setEraserPreviewPoint(null);
    panGestureRef.current = null;
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
    setIsPreviewPanMode(false);
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
    if (!isPreviewPanMode) return undefined;
    const cancelPan = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      panGestureRef.current = null;
      setIsPreviewPanMode(false);
    };
    window.addEventListener('keydown', cancelPan, true);
    return () => window.removeEventListener('keydown', cancelPan, true);
  }, [isPreviewPanMode]);

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
    leave(() => { void createScene(newName).then((saved) => { if (saved) setNewName(''); }); });
  };

  const saveConfiguration = async () => {
    const dimensions = parseBoardDimensions(boardDimensionsDraft);
    if (!dimensions) {
      setDimensionsError('Inserisci dimensioni intere positive oppure 0 × 0 per una board illimitata.');
      return false;
    }
    setDimensionsError(null);
    const hasImage = backgroundDraft instanceof File
      || (backgroundDraft !== 'blank' && selectedScene?.document.background.kind === 'image');
    if (await updateScene(nameDraft, backgroundDraft, hasImage ? calibrationDraft : null, dimensions, !isDarknessEnabledDraft, lightsDirty ? lightDraft : null)) {
      setBackgroundDraft(null);
      return true;
    }
    return false;
  };
  const submitUpdate = async (event: FormEvent) => { event.preventDefault(); await saveDrafts(); };

  const requestTransferPreview = () => {
    const x = Number(transferAnchor.x);
    const y = Number(transferAnchor.y);
    if (transferAnchor.x.trim() === '' || transferAnchor.y.trim() === ''
      || !Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0) {
      setTransferAnchorError('Inserisci due coordinate intere non negative.');
      return;
    }
    setTransferAnchorError(null);
    void previewPartyTransfer({ x, y });
  };

  const activeScene = catalog.find((scene) => scene.isActive);
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
    || isDarknessEnabledDraft !== !selectedScene.document.board.isFullyLit
  );
  const resetTools = () => {
    setObserverEnabled(false); setWallActive(false); setCellActive(false); setLightActive(false); setDrawingTool(null); setIsPreviewPanMode(false);
    drawingGestureRef.current = null; setDrawingGesture(null); setEraserPreviewPoint(null);
  };
  const changeStep = (next: number) => { resetTools(); setStep(next); requestAnimationFrame(() => stepHeadingRef.current?.focus()); };
  const discardDrafts = () => {
    if (!selectedScene) return;
    setNameDraft(selectedScene.name); setBackgroundDraft(null); setCalibrationDraft(sceneCalibration(selectedScene));
    setBoardDimensionsDraft({ columns: String(selectedScene.document.board.dimensions.columns), rows: String(selectedScene.document.board.dimensions.rows) });
    setIsDarknessEnabledDraft(!selectedScene.document.board.isFullyLit); setLightDraft(selectedScene.document.board.lightSources); setDimensionsError(null);
    encounterDrafts.current.forEach((draft) => draft.discard());
    resetTools();
  };
  const saveDrafts = async () => {
    if (navigationSaving.current || isMutating || isLoading) return false;
    navigationSaving.current = true;
    try {
      if (hasDraftChanges && !await saveConfiguration()) return false;
      if (!hasDraftChanges && lightsDirty && !await saveLights(lightDraft)) return false;
      for (const draft of [...encounterDrafts.current.values()]) { if (!await draft.save()) return false; }
      return true;
    }
    finally { navigationSaving.current = false; }
  };
  const leave = (action: () => void) => {
    if (isMutating || isLoading || navigationSaving.current) return;
    if (hasDraftChanges || lightsDirty || encounterDirty) {
      leaveTriggerRef.current = document.activeElement as HTMLElement;
      setPendingLeave(() => action);
    } else { resetTools(); action(); }
  };
  const stay = () => { setPendingLeave(null); requestAnimationFrame(() => leaveTriggerRef.current?.focus()); };
  const continueStep = async () => { if (await saveDrafts()) changeStep(Math.min(4, step + 1)); };
  useEffect(() => {
    if (closeRequestRef) closeRequestRef.current = () => pendingLeave ? stay() : leave(onRequestClose);
    return () => { if (closeRequestRef) closeRequestRef.current = null; };
  });
  useEffect(() => { if (pendingLeave) stayButtonRef.current?.focus(); }, [pendingLeave]);
  useEffect(() => {
    if (!pendingLeave) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); stay(); }
      if (event.key === 'Tab') {
        const buttons = [...(stayButtonRef.current?.closest('[role="alertdialog"]')?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault(); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
      }
    };
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  }, [pendingLeave]);
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
  const drawingEnabled = Boolean(step === 1 && selectedScene && drawingTool && previewScale > 0 && !hasDraftChanges && !isMutating && !isLoading && !isPreviewPanMode);
  const historyEnabled = Boolean(step === 1 && selectedScene && !hasDraftChanges && !isMutating && !isLoading && !drawingGesture);
  const canUndoDrawing = historyEnabled && Boolean(selectedScene?.drawingHistory?.canUndo);
  const canRedoDrawing = historyEnabled && Boolean(selectedScene?.drawingHistory?.canRedo);
  const previewPointFromPointer = (event: ReactPointerEvent<HTMLDivElement>): DrawingPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    const renderedScale = rect.width / previewWidth;
    const x = ((event.clientX - rect.left) / renderedScale + previewLeft) / CELL_SIZE;
    const y = ((event.clientY - rect.top) / renderedScale + previewTop) / CELL_SIZE;
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
    const rect = event.currentTarget.getBoundingClientRect();
    const renderedScale = rect.width / previewWidth;
    const rawX = ((event.clientX - rect.left) / renderedScale + previewLeft) / CELL_SIZE;
    const rawY = ((event.clientY - rect.top) / renderedScale + previewTop) / CELL_SIZE;
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
    <SceneDraftContext.Provider value={draftContext}><section className="scene-catalog scene-catalog--wizard" ref={panelRef} aria-label="Catalogo e preparazione delle scene">
<aside className="scene-catalog__rail" aria-labelledby="scene-catalog-list-heading">
        <div className="scene-catalog__rail-heading">
          <div>
            <p className="scene-catalog__eyebrow">Archivio del Master</p>
            <h3 id="scene-catalog-list-heading">Catalogo</h3>
          </div>
          <button type="button" className="scene-catalog__refresh" onClick={() => leave(() => { void reload(); })} disabled={isLoading || isMutating}>
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
                  onClick={() => leave(() => { void selectScene(scene.id); })}
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
        {selectedScene ? <>
          <header className="scene-wizard__heading">
            <div><p className="scene-catalog__eyebrow">Preparazione della scena</p><h3>{selectedScene.name}</h3></div>
            <span>{selectedScene.isActive ? 'Scena attiva' : 'Preparazione privata'} · v{selectedScene.version}</span>
          </header>
          <SceneWizardNavigation step={step} disabled={isLoading || isMutating} onSelect={(next) => leave(() => changeStep(next))} />
          <div className="scene-wizard__body">
            <ScenePreparationPreview><div className="scene-catalog__calibration-preview-frame">
                <div className="scene-catalog__calibration-preview-viewport" ref={previewFrameRef}>
                  <div
                    ref={setPreviewHost}
                    className="scene-catalog__calibration-preview"
                    style={{
                      width: previewWidth * previewScale,
                      height: previewHeight * previewScale,
                      visibility: previewScale > 0 ? 'visible' : 'hidden',
                      transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
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
                    <WallCellsLayer cells={selectedScene.document.wallCells} left={previewLeft / CELL_SIZE} top={previewTop / CELL_SIZE} width={previewWidth / CELL_SIZE} height={previewHeight / CELL_SIZE} />
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
                    {isPreviewPanMode ? <div className="scene-catalog__pan-capture" role="presentation"
                      onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); panGestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }; }}
                      onPointerMove={(event) => { const gesture = panGestureRef.current; if (!gesture || gesture.pointerId !== event.pointerId) return; setPreviewPan((current) => ({ x: current.x + event.clientX - gesture.x, y: current.y + event.clientY - gesture.y })); panGestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }; }}
                      onPointerUp={(event) => { if (panGestureRef.current?.pointerId !== event.pointerId) return; event.currentTarget.releasePointerCapture(event.pointerId); panGestureRef.current = null; }}
                      onPointerCancel={() => { panGestureRef.current = null; }} /> : null}
                  </div>
                </div>
                <div className="scene-catalog__preview-navigation" role="group" aria-label="Navigazione anteprima">
                  <button type="button" aria-pressed={isPreviewPanMode} onClick={() => { setLightActive(false); setCellActive(false); setDrawingTool(null); setWallActive(false); setIsPreviewPanMode((current) => !current); }}>Sposta vista</button>
                  <button type="button" aria-label="Riduci zoom anteprima" disabled={previewZoom <= 1} onClick={() => setPreviewZoom((current) => Math.max(1, Math.round((current - .25) * 100) / 100))}>−</button>
                  <output aria-label="Zoom anteprima">{Math.round(previewZoom * 100)}%</output>
                  <button type="button" aria-label="Aumenta zoom anteprima" disabled={previewZoom >= 4} onClick={() => setPreviewZoom((current) => Math.min(4, Math.round((current + .25) * 100) / 100))}>+</button>
                  <button type="button" onClick={() => { setPreviewZoom(1); setPreviewPan({ x: 0, y: 0 }); setIsPreviewPanMode(false); }}>Centra</button>
                </div>




                <small className="scene-catalog__drawing-hint" role="status">{hasDraftChanges
                  ? 'Salva o annulla le modifiche alla scena prima di disegnare.'
                  : drawingTool === 'pencil' ? 'Trascina sulla preview: il tratto si salva al rilascio. Esc annulla il gesto.'
                    : drawingTool === 'eraser' ? 'Trascina sui tratti da cancellare. Esc annulla il gesto.'
                      : step === 0 ? 'Allinea la griglia e conferma la base della mappa.' : step === 1 ? 'Scegli uno strumento per costruire o ricalcare le pareti.' : 'Usa zoom e spostamento per controllare la mappa.'}</small>
                <small className="scene-catalog__preview-caption">
                  {isPreviewUnlimited ? '0 × 0 · griglia illimitata, anteprima parziale' : `${previewBoard.columns} × ${previewBoard.rows} · bordo della board evidenziato`}
                </small>
              </div>
              </ScenePreparationPreview>
            <div className="scene-wizard__controls">
              <h4 tabIndex={-1} ref={stepHeadingRef} className="scene-wizard__title">{step + 1}. {SCENE_STEPS[step]}</h4>
              {error ? <p className="scene-catalog__error" role="alert">{error}</p> : null}
              <form id="scene-base-form" className="scene-catalog__detail" onSubmit={(event) => void submitUpdate(event)} hidden={step !== 0}>
                <div className="scene-wizard__origin" role="group" aria-label="Punto di partenza della mappa">
                  <button type="button" aria-pressed={origin === 'scratch'} onClick={() => setOrigin('scratch')}><strong>Costruisci da zero</strong><small>Griglia e pareti a celle</small></button>
                  <button type="button" aria-pressed={origin === 'image'} onClick={() => setOrigin('image')}><strong>Parti da un'immagine</strong><small>Carica, allinea e ricalca</small></button>
                </div>
                <p className="scene-catalog__hint">{origin === 'scratch' ? 'Costruisci sulla griglia. Puoi aggiungere anche un’immagine e usare i tracciati.' : 'Allinea la tua mappa alla griglia. Puoi combinare ricalco e pareti a celle.'}</p>
<label htmlFor="scene-name-draft">Nome della scena</label>
            <input
              id="scene-name-draft"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              maxLength={120}
              disabled={isMutating}
            />

                <fieldset className="scene-wizard__background"><legend>Sfondo e allineamento</legend><div className="scene-catalog__background-actions">
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

              </form>
              <div hidden={step !== 1} className="scene-wizard__environment" data-origin={origin}>
                <p className="scene-catalog__hint">Celle per costruire, tracciati per ricalcare. I due strumenti si possono combinare.</p>
<SceneCellWallEditor scene={selectedScene} active={step === 1 && cellActive} disabled={step !== 1 || lightsDirty || hasDraftChanges || isMutating || isLoading || isPreviewPanMode}
                  onActive={(value) => { setCellActive(value); if (value) { setLightActive(false); setWallActive(false); setDrawingTool(null); setIsPreviewPanMode(false); } }}
                  mutate={mutateWallCells} preview={{ host: previewHost, left: previewLeft, top: previewTop, width: previewWidth, height: previewHeight, interactive: true, onBeginEdit: () => {} }} /><SceneWallEditor scene={selectedScene} disabled={step !== 1 || lightsDirty || hasDraftChanges||isMutating||isLoading||isPreviewPanMode}
                  active={step === 1 && wallActive} onActive={(value)=>{setWallActive(value);if(value){setLightActive(false);setCellActive(false);setDrawingTool(null);setIsPreviewPanMode(false);}}}
                  mutate={mutateWall} preview={{host:previewHost,left:previewLeft,top:previewTop,width:previewWidth,height:previewHeight,interactive:!hasDraftChanges,onBeginEdit:()=>{}}}/><SceneElementEditor
                  sceneId={selectedScene.id}
                  elements={selectedScene.document.elements}
                  dimensions={selectedScene.document.board.dimensions}
                  previewHost={previewHost}
                  previewLeft={previewLeft}
                  previewTop={previewTop}
                  previewWidth={previewWidth}
                  previewHeight={previewHeight}
                  canPrepare={step === 1 && !lightsDirty && !hasDraftChanges && !isMutating && !isLoading && previewScale > 0}
                  drawingToolActive={drawingTool !== null || wallActive || cellActive || lightActive}
                  panMode={isPreviewPanMode}
                  previewZoom={previewZoom}
                  onBeginEdit={() => { setDrawingTool(null); setIsPreviewPanMode(false); setWallActive(false); setCellActive(false); }}
                  onAdd={addElement}
                  onUpdate={updateElement}
                  onRemove={removeElement}
                /><details><summary>Disegno decorativo</summary><div className="scene-catalog__drawing-tools" role="group" aria-label="Disegno della scena">
                  <button type="button" className="scene-catalog__drawing-tool" aria-pressed={drawingTool === 'pencil'}
                    disabled={isLoading || isMutating || hasDraftChanges} onClick={() => {setLightActive(false);setCellActive(false);setWallActive(false);setDrawingTool(drawingTool === 'pencil' ? null : 'pencil');}}>✎ <span>Matita</span></button>
                  <button type="button" className="scene-catalog__drawing-tool" aria-pressed={drawingTool === 'eraser'}
                    disabled={isLoading || isMutating || hasDraftChanges} onClick={() => {setLightActive(false);setCellActive(false);setWallActive(false);setDrawingTool(drawingTool === 'eraser' ? null : 'eraser');}}>⌫ <span>Gomma</span></button>
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
                </details>
              </div>
              <div hidden={step !== 2}><label className="toggle-row">
              <input
                type="checkbox"
                role="switch"
                checked={isDarknessEnabledDraft}
                disabled={isMutating}
                onChange={(event) => setIsDarknessEnabledDraft(event.target.checked)}
              />
              <span>
                <strong>Buio attivo</strong>
                <small>I Player vedono soltanto le aree illuminate o coperte dalla loro scurovisione.</small>
              </span>
            </label>
            <SceneLightEditor sceneId={selectedScene.id} lights={lightDraft} dirty={lightsDirty} disabled={step !== 2 || isMutating || isLoading || hasDraftChanges}
                  active={step === 2 && lightActive} onActive={(value) => { setLightActive(value); if (value) { setObserverEnabled(false); setCellActive(false); setWallActive(false); setDrawingTool(null); setIsPreviewPanMode(false); } }}
                  onChange={setLightDraft} onSave={() => saveLights(lightDraft)} onCancel={() => setLightDraft(selectedScene.document.board.lightSources)}
                  preview={{ host: previewHost, left: previewLeft, top: previewTop, width: previewWidth, height: previewHeight, interactive: true, onBeginEdit: () => {} }} />
            <SceneVisionPreview scene={selectedScene} lights={lightDraft} fullyLit={!isDarknessEnabledDraft}
              enabled={step === 2 && observerEnabled} onEnabled={(value) => { resetTools(); setObserverEnabled(value); }} scale={previewScale}
              preview={{ host: previewHost, left: previewLeft, top: previewTop, width: previewWidth, height: previewHeight, interactive: true, onBeginEdit: () => {} }} /></div>
              <div hidden={step !== 3}><SceneEncounterSection onOpenSheet={(tokenId)=>onOpenCreatureSheet?.(selectedScene.id,tokenId)} onUndoPlacement={undoPlacement} scene={selectedScene} disabled={step !== 3 || lightsDirty || isMutating || isLoading || hasDraftChanges} error={error}
            onCreate={createEncounter} onUpdate={updateEncounter} onRemove={removeEncounter}
            onCreateEntity={createEncounterEntity} onUpdateEntity={updateEncounterEntity}
            onCreatePlacement={createEncounterPlacement} onUpdatePlacement={updateEncounterPlacement} onRemovePlacement={removeEncounterPlacement}
            placementPreview={{ host: previewHost, left: previewLeft, top: previewTop, width: previewWidth, height: previewHeight,
              interactive: step === 3 && drawingTool === null && !wallActive && !cellActive && !lightActive && !isPreviewPanMode,
              onBeginEdit: () => { setDrawingTool(null); setIsPreviewPanMode(false); } }} /></div>
              {step === 4 ? <section className="scene-wizard__summary" aria-label="Riepilogo della scena">
                <dl>
                  <div><dt><button type="button" onClick={() => leave(() => changeStep(0))}>Base · Modifica</button></dt><dd>{selectedScene.document.background.kind === 'image' ? 'Immagine calibrata' : 'Griglia vuota'}</dd></div>
                  <div><dt><button type="button" onClick={() => leave(() => changeStep(0))}>Dimensioni · Modifica</button></dt><dd>{isPreviewUnlimited ? 'Illimitata' : `${previewBoard.columns} × ${previewBoard.rows} celle`}</dd></div>
                  <div><dt><button type="button" onClick={() => leave(() => changeStep(1))}>Pareti · Modifica</button></dt><dd>{selectedScene.document.wallCells.length} celle · {selectedScene.document.walls.length} tracciati</dd></div>
                  <div><dt><button type="button" onClick={() => leave(() => changeStep(2))}>Luci · Modifica</button></dt><dd>{selectedScene.document.board.lightSources.length} sorgenti · {selectedScene.document.board.isFullyLit ? 'Luce completa' : 'Buio attivo'}</dd></div>
                  <div><dt><button type="button" onClick={() => leave(() => changeStep(3))}>Encounter · Modifica</button></dt><dd>{selectedScene.document.encounters.length} incontri · {selectedScene.document.preparedPlacements.length} figure collocate</dd></div>
                </dl>
                <p className="scene-catalog__hint">La preparazione è salvata. Puoi riaprire ogni passaggio per modificarla.</p>
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
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  disabled={isMutating || hasDraftChanges}
                  title={hasDraftChanges ? 'Salva o annulla le modifiche prima di attivare la scena' : undefined}
                  onClick={() => void activateScene()}
                >
                  {isMutating ? 'Attivazione...' : 'Attiva scena'}
                </button>
              )}
            </div>
            <p className="scene-catalog__hint">Le modifiche alla scena attiva si applicano alla board al salvataggio; le altre restano preparazione finché non vengono attivate.</p>
            {!selectedScene.isActive ? (
              <fieldset className="scene-catalog__party-transfer">
                <legend>Attiva e trasferisci il party</legend>
                <p>Da <strong>{activeScene?.name ?? 'scena attiva'}</strong> a <strong>{selectedScene.name}</strong>. Gli altri token restano nella scena di partenza.</p>
                <div className="scene-catalog__party-anchor">
                  <label htmlFor="party-anchor-x">Colonna ancora
                    <input id="party-anchor-x" type="number" min="0" step="1" value={transferAnchor.x}
                      disabled={isMutating} onChange={(event) => { setTransferAnchor((current) => ({ ...current, x: event.target.value })); clearTransferPreview(); }} />
                  </label>
                  <label htmlFor="party-anchor-y">Riga ancora
                    <input id="party-anchor-y" type="number" min="0" step="1" value={transferAnchor.y}
                      disabled={isMutating} onChange={(event) => { setTransferAnchor((current) => ({ ...current, y: event.target.value })); clearTransferPreview(); }} />
                  </label>
                  <button type="button" className="secondary-button" disabled={isMutating || isLoading || hasDraftChanges}
                    title={hasDraftChanges ? 'Salva o annulla le modifiche alla scena prima di calcolare le posizioni' : undefined}
                    onClick={requestTransferPreview}>{isMutating ? 'Calcolo...' : 'Anteprima posizioni'}</button>
                </div>
                {hasDraftChanges ? <p className="scene-catalog__hint">Salva o annulla le modifiche alla scena per calcolare le posizioni.</p> : null}
                {transferAnchorError ? <p className="scene-catalog__error" role="alert">{transferAnchorError}</p> : null}
                {transferError ? <p className="scene-catalog__error" role="alert">{transferError}</p> : null}
                {transferPreview?.targetSceneId === selectedScene.id ? (
                  <div className="scene-catalog__party-result" role="status">
                    <strong>Anteprima · {transferPreview.placements.length} token</strong>
                    <ul>{transferPreview.placements.map((placement) => (
                      <li key={placement.tokenId}>{placement.name} <span>({placement.position.x}, {placement.position.y})</span></li>
                    ))}</ul>
                    <button type="button" className="primary-button" disabled={isMutating || hasDraftChanges}
                      onClick={() => void commitPartyTransfer()}>Conferma attivazione e trasferimento</button>
                  </div>
                ) : null}
                <small>L'anteprima non cambia scena né sposta token. Per attivare la scena senza il party, usa «Attiva scena».</small>
              </fieldset>
            ) : null}
            {transferNotice ? <p className="scene-catalog__status" role="status">{transferNotice}</p> : null}

              </section> : null}
            </div>
          </div>
          <footer className="scene-wizard__footer">
            <p role="status">{isMutating ? 'Salvataggio…' : hasDraftChanges || lightsDirty || encounterDirty ? 'Modifiche in bozza' : 'Modifiche salvate'}<small>{selectedScene.isActive ? 'Le modifiche confermate aggiornano la board.' : 'La preparazione resta privata fino all’attivazione.'}</small></p>
            <div>
              <button type="button" className="secondary-button" disabled={isMutating || step === 0} onClick={() => leave(() => changeStep(step - 1))}>Indietro</button>
              {(hasDraftChanges || lightsDirty || encounterDirty) ? <button type="button" className="secondary-button" disabled={isMutating} onClick={() => void saveDrafts()}>Salva modifiche</button> : null}
              {step < 4 ? <button type="button" className="primary-button" disabled={isMutating || isLoading} onClick={() => void continueStep()}>{hasDraftChanges || lightsDirty || encounterDirty ? 'Salva e continua' : step === 3 ? 'Vai al riepilogo' : 'Continua'}</button> : <button type="button" className="secondary-button" disabled={isMutating} onClick={() => leave(onRequestClose)}>Chiudi preparazione</button>}
            </div>
          </footer>
        </> : <div className="scene-catalog__empty-workspace"><strong>Scegli una scena dal catalogo</strong><p>Crea una scena per costruire sulla griglia o partire da un’immagine.</p></div>}
      </div>
      {pendingLeave ? <div className="scene-wizard__leave-backdrop"><div className="scene-wizard__leave" role="alertdialog" aria-modal="true" aria-labelledby="scene-leave-title">
        <h3 id="scene-leave-title">Ci sono modifiche in bozza</h3><p>Salvale prima di proseguire oppure scartale. Le modifiche già salvate restano nella scena.</p>
        <div><button ref={stayButtonRef} type="button" className="secondary-button" onClick={stay}>Resta qui</button>
          <button type="button" className="secondary-button" disabled={isMutating} onClick={() => { discardDrafts(); const action = pendingLeave; setPendingLeave(null); action(); }}>Scarta e prosegui</button>
          <button type="button" className="primary-button" disabled={isMutating} onClick={async () => { if (await saveDrafts()) { const action = pendingLeave; setPendingLeave(null); action(); } }}>Salva e prosegui</button></div>
      </div></div> : null}
    </section></SceneDraftContext.Provider>
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
