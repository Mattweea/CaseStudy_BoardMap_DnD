import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { BoardDimensions, SceneElement } from '../types';
import { SCENE_ELEMENT_LIBRARY, SceneElementArt } from './SceneElementArt';

const CELL_SIZE = 48;
type Point = { x: number; y: number };
type Transform = Pick<SceneElement, 'position' | 'widthCells' | 'heightCells' | 'rotation' | 'blocksMovement' | 'blocksVision'>;
type Gesture = { pointerId: number; mode: 'move' | 'resize' | 'rotate'; original: SceneElement; start: Point };

interface Props {
  sceneId: string;
  elements: SceneElement[];
  dimensions: BoardDimensions;
  previewHost: HTMLDivElement | null;
  previewLeft: number;
  previewTop: number;
  previewWidth: number;
  previewHeight: number;
  previewZoom: number;
  canPrepare: boolean;
  drawingToolActive: boolean;
  panMode: boolean;
  onBeginEdit: () => void;
  onAdd: (element: SceneElement) => Promise<boolean>;
  onUpdate: (id: string, transform: Transform) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}

function transformOf(element: SceneElement): Transform {
  return { position: element.position, widthCells: element.widthCells, heightCells: element.heightCells, rotation: element.rotation,
    blocksMovement: element.blocksMovement, blocksVision: element.blocksVision };
}

export function SceneElementEditor({
  sceneId, elements, dimensions, previewHost, previewLeft, previewTop, previewWidth, previewHeight, previewZoom,
  canPrepare, drawingToolActive, panMode, onBeginEdit, onAdd, onUpdate, onRemove,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placingKind, setPlacingKind] = useState<SceneElement['kind'] | null>(null);
  const [previewElement, setPreviewElement] = useState<SceneElement | null>(null);
  const previewElementRef = useRef<SceneElement | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const writePendingRef = useRef(false);
  const pointerEnabled = canPrepare && !drawingToolActive && !panMode;
  const setLocalPreview = (element: SceneElement | null) => {
    previewElementRef.current = element;
    setPreviewElement(element);
  };
  const shownElements = elements.filter((element) => element.id !== pendingRemoveId)
    .map((element) => previewElement?.id === element.id ? previewElement : element);
  if (previewElement && !elements.some((element) => element.id === previewElement.id)) shownElements.push(previewElement);
  const selected = shownElements.find((element) => element.id === selectedId) ?? null;

  useEffect(() => {
    setSelectedId(null);
    setPlacingKind(null);
    setLocalPreview(null);
    setPendingRemoveId(null);
    gestureRef.current = null;
  }, [sceneId]);

  useEffect(() => {
    if (panMode || drawingToolActive) {
      setPlacingKind(null);
      gestureRef.current = null;
      setLocalPreview(null);
    }
  }, [panMode, drawingToolActive]);

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || (!gestureRef.current && !placingKind)) return;
      event.preventDefault();
      event.stopPropagation();
      gestureRef.current = null;
      setLocalPreview(null);
      setPlacingKind(null);
    };
    window.addEventListener('keydown', cancel, true);
    return () => window.removeEventListener('keydown', cancel, true);
  }, [placingKind]);

  const pointerPoint = (event: ReactPointerEvent<HTMLElement>): Point => {
    const rect = previewHost?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scale = rect.width / previewWidth;
    return {
      x: ((event.clientX - rect.left) / scale + previewLeft) / CELL_SIZE,
      y: ((event.clientY - rect.top) / scale + previewTop) / CELL_SIZE,
    };
  };

  const clampTransform = (element: SceneElement, next: Transform): SceneElement => {
    const isResizing = next.widthCells !== element.widthCells || next.heightCells !== element.heightCells;
    const maxWidth = Math.min(40, dimensions.columns === 0 ? 40
      : dimensions.columns - (isResizing ? element.position.x : 0));
    const maxHeight = Math.min(40, dimensions.rows === 0 ? 40
      : dimensions.rows - (isResizing ? element.position.y : 0));
    const widthCells = Math.max(1, Math.min(maxWidth, Math.round(next.widthCells)));
    const heightCells = Math.max(1, Math.min(maxHeight, Math.round(next.heightCells)));
    const maxX = dimensions.columns === 0 ? 1_000_000 - widthCells : dimensions.columns - widthCells;
    const maxY = dimensions.rows === 0 ? 1_000_000 - heightCells : dimensions.rows - heightCells;
    return {
      ...element,
      position: {
        x: Math.max(0, Math.min(maxX, Math.round(next.position.x))),
        y: Math.max(0, Math.min(maxY, Math.round(next.position.y))),
      },
      widthCells,
      heightCells,
      rotation: ((Math.round(next.rotation / 15) * 15) % 360 + 360) % 360,
    };
  };

  const saveTransform = async (original: SceneElement, candidate: SceneElement) => {
    if (!canPrepare || writePendingRef.current || JSON.stringify(transformOf(original)) === JSON.stringify(transformOf(candidate))) {
      setLocalPreview(null);
      return;
    }
    writePendingRef.current = true;
    setLocalPreview(candidate);
    try { await onUpdate(original.id, transformOf(candidate)); }
    finally { writePendingRef.current = false; setLocalPreview(null); }
  };

  const placeElement = async (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerEnabled || !placingKind || writePendingRef.current || event.button !== 0) return;
    const item = SCENE_ELEMENT_LIBRARY.find((entry) => entry.kind === placingKind);
    if (!item) return;
    const point = pointerPoint(event);
    if (point.x < 0 || point.y < 0
      || (dimensions.columns > 0 && point.x >= dimensions.columns)
      || (dimensions.rows > 0 && point.y >= dimensions.rows)) return;
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    const element: SceneElement = {
      id: crypto.randomUUID(), kind: item.kind,
      position: {
        x: dimensions.columns === 0 ? x : Math.max(0, Math.min(dimensions.columns - item.widthCells, x)),
        y: dimensions.rows === 0 ? y : Math.max(0, Math.min(dimensions.rows - item.heightCells, y)),
      },
      widthCells: item.widthCells, heightCells: item.heightCells, rotation: 0,
      blocksMovement: false, blocksVision: false,
    };
    writePendingRef.current = true;
    setLocalPreview(element);
    try {
      if (await onAdd(element)) { setSelectedId(element.id); setPlacingKind(null); }
    } finally { writePendingRef.current = false; setLocalPreview(null); }
  };

  const startGesture = (event: ReactPointerEvent<HTMLElement>, element: SceneElement, mode: Gesture['mode']) => {
    event.stopPropagation();
    if (!pointerEnabled || writePendingRef.current || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(element.id);
    gestureRef.current = { pointerId: event.pointerId, mode, original: element, start: pointerPoint(event) };
  };

  const moveGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const point = pointerPoint(event);
    const { original, start } = gesture;
    let transform = transformOf(original);
    if (gesture.mode === 'move') {
      transform = { ...transform, position: {
        x: original.position.x + Math.round(point.x - start.x),
        y: original.position.y + Math.round(point.y - start.y),
      } };
    } else if (gesture.mode === 'resize') {
      transform = { ...transform,
        widthCells: original.widthCells + Math.round(point.x - start.x),
        heightCells: original.heightCells + Math.round(point.y - start.y),
      };
    } else {
      const center = { x: original.position.x + original.widthCells / 2, y: original.position.y + original.heightCells / 2 };
      const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
      const angle = Math.atan2(point.y - center.y, point.x - center.x);
      transform = { ...transform, rotation: original.rotation + (angle - startAngle) * 180 / Math.PI };
    }
    setLocalPreview(clampTransform(original, transform));
  };

  const endGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    moveGesture(event);
    gestureRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const candidate = previewElementRef.current?.id === gesture.original.id ? previewElementRef.current : gesture.original;
    void saveTransform(gesture.original, candidate);
  };

  const cancelGesture = () => { gestureRef.current = null; setLocalPreview(null); };
  const stepTransform = (patch: (element: SceneElement) => Transform) => {
    if (!selected || !pointerEnabled) return;
    void saveTransform(selected, clampTransform(selected, patch(selected)));
  };
  const removeSelected = async () => {
    if (!selected || !pointerEnabled || writePendingRef.current) return;
    writePendingRef.current = true;
    setPendingRemoveId(selected.id);
    try { if (await onRemove(selected.id)) setSelectedId(null); }
    finally { writePendingRef.current = false; setPendingRemoveId(null); }
  };

  return (
    <>
      {previewHost ? createPortal(
        <div className={`scene-element-preview-layer${placingKind ? ' scene-element-preview-layer--placing' : ''}`}
          style={{
            pointerEvents: pointerEnabled ? 'auto' : 'none',
            '--scene-handle-target-size': `${28 / previewZoom}px`,
            '--scene-handle-touch-target-size': `${44 / previewZoom}px`,
            '--scene-handle-dot-size': `${11 / previewZoom}px`,
            '--scene-handle-dot-border': `${1.5 / previewZoom}px`,
            '--scene-footprint-border': `${2 / previewZoom}px`,
          } as CSSProperties}
          onPointerDown={(event) => void placeElement(event)}>
          {selected && (selected.blocksMovement || selected.blocksVision) ? (
            <div className={`scene-element-preview-footprint${selected.blocksMovement ? ' scene-element-preview-footprint--movement' : ''}${selected.blocksVision ? ' scene-element-preview-footprint--vision' : ''}`}
              aria-hidden="true" style={{
                left: `${(selected.position.x * CELL_SIZE - previewLeft) / previewWidth * 100}%`,
                top: `${(selected.position.y * CELL_SIZE - previewTop) / previewHeight * 100}%`,
                width: `${selected.widthCells * CELL_SIZE / previewWidth * 100}%`,
                height: `${selected.heightCells * CELL_SIZE / previewHeight * 100}%`,
              }} />
          ) : null}
          {shownElements.map((element) => (
            <div key={element.id} className={`scene-element-preview-item${selectedId === element.id ? ' scene-element-preview-item--selected' : ''}`}
              style={{
                left: `${(element.position.x * CELL_SIZE - previewLeft) / previewWidth * 100}%`,
                top: `${(element.position.y * CELL_SIZE - previewTop) / previewHeight * 100}%`,
                width: `${element.widthCells * CELL_SIZE / previewWidth * 100}%`,
                height: `${element.heightCells * CELL_SIZE / previewHeight * 100}%`,
                transform: `rotate(${element.rotation}deg)`,
              }}>
              <button type="button" className="scene-element-preview-item__surface" disabled={!pointerEnabled || Boolean(placingKind)}
                aria-label={`Seleziona e sposta ${SCENE_ELEMENT_LIBRARY.find((item) => item.kind === element.kind)?.label ?? 'elemento'}`}
                aria-pressed={selectedId === element.id} title="Trascina per spostare"
                onPointerDown={(event) => startGesture(event, element, 'move')}
                onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={cancelGesture}
                onKeyDown={(event) => {
                  const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
                  if (!delta) return;
                  event.preventDefault(); event.stopPropagation();
                  setSelectedId(element.id);
                  void saveTransform(element, clampTransform(element, { ...transformOf(element), position: {
                    x: element.position.x + delta[0], y: element.position.y + delta[1],
                  } }));
                }}><SceneElementArt kind={element.kind} /></button>
              {selectedId === element.id && pointerEnabled && !placingKind ? (
                <>
                  <button type="button" className="scene-element-preview-item__handle scene-element-preview-item__handle--resize"
                    aria-label="Ridimensiona elemento" title="Trascina per ridimensionare"
                    onPointerDown={(event) => startGesture(event, element, 'resize')}
                    onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={cancelGesture} />
                  <button type="button" className="scene-element-preview-item__handle scene-element-preview-item__handle--rotate"
                    aria-label="Ruota elemento" title="Trascina per ruotare"
                    onPointerDown={(event) => startGesture(event, element, 'rotate')}
                    onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={cancelGesture} />
                </>
              ) : null}
            </div>
          ))}
        </div>, previewHost) : null}
      <div className="scene-element-editor" aria-label="Elementi scenici">
        <div className="scene-element-editor__heading"><div><strong>Arredi della scena</strong><small>{elements.length} elementi · solo preparazione</small></div></div>
        <div className="scene-element-editor__library" role="group" aria-label="Libreria locale di arredi">
          {SCENE_ELEMENT_LIBRARY.map((item) => (
            <button key={item.kind} type="button" className="scene-element-editor__library-item" aria-pressed={placingKind === item.kind}
              disabled={!canPrepare || dimensions.columns > 0 && (dimensions.columns < item.widthCells || dimensions.rows < item.heightCells)}
              onClick={() => { onBeginEdit(); setPlacingKind(placingKind === item.kind ? null : item.kind); }}>
              <span className="scene-element-editor__library-art"><SceneElementArt kind={item.kind} /></span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        {elements.length > 0 ? <div className="scene-element-editor__placed" role="group" aria-label="Arredi presenti nella scena">
          {elements.map((element, index) => <button key={element.id} type="button" aria-pressed={selectedId === element.id}
            disabled={!pointerEnabled} onClick={() => setSelectedId(element.id)}>
            {index + 1}. {SCENE_ELEMENT_LIBRARY.find((item) => item.kind === element.kind)?.label} · {element.position.x},{element.position.y}
          </button>)}
        </div> : null}
        {selected ? (
          <div className="scene-element-editor__selection" role="group" aria-label="Trasforma elemento selezionato">
            <div className="scene-element-editor__selection-title"><strong>{SCENE_ELEMENT_LIBRARY.find((item) => item.kind === selected.kind)?.label}</strong><span>({selected.position.x}, {selected.position.y}) · {selected.widthCells} × {selected.heightCells} · {selected.rotation}°</span></div>
            <div className="scene-element-editor__blocking-flags" role="group" aria-label="Blocchi dell’elemento">
              <button type="button" disabled={!pointerEnabled} aria-pressed={selected.blocksMovement}
                onClick={() => stepTransform((element) => ({ ...transformOf(element), blocksMovement: !element.blocksMovement }))}>
                Blocca movimento
              </button>
              <button type="button" disabled={!pointerEnabled} aria-pressed={selected.blocksVision}
                onClick={() => stepTransform((element) => ({ ...transformOf(element), blocksVision: !element.blocksVision }))}>
                Blocca visuale
              </button>
            </div>
            <p className="scene-element-editor__hint">Se attivi un blocco, il contorno mostra le caselle interessate; la rotazione cambia solo l’aspetto. La visuale non nasconde i dati inviati al Player.</p>
            <div className="scene-element-editor__actions">
              <div className="scene-element-editor__action-group" aria-label="Sposta di una casella">
                {([['←', -1, 0, 'sinistra'], ['↑', 0, -1, 'alto'], ['↓', 0, 1, 'basso'], ['→', 1, 0, 'destra']] as const).map(([label, dx, dy, name]) => (
                  <button key={name} type="button" disabled={!pointerEnabled} aria-label={`Sposta a ${name}`}
                    onClick={() => stepTransform((element) => ({ ...transformOf(element), position: { x: element.position.x + dx, y: element.position.y + dy } }))}>{label}</button>
                ))}
              </div>
              <div className="scene-element-editor__action-group" aria-label="Dimensioni in caselle">
                <button type="button" disabled={!pointerEnabled} aria-label="Riduci larghezza" onClick={() => stepTransform((element) => ({ ...transformOf(element), widthCells: element.widthCells - 1 }))}>− L</button>
                <button type="button" disabled={!pointerEnabled} aria-label="Aumenta larghezza" onClick={() => stepTransform((element) => ({ ...transformOf(element), widthCells: element.widthCells + 1 }))}>+ L</button>
                <button type="button" disabled={!pointerEnabled} aria-label="Riduci altezza" onClick={() => stepTransform((element) => ({ ...transformOf(element), heightCells: element.heightCells - 1 }))}>− H</button>
                <button type="button" disabled={!pointerEnabled} aria-label="Aumenta altezza" onClick={() => stepTransform((element) => ({ ...transformOf(element), heightCells: element.heightCells + 1 }))}>+ H</button>
              </div>
              <div className="scene-element-editor__action-group" aria-label="Rotazione">
                <button type="button" disabled={!pointerEnabled} aria-label="Ruota di 15 gradi in senso antiorario" onClick={() => stepTransform((element) => ({ ...transformOf(element), rotation: element.rotation - 15 }))}>↶ 15°</button>
                <button type="button" disabled={!pointerEnabled} aria-label="Ruota di 15 gradi in senso orario" onClick={() => stepTransform((element) => ({ ...transformOf(element), rotation: element.rotation + 15 }))}>↷ 15°</button>
              </div>
              <button type="button" className="scene-element-editor__remove" disabled={!pointerEnabled} onClick={() => void removeSelected()}>Rimuovi</button>
            </div>
          </div>
        ) : <p className="scene-element-editor__hint">{placingKind ? 'Clicca sulla preview per posizionare l’arredo. Esc annulla.' : 'Scegli un arredo o selezionane uno sulla preview per trasformarlo.'}</p>}
      </div>
    </>
  );
}
