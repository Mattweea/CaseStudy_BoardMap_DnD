import { BOARD_CONFIG } from '../constants/board.ts';
import type { DndSize, GridPosition, UnitToken } from '../types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampZoom(zoom: number): number {
  return clamp(zoom, BOARD_CONFIG.minZoom, BOARD_CONFIG.maxZoom);
}

// La camera resta frazionaria: solo il limite inferiore è un confine continuo, perché il
// mondo non ha un bordo destro o inferiore fisso. Nessun arrotondamento a cella intera qui,
// altrimenti reintroduce la quantizzazione che lo spostamento continuo deve eliminare.
export function clampCamera(position: GridPosition): GridPosition {
  return {
    x: Math.max(0, position.x),
    y: Math.max(0, position.y),
  };
}

// Sorgente del gesto: rotella classica o superficie trackpad. Indipendente da `ctrlKey`,
// perché il pinch del trackpad arriva anch'esso come `wheel` con `ctrlKey: true` e ha comunque
// la forma di un trackpad (delta piccoli e spesso frazionari); l'azione risultante si decide
// combinando questa sorgente con `ctrlKey` in `wheelAction`.
export type WheelSourceKind = 'wheel' | 'trackpad';

// Una rotella classica emette righe/pagine o uno scatto di almeno ~100 px in `deltaY`, senza
// `deltaX`. Un trackpad emette delta in pixel piccoli: su Windows spesso interi e, in uno
// scorrimento solo verticale, senza `deltaX`, quindi né l'interezza né l'assenza di `deltaX`
// bastano a indicare una rotella. Il primo evento di un gesto del trackpad è piccolo, e la
// classificazione per raffica tiene la sorgente anche quando il gesto accelera oltre i 50 px.
export function classifyWheelSource(event: {
  deltaMode: number;
  deltaX: number;
  deltaY: number;
}): WheelSourceKind {
  if (event.deltaMode !== 0) {
    // DOM_DELTA_PIXEL === 0; righe o pagine sono sempre una rotella.
    return 'wheel';
  }

  if (event.deltaX !== 0) {
    return 'trackpad';
  }

  return Math.abs(event.deltaY) >= 50 ? 'wheel' : 'trackpad';
}

const WHEEL_BURST_GAP_MS = 100;

export interface WheelBurstState {
  kind: WheelSourceKind;
  lastEventTime: number;
}

// La classificazione resta fissa per l'intera raffica (eventi distanti meno di
// `WHEEL_BURST_GAP_MS`), perché una raffica di trackpad contiene sia delta grandi che
// piccoli: riclassificare a metà gesto farebbe alternare pan e zoom nello stesso movimento.
export function classifyWheelBurst(
  event: { deltaMode: number; deltaX: number; deltaY: number },
  now: number,
  previous: WheelBurstState | null,
): WheelBurstState {
  if (previous && now - previous.lastEventTime < WHEEL_BURST_GAP_MS) {
    return { kind: previous.kind, lastEventTime: now };
  }

  return { kind: classifyWheelSource(event), lastEventTime: now };
}

export type WheelAction = 'zoom' | 'pan-xy' | 'pan-x' | 'pan-y';

// Tabella prodotto: la rotella da sola ingrandisce, con Ctrl sposta la visuale in verticale,
// con Alt in orizzontale; il trackpad senza Ctrl (scorrimento a due dita) sposta la visuale
// sui due assi, il trackpad con Ctrl (pinch, sintetizzato dal browser) ingrandisce ancorato
// alle dita.
export function wheelAction(
  modifiers: { ctrlKey: boolean; altKey: boolean },
  source: WheelSourceKind,
): WheelAction {
  if (source === 'trackpad') {
    return modifiers.ctrlKey ? 'zoom' : 'pan-xy';
  }

  if (modifiers.ctrlKey) {
    return 'pan-y';
  }

  return modifiers.altKey ? 'pan-x' : 'zoom';
}

// D3: zoom moltiplicativo invece che a passo additivo, percettivamente uniforme a ogni scala.
export function applyZoomDelta(zoom: number, deltaY: number, factorPerPixel: number): number {
  return clampZoom(zoom * Math.exp(-deltaY * factorPerPixel));
}

// D4: la camera si corregge in modo che la coordinata mondo sotto `pointer` (in pixel,
// relativi all'origine del palco) resti la stessa prima e dopo la variazione di zoom.
// `nextZoom` è già il valore applicato (eventualmente ridimensionato ai limiti): l'invariante
// resta esatta anche quando lo zoom è stato ridimensionato.
export function zoomAtPoint(
  camera: GridPosition,
  zoom: number,
  nextZoom: number,
  pointer: { x: number; y: number },
): GridPosition {
  const worldX = camera.x + pointer.x / (BOARD_CONFIG.cellSize * zoom);
  const worldY = camera.y + pointer.y / (BOARD_CONFIG.cellSize * zoom);

  return clampCamera({
    x: worldX - pointer.x / (BOARD_CONFIG.cellSize * nextZoom),
    y: worldY - pointer.y / (BOARD_CONFIG.cellSize * nextZoom),
  });
}

export function gridToPixels(position: GridPosition): GridPosition {
  return {
    x: position.x * BOARD_CONFIG.cellSize,
    y: position.y * BOARD_CONFIG.cellSize,
  };
}

export function sizeToCells(size: DndSize): number {
  switch (size) {
    case 'large':
      return 2;
    case 'huge':
      return 3;
    case 'gargantuan':
      return 4;
    case 'tiny':
    case 'small':
    case 'medium':
    default:
      return 1;
  }
}

export function viewportPointToWorldCell(
  clientX: number,
  clientY: number,
  stageRect: DOMRect,
  zoom: number,
  camera: GridPosition,
): GridPosition {
  const xInBoard = (clientX - stageRect.left) / zoom;
  const yInBoard = (clientY - stageRect.top) / zoom;

  // La cella si arrotonda dopo avere sommato la camera (D5): con una camera frazionaria,
  // arrotondare prima produrrebbe una cella frazionaria. Equivalente al comportamento
  // precedente quando la camera è intera.
  return {
    x: Math.floor(xInBoard / BOARD_CONFIG.cellSize + camera.x),
    y: Math.floor(yInBoard / BOARD_CONFIG.cellSize + camera.y),
  };
}

export function boardPixelSize(columns: number, rows: number): { width: number; height: number } {
  return {
    width: columns * BOARD_CONFIG.cellSize,
    height: rows * BOARD_CONFIG.cellSize,
  };
}

export function gridRowToLabel(index: number): string {
  let value = Math.max(1, index + 1);
  let result = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

export function rowLabelToGridIndex(label: string): number {
  const normalized = label.trim().toUpperCase();
  if (!normalized) {
    return 0;
  }

  let value = 0;
  for (const character of normalized) {
    const code = character.charCodeAt(0);
    if (code < 65 || code > 90) {
      continue;
    }

    value = value * 26 + (code - 64);
  }

  return Math.max(0, value - 1);
}

export function gridColumnToLabel(index: number): string {
  return String(Math.max(1, index + 1));
}

export function getTokenFootprint(token: UnitToken): { width: number; height: number } {
  const width =
    typeof token.widthCells === 'number' && token.widthCells > 0
      ? Math.max(1, Math.floor(token.widthCells))
      : sizeToCells(token.size);
  const height =
    typeof token.heightCells === 'number' && token.heightCells > 0
      ? Math.max(1, Math.floor(token.heightCells))
      : sizeToCells(token.size);

  return { width, height };
}
