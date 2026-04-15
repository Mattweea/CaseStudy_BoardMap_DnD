import { useEffect, useRef, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { Board } from './components/Board';
import { DiceLogModal } from './components/DiceLogModal';
import { DicePanel } from './components/DicePanel';
import { DiceResultModal } from './components/DiceResultModal';
import { EditElementModal, ElementsListModal, NewElementModal } from './components/ElementModals';
import { InitiativeRollModal } from './components/InitiativeRollModal';
import { InitiativePanel } from './components/InitiativePanel';
import { Modal } from './components/Modal';
import { findCharacterProfileByKey } from './constants/characters';
import { useAuthSession } from './hooks/useAuthSession';
import { useBattleMapState } from './hooks/useBattleMapState';
import type { DiceRollLog } from './types';
import avernusImage from '../media/images/avernus.jpeg';

const FULLSCREEN_TRANSITION_MS = 260;
const MANUAL_PDF_PATH =
  'https://drive.google.com/file/d/1v4XF37X1QjXrhEX3Y2dHouMkYnNedfGw/preview';

type SidebarSectionId = 'session' | 'dice' | 'initiative' | 'legend';

const SIDEBAR_SECTION_ORDER: SidebarSectionId[] = ['session', 'dice', 'initiative', 'legend'];
const SIDEBAR_SHORTCUTS: Array<{ id: SidebarSectionId; icon: string; label: string }> = [
  { id: 'session', icon: '👤', label: 'Sessione' },
  { id: 'dice', icon: '🎲', label: 'Dice Roller' },
  { id: 'initiative', icon: '⚔️', label: 'Ordine Dei Turni' },
  { id: 'legend', icon: '?', label: 'Legenda Comandi' },
];

interface DiceResultScene {
  flavor: string;
  log: DiceRollLog;
}

function App() {
  const { user, isLoading, isSubmitting, error, login, logout } = useAuthSession();
  const {
    isReady: isBattleMapReady,
    state,
    addTokens,
    addDiceLog,
    cycleTurn,
    clearDiceLogs,
    clearInitiative,
    clearInitiatives,
    moveTokens,
    moveOwnedToken,
    addOwnedExtraMovement,
    reorderInitiatives,
    removeToken,
    removeTokens,
    setActiveTurnToken,
    setInitiative,
    setInitiatives,
    undoLastAction,
    useDashAction,
    updateToken,
    updateOwnedToken,
    setZoom,
    sessionStatus,
    suspendSession,
    resumeLastSession,
  } = useBattleMapState();
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>(
    state.tokens[0] ? [state.tokens[0].id] : [],
  );
  const [isNewElementModalOpen, setIsNewElementModalOpen] = useState(false);
  const [isElementsListModalOpen, setIsElementsListModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isDiceLogModalOpen, setIsDiceLogModalOpen] = useState(false);
  const [isInitiativeModalOpen, setIsInitiativeModalOpen] = useState(false);
  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [latestDiceResult, setLatestDiceResult] = useState<DiceResultScene | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ tokenId: string; nonce: number } | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarLeadSection, setSidebarLeadSection] = useState<SidebarSectionId | null>(null);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [boardFullscreenPhase, setBoardFullscreenPhase] = useState<
    'closed' | 'opening' | 'open' | 'closing'
  >('closed');
  const sidebarRef = useRef<HTMLElement | null>(null);
  const canManageBattleMap = user?.role === 'master';
  const sessionCharacter = findCharacterProfileByKey(user?.characterKey);
  const sessionToken =
    state.tokens.find((token) => token.ownerUserId === user?.id) ??
    state.tokens.find((token) => token.id === user?.playerTokenId) ??
    null;
  const sessionVehicle =
    sessionToken
      ? state.tokens.find(
          (token) =>
            token.type === 'vehicle' &&
            Array.isArray(token.vehicleOccupantIds) &&
            token.vehicleOccupantIds.includes(sessionToken.id),
        ) ?? null
      : null;
  const dashUsed = sessionToken ? state.dashUsedByTokenId[sessionToken.id] === true : false;
  const extraMovement = sessionToken ? state.extraMovementByTokenId[sessionToken.id] ?? 0 : 0;
  const hasInitiativeOrder = state.initiatives.length > 0;
  const isPlayersTurn = Boolean(sessionToken && state.activeTurnTokenId === sessionToken.id);
  const activeTurnToken =
    state.tokens.find((token) => token.id === state.activeTurnTokenId) ?? null;
  const editableTokenIds = canManageBattleMap
    ? state.tokens.map((token) => token.id)
    : sessionToken
      ? [sessionToken.id]
      : [];
  const movableTokenIds = canManageBattleMap
    ? state.tokens.map((token) => token.id)
    : sessionToken
      ? [sessionToken.id, ...(sessionVehicle ? [sessionVehicle.id] : [])]
      : [];
  const selectedCreatureIds = selectedTokenIds.filter((tokenId) =>
    state.tokens.some(
      (token) =>
        token.id === tokenId &&
        (token.type === 'player' || token.type === 'enemy' || token.type === 'vehicle'),
    ),
  );

  useEffect(() => {
    setSelectedTokenIds((current) =>
      current.filter((tokenId) => state.tokens.some((token) => token.id === tokenId)),
    );

    if (editingTokenId && !state.tokens.some((token) => token.id === editingTokenId)) {
      setEditingTokenId(null);
    }
  }, [editingTokenId, state.tokens]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsBootLoading(false);
    }, 7400);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (boardFullscreenPhase === 'opening') {
      const timeoutId = window.setTimeout(() => {
        setBoardFullscreenPhase('open');
      }, 30);

      return () => window.clearTimeout(timeoutId);
    }

    if (boardFullscreenPhase === 'closing') {
      const timeoutId = window.setTimeout(() => {
        setBoardFullscreenPhase('closed');
      }, FULLSCREEN_TRANSITION_MS);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [boardFullscreenPhase]);

  useEffect(() => {
    if (isSidebarCollapsed) {
      return;
    }

    sidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isSidebarCollapsed, sidebarLeadSection]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (sessionToken) {
      setSelectedTokenIds((current) => (current.includes(sessionToken.id) ? current : [sessionToken.id]));
      return;
    }

    if (canManageBattleMap && state.tokens[0]) {
      setSelectedTokenIds((current) => (current.length > 0 ? current : [state.tokens[0].id]));
    }
  }, [canManageBattleMap, sessionToken, state.tokens, user]);

  const locateToken = (tokenId: string) => {
    setFocusRequest({ tokenId, nonce: Date.now() });
    setSelectedTokenIds([tokenId]);
  };

  const openEditTokenModal = (tokenId: string) => {
    if (!canManageBattleMap && sessionToken?.id !== tokenId) {
      return;
    }

    locateToken(tokenId);
    setIsElementsListModalOpen(false);
    setEditingTokenId(tokenId);
  };

  const editingToken = state.tokens.find((token) => token.id === editingTokenId) ?? null;
  const isBoardFullscreenVisible = boardFullscreenPhase !== 'closed';
  const orderedSidebarSections = sidebarLeadSection
    ? [sidebarLeadSection, ...SIDEBAR_SECTION_ORDER.filter((sectionId) => sectionId !== sidebarLeadSection)]
    : SIDEBAR_SECTION_ORDER;

  const handleSidebarToggle = () => {
    if (isSidebarCollapsed) {
      setSidebarLeadSection(null);
      setIsSidebarCollapsed(false);
      return;
    }

    setIsSidebarCollapsed(true);
  };

  const openSidebarSection = (sectionId: SidebarSectionId) => {
    setSidebarLeadSection(sectionId);
    setIsSidebarCollapsed(false);
  };

  const moveSessionTokenBy = (deltaX: number, deltaY: number) => {
    if (!sessionToken) {
      return;
    }

    void moveOwnedToken(
      sessionToken.id,
      sessionToken.position.x + deltaX,
      sessionToken.position.y + deltaY,
    );
  };

  const addSelectedToInitiative = () => {
    if (!canManageBattleMap || selectedCreatureIds.length === 0) {
      return;
    }

    setInitiatives(
      selectedCreatureIds.flatMap((tokenId) => {
        const token = state.tokens.find((entry) => entry.id === tokenId);
        if (!token) {
          return [];
        }

        return [
          {
            tokenId,
            value: token.initiativeModifier,
            source: 'manual' as const,
          },
        ];
      }),
    );
  };

  const renderSidebarSection = (sectionId: SidebarSectionId) => {
    switch (sectionId) {
      case 'session':
        return (
          <section key="session" className="sidebar__section session-panel">
            <div>
              <p className="eyebrow">Sessione</p>
              <h2>{user?.displayName}</h2>
            </div>
            <div className="session-panel__body">
              {sessionCharacter?.imageUrl ? (
                <img
                  src={sessionCharacter.imageUrl}
                  alt={user?.displayName ?? 'Profilo'}
                  className="session-panel__avatar"
                />
              ) : null}
              <div className="session-panel__facts">
                <p className="session-panel__fact">
                  <span>Round</span>
                  <strong>{state.roundNumber}</strong>
                </p>
                <p className="session-panel__fact">
                  <span>Turno Attivo</span>
                  <strong>{activeTurnToken?.name ?? 'Nessuno'}</strong>
                </p>
                {!canManageBattleMap ? (
                  <p className="session-panel__fact">
                    <span>Stato</span>
                    <strong>
                      {!hasInitiativeOrder
                        ? 'Attesa Iniziativa'
                        : isPlayersTurn
                          ? 'Il Tuo Turno'
                          : 'In Attesa'}
                    </strong>
                  </p>
                ) : null}
                {sessionToken ? (
                  <p className="session-panel__fact">
                    <span>Movimento extra</span>
                    <strong>{extraMovement}</strong>
                  </p>
                ) : null}
              </div>
            </div>
            {!canManageBattleMap && sessionToken ? (
              <div className="movement-pad">
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(-1, -1)}>↖</button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(0, -1)}>↑</button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(1, -1)}>↗</button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(-1, 0)}>←</button>
                <button
                  type="button"
                  className="movement-pad__button movement-pad__button--center"
                  onClick={() => void addOwnedExtraMovement(sessionToken.id, 1)}
                  title="Aggiungi 1 casella di movimento extra"
                >
                  +1
                </button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(1, 0)}>→</button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(-1, 1)}>↙</button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(0, 1)}>↓</button>
                <button type="button" className="movement-pad__button" onClick={() => moveSessionTokenBy(1, 1)}>↘</button>
              </div>
            ) : null}
            <div className="session-panel__controls">
              {!canManageBattleMap && hasInitiativeOrder && isPlayersTurn && sessionToken ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void useDashAction(sessionToken.id)}
                  disabled={dashUsed}
                  title={dashUsed ? 'Scatto Già Usato' : 'Usa Scatto'}
                  aria-label={dashUsed ? 'Scatto Già Usato' : 'Usa Scatto'}
                >
                  🏃
                </button>
              ) : null}
              <button
                type="button"
                className="icon-button"
                onClick={() => void undoLastAction()}
                title="Undo"
                aria-label="Undo"
              >
                ↶
              </button>
              {canManageBattleMap ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void suspendSession()}
                  title="Sospendi Sessione"
                  aria-label="Sospendi Sessione"
                >
                  💾
                </button>
              ) : null}
              {canManageBattleMap ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void resumeLastSession()}
                  disabled={!sessionStatus.hasSnapshot}
                  title="Riprendi Ultima Sessione"
                  aria-label="Riprendi Ultima Sessione"
                >
                  ⏯
                </button>
              ) : null}
              <button
                type="button"
                className="secondary-button secondary-button--small"
                onClick={() => void logout()}
              >
                Logout
              </button>
            </div>
          </section>
        );
      case 'dice':
        return (
          <DicePanel
            key="dice"
            logsCount={state.diceLogs.length}
            actorKey={user?.characterKey}
            rollerName={user?.displayName}
            isResultOpen={latestDiceResult !== null}
            onAddLog={addDiceLog}
            onShowResult={setLatestDiceResult}
            onOpenLogs={() => setIsDiceLogModalOpen(true)}
          />
        );
      case 'initiative':
        return (
          <InitiativePanel
            key="initiative"
            tokens={state.tokens}
            initiatives={state.initiatives}
            activeTurnTokenId={state.activeTurnTokenId}
            canManageInitiative={canManageBattleMap}
            onOpenRollModal={() => {
              if (canManageBattleMap) {
                setIsInitiativeModalOpen(true);
              }
            }}
            onCycleTurn={(direction) => {
              if (canManageBattleMap) {
                cycleTurn(direction);
              }
            }}
            onSetActiveTurnToken={setActiveTurnToken}
            onClearInitiatives={() => {
              if (canManageBattleMap) {
                clearInitiatives();
              }
            }}
            onReorderInitiatives={(fromIndex, toIndex) => {
              if (canManageBattleMap) {
                reorderInitiatives(fromIndex, toIndex);
              }
            }}
            onLocateToken={locateToken}
            onOpenEditTokenModal={openEditTokenModal}
          />
        );
      case 'legend':
        return (
          <section key="legend" className="sidebar__section">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Legenda</p>
                <h2>Comandi</h2>
              </div>
            </div>
            <div className="command-legend">
              <div className="command-legend__group">
                <p className="command-legend__title">Comuni</p>
                <p><strong>Click</strong>: seleziona elemento.</p>
                <p><strong>Shift + click</strong>: multi-selezione.</p>
                <p><strong>Rotella</strong>: zoom.</p>
                <p><strong>Ctrl + drag</strong>: muovi visuale.</p>
                <p><strong>🔎</strong>: lista elementi.</p>
                <p><strong>📖</strong>: manuale.</p>
              </div>

              {canManageBattleMap ? (
                <div className="command-legend__group">
                  <p className="command-legend__title">Master</p>
                  <p><strong>Drag</strong>: muovi token selezionati.</p>
                  <p><strong>Tasto destro</strong>: edit completo.</p>
                  <p><strong>➕</strong>: crea elemento.</p>
                  <p><strong>⚔️</strong>: aggiungi selezionati ai turni.</p>
                  <p><strong>🗑️</strong>: rimuovi selezionati.</p>
                  <p><strong>Roll for selected</strong>: iniziativa solo ai selezionati.</p>
                  <p><strong>Invisibile</strong>: nasconde token ai player.</p>
                  <p><strong>↶</strong>: undo globale.</p>
                </div>
              ) : (
                <div className="command-legend__group">
                  <p className="command-legend__title">Player</p>
                  <p><strong>Tasto destro sul tuo PG</strong>: menu personale.</p>
                  <p><strong>Frecce</strong>: muovi il tuo PG, diagonali incluse.</p>
                  <p><strong>+1</strong>: movimento extra.</p>
                  <p><strong>🏃</strong>: scatto.</p>
                  <p><strong>PF</strong>: aggiorna i tuoi punti ferita.</p>
                  <p><strong>↶</strong>: undo della tua ultima azione.</p>
                </div>
              )}
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  if (isLoading && !user) {
    return (
      <div className="auth-shell auth-shell--loading">
        <p className="auth-copy">Connessione al server di sessione...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen error={error} isLoading={isSubmitting} onLogin={login} />;
  }

  if (!isBattleMapReady) {
    return (
      <div className="auth-shell auth-shell--loading">
        <p className="auth-copy">Sincronizzazione della sessione condivisa...</p>
      </div>
    );
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'app-shell--sidebar-collapsed' : ''}`}>
      <aside ref={sidebarRef} className={`sidebar ${isSidebarCollapsed ? 'sidebar--collapsed' : ''}`}>
        <div className="sidebar__toggle-wrap">
          <button
            type="button"
            className="sidebar__toggle"
            aria-expanded={!isSidebarCollapsed}
            aria-label={isSidebarCollapsed ? 'Apri sidebar' : 'Chiudi sidebar'}
            onClick={handleSidebarToggle}
          >
            <span aria-hidden="true">{isSidebarCollapsed ? '»' : '«'}</span>
          </button>
        </div>

        {isSidebarCollapsed ? (
          <div className="sidebar__shortcuts">
            {SIDEBAR_SHORTCUTS.map((shortcut) => (
              <button
                key={shortcut.id}
                type="button"
                className="sidebar__shortcut"
                onClick={() => openSidebarSection(shortcut.id)}
                title={shortcut.label}
                aria-label={shortcut.label}
              >
                <span aria-hidden="true">{shortcut.icon}</span>
              </button>
            ))}
          </div>
        ) : (
          orderedSidebarSections.map((sectionId) => renderSidebarSection(sectionId))
        )}
      </aside>

      <main className="app-main">
        <Board
          tokens={state.tokens}
          zoom={state.zoom}
          selectedTokenIds={selectedTokenIds}
          editableTokenIds={editableTokenIds}
          focusRequest={focusRequest}
          canManageTokens={canManageBattleMap}
          movableTokenIds={movableTokenIds}
          onToggleFullscreen={() => setBoardFullscreenPhase('opening')}
          onOpenManual={() => setIsManualModalOpen(true)}
          onOpenNewElementModal={() => {
            if (canManageBattleMap) {
              setIsNewElementModalOpen(true);
            }
          }}
          onOpenElementsListModal={() => setIsElementsListModalOpen(true)}
          onOpenEditTokenModal={openEditTokenModal}
          onRemoveSelected={() => removeTokens(selectedTokenIds)}
          onAddSelectedToInitiative={addSelectedToInitiative}
          onMoveTokens={(moves) => {
            if (canManageBattleMap) {
              moveTokens(moves);
            } else if (
              sessionToken &&
              moves.length === 1 &&
              (moves[0].tokenId === sessionToken.id || moves[0].tokenId === sessionVehicle?.id)
            ) {
              void moveOwnedToken(moves[0].tokenId, moves[0].x, moves[0].y);
            }
          }}
          onSelectionChange={setSelectedTokenIds}
          onZoomChange={setZoom}
        />
      </main>

      {isBoardFullscreenVisible ? (
        <div
          className={`board-fullscreen-overlay board-fullscreen-overlay--${boardFullscreenPhase}`}
        >
          <Board
            tokens={state.tokens}
            zoom={state.zoom}
            selectedTokenIds={selectedTokenIds}
            editableTokenIds={editableTokenIds}
            focusRequest={focusRequest}
            isFullscreen
            canManageTokens={canManageBattleMap}
            movableTokenIds={movableTokenIds}
            onToggleFullscreen={() => setBoardFullscreenPhase('closing')}
            onOpenManual={() => setIsManualModalOpen(true)}
            onOpenNewElementModal={() => {
              if (canManageBattleMap) {
                setIsNewElementModalOpen(true);
              }
            }}
            onOpenElementsListModal={() => setIsElementsListModalOpen(true)}
            onOpenEditTokenModal={openEditTokenModal}
            onRemoveSelected={() => removeTokens(selectedTokenIds)}
            onAddSelectedToInitiative={addSelectedToInitiative}
            onMoveTokens={(moves) => {
              if (canManageBattleMap) {
                moveTokens(moves);
              } else if (
                sessionToken &&
                moves.length === 1 &&
                (moves[0].tokenId === sessionToken.id || moves[0].tokenId === sessionVehicle?.id)
              ) {
                void moveOwnedToken(moves[0].tokenId, moves[0].x, moves[0].y);
              }
            }}
            onSelectionChange={setSelectedTokenIds}
            onZoomChange={setZoom}
          />
        </div>
      ) : null}

      {canManageBattleMap ? (
        <NewElementModal
          isOpen={isNewElementModalOpen}
          tokens={state.tokens}
          tokenCount={state.tokens.length}
          onClose={() => setIsNewElementModalOpen(false)}
          onAddTokens={addTokens}
        />
      ) : null}

      <EditElementModal
        isOpen={editingToken !== null}
        token={editingToken}
        tokens={state.tokens}
        canManageStructure={canManageBattleMap}
        canManageVisibility={canManageBattleMap}
        canRemoveToken={canManageBattleMap}
        onClose={() => setEditingTokenId(null)}
        onAddTokens={addTokens}
        onSaveToken={updateToken}
        onSaveOwnedToken={(tokenId, updates) => void updateOwnedToken(tokenId, updates)}
        onRemoveToken={(tokenId) => {
          if (canManageBattleMap) {
            removeToken(tokenId);
          }
          setEditingTokenId(null);
        }}
      />

      <ElementsListModal
        isOpen={isElementsListModalOpen}
        tokens={state.tokens}
        readOnly={!canManageBattleMap}
        onClose={() => setIsElementsListModalOpen(false)}
        onRemoveToken={(tokenId) => {
          if (canManageBattleMap) {
            removeToken(tokenId);
          }
        }}
        onLocateToken={locateToken}
        onEditToken={openEditTokenModal}
      />

      <Modal
        title="Manuale"
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        className="modal-card--manual"
      >
        <div className="manual-preview">
          <iframe
            title="Anteprima manuale PDF"
            src={MANUAL_PDF_PATH}
            className="manual-preview__frame"
          />
        </div>
      </Modal>

      <DiceLogModal
        isOpen={isDiceLogModalOpen}
        logs={state.diceLogs}
        onClose={() => setIsDiceLogModalOpen(false)}
        onClear={clearDiceLogs}
      />

      <InitiativeRollModal
        isOpen={isInitiativeModalOpen}
        tokens={state.tokens}
        initiatives={state.initiatives}
        selectedTokenIds={selectedTokenIds}
        canManage={canManageBattleMap}
        onClose={() => setIsInitiativeModalOpen(false)}
        onSetInitiative={(entry) => {
          if (canManageBattleMap) {
            setInitiative(entry);
          }
        }}
        onSetInitiatives={(entries) => {
          if (canManageBattleMap) {
            setInitiatives(entries);
          }
        }}
        onClearInitiative={(tokenId) => {
          if (canManageBattleMap) {
            clearInitiative(tokenId);
          }
        }}
        onLocateToken={locateToken}
      />

      <DiceResultModal result={latestDiceResult} onClose={() => setLatestDiceResult(null)} />

      {isBootLoading ? (
        <div className="boot-loader" role="status" aria-live="polite">
          <img className="boot-loader__image" src={avernusImage} alt="" aria-hidden="true" />
          <div className="boot-loader__shade" aria-hidden="true" />
          <div className="boot-loader__card">
            <h1 className="boot-loader__title">Gli ammazza-keebler</h1>
            <p className="boot-loader__aside">(Di ghigno)</p>
            <h2 className="boot-loader__subtitle">nell&apos;Averno</h2>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
