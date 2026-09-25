import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { InitiativeEntry, InitiativeRollMode, SessionMode, UnitToken } from '../types';
import { isCreature, tokenTypeLabel } from '../utils/tokens';
import { ConditionBadge } from './ConditionBadge';
import { Modal } from './Modal';
import type { CombatActionResult } from './InitiativePanel';

interface InitiativeRollModalProps {
  isOpen: boolean;
  tokens: UnitToken[];
  initiatives: InitiativeEntry[];
  sessionMode: SessionMode;
  canManage?: boolean;
  onClose: () => void;
  onRollInitiative: (tokenId: string, mode?: InitiativeRollMode) => Promise<CombatActionResult>;
  onSetInitiative: (entry: InitiativeEntry) => void;
  onClearInitiative: (tokenId: string) => void;
  onLocateToken: (tokenId: string) => void;
}

const ROLL_MODE_OPTIONS: Array<[InitiativeRollMode, string]> = [['normal', 'Normale'], ['advantage', 'Vantaggio'], ['disadvantage', 'Svantaggio']];

// Il personaggio di un utente tira con la modalità salvata nella sua scheda: il Master sceglie la
// modalità solo per le creature senza scheda.
function hasCharacterSheet(token: UnitToken) {
  return token.type === 'player' && token.isFamiliar !== true && Boolean(token.ownerUserId);
}

// Strumento del Master (P0.8a) per le singole voci: tiro sul server, valore manuale, rimozione.
// Nessun dado viene tirato nel browser: il valore di un tiro arriva sempre dal server.
export function InitiativeRollModal({
  isOpen,
  tokens,
  initiatives,
  sessionMode,
  canManage = false,
  onClose,
  onRollInitiative,
  onSetInitiative,
  onClearInitiative,
  onLocateToken,
}: InitiativeRollModalProps) {
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [rollModes, setRollModes] = useState<Record<string, InitiativeRollMode>>({});
  const [pendingTokenId, setPendingTokenId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const creatures = useMemo(() => tokens.filter((token) => isCreature(token) && token.excludeFromInitiative !== true), [tokens]);
  const initiativeMap = useMemo(
    () => new Map(initiatives.map((entry) => [entry.tokenId, entry])),
    [initiatives],
  );
  const isCombat = sessionMode === 'combat';

  const rollFor = async (token: UnitToken) => {
    if (pendingTokenId) return;
    setPendingTokenId(token.id);
    setFeedback(null);
    try {
      const result = await onRollInitiative(token.id, hasCharacterSheet(token) ? undefined : rollModes[token.id] ?? 'normal');
      if (!result.ok) setFeedback(result.message);
    } finally {
      setPendingTokenId(null);
    }
  };

  const applyManualInitiative = (token: UnitToken) => {
    const parsedValue = Number(manualValues[token.id]);
    if (manualValues[token.id]?.trim() === '' || !Number.isFinite(parsedValue)) {
      setFeedback(`Inserisci un numero per ${token.name}.`);
      return;
    }
    setFeedback(null);
    onSetInitiative({ tokenId: token.id, value: Math.trunc(parsedValue), source: 'manual' });
    setManualValues((current) => ({ ...current, [token.id]: '' }));
  };

  return (
    <Modal title="Gestisci l'iniziativa" isOpen={isOpen} onClose={onClose}>
      {!isCombat ? (
        <p className="empty-state">Esplorazione: avvia il combattimento per tirare o inserire l'iniziativa.</p>
      ) : null}
      {feedback ? <p className="initiative-roster__feedback" role="alert">{feedback}</p> : null}
      <div className="initiative-roster">
        {creatures.map((token) => {
          const currentEntry = initiativeMap.get(token.id);
          const withSheet = hasCharacterSheet(token);

          return (
            <div key={token.id} className="initiative-roster__row">
              <button
                type="button"
                className={`initiative-token initiative-token--${token.type}`}
                title={token.name}
                style={{ '--token-color': token.color } as CSSProperties}
                onClick={() => onLocateToken(token.id)}
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
                <span>
                  {withSheet
                    ? 'Modificatore e modalità dalla scheda'
                    : `Mod. iniziativa: ${token.initiativeModifier >= 0 ? `+${token.initiativeModifier}` : token.initiativeModifier}`}
                </span>
                <span>
                  {currentEntry
                    ? `${Math.trunc(currentEntry.value)} (${currentEntry.source === 'rolled' ? 'tirata' : 'manuale'})`
                    : 'Nessuna voce'}
                </span>
                {token.conditions.length > 0 ? (
                  <span className="condition-badge-list">
                    {token.conditions.map((condition) => (
                      <ConditionBadge key={condition} condition={condition} />
                    ))}
                  </span>
                ) : null}
              </div>

              <div className="initiative-roster__roll">
                {withSheet ? null : (
                  <label className="initiative-roster__mode">
                    <span className="visually-hidden">Modalità del tiro per {token.name}</span>
                    <select
                      value={rollModes[token.id] ?? 'normal'}
                      disabled={!canManage || !isCombat}
                      onChange={(event) => setRollModes((current) => ({ ...current, [token.id]: event.target.value as InitiativeRollMode }))}
                    >
                      {ROLL_MODE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  disabled={!canManage || !isCombat || pendingTokenId !== null}
                  onClick={() => void rollFor(token)}
                >
                  {currentEntry ? 'Ritira' : 'Tira'}
                </button>
              </div>

              <input
                type="number"
                className="initiative-roster__input"
                placeholder="Manuale"
                aria-label={`Valore manuale per ${token.name}`}
                value={manualValues[token.id] ?? ''}
                disabled={!canManage || !isCombat}
                onChange={(event) => setManualValues((current) => ({ ...current, [token.id]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyManualInitiative(token);
                  }
                }}
              />

              <div className="initiative-roster__actions">
                <button type="button" onClick={() => applyManualInitiative(token)} disabled={!canManage || !isCombat}>
                  Salva
                </button>
                <button
                  type="button"
                  className="outline-button"
                  disabled={!canManage || !currentEntry}
                  onClick={() => onClearInitiative(token.id)}
                >
                  Rimuovi
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
