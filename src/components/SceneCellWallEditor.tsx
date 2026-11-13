import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GridPosition } from '../types';
import type { PersistedScene } from '../utils/sceneApi';
import type { PlacementPreview } from './SceneEncounterPlacementSection';
import { cellKey, lineWallCells, rectangleCells } from '../../shared/wall-cells.mjs';
import { normalizeSceneWallCells } from '../../shared/scene-model.mjs';
import { BOARD_CONFIG } from '../constants/board';

type Tool = 'brush' | 'rectangle' | 'erase';
interface Props {
  scene: PersistedScene; preview: PlacementPreview; disabled: boolean; active: boolean;
  onActive: (active: boolean) => void;
  mutate: (operation: 'add' | 'remove', cells: GridPosition[]) => Promise<boolean>;
}
export function SceneCellWallEditor({ scene, preview, disabled, active, onActive, mutate }: Props) {
  const [tool, setTool] = useState<Tool>('brush');
  const [draft, setDraft] = useState<GridPosition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [coordinates, setCoordinates] = useState({ x: '0', y: '0', x2: '1', y2: '0' });
  const gesture = useRef<{ id: number; start: GridPosition; last: GridPosition; cells: Map<string, GridPosition>; invalid: boolean } | null>(null);
  const savingRef = useRef(false);
  const cancel = useCallback(() => { gesture.current = null; setDraft([]); }, []);
  useEffect(() => { cancel(); }, [scene.id, active, disabled, tool, cancel]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) {
        event.preventDefault(); event.stopImmediatePropagation(); cancel();
      }
    };
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, [cancel]);
  const save = async (cells: GridPosition[], operation: 'add' | 'remove') => {
    if (savingRef.current || disabled) return;
    try {
      const normalized = normalizeSceneWallCells(cells, scene.document.board.dimensions);
      savingRef.current = true; setSaving(true); setError(null);
      if (!await mutate(operation, normalized)) setError('Pareti non salvate. Controlla il messaggio della scena e riprova.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Pareti non salvate.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const at = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor(((event.clientX - box.left) / box.width * preview.width + preview.left) / BOARD_CONFIG.cellSize),
      y: Math.floor(((event.clientY - box.top) / box.height * preview.height + preview.top) / BOARD_CONFIG.cellSize),
    };
  };
  const append = (point: GridPosition) => {
    const current = gesture.current;
    if (!current || current.invalid) return;
    try {
      const next = tool === 'rectangle' ? rectangleCells(current.start, point) : lineWallCells(current.last, point);
      if (tool === 'rectangle') current.cells.clear();
      next.forEach((cell) => current.cells.set(cellKey(cell), cell));
      const cells = normalizeSceneWallCells([...current.cells.values()], scene.document.board.dimensions);
      current.last = point; setDraft(cells);
    } catch (e) { current.invalid = true; setDraft([]); setError(e instanceof Error ? e.message : 'Selezione non valida.'); }
  };
  const unavailable = disabled || saving;
  const byCoordinates = (operation: 'add' | 'remove') => {
    try {
      if (Object.values(coordinates).some((v) => v.trim() === '')) throw Error('Inserisci le coordinate.');
      const a = { x: Number(coordinates.x), y: Number(coordinates.y) };
      const b = { x: Number(coordinates.x2), y: Number(coordinates.y2) };
      normalizeSceneWallCells(tool === 'rectangle' ? [a, b] : [a], scene.document.board.dimensions);
      void save(tool === 'rectangle' ? rectangleCells(a, b) : [a], operation);
    } catch (e) { setError(e instanceof Error ? e.message : 'Coordinate non valide.'); }
  };
  return <section className="scene-cell-walls scene-encounters" aria-label="Pareti a celle">
    <h4>Pareti a celle</h4>
    <div className="scene-catalog__drawing-tools">
      <button type="button" className="secondary-button" aria-pressed={active} disabled={unavailable}
        onClick={() => onActive(!active)}>Costruisci pareti</button>
      <div role="group" aria-label="Strumenti pareti a celle" className="scene-wall-editor__modes">
        {([['brush', 'Pennello'], ['rectangle', 'Rettangolo'], ['erase', 'Gomma pareti']] as const).map(([id, label]) =>
          <button type="button" key={id} className="scene-catalog__drawing-tool" aria-pressed={tool === id}
            disabled={unavailable} onClick={() => { cancel(); setTool(id); onActive(true); }}>{label}</button>)}
      </div>
    </div>
    <p className="scene-catalog__hint">Dipingi o trascina sulla griglia. Rilascia per salvare, Esc annulla. Le pareti unite bloccano movimento, luce e visuale.</p>
    <small role="status">{saving ? 'Salvataggio…' : `${scene.document.wallCells.length} celle salvate${draft.length ? ` · ${draft.length} in bozza` : ''}`}</small>
    {error ? <p role="alert" className="scene-catalog__error">{error}</p> : null}
    <details><summary>Coordinate da tastiera</summary>
      <div className="scene-entity-editor__fields">
        {(['x', 'y', ...(tool === 'rectangle' ? ['x2', 'y2'] : [])] as (keyof typeof coordinates)[]).map((key) =>
          <label key={key}>{({ x: 'Colonna parete (da 0)', y: 'Riga parete (da 0)', x2: 'Colonna finale (da 0)', y2: 'Riga finale (da 0)' })[key]}
            <input type="number" min="0" step="1" value={coordinates[key]} disabled={unavailable}
              onChange={(e) => setCoordinates({ ...coordinates, [key]: e.target.value })} /></label>)}
      </div>
      <button type="button" className="secondary-button" disabled={unavailable} onClick={() => byCoordinates(tool === 'erase' ? 'remove' : 'add')}>
        {tool === 'erase' ? 'Rimuovi celle' : tool === 'rectangle' ? 'Aggiungi rettangolo' : 'Aggiungi cella'}</button>
    </details>
    {preview.host && preview.width > 0 ? createPortal(<svg aria-label="Costruzione pareti sulla griglia"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 9, touchAction: 'none',
        pointerEvents: active && !unavailable ? 'auto' : 'none' }}
      viewBox={`${preview.left / BOARD_CONFIG.cellSize} ${preview.top / BOARD_CONFIG.cellSize} ${preview.width / BOARD_CONFIG.cellSize} ${preview.height / BOARD_CONFIG.cellSize}`}
      onPointerDown={(e) => {
        if (!active || unavailable || e.button !== 0 || e.ctrlKey || e.metaKey) return;
        e.preventDefault(); e.stopPropagation(); setError(null);
        const point = at(e); e.currentTarget.setPointerCapture(e.pointerId);
        gesture.current = { id: e.pointerId, start: point, last: point, cells: new Map(), invalid: false }; append(point);
      }}
      onPointerMove={(e) => { if (gesture.current?.id === e.pointerId) append(at(e)); }}
      onPointerUp={(e) => {
        if (gesture.current?.id !== e.pointerId) return;
        append(at(e)); const current = gesture.current; cancel();
        if (!current.invalid) void save([...current.cells.values()], tool === 'erase' ? 'remove' : 'add');
      }} onPointerCancel={cancel} onLostPointerCapture={cancel}>
      {draft.map((cell) => <rect key={cellKey(cell)} x={cell.x} y={cell.y} width="1" height="1"
        fill={tool === 'erase' ? '#c34e43' : '#e1b785'} opacity="0.6" pointerEvents="none" />)}
    </svg>, preview.host) : null}
  </section>;
}
