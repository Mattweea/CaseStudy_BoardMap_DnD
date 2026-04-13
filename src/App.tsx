import { useEffect, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { Board } from './components/Board';
import { DiceLogModal } from './components/DiceLogModal';
import { DicePanel } from './components/DicePanel';
import { DiceResultModal } from './components/DiceResultModal';
import { EditElementModal, ElementsListModal, NewElementModal } from './components/ElementModals';
import { InitiativeRollModal } from './components/InitiativeRollModal';
import { InitiativePanel } from './components/InitiativePanel';
import { Modal } from './components/Modal';
import { useAuthSession } from './hooks/useAuthSession';
import { useBattleMapState } from './hooks/useBattleMapState';
import type { DiceRollLog } from './types';
import avernusImage from '../media/images/avernus.jpeg';

const FULLSCREEN_TRANSITION_MS = 260;
const MANUAL_PDF_PATH =
  'https://drive.google.com/file/d/1v4XF37X1QjXrhEX3Y2dHouMkYnNedfGw/preview';

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
    clearDiceLogs,
    clearInitiative,
    clearInitiatives,
    moveTokens,
    reorderInitiatives,
    removeToken,
    setActiveTurnToken,
    setInitiative,
    updateToken,
    setZoom,
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
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [boardFullscreenPhase, setBoardFullscreenPhase] = useState<
    'closed' | 'opening' | 'open' | 'closing'
  >('closed');
  const canManageBattleMap = user?.role === 'master';

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

  const locateToken = (tokenId: string) => {
    setFocusRequest({ tokenId, nonce: Date.now() });
    setSelectedTokenIds([tokenId]);
  };

  const openEditTokenModal = (tokenId: string) => {
    if (!canManageBattleMap) {
      return;
    }

    locateToken(tokenId);
    setIsElementsListModalOpen(false);
    setEditingTokenId(tokenId);
  };

  const editingToken = state.tokens.find((token) => token.id === editingTokenId) ?? null;
  const primarySelectedToken =
    state.tokens.find((token) => token.id === selectedTokenIds[0]) ?? null;
  const isBoardFullscreenVisible = boardFullscreenPhase !== 'closed';

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
    <div className="app-shell">
      <aside className="sidebar">
        <section className="sidebar__section session-panel">
          <div>
            <p className="eyebrow">Sessione</p>
            <h2>{user.displayName}</h2>
            <p className="sidebar__copy">
              Accesso come <strong>{user.role}</strong>.
            </p>
            {!canManageBattleMap ? (
              <p className="panel-note">Il profilo adventurer puo consultare la board ma non modificarla.</p>
            ) : null}
          </div>
          <button type="button" className="secondary-button secondary-button--small" onClick={() => void logout()}>
            Logout
          </button>
        </section>

        <DicePanel
          logsCount={state.diceLogs.length}
          rollerName={primarySelectedToken?.name ?? null}
          isResultOpen={latestDiceResult !== null}
          onAddLog={addDiceLog}
          onShowResult={setLatestDiceResult}
          onOpenLogs={() => setIsDiceLogModalOpen(true)}
        />
        <InitiativePanel
          tokens={state.tokens}
          initiatives={state.initiatives}
          activeTurnTokenId={state.activeTurnTokenId}
          canManageInitiative={canManageBattleMap}
          onOpenRollModal={() => {
            if (canManageBattleMap) {
              setIsInitiativeModalOpen(true);
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
      </aside>

      <main className="app-main">
        <Board
          tokens={state.tokens}
          zoom={state.zoom}
          selectedTokenIds={selectedTokenIds}
          focusRequest={focusRequest}
          canManageTokens={canManageBattleMap}
          onToggleFullscreen={() => setBoardFullscreenPhase('opening')}
          onOpenManual={() => setIsManualModalOpen(true)}
          onOpenNewElementModal={() => {
            if (canManageBattleMap) {
              setIsNewElementModalOpen(true);
            }
          }}
          onOpenElementsListModal={() => setIsElementsListModalOpen(true)}
          onOpenEditTokenModal={openEditTokenModal}
          onMoveTokens={(moves) => {
            if (canManageBattleMap) {
              moveTokens(moves);
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
            focusRequest={focusRequest}
            isFullscreen
            canManageTokens={canManageBattleMap}
            onToggleFullscreen={() => setBoardFullscreenPhase('closing')}
            onOpenManual={() => setIsManualModalOpen(true)}
            onOpenNewElementModal={() => {
              if (canManageBattleMap) {
                setIsNewElementModalOpen(true);
              }
            }}
            onOpenElementsListModal={() => setIsElementsListModalOpen(true)}
            onOpenEditTokenModal={openEditTokenModal}
            onMoveTokens={(moves) => {
              if (canManageBattleMap) {
                moveTokens(moves);
              }
            }}
            onSelectionChange={setSelectedTokenIds}
            onZoomChange={setZoom}
          />
        </div>
      ) : null}

      {canManageBattleMap ? (
        <>
          <NewElementModal
            isOpen={isNewElementModalOpen}
            tokens={state.tokens}
            tokenCount={state.tokens.length}
            onClose={() => setIsNewElementModalOpen(false)}
            onAddTokens={addTokens}
          />

          <EditElementModal
            isOpen={editingToken !== null}
            token={editingToken}
            tokens={state.tokens}
            onClose={() => setEditingTokenId(null)}
            onAddTokens={addTokens}
            onSaveToken={updateToken}
            onRemoveToken={(tokenId) => {
              removeToken(tokenId);
              setEditingTokenId(null);
            }}
          />
        </>
      ) : null}

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
        canManage={canManageBattleMap}
        onClose={() => setIsInitiativeModalOpen(false)}
        onSetInitiative={(entry) => {
          if (canManageBattleMap) {
            setInitiative(entry);
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
