import { useId } from 'react';

interface DarknessLayerProps {
  width: number;
  height: number;
  cellSize: number;
  paths: string[];
}

/** Unknown terrain is covered by fully opaque black. */
export function DarknessLayer({ width, height, cellSize, paths }: DarknessLayerProps) {
  const id = useId().replace(/:/g, '');
  void cellSize;
  return (
    <svg
      className="board-darkness-layer"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        <mask
          id={`${id}-mask`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={width}
          height={height}
          style={{ maskType: 'luminance' }}
        >
          <rect width={width} height={height} fill="white" />
          <g fill="black">
            {paths.filter(Boolean).map((path, index) => (
              <path key={index} d={path} fillRule="evenodd" />
            ))}
          </g>
        </mask>
      </defs>
      <rect width={width} height={height} fill="#000" mask={`url(#${id}-mask)`} />
    </svg>
  );
}
