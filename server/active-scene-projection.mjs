function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function summarizeScene(scene, activeSceneId) {
  if (!scene) return null;
  return {
    id: scene.id,
    name: scene.name,
    version: scene.version,
    isActive: scene.id === activeSceneId,
  };
}

export function summarizeSceneCatalog(scenes, activeSceneId) {
  return scenes.map((scene) => summarizeScene(scene, activeSceneId));
}

export function attachActiveSceneMetadata(state, activeScene) {
  const summary = summarizeScene(activeScene, activeScene?.id ?? null);
  return {
    ...state,
    activeSceneId: summary?.id ?? null,
    activeSceneVersion: summary?.version ?? null,
    activeSceneSummary: summary,
    activeSceneBackground: activeScene?.document.background.kind === 'image'
      ? {
          ...clone(activeScene.document.background),
          url: `/api/scenes/${encodeURIComponent(activeScene.id)}/background?v=${activeScene.document.background.etag}`,
        }
      : { kind: 'blank' },
  };
}

// The board still consumes top-level fields. This adapter installs the persisted active
// configuration in that legacy shape while keeping live tokens and the rest of the session
// runtime in the battle-map state owned by the server.
export function installActiveSceneProjection(state, activeScene) {
  if (!activeScene) return attachActiveSceneMetadata(state, null);

  const board = activeScene.document.board;
  return attachActiveSceneMetadata({
    ...state,
    diagonalRule: board.diagonalRule,
    measurementUnit: clone(board.measurementUnit),
    isBoardBackgroundHidden: board.isBackgroundHidden,
    isBoardFullyLit: board.isFullyLit,
    lightSources: clone(board.lightSources),
  }, activeScene);
}

export function buildSceneStateView(state, user, sceneService) {
  const activeScene = sceneService?.getActiveScene?.() ?? null;
  const withActiveScene = attachActiveSceneMetadata(state, activeScene);
  const { sceneCatalog: _ignoredCatalog, ...withoutCatalog } = withActiveScene;

  if (user?.role !== 'master') return withoutCatalog;

  return {
    ...withoutCatalog,
    sceneCatalog: summarizeSceneCatalog(
      sceneService?.getCatalog?.() ?? [],
      activeScene?.id ?? null,
    ),
  };
}
