import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LightSource } from '../types';
import type { PlacementPreview } from './SceneEncounterPlacementSection';
import { BOARD_CONFIG } from '../constants/board';
interface Props {
  sceneId: string; lights: LightSource[]; dirty: boolean; disabled: boolean;
  preview: PlacementPreview; active: boolean; onActive: (active: boolean) => void;
  onChange: (lights: LightSource[]) => void; onSave: () => Promise<boolean>; onCancel: () => void;
}
export function SceneLightEditor({ sceneId, lights, dirty, disabled, preview, active, onActive, onChange, onSave, onCancel }: Props) {
  const [selectedId, select] = useState<string | null>(null);
  const drag = useRef<{ id: number; before: LightSource[] } | null>(null);
  const selected = lights.find((light) => light.id === selectedId) ?? null;
  const lightsRef = useRef(lights); lightsRef.current = lights;
  const updateLights = (next: LightSource[]) => { lightsRef.current = next; onChange(next); };
  const selectLight = (id: string) => { drag.current = null; select(id); onActive(true); };
  const cancelDrag = () => { if (drag.current) { updateLights(drag.current.before); drag.current = null; } };
  useEffect(() => { select(null); drag.current = null; }, [sceneId]);
  useEffect(() => {
    if (!active) cancelDrag();
  }, [active]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault(); event.stopImmediatePropagation(); cancelDrag();
      }
    };
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  });
  const patch = (value: Partial<LightSource>) => {
    if (selectedId) updateLights(lightsRef.current.map((light) => light.id === selectedId ? { ...light, ...value } : light));
  };
  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: Math.floor(((event.clientX - box.left) / box.width * preview.width + preview.left) / BOARD_CONFIG.cellSize),
      y: Math.floor(((event.clientY - box.top) / box.height * preview.height + preview.top) / BOARD_CONFIG.cellSize) };
  };
  return <section className="scene-light-editor scene-encounters" aria-label="Luci della scena">
    <h4>Luci puntuali</h4>
    <p className="scene-catalog__hint">Aggiungi e posiziona le luci sulla mappa o inserisci le coordinate. Puoi modificarne più di una, poi confermarle tutte con Salva luci.</p>
    <div className="scene-catalog__drawing-tools">
      <button type="button" className="secondary-button" disabled={disabled} onClick={() => {
        const light = { id: crypto.randomUUID(), position: { x: 0, y: 0 }, radiusCells: 6 };
        updateLights([...lightsRef.current, light]); selectLight(light.id);
      }}>Aggiungi luce</button>
      <button type="button" className="secondary-button" disabled={disabled || !selected} aria-pressed={active}
        onClick={() => onActive(!active)}>Posiziona luce</button>
    </div>
    <ul className="scene-light-editor__list">{lights.map((light, index) => <li key={light.id}>
      <button type="button" disabled={disabled} aria-pressed={light.id === selectedId}
        onClick={() => selectLight(light.id)}>Luce {index + 1} · {Number.isFinite(light.radiusCells) ? `${light.radiusCells} caselle` : 'raggio da impostare'}</button>
    </li>)}</ul>
    {selected ? <div className="scene-entity-editor__fields">
      {(['x', 'y', 'radius'] as const).map((axis) => {
        const value = axis === 'radius' ? selected.radiusCells : selected.position[axis];
        return <label key={axis}>{axis === 'x' ? 'Colonna luce (da 0)' : axis === 'y' ? 'Riga luce (da 0)' : 'Raggio luce (caselle)'}
          <input type="number" step="1" min={axis === 'radius' ? 0 : undefined} max={axis === 'radius' ? 1000 : undefined}
            disabled={disabled} value={Number.isFinite(value) ? value : ''}
            onChange={(e) => {
              const number = e.target.value.trim() === '' ? NaN : Number(e.target.value);
              patch(axis === 'radius' ? { radiusCells: number } : { position: { ...selected.position, [axis]: number } });
            }} /></label>;
      })}
      <button type="button" className="secondary-button" disabled={disabled} onClick={() => {
        drag.current = null; updateLights(lightsRef.current.filter((light) => light.id !== selected.id)); select(null); onActive(false);
      }}>Rimuovi luce</button>
    </div> : null}
    <div className="scene-catalog__draft-actions">
      <button type="button" className="secondary-button" disabled={disabled || !dirty} onClick={onCancel}>Annulla luci</button>
      <button type="button" className="primary-button" disabled={disabled || !dirty} onClick={() => void onSave()}>Salva luci</button>
    </div>
    <small role="status">{dirty ? `${lights.length} luci in bozza · modifiche non ancora salvate` : `${lights.length} luci salvate`}</small>
    {preview.host && preview.width > 0 ? createPortal(<svg aria-label="Posizionamento luci"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 8, touchAction: 'none', pointerEvents: active && !disabled && selected ? 'auto' : 'none' }}
      viewBox={`${preview.left / BOARD_CONFIG.cellSize} ${preview.top / BOARD_CONFIG.cellSize} ${preview.width / BOARD_CONFIG.cellSize} ${preview.height / BOARD_CONFIG.cellSize}`}
      onPointerDown={(e) => {
        if (!active || disabled || !selected || e.button !== 0) return;
        e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { id: e.pointerId, before: structuredClone(lights) }; patch({ position: point(e) });
      }} onPointerMove={(e) => { if (drag.current?.id === e.pointerId) patch({ position: point(e) }); }}
      onPointerUp={(e) => { if (drag.current?.id === e.pointerId) { patch({ position: point(e) }); drag.current = null; } }}
      onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}>
      {lights.filter((light) => Number.isFinite(light.radiusCells) && Number.isFinite(light.position.x) && Number.isFinite(light.position.y)).map((light) => <g key={light.id} pointerEvents="none">
        <circle cx={light.position.x + .5} cy={light.position.y + .5} r={light.radiusCells} fill="#f1c77a" fillOpacity="0.07" stroke="#f1c77a" strokeWidth=".025" strokeDasharray=".12 .1" />
        <circle cx={light.position.x + .5} cy={light.position.y + .5} r=".16" fill="#ffd994" stroke="#70522e" strokeWidth=".04" />
      </g>)}
    </svg>, preview.host) : null}
  </section>;
}
