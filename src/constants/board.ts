export const BOARD_CONFIG = {
  cellSize: 48,
  minZoom: 0.6,
  maxZoom: 2.2,
  minVisibleColumns: 30,
  minVisibleRows: 30,
  // Fattore moltiplicativo per pixel di `deltaY`: zoom' = zoom * exp(-deltaY * k).
  // Calibrati separatamente perché la stessa costante rende la rotella troppo lenta
  // (delta di 100-120 per notch) o il pinch del trackpad nervoso (delta di pochi pixel).
  wheelZoomFactorPerPixel: 0.0018,
  pinchZoomFactorPerPixel: 0.012,
  // Passo moltiplicativo dei pulsanti +/-, condiviso con la progressione dei gesti.
  buttonZoomFactor: 1.2,
} as const;

export const STORAGE_KEY = 'dnd-battle-map-state';
