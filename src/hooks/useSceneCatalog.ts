import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardDimensions, SceneDrawing } from '../types';
import {
  sceneApi,
  SceneApiError,
  type PersistedScene,
  type SceneBackgroundCalibration,
  type SceneCatalogEntry,
} from '../utils/sceneApi';

function entryFromScene(scene: PersistedScene): SceneCatalogEntry {
  const { id, name, version, sortOrder, createdAt, updatedAt, isActive } = scene;
  return { id, name, version, sortOrder, createdAt, updatedAt, isActive };
}

function replaceEntry(catalog: SceneCatalogEntry[], scene: PersistedScene) {
  const entry = entryFromScene(scene);
  const next = catalog.some(({ id }) => id === entry.id)
    ? catalog.map((current) => current.id === entry.id ? entry : current)
    : [...catalog, entry];
  return next.sort((left, right) => left.sortOrder - right.sortOrder
    || left.name.localeCompare(right.name)
    || left.id.localeCompare(right.id));
}

function readableError(error: unknown, fallback: string) {
  if (error instanceof TypeError || (error instanceof Error && error.message === 'Failed to fetch')) {
    return 'Impossibile contattare il server delle scene.';
  }
  return error instanceof Error ? error.message : fallback;
}

export function useSceneCatalog(enabled: boolean) {
  const [catalog, setCatalog] = useState<SceneCatalogEntry[]>([]);
  const [selectedScene, setSelectedScene] = useState<PersistedScene | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawingWritePending = useRef(false);

  const loadCatalog = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const payload = await sceneApi.list();
      setCatalog(payload.scenes);
    } catch (requestError) {
      setError(readableError(requestError, 'Catalogo scene non disponibile.'));
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCatalog([]);
      setSelectedScene(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    void loadCatalog();
  }, [enabled, loadCatalog]);

  const selectScene = async (sceneId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      setSelectedScene(await sceneApi.get(sceneId));
    } catch (requestError) {
      setError(readableError(requestError, 'Dettaglio scena non disponibile.'));
    } finally {
      setIsLoading(false);
    }
  };

  const createScene = async (name: string) => {
    setIsMutating(true);
    setError(null);
    try {
      const created = await sceneApi.create(name);
      setCatalog((current) => replaceEntry(current, created));
      setSelectedScene(created);
      return true;
    } catch (requestError) {
      setError(readableError(requestError, 'Creazione della scena non riuscita.'));
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const updateScene = async (
    name: string,
    backgroundDraft: File | 'blank' | null = null,
    backgroundCalibration: SceneBackgroundCalibration | null = null,
    boardDimensions: BoardDimensions | null = null,
  ) => {
    if (!selectedScene) return false;
    setIsMutating(true);
    setError(null);
    try {
      let updated = selectedScene;
      if (backgroundDraft instanceof File) {
        updated = await sceneApi.uploadBackground(selectedScene.id, updated.version, backgroundDraft);
      } else if (backgroundDraft === 'blank' && updated.document.background.kind !== 'blank') {
        updated = await sceneApi.clearBackground(selectedScene.id, updated.version);
      }
      const patch: {
        name?: string;
        backgroundCalibration?: SceneBackgroundCalibration;
        boardDimensions?: BoardDimensions;
      } = {};
      if (name.trim() !== updated.name) patch.name = name;
      if (backgroundCalibration && updated.document.background.kind === 'image') {
        const current = updated.document.background;
        if (
          current.scale !== backgroundCalibration.scale
          || current.offsetX !== backgroundCalibration.offsetX
          || current.offsetY !== backgroundCalibration.offsetY
        ) {
          patch.backgroundCalibration = backgroundCalibration;
        }
      }
      if (boardDimensions) {
        const current = updated.document.board.dimensions;
        if (current.columns !== boardDimensions.columns || current.rows !== boardDimensions.rows) {
          patch.boardDimensions = boardDimensions;
        }
      }
      if (Object.keys(patch).length > 0) {
        updated = await sceneApi.update(selectedScene.id, updated.version, patch);
      }
      setCatalog((current) => replaceEntry(current, updated));
      setSelectedScene(updated);
      return true;
    } catch (requestError) {
      if (requestError instanceof SceneApiError && requestError.status === 409 && requestError.payload.currentScene) {
        const current = requestError.payload.currentScene;
        setCatalog((catalogState) => replaceEntry(catalogState, current));
        setSelectedScene(current);
        setError('La scena e cambiata nel frattempo. Ho caricato la versione piu recente.');
      } else {
        setError(readableError(requestError, 'Modifica della scena non riuscita.'));
      }
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const writeDrawing = async (action: (scene: PersistedScene) => Promise<PersistedScene>, fallback = 'Salvataggio del disegno non riuscito. Riprova.') => {
    if (!selectedScene || drawingWritePending.current) return false;
    drawingWritePending.current = true;
    setIsMutating(true);
    setError(null);
    try {
      const updated = await action(selectedScene);
      setCatalog((current) => replaceEntry(current, updated));
      setSelectedScene(updated);
      return true;
    } catch (requestError) {
      if (requestError instanceof SceneApiError && requestError.status === 409 && requestError.payload.currentScene) {
        const current = requestError.payload.currentScene;
        setCatalog((catalogState) => replaceEntry(catalogState, current));
        setSelectedScene(current);
        setError('La scena è cambiata nel frattempo. Ho caricato la versione più recente; ripeti il gesto.');
      } else {
        setError(readableError(requestError, fallback));
      }
      return false;
    } finally {
      drawingWritePending.current = false;
      setIsMutating(false);
    }
  };

  return {
    catalog,
    selectedScene,
    isLoading,
    isMutating,
    error,
    reload: loadCatalog,
    selectScene,
    createScene,
    updateScene,
    addDrawing: (drawing: SceneDrawing) => writeDrawing((scene) => sceneApi.addDrawing(scene.id, scene.version, drawing)),
    eraseDrawings: (ids: string[]) => writeDrawing((scene) => sceneApi.eraseDrawings(scene.id, scene.version, ids)),
    undoDrawing: () => writeDrawing((scene) => sceneApi.undoDrawing(scene.id, scene.version), 'Impossibile annullare il disegno. Riprova.'),
    redoDrawing: () => writeDrawing((scene) => sceneApi.redoDrawing(scene.id, scene.version), 'Impossibile ripetere il disegno. Riprova.'),
  };
}
