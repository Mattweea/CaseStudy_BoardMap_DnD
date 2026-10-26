import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
export function SceneWallEditor({ scene, preview, disabled, active, onActive, mutate }: Props) {
  const gesture = useRef<{ pointerId: number; points: { x: number; y: number }[] } | null>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [segment, setSegment] = useState({ x1: '0', y1: '0', x2: '1', y2: '0' });
  const cancel = () => {
    gesture.current = null;
    setPoints([]);
  };
  useEffect(() => {
    cancel();
  }, [scene.id, active, disabled]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  const wall = (vertices: { x: number; y: number }[]): SceneDrawing => ({
    id: crypto.randomUUID(),
    color: '#ff7970',
    widthCells: 0.05,
    points: vertices,
  });
  const at = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: (((event.clientX - box.left) / box.width) * preview.width + preview.left) / 48,
      y: (((event.clientY - box.top) / box.height) * preview.height + preview.top) / 48,
    };
  };
  return (
    <section aria-label="Muri della scena" className="scene-encounters">
      <div className="scene-catalog__drawing-tools">
        <button
          className="secondary-button"
          type="button"
          disabled={disabled}
          aria-pressed={active}
          onClick={() => onActive(!active)}
        >
          Disegna muri
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={disabled || !scene.wallHistory?.canUndo}
          onClick={() => void mutate('undo')}
        >
          Annulla muro
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={disabled || !scene.wallHistory?.canRedo}
          onClick={() => void mutate('redo')}
        >
          Ripeti muro
        </button>
      </div>
      <small>Ripassa i muri sulla foto: bloccano luce e visuale, non il movimento. Esc annulla il tratto.</small>
      <ul>
        {(scene.document.walls ?? []).map((item, i) => (
          <li key={item.id}>
            Muro {i + 1} · {item.points.length} punti{' '}
            <button
              className="secondary-button"
              type="button"
              disabled={disabled}
              aria-label={`Cancella muro ${i + 1}`}
              onClick={() => void mutate('remove', undefined, item.id)}
            >
              Cancella muro
            </button>
          </li>
        ))}
      </ul>
      <details>
        <summary>Segmento da tastiera</summary>
        <div className="scene-entity-editor__fields">
          {(['x1', 'y1', 'x2', 'y2'] as const).map((key) => (
            <label key={key}>
              {key} (caselle, da 0)
              <input
                type="number"
                min="0"
                step="any"
                value={segment[key]}
                disabled={disabled}
                onChange={(e) => setSegment({ ...segment, [key]: e.target.value })}
              />
            </label>
          ))}
          <button
            className="secondary-button"
            type="button"
            disabled={disabled}
            onClick={() =>
              void mutate(
                'add',
                wall([
                  { x: Number(segment.x1), y: Number(segment.y1) },
                  { x: Number(segment.x2), y: Number(segment.y2) },
                ]),
              )
            }
          >
            Aggiungi segmento muro
          </button>
        </div>
      </details>
      {preview.host && preview.width > 0
        ? createPortal(
            <svg
              aria-label="Tracciamento muri"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                zIndex: 9,
                pointerEvents: active && !disabled ? 'auto' : 'none',
                touchAction: 'none',
              }}
              viewBox={`${preview.left / 48} ${preview.top / 48} ${preview.width / 48} ${preview.height / 48}`}
              onPointerDown={(event) => {
                if (disabled || !active || event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                gesture.current = { pointerId: event.pointerId, points: [at(event)] };
                setPoints(gesture.current.points);
              }}
              onPointerMove={(event) => {
                const current = gesture.current;
                if (!current || current.pointerId !== event.pointerId) return;
                const next = at(event),
                  last = current.points[current.points.length - 1];
                if (Math.hypot(next.x - last.x, next.y - last.y) < 0.02) return;
                current.points = [...current.points, next];
                setPoints(current.points);
              }}
              onPointerUp={(event) => {
                const current = gesture.current;
                if (!current || current.pointerId !== event.pointerId) return;
                const end = at(event),
                  vertices = [...current.points, end];
                cancel();
                if (vertices.some((p) => Math.hypot(p.x - vertices[0].x, p.y - vertices[0].y) > 0.001))
                  void mutate('add', wall(vertices));
              }}
              onPointerCancel={cancel}
            >
              {[...(scene.document.walls ?? []), ...(points.length ? [wall(points)] : [])].map((item, i) => (
                <polyline
                  key={i}
                  points={item.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#ff7970"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              ))}
            </svg>,
            preview.host,
          )
        : null}
    </section>
  );
}
