import { useMemo } from 'react';
import type { GridPosition } from '../types';
import { wallCellPaths } from '../../shared/wall-cells.mjs';
interface Props {
  cells: GridPosition[];
  left: number; top: number; width: number; height: number;
}
export function WallCellsLayer({ cells, left, top, width, height }: Props) {
  const paths = useMemo(() => wallCellPaths(cells), [cells]);
  return <svg className="wall-cells-layer" aria-hidden="true" viewBox={`${left} ${top} ${width} ${height}`}
    preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
    <path d={paths.fill} fill="#51443b" />
    <path d={paths.outline} fill="none" stroke="#e1b785" strokeWidth="0.035" />
  </svg>;
}
