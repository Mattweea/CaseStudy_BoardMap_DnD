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
  isGhost?: boolean;
  displayPosition?: UnitToken['position'];
  footprint: { width: number; height: number };
  zoom: number;
  canEdit?: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, token: UnitToken) => void;
  onEdit: (tokenId: string) => void;
}

export function Token({
  token,
  tokens,
  isSelected,
  isDragging,
  isGhost = false,
  displayPosition,
  footprint,
  zoom,
  canEdit = true,
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
  const maxHp = typeof token.maxHitPoints === 'number' && token.maxHitPoints > 0 ? token.maxHitPoints : null;
  const currentHp = token.hitPoints ?? 0;
  const temporaryHp = token.temporaryHitPoints ?? 0;
  const currentRatio = maxHp ? Math.min(1, Math.max(0, currentHp / maxHp)) : 0;
  const temporaryRatio = maxHp ? Math.min(1, Math.max(0, temporaryHp / maxHp)) : 0;
  const hpTone = currentRatio < 0.2 ? 'danger' : currentRatio <= 0.5 ? 'warn' : 'healthy';
  const style = {
    width: screenWidth,
    height: screenHeight,
    transform: `translate(${pixelPosition.x * zoom}px, ${pixelPosition.y * zoom}px)`,
    '--token-color': token.color,
    '--token-image': token.imageUrl ? `url("${token.imageUrl}")` : 'none',
  } as CSSProperties;

  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (canEdit) {
      onEdit(token.id);
    }
  };

  const handleDoubleClick = () => {
    if (canEdit) {
      onEdit(token.id);
    }
  };

  return (
    <button
      type="button"
      className={[
        'token',
        `token--${token.type}`,
        isSelected ? 'token--selected' : '',
        isDragging ? 'token--dragging' : '',
        isGhost ? 'token--ghost' : '',
        isCompact ? 'token--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      onPointerDown={(event) => onPointerDown(event, token)}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      aria-label={`Elemento ${token.name}, ${tokenTypeLabel(token.type)}${maxHp ? `, Punti ferita ${currentHp} su ${maxHp}${temporaryHp > 0 ? `, ${temporaryHp} temporanei` : ''}` : ''}`}
    >
      {token.conditions.length > 0 ? (
        <span className="token__conditions">
          {token.conditions.map((condition) => (
            <ConditionBadge key={condition} condition={condition} showLabel={false} />
          ))}
        </span>
      ) : null}
      {maxHp ? (
        <span className={`token__hp token__hp--${hpTone} ${currentHp === 0 ? 'token__hp--empty' : ''}`} aria-hidden="true">
          <span className="token__hp-row">
            <span className="token__hp-current" style={{ width: `${currentRatio * 100}%` }} />
            <span className="token__hp-label">{currentHp}/{maxHp}</span>
          </span>
          {temporaryRatio > 0 ? (
            <span className="token__hp-row token__hp-row--temporary">
              <span className="token__hp-temporary" style={{ width: `${temporaryRatio * 100}%` }} />
              <span className="token__hp-label">+{temporaryHp} temp</span>
            </span>
          ) : null}
        </span>
      ) : null}
      {isCompact ? <span className="token__compact">{compactLabel}</span> : null}
      {isGhost ? <span className="token__visibility">Nascosto</span> : null}
      <span className="token__name">{token.name}</span>
      <span className="token__type">{tokenTypeLabel(token.type)}</span>
    </button>
  );
}
