import { useMemo, useState } from 'react';
import type { InitiativeEntry, UnitToken } from '../types';
import { findTokenName, isCreature, tokenTypeLabel } from '../utils/tokens';
import { ConditionBadge } from './ConditionBadge';

interface InitiativePanelProps {
  tokens: UnitToken[];
  initiatives: InitiativeEntry[];
  activeTurnTokenId: string | null;
  canManageInitiative?: boolean;
  onOpenRollModal: () => void;
  onSetActiveTurnToken: (tokenId: string) => void;
  onClearInitiatives: () => void;
  onReorderInitiatives: (fromIndex: number, toIndex: number) => void;
  onLocateToken: (tokenId: string) => void;
  onOpenEditTokenModal: (tokenId: string) => void;
}

export function InitiativePanel({
  tokens,
  initiatives,
  activeTurnTokenId,
  canManageInitiative = true,
  onOpenRollModal,
  onSetActiveTurnToken,
  onClearInitiatives,
  onReorderInitiatives,
  onLocateToken,
  onOpenEditTokenModal,
}: InitiativePanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropPreview, setDropPreview] = useState<{ index: number; position: 'before' | 'after' } | null>(null);
  const creatures = useMemo(() => tokens.filter(isCreature), [tokens]);

  const updateDropPreview = (targetIndex: number, clientY: number, rect: DOMRect) => {
    if (draggedIndex === null) {
      setDropPreview(null);
      return;
    }

    const draggedEntry = initiatives[draggedIndex];
    const targetEntry = initiatives[targetIndex];
    if (!draggedEntry || !targetEntry || draggedEntry.value !== targetEntry.value) {
      setDropPreview(null);
      return;
    }

    const midY = rect.top + rect.height / 2;
    setDropPreview({
      index: targetIndex,
      position: clientY < midY ? 'before' : 'after',
    });
  };

  const resolveDropIndex = () => {
    if (draggedIndex === null || !dropPreview) {
      return null;
    }

    const targetIndex =
      dropPreview.position === 'before' ? dropPreview.index : dropPreview.index + 1;
    const normalizedTarget = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;

    if (normalizedTarget === draggedIndex) {
      return null;
    }

    const draggedEntry = initiatives[draggedIndex];
    const comparisonIndex = normalizedTarget > draggedIndex ? normalizedTarget : Math.max(0, normalizedTarget);
    const anchorEntry = initiatives[Math.min(comparisonIndex, initiatives.length - 1)];
    if (!draggedEntry || !anchorEntry || draggedEntry.value !== anchorEntry.value) {
      return null;
    }

    return normalizedTarget;
  };

  return (
    <section className="sidebar__section">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Initiative</p>
          <h2>Ordine dei turni</h2>
        </div>
        <div className="initiative-panel__actions">
          <button
            type="button"
            className="secondary-button secondary-button--small"
            onClick={onOpenRollModal}
            disabled={!canManageInitiative}
          >
            Roll for initiative
          </button>
          <button
            type="button"
            className="secondary-button secondary-button--small"
            onClick={onClearInitiatives}
            disabled={!canManageInitiative}
          >
            Reset
          </button>
        </div>
      </div>

      {!canManageInitiative ? (
        <p className="panel-note">Solo il master puo modificare l&apos;ordine dei turni.</p>
      ) : null}

      <div className="turn-order">
        {initiatives.length === 0 ? <p className="empty-state">Nessuna iniziativa impostata.</p> : null}

        {initiatives.map((entry, index) => {
          const isActive = entry.tokenId === activeTurnTokenId;
          const token = creatures.find((item) => item.id === entry.tokenId);
          if (!token) {
            return null;
          }

          return (
            <div
              key={entry.tokenId}
              className={`turn-order__item ${isActive ? 'turn-order__item--active' : ''}`}
              onClick={() => {
                if (canManageInitiative) {
                  onSetActiveTurnToken(entry.tokenId);
                }
                onLocateToken(entry.tokenId);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                if (canManageInitiative) {
                  onOpenEditTokenModal(entry.tokenId);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (canManageInitiative) {
                    onSetActiveTurnToken(entry.tokenId);
                  }
                  onLocateToken(entry.tokenId);
                }
              }}
              role="button"
              tabIndex={0}
              draggable={canManageInitiative}
              onDragStart={() => {
                if (!canManageInitiative) {
                  return;
                }
                setDraggedIndex(index);
                setDropPreview(null);
              }}
              onDragOver={(event) => {
                if (!canManageInitiative) {
                  return;
                }
                event.preventDefault();
                updateDropPreview(index, event.clientY, event.currentTarget.getBoundingClientRect());
              }}
              onDrop={() => {
                if (!canManageInitiative) {
                  return;
                }
                const nextIndex = resolveDropIndex();
                if (nextIndex === null || draggedIndex === null) {
                  setDropPreview(null);
                  return;
                }

                onReorderInitiatives(draggedIndex, nextIndex);
                setDraggedIndex(null);
                setDropPreview(null);
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDropPreview(null);
              }}
            >
              {dropPreview?.index === index && dropPreview.position === 'before' ? (
                <span className="turn-order__drop-preview turn-order__drop-preview--before" />
              ) : null}
              <span>{index + 1}</span>
              <span className="turn-order__meta">
                <strong>
                  <button
                    type="button"
                    className="token-name-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (canManageInitiative) {
                        onSetActiveTurnToken(entry.tokenId);
                      }
                      onLocateToken(entry.tokenId);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (canManageInitiative) {
                        onOpenEditTokenModal(entry.tokenId);
                      }
                    }}
                  >
                    {findTokenName(tokens, entry.tokenId)}
                  </button>
                </strong>
                <span className="turn-order__type">{tokenTypeLabel(token.type)}</span>
                {token.conditions.length > 0 ? (
                  <span className="condition-badge-list">
                    {token.conditions.map((condition) => (
                      <ConditionBadge key={condition} condition={condition} />
                    ))}
                  </span>
                ) : null}
              </span>
              <span>{entry.value}</span>
              {dropPreview?.index === index && dropPreview.position === 'after' ? (
                <span className="turn-order__drop-preview turn-order__drop-preview--after" />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
