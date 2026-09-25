import { useMemo, useState } from 'react';
import type { InitiativeEntry, SessionMode, UnitToken } from '../types';
import { findTokenName, isCreature, tokenTypeLabel } from '../utils/tokens';
import { ConditionBadge } from './ConditionBadge';
import { DiceGlyph } from './DiceIcons';
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, CrossedSwordsIcon, PlayIcon, StepBackIcon, StepForwardIcon } from './UiIcons';

export type CombatActionResult = { ok: true } | { ok: false; message: string };

interface InitiativePanelProps {
  tokens: UnitToken[];
  initiatives: InitiativeEntry[];
  activeTurnTokenId: string | null;
  roundNumber: number;
  sessionMode: SessionMode;
  isRoundStarted: boolean;
  playersCanEndTurn: boolean;
  currentUserId: string | null;
  canManageInitiative?: boolean;
  onStartCombat: () => Promise<CombatActionResult>;
  onEndCombat: () => Promise<CombatActionResult>;
  onStartRound: () => Promise<CombatActionResult>;
  onAdvanceTurn: (direction: 'previous' | 'next') => Promise<CombatActionResult>;
  onEndOwnTurn: () => Promise<CombatActionResult>;
  onRollInitiative: (tokenId: string) => Promise<CombatActionResult>;
  onRollAll: () => Promise<CombatActionResult & { skipped?: string[] }>;
  onOpenRollModal: () => void;
  onSetActiveTurnToken: (tokenId: string) => void;
  onClearInitiative: (tokenId: string) => void;
  onReorderInitiatives: (fromIndex: number, toIndex: number) => void;
  onLocateToken: (tokenId: string) => void;
  onOpenEditTokenModal: (tokenId: string) => void;
}

const MODE_BADGES = { advantage: ['V', 'Tirata con vantaggio'], disadvantage: ['S', 'Tirata con svantaggio'] } as const;

// Tracker del turno (P0.8a): mostra modalità e fase della sessione e l'ordine autorevole deciso dal
// server. I comandi riservati al Master non entrano nel DOM di un Adventurer; ogni comando
// visibile a un Adventurer compare solo quando il server lo accetterebbe.
export function InitiativePanel({
  tokens,
  initiatives,
  activeTurnTokenId,
  roundNumber,
  sessionMode,
  isRoundStarted,
  playersCanEndTurn,
  currentUserId,
  canManageInitiative = false,
  onStartCombat,
  onEndCombat,
  onStartRound,
  onAdvanceTurn,
  onEndOwnTurn,
  onRollInitiative,
  onRollAll,
  onOpenRollModal,
  onSetActiveTurnToken,
  onClearInitiative,
  onReorderInitiatives,
  onLocateToken,
  onOpenEditTokenModal,
}: InitiativePanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropPreview, setDropPreview] = useState<{ index: number; position: 'before' | 'after' } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'info'; message: string } | null>(null);
  const creatures = useMemo(() => tokens.filter(isCreature), [tokens]);
  const activeToken = creatures.find((token) => token.id === activeTurnTokenId) ?? null;
  const isCombat = sessionMode === 'combat';
  const ownCharacter = currentUserId
    ? tokens.find((token) => token.ownerUserId === currentUserId && token.type === 'player' && token.isFamiliar !== true) ?? null
    : null;
  const ownEntryExists = ownCharacter ? initiatives.some((entry) => entry.tokenId === ownCharacter.id) : false;
  const canRollOwn = !canManageInitiative && isCombat && ownCharacter !== null && ownCharacter.excludeFromInitiative !== true && !ownEntryExists;
  const canEndOwnTurn = !canManageInitiative && isCombat && isRoundStarted && playersCanEndTurn &&
    ownCharacter !== null && activeTurnTokenId === ownCharacter.id;

  // Un comando alla volta: resta disabilitato finché il server non risponde, così un doppio click
  // non produce due richieste. Un rifiuto mostra il motivo del server.
  const run = async (key: string, action: () => Promise<CombatActionResult & { skipped?: string[] }>) => {
    if (pendingAction) return;
    setPendingAction(key);
    setFeedback(null);
    try {
      const result = await action();
      if (!result.ok) setFeedback({ kind: 'error', message: result.message });
      else if (result.skipped?.length) setFeedback({ kind: 'info', message: `Non tirati: ${result.skipped.join(', ')}.` });
    } finally {
      setPendingAction(null);
    }
  };
  const isBusy = pendingAction !== null;

  const updateDropPreview = (targetIndex: number, clientY: number, rect: DOMRect) => {
    if (draggedIndex === null) {
      setDropPreview(null);
      return;
    }
    const midY = rect.top + rect.height / 2;
    setDropPreview({ index: targetIndex, position: clientY < midY ? 'before' : 'after' });
  };

  const resolveDropIndex = () => {
    if (draggedIndex === null || !dropPreview) return null;
    const targetIndex = dropPreview.position === 'before' ? dropPreview.index : dropPreview.index + 1;
    const normalizedTarget = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;
    return normalizedTarget === draggedIndex ? null : normalizedTarget;
  };

  const selectEntry = (tokenId: string) => {
    if (canManageInitiative && isRoundStarted) onSetActiveTurnToken(tokenId);
    onLocateToken(tokenId);
  };

  // Una sola riga di stato racconta a che punto è l'incontro; il comando principale sta sotto, e
  // cambia con la fase: avvio del combattimento, avvio del round, avanzamento del turno.
  const statusLine = !isCombat
    ? null
    : isRoundStarted
      ? <>Turno di <strong>{activeToken?.name ?? 'nessuno'}</strong></>
      : initiatives.length > 0
        ? <>Fase di tiro: il round non è cominciato</>
        : <>Fase di tiro: in attesa dei tiri</>;

  return (
    <section className="sidebar__section initiative-panel">
      <div className="initiative-panel__header">
        <h2>Ordine dei turni</h2>
        <span className={`initiative-panel__mode initiative-panel__mode--${isCombat ? 'combat' : 'exploration'}`}>
          {!isCombat ? 'Esplorazione' : isRoundStarted ? `Round ${roundNumber}` : 'Combattimento'}
        </span>
      </div>

      {canManageInitiative ? (
        <div className="initiative-deck" role="group" aria-label="Comandi del Master">
          {!isCombat ? (
            <button type="button" className="primary-button initiative-deck__primary" disabled={isBusy} onClick={() => void run('start', onStartCombat)}>
              <CrossedSwordsIcon size={18} /> Avvia combattimento
            </button>
          ) : !isRoundStarted ? (
            <button
              type="button" className="primary-button initiative-deck__primary"
              disabled={isBusy || initiatives.length === 0}
              title={initiatives.length === 0 ? "Serve almeno una voce d'iniziativa" : undefined}
              onClick={() => void run('round', onStartRound)}
            >
              <PlayIcon size={16} /> Avvia round 1
            </button>
          ) : (
            <div className="initiative-deck__turn">
              <button
                type="button" className="initiative-deck__step" disabled={isBusy}
                aria-label="Turno precedente" title="Turno precedente"
                onClick={() => void run('prev', () => onAdvanceTurn('previous'))}
              ><StepBackIcon size={14} /></button>
              <p className="initiative-deck__status" aria-live="polite">{statusLine}</p>
              <button
                type="button" className="initiative-deck__step initiative-deck__step--next" disabled={isBusy}
                aria-label="Turno successivo" title="Turno successivo"
                onClick={() => void run('next', () => onAdvanceTurn('next'))}
              ><StepForwardIcon size={14} /></button>
            </div>
          )}
          {isCombat ? (
            <div className="initiative-deck__tools">
              <button type="button" className="initiative-deck__tool" disabled={isBusy} onClick={() => void run('roll-all', onRollAll)}>
                <DiceGlyph type="d20" size={16} /> Tira per tutti
              </button>
              <button type="button" className="initiative-deck__tool" disabled={isBusy} onClick={onOpenRollModal}>
                Gestisci voci
              </button>
            </div>
          ) : null}
        </div>
      ) : isCombat && statusLine ? (
        <p className="initiative-panel__status" aria-live="polite">{statusLine}</p>
      ) : null}

      {canRollOwn && ownCharacter ? (
        <div className="initiative-roll">
          <button
            type="button"
            className={`initiative-roll__die ${pendingAction === 'roll-own' ? 'initiative-roll__die--rolling' : ''}`}
            disabled={isBusy}
            aria-label={`Tira l'iniziativa di ${ownCharacter.name}`}
            onClick={() => void run('roll-own', () => onRollInitiative(ownCharacter.id))}
          >
            <DiceGlyph type="d20" size={56} />
          </button>
          <p className="initiative-roll__caption" aria-hidden="true">Tira l'iniziativa</p>
        </div>
      ) : null}

      {canEndOwnTurn ? (
        <button type="button" className="primary-button initiative-panel__end-turn" disabled={isBusy} onClick={() => void run('end-turn', onEndOwnTurn)}>
          Termina il mio turno
        </button>
      ) : null}

      {feedback ? (
        <p className={`initiative-panel__feedback initiative-panel__feedback--${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
          {feedback.message}
        </p>
      ) : null}

      <div className="turn-order">
        {initiatives.length === 0 ? (
          <p className="empty-state">
            {isCombat
              ? "Nessuna voce ancora: tirate l'iniziativa per entrare nell'ordine dei turni."
              : canManageInitiative
                ? "Esplorazione: avvia il combattimento per aprire la fase di tiro dell'iniziativa."
                : "Esplorazione: il tiro d'iniziativa si abilita quando il Master avvia il combattimento."}
          </p>
        ) : null}

        {initiatives.map((entry, index) => {
          const isActive = isRoundStarted && entry.tokenId === activeTurnTokenId;
          const token = creatures.find((item) => item.id === entry.tokenId);
          if (!token) return null;
          const modeBadge = entry.mode && entry.mode !== 'normal' ? MODE_BADGES[entry.mode] : null;

          return (
            <div
              key={entry.tokenId}
              className={`turn-order__item ${isActive ? 'turn-order__item--active' : ''}`}
              aria-current={isActive ? 'step' : undefined}
              onClick={() => selectEntry(entry.tokenId)}
              onContextMenu={(event) => {
                event.preventDefault();
                if (canManageInitiative) onOpenEditTokenModal(entry.tokenId);
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectEntry(entry.tokenId);
                }
              }}
              role="button"
              tabIndex={0}
              draggable={canManageInitiative}
              onDragStart={() => {
                if (!canManageInitiative) return;
                setDraggedIndex(index);
                setDropPreview(null);
              }}
              onDragOver={(event) => {
                if (!canManageInitiative) return;
                event.preventDefault();
                updateDropPreview(index, event.clientY, event.currentTarget.getBoundingClientRect());
              }}
              onDrop={() => {
                if (!canManageInitiative) return;
                const nextIndex = resolveDropIndex();
                if (nextIndex !== null && draggedIndex !== null) onReorderInitiatives(draggedIndex, nextIndex);
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
                      selectEntry(entry.tokenId);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (canManageInitiative) onOpenEditTokenModal(entry.tokenId);
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
              <span className="turn-order__value">
                {Math.trunc(entry.value)}
                {modeBadge ? <abbr className={`turn-order__mode turn-order__mode--${entry.mode}`} title={modeBadge[1]} aria-label={modeBadge[1]}>{modeBadge[0]}</abbr> : null}
              </span>
              {canManageInitiative ? (
                <span className="turn-order__controls">
                  <button
                    type="button" className="turn-order__control" disabled={index === 0}
                    aria-label={`Sposta ${token.name} in su`} title="Sposta in su"
                    onClick={(event) => { event.stopPropagation(); onReorderInitiatives(index, index - 1); }}
                  ><ArrowUpIcon size={13} /></button>
                  <button
                    type="button" className="turn-order__control" disabled={index === initiatives.length - 1}
                    aria-label={`Sposta ${token.name} in giù`} title="Sposta in giù"
                    onClick={(event) => { event.stopPropagation(); onReorderInitiatives(index, index + 1); }}
                  ><ArrowDownIcon size={13} /></button>
                  <button
                    type="button" className="turn-order__control turn-order__control--remove"
                    aria-label={`Rimuovi ${token.name} dall'ordine`} title="Rimuovi dall'ordine"
                    onClick={(event) => { event.stopPropagation(); onClearInitiative(entry.tokenId); }}
                  ><CloseIcon size={12} /></button>
                </span>
              ) : null}
              {dropPreview?.index === index && dropPreview.position === 'after' ? (
                <span className="turn-order__drop-preview turn-order__drop-preview--after" />
              ) : null}
            </div>
          );
        })}
      </div>

      {canManageInitiative && isCombat ? (
        <div className="initiative-panel__footer">
          <button type="button" className="initiative-panel__end-combat" disabled={isBusy} onClick={() => void run('end', onEndCombat)}>
            Termina combattimento
          </button>
        </div>
      ) : null}
    </section>
  );
}
