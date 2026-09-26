import type { CSSProperties, MouseEvent, PointerEvent } from 'react';
import type { UnitToken } from '../types';
import { BOARD_CONFIG } from '../constants/board';
import { gridToPixels } from '../utils/board';
import { conditionLabel, tokenCompactLabel, tokenTypeLabel, vehicleCompactLabel } from '../utils/tokens';
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
  // Vera durante una pianificazione, un righello o una sagoma: il click destro deve restare un
  // waypoint (già gestito dal pointerdown) invece di aprire il menu radiale (P0.8c).
  mapInteractionActive?: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, token: UnitToken) => void;
  // Apre il menu radiale delle condizioni. La modale di modifica del token non è più
  // raggiungibile né dal click destro né dal doppio click (design, decisione 8).
  onOpenMenu: (tokenId: string) => void;
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
  mapInteractionActive = false,
  onPointerDown,
  onOpenMenu,
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
    '--token-image': token.imageUrl ? `url("${token.imageUrl}")` : 'none',
  } as CSSProperties;

  // Il click destro apre il menu radiale delle condizioni quando è permesso e nessuna
  // pianificazione/righello/sagoma è in corso; durante un'interazione resta un waypoint, già
  // aggiunto dal gestore del pointerdown prima che il contextmenu nativo arrivi qui (P0.8c).
  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (mapInteractionActive) {
      return;
    }
    if (canEdit) {
      onOpenMenu(token.id);
    }
  };

  // Il doppio click non apre più alcuna modale (design, decisione 8): la modifica dei dati del
  // personaggio passa dalla scheda, le condizioni dal menu radiale.

  // Nome accessibile: elenco completo delle condizioni, anche oltre i tre badge mostrati sul
  // token, con il livello di Indebolimento (P0.8c).
  const exhaustionLevel = token.exhaustionLevel ?? 0;
  const conditionNames = token.conditions.map((condition) => conditionLabel(condition));
  if (exhaustionLevel > 0) {
    conditionNames.push(`Indebolimento ${exhaustionLevel}`);
  }
  const accessibleConditions = conditionNames.length > 0 ? `, condizioni: ${conditionNames.join(', ')}` : '';

  // Badge sul token: al massimo tre icone (condizioni più, se attivo, l'Indebolimento come una
  // voce in più), poi «+N» per le restanti; l'elenco completo resta nel nome accessibile sopra.
  const MAX_VISIBLE_BADGES = 3;
  const totalBadgeCount = token.conditions.length + (exhaustionLevel > 0 ? 1 : 0);
  const visibleConditions = token.conditions.slice(0, MAX_VISIBLE_BADGES);
  const showExhaustionBadge = exhaustionLevel > 0 && visibleConditions.length < MAX_VISIBLE_BADGES;
  const hiddenBadgeCount = totalBadgeCount - visibleConditions.length - (showExhaustionBadge ? 1 : 0);

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
        token.conditions.includes('invisible') ? 'token--invisible-marker' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      data-token-id={token.id}
      onPointerDown={(event) => onPointerDown(event, token)}
      onContextMenu={handleContextMenu}
      aria-label={`Elemento ${token.name}, ${tokenTypeLabel(token.type)}${accessibleConditions}`}
    >
      {totalBadgeCount > 0 ? (
        <span className="token__conditions">
          {visibleConditions.map((condition) => (
            <ConditionBadge key={condition} condition={condition} showLabel={false} />
          ))}
          {showExhaustionBadge ? (
            <span className="condition-badge condition-badge--exhaustion" title={`Indebolimento ${exhaustionLevel}`}>
              <span className="condition-badge__level" aria-hidden="true">
                {exhaustionLevel}
              </span>
            </span>
          ) : null}
          {hiddenBadgeCount > 0 ? (
            <span className="condition-badge condition-badge--more" title={`Altre ${hiddenBadgeCount} condizioni`}>
              {`+${hiddenBadgeCount}`}
            </span>
          ) : null}
        </span>
      ) : null}
      {token.maxHitPoints !== null && token.maxHitPoints !== undefined ? (
        <span className="token__hp" aria-label={`Punti ferita ${token.hitPoints ?? 0} su ${token.maxHitPoints}`}>
          {`${token.hitPoints ?? 0}/${token.maxHitPoints}`}
        </span>
      ) : null}
      {isCompact ? <span className="token__compact">{compactLabel}</span> : null}
      {isGhost ? <span className="token__visibility">Nascosto</span> : null}
      <span className="token__name">{token.name}</span>
      <span className="token__type">{tokenTypeLabel(token.type)}</span>
    </button>
  );
}
