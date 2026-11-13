import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BOARD_CONFIG } from '../constants/board';
import type { SceneDrawing } from '../types';
import type { PersistedScene } from '../utils/sceneApi';
import type { PlacementPreview } from './SceneEncounterPlacementSection';

interface Props {
  scene: PersistedScene;
  preview: PlacementPreview;
  disabled: boolean;
  active: boolean;
  onActive: (value: boolean) => void;
  mutate: (op: 'add' | 'remove' | 'undo' | 'redo', wall?: SceneDrawing, id?: string) => Promise<boolean>;
}
type Point = { x: number; y: number };
type Mode = 'freehand' | 'segments';

export function SceneWallEditor({ scene, preview, disabled, active, onActive, mutate }: Props) {
  const hintId = useId();
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const gesture = useRef<{ pointerId: number } | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const cursorRef = useRef<Point | null>(null);
  const savingRef = useRef(false);
  const [mode, setMode] = useState<Mode>('segments');
  const [points, setPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const unavailable = disabled || isSaving;
  const setDraft = useCallback((vertices: Point[]) => {
    pointsRef.current = vertices;
    setPoints(vertices);
  }, []);
  const pointAt = useCallback((point: Point | null) => {
    cursorRef.current = point;
    setCursor(point);
  }, []);
  const cancel = useCallback(() => {
    gesture.current = null;
    setDraft([]);
    pointAt(null);
  }, [setDraft, pointAt]);
  const addVertex = useCallback((point: Point) => {
    const last = pointsRef.current[pointsRef.current.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 1e-6) {
      setDraft([...pointsRef.current, point]);
    }
  }, [setDraft]);
  const submit = useCallback(async () => {
    const vertices = pointsRef.current;
    if (!active || disabled || savingRef.current || vertices.length < 2) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    cancel();
    try {
      await mutate('add', { id: crypto.randomUUID(), color: '#ff7970', widthCells: 0.05, points: vertices });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Muro non salvato. Riprova.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [active, disabled, cancel, mutate]);

  useEffect(() => { cancel(); }, [scene.id, active, disabled, mode, cancel]);
  useEffect(() => {
    if (!active || unavailable) return;
    const listener = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'Escape' && (pointsRef.current.length || gesture.current)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
        return;
      }
      if (mode !== 'segments' || target !== overlayRef.current) return;
      if (event.key.startsWith('Arrow') || event.key.toLowerCase() === 'v') {
        event.preventDefault();
        event.stopImmediatePropagation();
        const origin = cursorRef.current ?? pointsRef.current[pointsRef.current.length - 1] ?? {
          x: (preview.left + preview.width / 2) / BOARD_CONFIG.cellSize,
          y: (preview.top + preview.height / 2) / BOARD_CONFIG.cellSize,
        };
        if (event.key.toLowerCase() === 'v') { addVertex(origin); return; }
        const step = event.shiftKey ? 0.25 : 1;
        pointAt({
          x: Math.max(0, origin.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)),
          y: Math.max(0, origin.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)),
        });
      } else if ([' ', 'Enter', 'Backspace'].includes(event.key) && pointsRef.current.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === 'Backspace') setDraft(pointsRef.current.slice(0, -1));
        else if (!event.repeat) void submit();
      }
    };
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, [active, unavailable, mode, preview.left, preview.top, preview.width, preview.height,
    cancel, addVertex, pointAt, setDraft, submit]);

  const at = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, (((event.clientX - box.left) / box.width) * preview.width + preview.left) / BOARD_CONFIG.cellSize),
      y: Math.max(0, (((event.clientY - box.top) / box.height) * preview.height + preview.top) / BOARD_CONFIG.cellSize),
    };
  };
  const nextSegment = mode === 'segments' && cursor && points.length ? [points[points.length - 1], cursor] : [];
  return (
    <section aria-label="Muri della scena" className="scene-encounters">
      <div className="scene-catalog__drawing-tools">
        <button className="secondary-button" type="button" disabled={unavailable}
          aria-pressed={active} onClick={() => onActive(!active)}>Disegna muri</button>
        <div className="scene-wall-editor__modes" role="group" aria-label="Modalità muri">
          {(['freehand', 'segments'] as const).map((value) => (
            <button key={value} type="button" className="scene-catalog__drawing-tool"
              aria-pressed={mode === value} disabled={unavailable}
              onClick={() => { cancel(); setMode(value); }}>
              {value === 'freehand' ? 'Libero' : 'Segmenti'}
            </button>
          ))}
        </div>
        {active && mode === 'segments' ? <>
          <button className="secondary-button" type="button" disabled={unavailable || points.length < 2}
            onClick={() => void submit()}>{isSaving ? 'Salvataggio…' : 'Conferma muro'}</button>
          <button className="secondary-button" type="button" disabled={unavailable || !points.length}
            onClick={cancel}>Annulla bozza</button>
        </> : null}
        <button className="secondary-button" type="button" disabled={unavailable || !scene.wallHistory?.canUndo}
          onClick={() => void mutate('undo')}>Annulla muro</button>
        <button className="secondary-button" type="button" disabled={unavailable || !scene.wallHistory?.canRedo}
          onClick={() => void mutate('redo')}>Ripeti muro</button>
      </div>
      <p id={hintId} role="status">
        {mode === 'segments'
          ? `Clic per aggiungere vertici · ${points.length} punti. Spazio o Invio conferma, Backspace toglie l’ultimo, Esc annulla. Frecce e V per disegnare da tastiera; Shift per passi fini.`
          : 'Ripassa i muri sulla foto e rilascia per salvare. Esc annulla il tratto.'}
      </p>
      <small>I muri bloccano luce e visuale, non il movimento.</small>
      {saveError ? <p role="alert">{saveError}</p> : null}
      <ul>
        {(scene.document.walls ?? []).map((item, i) => (
          <li key={item.id}>
            Muro {i + 1} · {item.points.length} punti{' '}
            <button className="secondary-button" type="button" disabled={unavailable}
              aria-label={`Cancella muro ${i + 1}`} onClick={() => void mutate('remove', undefined, item.id)}>Cancella muro</button>
          </li>
        ))}
      </ul>
      {preview.host && preview.width > 0 ? createPortal(
        <svg ref={overlayRef} aria-label="Tracciamento muri" aria-describedby={hintId}
          tabIndex={active && !unavailable ? 0 : -1}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 9,
            pointerEvents: active && !unavailable ? 'auto' : 'none', touchAction: 'none' }}
          viewBox={`${preview.left / BOARD_CONFIG.cellSize} ${preview.top / BOARD_CONFIG.cellSize} ${preview.width / BOARD_CONFIG.cellSize} ${preview.height / BOARD_CONFIG.cellSize}`}
          onPointerDown={(event) => {
            if (unavailable || !active || event.button !== 0 || event.ctrlKey || event.metaKey) return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.focus({ preventScroll: true });
            setSaveError(null);
            const point = at(event);
            if (mode === 'segments') { addVertex(point); pointAt(point); return; }
            event.currentTarget.setPointerCapture(event.pointerId);
            gesture.current = { pointerId: event.pointerId };
            setDraft([point]);
          }}
          onPointerMove={(event) => {
            if (unavailable || !active) return;
            const point = at(event);
            if (mode === 'segments') { pointAt(point); return; }
            if (gesture.current?.pointerId !== event.pointerId) return;
            const last = pointsRef.current[pointsRef.current.length - 1];
            if (Math.hypot(point.x - last.x, point.y - last.y) >= 0.02) addVertex(point);
          }}
          onPointerUp={(event) => {
            if (mode !== 'freehand' || gesture.current?.pointerId !== event.pointerId) return;
            addVertex(at(event));
            if (pointsRef.current.length < 2) cancel();
            else void submit();
          }}
          onPointerLeave={() => { if (mode === 'segments') pointAt(null); }}
          onPointerCancel={() => { if (mode === 'freehand') cancel(); }}
          onLostPointerCapture={() => { if (mode === 'freehand') cancel(); }}
        >
          {(scene.document.walls ?? []).map((item) => (
            <polyline key={item.id} points={item.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="#ff7970" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
          ))}
          {points.length ? <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none" stroke="#ffb3a9" strokeWidth="2"
            vectorEffect="non-scaling-stroke" pointerEvents="none" /> : null}
          {nextSegment.length ? <polyline points={nextSegment.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none" stroke="#ffb3a9" strokeWidth="2" strokeDasharray="5 3"
            vectorEffect="non-scaling-stroke" pointerEvents="none" /> : null}
          {mode === 'segments' ? points.map((point, i) => (
            <circle key={i} cx={point.x} cy={point.y} r={0.07} fill="#ff7970" stroke="#fff"
              strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none" />
          )) : null}
          {mode === 'segments' && cursor ? <circle cx={cursor.x} cy={cursor.y} r={0.06}
            fill="none" stroke="#ffb3a9" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none" /> : null}
        </svg>, preview.host,
      ) : null}
    </section>
  );
}
