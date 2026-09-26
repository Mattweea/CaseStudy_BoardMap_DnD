import { useCallback, useEffect, useState } from 'react';
import {
  sceneApi,
  SceneApiError,
  type PersistedScene,
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

  const updateScene = async (name: string) => {
    if (!selectedScene) return false;
    setIsMutating(true);
    setError(null);
    try {
      const updated = await sceneApi.update(selectedScene.id, selectedScene.version, name);
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
  };
}
