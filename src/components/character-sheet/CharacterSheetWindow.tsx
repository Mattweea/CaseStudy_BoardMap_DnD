import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useCharacterSheet } from '../../hooks/useCharacterSheet';
import type { DiceRollLog, DiceRollSourceRequest, SessionMode } from '../../types';
import { buildClearOperations } from './clearOperations';
import { CharacterTab } from './CharacterTab';
import { SpellsTab } from './SpellsTab';
import { StoryTab } from './StoryTab';
import '../../styles/character-sheet.css';

type TabId = 'character' | 'story' | 'spells';
type WindowPosition = { x: number; y: number };
type DragState = { pointerId: number; offsetX: number; offsetY: number };
type RollVisibility = 'public' | 'secret';

const tabs: Array<[TabId, string]> = [['character', 'Personaggio e combattimento'], ['story', 'Aspetto e storia'], ['spells', 'Incantesimi']];
const saveLabels = { loading: 'Caricamento', editing: 'Modifica in corso', saving: 'Salvataggio', saved: 'Salvato', error: 'Errore' } as const;
const positionStorageKey = 'board-map:character-sheet-position';
const compactViewportQuery = '(max-width: 820px)';
const windowGutter = 12;

// L'interruttore vale per la singola scheda e resta locale al browser, come le preferenze di
// presentazione dei dadi: non è un fatto della sessione, ma di chi tira da quella scheda.
function rollVisibilityStorageKey(sheetId: string) {
  return `board-map:character-sheet-roll-visibility:${sheetId}`;
}

function readStoredRollVisibility(sheetId: string): RollVisibility {
  try {
    return window.localStorage.getItem(rollVisibilityStorageKey(sheetId)) === 'secret' ? 'secret' : 'public';
  } catch {
    return 'public';
  }
}

function storeRollVisibility(sheetId: string, value: RollVisibility) {
  try {
    window.localStorage.setItem(rollVisibilityStorageKey(sheetId), value);
  } catch {
    // L'interruttore resta utilizzabile anche senza storage persistente.
  }
}

function isCompactViewport() {
  return window.matchMedia(compactViewportQuery).matches;
}

function clampPosition(element: HTMLElement, position: WindowPosition): WindowPosition {
  const maxX = Math.max(windowGutter, window.innerWidth - element.offsetWidth - windowGutter);
  const maxY = Math.max(windowGutter, window.innerHeight - element.offsetHeight - windowGutter);
  return {
    x: Math.min(maxX, Math.max(windowGutter, position.x)),
    y: Math.min(maxY, Math.max(windowGutter, position.y)),
  };
}

function readStoredPosition(): WindowPosition | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(positionStorageKey) ?? 'null') as Partial<WindowPosition> | null;
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) ? { x: Number(value.x), y: Number(value.y) } : null;
  } catch {
    return null;
  }
}

function storePosition(position: WindowPosition) {
  try {
    window.localStorage.setItem(positionStorageKey, JSON.stringify(position));
  } catch {
    // The sheet remains movable when storage is unavailable.
  }
}

export function CharacterSheetWindow({ sheetId, isOpen, title, onClose, onRoll, diceLogs, sessionMode }: {
  sheetId: string | null; isOpen: boolean; title: string; onClose: () => void;
  onRoll?: (request: DiceRollSourceRequest) => void; diceLogs?: DiceRollLog[]; sessionMode?: SessionMode;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('character');
  const [rollVisibility, setRollVisibility] = useState<RollVisibility>('public');
  const [position, setPosition] = useState<WindowPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const positionRef = useRef<WindowPosition | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<() => Promise<void>>(async () => undefined);
  const { sheet, draft, saveState, error, conflicts, patch, flush, uploadPortrait } = useCharacterSheet(sheetId, isOpen);

  const close = async () => { await flush(); onClose(); };
  closeRef.current = close;

  useEffect(() => {
    setRollVisibility(sheetId ? readStoredRollVisibility(sheetId) : 'public');
  }, [sheetId]);

  const toggleRollVisibility = () => {
    if (!sheetId) return;
    const next: RollVisibility = rollVisibility === 'secret' ? 'public' : 'secret';
    setRollVisibility(next);
    storeRollVisibility(sheetId, next);
  };

  const moveWindow = (nextPosition: WindowPosition, persist = false) => {
    const element = dialogRef.current;
    if (!element || isCompactViewport()) return;
    const clamped = clampPosition(element, nextPosition);
    positionRef.current = clamped;
    setPosition(clamped);
    if (persist) storePosition(clamped);
  };

  useLayoutEffect(() => {
    const element = dialogRef.current;
    if (!isOpen || !element) return;
    if (isCompactViewport()) {
      positionRef.current = null;
      setPosition(null);
      return;
    }
    const stored = readStoredPosition();
    const initial = stored ?? {
      x: (window.innerWidth - element.offsetWidth) / 2,
      y: (window.innerHeight - element.offsetHeight) / 2,
    };
    const clamped = clampPosition(element, initial);
    positionRef.current = clamped;
    setPosition(clamped);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let resizeFrame = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        const element = dialogRef.current;
        if (!element) return;
        if (isCompactViewport()) {
          positionRef.current = null;
          setPosition(null);
          return;
        }
        const fallback = readStoredPosition() ?? {
          x: (window.innerWidth - element.offsetWidth) / 2,
          y: (window.innerHeight - element.offsetHeight) / 2,
        };
        moveWindow(positionRef.current ?? fallback, true);
      });
    };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(resizeFrame); window.removeEventListener('resize', onResize); };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement as HTMLElement;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('[data-sheet-close]')?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      returnFocusRef.current?.focus();
    };
  }, [isOpen]);

  const onDragStart = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || isCompactViewport() || target.closest('button, input, textarea, select, a')) return;
    const element = dialogRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    moveWindow({ x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY });
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setIsDragging(false);
    if (positionRef.current) storePosition(positionRef.current);
  };

  const onMoveKey = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.currentTarget !== event.target || !event.altKey || isCompactViewport()) return;
    const movement: Record<string, WindowPosition> = {
      ArrowLeft: { x: -16, y: 0 },
      ArrowRight: { x: 16, y: 0 },
      ArrowUp: { x: 0, y: -16 },
      ArrowDown: { x: 0, y: 16 },
    };
    const delta = movement[event.key];
    if (!delta) return;
    event.preventDefault();
    const current = positionRef.current ?? { x: windowGutter, y: windowGutter };
    moveWindow({ x: current.x + delta.x, y: current.y + delta.y }, true);
  };

  if (!isOpen) return null;
  const windowStyle: CSSProperties | undefined = position ? { left: position.x, top: position.y } : undefined;
  const windowClassName = ['character-sheet-window', position ? 'character-sheet-window--positioned' : '', isDragging ? 'character-sheet-window--dragging' : ''].filter(Boolean).join(' ');

  return <div className="character-sheet-overlay" role="presentation">
    <div className={windowClassName} style={windowStyle} ref={dialogRef} role="dialog" aria-modal="false" aria-labelledby="character-sheet-title">
      <header className="character-sheet-window__bar" tabIndex={0} aria-label="Sposta la scheda. Trascina oppure usa Alt più i tasti freccia." title="Trascina per spostare · Alt + frecce da tastiera" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={finishDrag} onPointerCancel={finishDrag} onKeyDown={onMoveKey}>
        <div className="character-sheet-window__title"><span className="character-sheet-window__grip" aria-hidden="true">⠿</span><div><p>Archivio dell’avventuriero</p><h2 id="character-sheet-title">{title}</h2></div></div>
        {import.meta.env.DEV && draft ? <button type="button" className="sheet-debug-clear" onClick={() => {
          if (!window.confirm('Debug: svuotare tutti i campi della scheda? La modifica viene sincronizzata con gli altri partecipanti.')) return;
          buildClearOperations(draft).forEach((operation) => patch(operation));
        }} title="Solo in sviluppo: svuota ogni campo della scheda">Svuota scheda</button> : null}
        <button
          type="button" className={`sheet-roll-visibility sheet-roll-visibility--${rollVisibility}`}
          onClick={toggleRollVisibility} aria-pressed={rollVisibility === 'secret'}
          title="Vale per i tiri fatti da questa scheda"
        >{rollVisibility === 'secret' ? 'Tiri: Segreti' : 'Tiri: Pubblici'}</button>
        <div className={`sheet-save-state sheet-save-state--${saveState}`} role="status"><span aria-hidden="true" />{saveLabels[saveState]}</div>
        <button type="button" data-sheet-close className="character-sheet-window__close" onClick={() => void close()} aria-label="Chiudi scheda">×</button>
      </header>
      <nav className="character-sheet-tabs" role="tablist" aria-label="Sezioni della scheda">{tabs.map(([id, label], index) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} tabIndex={activeTab === id ? 0 : -1} onClick={() => setActiveTab(id)} onKeyDown={(event) => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length; setActiveTab(tabs[next][0]); requestAnimationFrame(() => dialogRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()); }}>{label}</button>)}</nav>
      {error ? <div className="sheet-alert" role="alert"><strong>{saveState === 'error' ? 'La pergamena non è stata salvata.' : 'Attenzione'}</strong><span>{error}</span></div> : null}
      {conflicts.length ? <div className="sheet-conflicts" role="alert"><strong>Conflitto da risolvere</strong>{conflicts.map((conflict) => <p key={conflict.path}><code>{conflict.path}</code>: il tuo valore <b>{String(conflict.localValue ?? '')}</b>, sul server <b>{String(conflict.value ?? '')}</b>.</p>)}</div> : null}
      <div className="character-sheet-window__scroll" role="tabpanel">
        {!draft ? <div className="sheet-loading">Apro la scheda…</div> : activeTab === 'character' ? <CharacterTab data={draft} patch={patch} sheetId={sheetId ?? undefined} onRoll={onRoll} diceLogs={diceLogs} rollVisibility={rollVisibility} sessionMode={sessionMode} /> : activeTab === 'story' ? <StoryTab data={draft} portraitUrl={sheet?.portraitUrl ?? null} patch={patch} onPortrait={(file) => void uploadPortrait(file)} /> : <SpellsTab data={draft} patch={patch} />}
      </div>
    </div>
  </div>;
}
