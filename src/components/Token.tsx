import type { CSSProperties, MouseEvent, PointerEvent } from 'react';
import type { UnitToken } from '../types';
import { BOARD_CONFIG } from '../constants/board';
import { gridToPixels } from '../utils/board';
import { tokenCompactLabel, tokenTypeLabel, vehicleCompactLabel } from '../utils/tokens';
import { ConditionBadge } from './ConditionBadge';

interface TokenProps {
  token: UnitToken;
  tokens: UnitToken[];
  isSelected: boolean;
  isDragging: boolean;
  displayPosition?: UnitToken['position'];
  footprint: { width: number; height: number };
  zoom: number;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, token: UnitToken) => void;
  onEdit: (tokenId: string) => void;
}

export function Token({
  token,
  tokens,
  isSelected,
  isDragging,
  displayPosition,
  footprint,
  zoom,
  onPointerDown,
  onEdit,
}: TokenProps) {
  const position = displayPosition ?? token.position;
  const pixelPosition = gridToPixels(position);
  const screenWidth = footprint.width * BOARD_CONFIG.cellSize * zoom;
  const screenHeight = footprint.height * BOARD_CONFIG.cellSize * zoom;
  const isCompact = Math.min(screenWidth, screenHeight) <= 34;
  const compactLabel =
    token.type === 'vehicle' ? vehicleCompactLabel(token, tokens) : tokenCompactLabel(token.name);
  const style = {
    width: screenWidth,
    height: screenHeight,
    transform: `translate(${pixelPosition.x * zoom}px, ${pixelPosition.y * zoom}px)`,
    '--token-color': token.color,
  } as CSSProperties;

  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onEdit(token.id);
  };

  return (
    <button
      type="button"
      className={[
        'token',
        `token--${token.type}`,
        isSelected ? 'token--selected' : '',
        isDragging ? 'token--dragging' : '',
        isCompact ? 'token--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      onPointerDown={(event) => onPointerDown(event, token)}
      onContextMenu={handleContextMenu}
      aria-label={`Elemento ${token.name}, ${tokenTypeLabel(token.type)}`}
    >
      {token.conditions.length > 0 ? (
        <span className="token__conditions">
          {token.conditions.map((condition) => (
            <ConditionBadge key={condition} condition={condition} showLabel={false} />
          ))}
        </span>
      ) : null}
      {isCompact ? <span className="token__compact">{compactLabel}</span> : null}
      <span className="token__name">{token.name}</span>
      <span className="token__type">{tokenTypeLabel(token.type)}</span>
    </button>
  );
}
