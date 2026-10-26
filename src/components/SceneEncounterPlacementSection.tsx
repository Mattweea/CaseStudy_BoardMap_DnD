import { planEncounterBatch } from '../../shared/encounter-batch.mjs';
import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ScenePreparedPlacement } from '../types';
import type { EncounterPlacementInput, PersistedScene } from '../utils/sceneApi';
import { projectEncounterEntityToken } from '../../shared/encounter-token.mjs';
import { getTokenFootprint } from '../utils/board';

export interface PlacementPreview {
  host: HTMLDivElement | null;
  left: number;
  top: number;
  width: number;
  height: number;
  interactive: boolean;
  onBeginEdit: () => void;
}

export interface EncounterPlacementActions {
  onUndoPlacement?: ()=>Promise<boolean>;
  onCreatePlacement: (encounterId: string, placement: EncounterPlacementInput) => Promise<boolean>;
  onUpdatePlacement: (encounterId: string, placementId: string, placement: EncounterPlacementInput) => Promise<boolean>;
  onRemovePlacement: (encounterId: string, placementId: string) => Promise<boolean>;
}

type Draft = { entityReferenceId: string; x: string; y: string; width: string; height: string; hidden: boolean };
const EMPTY: Draft = { entityReferenceId: '', x: '1', y: '1', width: '', height: '', hidden: false };
function draftOf(placement: ScenePreparedPlacement): Draft {
  return { entityReferenceId: placement.entityReferenceId, x: String(placement.position.x + 1), y: String(placement.position.y + 1),
    width: String(placement.widthCells ?? ''), height: String(placement.heightCells ?? ''), hidden: placement.isHidden ?? false };
}
function payloadOf(draft: Draft): EncounterPlacementInput {
  return { entityReferenceId: draft.entityReferenceId, position: { x: Number(draft.x) - 1, y: Number(draft.y) - 1 },
    widthCells: draft.width === '' ? null : Number(draft.width), heightCells: draft.height === '' ? null : Number(draft.height), isHidden: draft.hidden };
}

export function SceneEncounterPlacementSection({ scene, encounterId, disabled, preview,
  onUndoPlacement, onCreatePlacement, onUpdatePlacement, onRemovePlacement }: EncounterPlacementActions & {
    scene: PersistedScene; encounterId: string; disabled: boolean; preview: PlacementPreview;
  }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [notice, setNotice] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<ScenePreparedPlacement | null>(null);
  const dragCandidate = useRef<ScenePreparedPlacement | null>(null);
  const gesture = useRef<{ pointerId: number; original: ScenePreparedPlacement; x: number; y: number } | null>(null);
  const pending = useRef(false);
  const entities = scene.document.entityReferences.filter((entity) => entity.encounterId === encounterId
    && (entity.entityType === 'monster' || entity.entityType === 'npc'));
  const placements = scene.document.preparedPlacements.filter((placement) => placement.encounterId === encounterId);
  const selected = placements.find((placement) => placement.id === selectedId) ?? null;
  let batchPreview: ScenePreparedPlacement[] = [], batchError = '';
  if (!selected && Number(quantity) !== 1 && draft.entityReferenceId) {
    try { batchPreview = planEncounterBatch(scene.document, encounterId, { ...payloadOf(draft), quantity: Number(quantity) }); }
    catch (error) { batchError = error instanceof Error ? error.message : 'Lotto non valido.'; }
  }
  const reset = () => { setDraft(selected ? draftOf(selected) : EMPTY); setDragPreview(null); gesture.current = null; };

  useEffect(() => {
    setSelectedId(null); setDraft(EMPTY); setQuantity('1'); setConfirmRemove(false); setNotice(null); setDragPreview(null); gesture.current = null;
  }, [scene.id, encounterId]);
  useEffect(() => {
    const current = placements.find((placement) => placement.id === selectedId);
    if (current) setDraft(draftOf(current));
    else if (selectedId) { setSelectedId(null); setDraft(EMPTY); }
    setDragPreview(null); gesture.current = null;
  }, [scene.version]);
  useEffect(() => {
    if (!preview.interactive || disabled) { gesture.current = null; setDragPreview(null); }
  }, [preview.interactive, disabled]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) { event.preventDefault(); gesture.current = null; setDragPreview(null); }
    };
    window.addEventListener('keydown', cancel, true);
    return () => window.removeEventListener('keydown', cancel, true);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || pending.current || !draft.entityReferenceId) return;
    pending.current = true; setNotice(null);
    try {
      const saved = selected ? await onUpdatePlacement(encounterId, selected.id, payloadOf(draft))
        : await onCreatePlacement(encounterId, { ...payloadOf(draft), ...(quantity === '1' ? {} : { quantity: Number(quantity) }) });
      if (saved) { setNotice(selected ? 'Collocazione aggiornata.' : 'Figura collocata sulla scena.'); if (!selected) setDraft(EMPTY); }
    } finally { pending.current = false; }
  };
  const point = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = preview.host!.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width * preview.width + preview.left) / 48,
      y: ((event.clientY - rect.top) / rect.height * preview.height + preview.top) / 48 };
  };
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, placement: ScenePreparedPlacement) => {
    if (disabled || !preview.interactive || pending.current || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); preview.onBeginEdit();
    setSelectedId(placement.id); setDraft(draftOf(placement)); setConfirmRemove(false);
    const start = point(event);
    dragCandidate.current = null;
    gesture.current = { pointerId: event.pointerId, original: placement, ...start };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const position = point(event);
    const entity = entities.find((item) => item.id === current.original.entityReferenceId)!;
    const token = projectEncounterEntityToken({ entity: entity as Parameters<typeof projectEncounterEntityToken>[0]['entity'], placement: current.original });
    const footprint = getTokenFootprint(token);
    const dimensions = scene.document.board.dimensions;
    const candidate = { ...current.original, position: {
      x: Math.max(0, Math.min((dimensions.columns || 1_000_000) - footprint.width, Math.round(current.original.position.x + position.x - current.x))),
      y: Math.max(0, Math.min((dimensions.rows || 1_000_000) - footprint.height, Math.round(current.original.position.y + position.y - current.y))),
    } };
    dragCandidate.current = candidate; setDragPreview(candidate);
  };
  const endDrag = async (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = gesture.current; gesture.current = null;
    const candidate = dragCandidate.current; dragCandidate.current = null;
    if (!current || current.pointerId !== event.pointerId || !candidate || pending.current) { setDragPreview(null); return; }
    if (candidate.position.x === current.original.position.x && candidate.position.y === current.original.position.y) { setDragPreview(null); return; }
    pending.current = true;
    try { await onUpdatePlacement(encounterId, current.original.id, payloadOf(draftOf(candidate))); }
    finally { pending.current = false; setDragPreview(null); }
  };

  return <section className="scene-entity-editor scene-placement-editor" aria-label="Collocazioni dell’encounter">
    <div className="scene-entity-editor__heading">
      <div><h5>Figure sulla mappa</h5><p>Colloca le figure preparate. Se la scena è attiva, compariranno subito sulla board.</p></div>
      <button type="button" className="secondary-button" disabled={disabled || !entities.length}
        onClick={() => { setSelectedId(null); setDraft(EMPTY); setQuantity('1'); setConfirmRemove(false); setNotice(null); }}>Nuova collocazione</button>
    </div>
    <div className="scene-entity-editor__layout">
      <nav aria-label="Figure collocate">{placements.length ? <ul className="scene-encounters__list">{placements.map((placement) => <li key={placement.id}>
        <button type="button" aria-current={placement.id === selectedId ? 'true' : undefined}
          onClick={() => { setSelectedId(placement.id); setDraft(draftOf(placement)); setConfirmRemove(false); setNotice(null); }}>
          <strong>{placement.name ?? entities.find((entity) => entity.id === placement.entityReferenceId)?.name}</strong>
          <span>{placement.isHidden ? 'Nascosta' : 'Visibile'} · {placement.position.x + 1}, {placement.position.y + 1}</span>
        </button></li>)}</ul> : <p className="scene-catalog__hint">Nessuna figura collocata.</p>}</nav>
      <form className="scene-encounters__form" onSubmit={(event) => void submit(event)}>
        {onUndoPlacement ? <button type="button" className="secondary-button" disabled={disabled||!scene.placementHistory?.canUndo}
          onClick={()=>void onUndoPlacement()}>Annulla ultima collocazione / lotto</button> : null}
        <label>Figura<select required value={draft.entityReferenceId} disabled={disabled || Boolean(selected)}
          onChange={(event) => { const entity = entities.find((item) => item.id === event.target.value); setDraft((current) => ({ ...current,
            entityReferenceId: event.target.value, hidden: entity?.tokenProperties?.isInvisible ?? false })); }}>
          <option value="">Scegli una figura</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
        </select></label>
        {!selected ? <label>Quantità<input type="number" min="1" max="100" step="1" required
          value={quantity} disabled={disabled} onChange={(event) => setQuantity(event.target.value)} /></label> : null}
        {batchError ? <p role="alert">{batchError}</p> : null}
        {batchPreview.length ? <div aria-label="Anteprima lotto"><p>Conferma {batchPreview.length} figure nelle posizioni indicate:</p>
          <ul>{batchPreview.map((item) => <li key={item.id}>{item.name} · {item.position.x + 1}, {item.position.y + 1}</li>)}</ul></div> : null}
        <div className="scene-entity-editor__fields">{([['x', 'Colonna', 1], ['y', 'Riga', 1], ['width', 'Larghezza in caselle', 1], ['height', 'Altezza in caselle', 1]] as const).map(([key, label, min]) =>
          <label key={key}>{label}<input type="number" min={min} max={key === 'width' || key === 'height' ? 40 : 1_000_000} step={1}
            required={key === 'x' || key === 'y'} placeholder="Taglia della figura" value={draft[key]} disabled={disabled}
            onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>
        <label><input type="checkbox" checked={draft.hidden} disabled={disabled}
          onChange={(event) => setDraft((current) => ({ ...current, hidden: event.target.checked }))} /> Nascondi ai giocatori</label>
        <div className="scene-encounters__actions">
          <button type="button" className="secondary-button" disabled={disabled} onClick={reset}>Annulla modifiche</button>
          {selected ? <button type="button" className="secondary-button" disabled={disabled} onClick={() => setConfirmRemove(true)}>Rimuovi dalla scena</button> : null}
          <button type="submit" className="primary-button" disabled={disabled || !draft.entityReferenceId || Boolean(batchError)}>{selected ? 'Salva collocazione' : Number(quantity) > 1 ? `Conferma lotto di ${quantity}` : 'Colloca figura'}</button>
        </div>
        {confirmRemove && selected ? <div role="group" aria-label="Conferma rimozione dalla scena">
          <p>Rimuovere questa collocazione? La figura preparata resta nell’encounter.</p>
          <button type="button" disabled={disabled} onClick={() => setConfirmRemove(false)}>Annulla</button>
          <button type="button" disabled={disabled} onClick={async () => {
            if (await onRemovePlacement(encounterId, selected.id)) { setSelectedId(null); setDraft(EMPTY); }
            setConfirmRemove(false);
          }}>Conferma rimozione</button>
        </div> : null}
        {notice ? <p role="status">{notice}</p> : null}
      </form>
    </div>
    {preview.host && preview.width > 0 && preview.height > 0 ? createPortal(<div style={{ position: 'absolute', inset: 0, zIndex: 7, pointerEvents: 'none' }}>
      {placements.map((placement) => {
        const shown = dragPreview?.id === placement.id ? dragPreview : placement;
        const entity = entities.find((item) => item.id === shown.entityReferenceId)!;
        const token = projectEncounterEntityToken({ entity: entity as Parameters<typeof projectEncounterEntityToken>[0]['entity'], placement: shown });
        const footprint = getTokenFootprint(token);
        return <button key={shown.id} type="button" aria-label={`Collocazione ${token.name}`} aria-pressed={shown.id === selectedId}
          disabled={disabled || !preview.interactive} onPointerDown={(event) => startDrag(event, shown)} onPointerMove={moveDrag}
          onPointerUp={(event) => void endDrag(event)} onPointerCancel={() => { gesture.current = null; setDragPreview(null); }}
          onClick={() => { setSelectedId(shown.id); setDraft(draftOf(shown)); }}
          style={{ position: 'absolute', left: `${(shown.position.x * 48 - preview.left) / preview.width * 100}%`,
            top: `${(shown.position.y * 48 - preview.top) / preview.height * 100}%`, width: `${footprint.width * 48 / preview.width * 100}%`,
            height: `${footprint.height * 48 / preview.height * 100}%`, padding: 0, overflow: 'hidden', background: token.color,
            outline: shown.id === selectedId ? '3px solid #ffdb82' : undefined, opacity: token.isInvisible ? .5 : 1,
            touchAction: 'none', pointerEvents: disabled || !preview.interactive ? 'none' : 'auto', fontSize: '.65rem' }}>
          {token.name}
        </button>;
      })}
    </div>, preview.host) : null}
  </section>;
}
