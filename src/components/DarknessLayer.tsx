import { useId } from 'react';

interface DarknessLayerProps {
  width: number;
  height: number;
  cellSize: number;
  paths: string[];
}

/** Feather the union inward: neither the blur nor a stroke may enlarge visibility. */
export function DarknessLayer({ width, height, cellSize, paths }: DarknessLayerProps) {
  const id = useId().replace(/:/g, '');
  const feather = cellSize / 4;
  return (
    <svg
      className="board-darkness-layer"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        <filter
          id={`${id}-feather`}
          filterUnits="userSpaceOnUse"
          x={-feather * 4}
          y={-feather * 4}
          width={width + feather * 8}
          height={height + feather * 8}
          colorInterpolationFilters="sRGB"
        >
          <feMorphology in="SourceGraphic" operator="erode" radius={feather / 2} />
          <feGaussianBlur stdDeviation={feather / 4} />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
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
          <g fill="black" filter={`url(#${id}-feather)`}>
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
