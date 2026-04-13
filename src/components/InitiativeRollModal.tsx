import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { InitiativeEntry, UnitToken } from '../types';
import { isCreature, tokenTypeLabel } from '../utils/tokens';
import { rollSingleDie } from '../utils/dice';
import { ConditionBadge } from './ConditionBadge';
import { Modal } from './Modal';

interface InitiativeRollModalProps {
  isOpen: boolean;
  tokens: UnitToken[];
  initiatives: InitiativeEntry[];
  canManage?: boolean;
  onClose: () => void;
  onSetInitiative: (entry: InitiativeEntry) => void;
  onClearInitiative: (tokenId: string) => void;
  onLocateToken: (tokenId: string) => void;
}

export function InitiativeRollModal({
  isOpen,
  tokens,
  initiatives,
  canManage = true,
  onClose,
  onSetInitiative,
  onClearInitiative,
  onLocateToken,
}: InitiativeRollModalProps) {
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const creatures = useMemo(() => tokens.filter(isCreature), [tokens]);
  const initiativeMap = useMemo(
    () =>
      initiatives.reduce<Record<string, InitiativeEntry>>((accumulator, entry) => {
        accumulator[entry.tokenId] = entry;
        return accumulator;
      }, {}),
    [initiatives],
  );

  const applyManualInitiative = (token: UnitToken) => {
    const parsedValue = Number(manualValues[token.id]);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    onSetInitiative({
      tokenId: token.id,
      value: parsedValue,
      source: 'manual',
    });
  };

  const applyAllManualInitiatives = () => {
    creatures.forEach((token) => {
      const parsedValue = Number(manualValues[token.id]);
      if (!Number.isFinite(parsedValue)) {
        return;
      }

      onSetInitiative({
        tokenId: token.id,
        value: parsedValue,
        source: 'manual',
      });
    });
  };

  const rollForEveryone = () => {
    creatures.forEach((token) => {
      const rolledValue = rollSingleDie(20) + token.initiativeModifier;
      onSetInitiative({
        tokenId: token.id,
        value: rolledValue,
        source: 'rolled',
      });
    });
  };

  return (
    <Modal title="Roll for initiative" isOpen={isOpen} onClose={onClose}>
      <div className="initiative-actions initiative-actions--stack">
        <button type="button" onClick={rollForEveryone} disabled={!canManage}>
          Roll for everyone
        </button>
        <button type="button" onClick={applyAllManualInitiatives} disabled={!canManage}>
          Save all
        </button>
      </div>

      {!canManage ? <p className="panel-note">Solo il master puo assegnare o resettare l&apos;iniziativa.</p> : null}

      <div className="initiative-roster">
        {creatures.map((token) => {
          const currentEntry = initiativeMap[token.id];

          return (
            <div key={token.id} className="initiative-roster__row">
              <button
                type="button"
                className={`initiative-token initiative-token--${token.type}`}
                title={token.name}
                style={{ '--token-color': token.color } as CSSProperties}
              >
                {token.name.slice(0, 2).toUpperCase()}
              </button>

              <div className="initiative-roster__meta">
                <strong>
                  <button type="button" className="token-name-button" onClick={() => onLocateToken(token.id)}>
                    {token.name}
                  </button>
                </strong>
                <span>{tokenTypeLabel(token.type)}</span>
                <span>Mod. iniziativa: {token.initiativeModifier >= 0 ? `+${token.initiativeModifier}` : token.initiativeModifier}</span>
                <span>
                  {currentEntry ? `${currentEntry.value} (${currentEntry.source})` : 'Nessuna iniziativa'}
                </span>
                {token.conditions.length > 0 ? (
                  <span className="condition-badge-list">
                    {token.conditions.map((condition) => (
                      <ConditionBadge key={condition} condition={condition} />
                    ))}
                  </span>
                ) : null}
              </div>

              <input
                type="number"
                className="initiative-roster__input"
                placeholder="Manuale"
                value={manualValues[token.id] ?? ''}
                disabled={!canManage}
                onChange={(event) =>
                  setManualValues((current) => ({
                    ...current,
                    [token.id]: event.target.value,
                  }))
                }
              />

              <div className="initiative-roster__actions">
                <button type="button" onClick={() => applyManualInitiative(token)} disabled={!canManage}>
                  Salva
                </button>

                <button
                  type="button"
                  className="outline-button"
                  disabled={!canManage}
                  onClick={() => {
                    setManualValues((current) => ({
                      ...current,
                      [token.id]: '',
                    }));
                    onClearInitiative(token.id);
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
