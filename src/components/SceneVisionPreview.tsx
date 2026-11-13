import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LightSource, GridPosition, UnitToken } from '../types';
import type { PersistedScene } from '../utils/sceneApi';
import type { PlacementPreview } from './SceneEncounterPlacementSection';
import { collectVisionBlockers } from '../../shared/scene-blockers';
import { clipRegions, regionPaths, visibleRegions } from '../../shared/explored-regions.mjs';
import { normalizeSceneWallCells } from '../../shared/scene-model.mjs';
import { DarknessLayer } from './DarknessLayer';
import { BOARD_CONFIG } from '../constants/board';
interface Props {
  scene: PersistedScene; lights: LightSource[]; fullyLit: boolean; preview: PlacementPreview;
  scale: number; enabled: boolean; onEnabled: (enabled: boolean) => void;
}
export function SceneVisionPreview({ scene, lights, fullyLit, preview, scale, enabled, onEnabled }: Props) {
  const [position, setPosition] = useState<GridPosition>({ x: 0, y: 0 });
  const [radius, setRadius] = useState('12');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setPosition({ x: 0, y: 0 }); setError(null); }, [scene.id, enabled]);
  useEffect(() => {
    if (!enabled) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onEnabled(false); }
    };
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  }, [enabled, onEnabled]);
  const blockers = useMemo(() => collectVisionBlockers([], scene.document.elements, () => ({ width: 1, height: 1 }),
    scene.document.walls, scene.document.wallCells), [scene.document.elements, scene.document.walls, scene.document.wallCells]);
  const radiusCells = Number(radius);
  const radiusValid = radius.trim() !== '' && Number.isFinite(radiusCells) && radiusCells >= 0 && radiusCells <= 1000;
  const lightsValid = lights.every((light) => Number.isFinite(light.radiusCells) && light.radiusCells >= 0 && light.radiusCells <= 1000
    && Number.isSafeInteger(light.position.x) && Number.isSafeInteger(light.position.y));
  const regions = useMemo(() => {
    if (!enabled || !radiusValid || !lightsValid) return [];
    const token: UnitToken = { id: 'local-observer', name: 'Osservatore di prova', type: 'player', size: 'medium',
      color: '#e6be80', initiativeModifier: 0, position, conditions: [] };
    return clipRegions(visibleRegions(token, radiusCells, blockers, lights), scene.document.board.dimensions);
  }, [enabled, radiusValid, lightsValid, radiusCells, position, blockers, lights, scene.document.board.dimensions]);
  const setAt = (point: GridPosition) => {
    try { normalizeSceneWallCells([point], scene.document.board.dimensions); setPosition(point); setError(null); }
    catch { setError('Scegli una cella all’interno della scena.'); }
  };
  const pointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setAt({ x: Math.floor(((event.clientX - box.left) / box.width * preview.width + preview.left) / BOARD_CONFIG.cellSize),
      y: Math.floor(((event.clientY - box.top) / box.height * preview.height + preview.top) / BOARD_CONFIG.cellSize) });
  };
  return <section className="scene-vision-preview scene-encounters" aria-label="Prova della visuale">
    <h4>Prova la visuale</h4>
    <button type="button" className="secondary-button" aria-pressed={enabled} onClick={() => onEnabled(!enabled)}>
      {enabled ? 'Termina prova visuale' : 'Prova visuale'}</button>
    <p className="scene-catalog__hint">Posiziona un osservatore sulla mappa per verificare luce e aperture. La prova resta locale e mostra la visuale attuale, senza il terreno ricordato dal party.</p>
    {enabled ? <>
      <div className="scene-entity-editor__fields">
        <label>Raggio visivo di prova (caselle)<input type="number" min="0" max="1000" value={radius} onChange={(e) => setRadius(e.target.value)} /></label>
        <label>Colonna osservatore (da 0)<input type="number" min="0" step="1" value={position.x} onChange={(e) => setAt({ ...position, x: Number(e.target.value) })} /></label>
        <label>Riga osservatore (da 0)<input type="number" min="0" step="1" value={position.y} onChange={(e) => setAt({ ...position, y: Number(e.target.value) })} /></label>
      </div>
      <p role="status">Visuale di prova · {fullyLit ? 'Luce completa' : 'Buio attivo'} · Esc termina</p>
      {error || !radiusValid || !lightsValid ? <p role="alert">{error ?? (!radiusValid ? 'Inserisci un raggio da 0 a 1000 caselle.' : 'Correggi i valori delle luci per provare la visuale.')}</p> : null}
    </> : null}
    {enabled && preview.host && preview.width > 0 && scale > 0 ? createPortal(<div className="scene-vision-preview__layer" data-vision-preview="true"
      style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
      {!fullyLit ? <DarknessLayer width={preview.width * scale} height={preview.height * scale} cellSize={BOARD_CONFIG.cellSize * scale}
        paths={regionPaths(regions, { x: preview.left / BOARD_CONFIG.cellSize, y: preview.top / BOARD_CONFIG.cellSize }, BOARD_CONFIG.cellSize * scale)} /> : null}
      <svg aria-label="Posizionamento osservatore di prova" viewBox={`${preview.left / BOARD_CONFIG.cellSize} ${preview.top / BOARD_CONFIG.cellSize} ${preview.width / BOARD_CONFIG.cellSize} ${preview.height / BOARD_CONFIG.cellSize}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'auto', touchAction: 'none' }}
        onPointerDown={(e) => { if (e.button === 0) { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); pointer(e); } }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) pointer(e); }}>
        <circle cx={position.x + .5} cy={position.y + .5} r=".3" fill="#edc17f" stroke="#60372d" strokeWidth=".07" />
        <path d={`M${position.x + .2},${position.y + .5}h.6 M${position.x + .5},${position.y + .2}v.6`} stroke="#60372d" strokeWidth=".04" pointerEvents="none" />
      </svg>
    </div>, preview.host) : null}
  </section>;
}
