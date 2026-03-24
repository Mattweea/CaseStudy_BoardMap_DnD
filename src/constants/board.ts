export const BOARD_CONFIG = {
  cellSize: 48,
  minZoom: 0.6,
  maxZoom: 2.2,
  zoomStep: 0.2,
  minVisibleColumns: 30,
  minVisibleRows: 30,
  panStep: 6,
} as const;

export const STORAGE_KEY = 'dnd-battle-map-state';
