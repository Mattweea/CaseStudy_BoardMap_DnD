import { normalizeSceneDrawings, SCENE_LIMITS } from '../shared/scene-model.mjs';

const DRAWING_HISTORY_LIMIT = 40;

export class ScenePersistenceConflictError extends Error {
  constructor(currentScene) {
    super('La scena e stata modificata da un altro client.');
    this.name = 'ScenePersistenceConflictError';
    this.statusCode = 409;
    this.currentScene = currentScene;
  }
}

export class SceneDrawingHistoryUnavailableError extends Error {
  constructor(currentScene) {
    super('Nessuna operazione di disegno disponibile in questa direzione.');
    this.name = 'SceneDrawingHistoryUnavailableError';
    this.statusCode = 409;
    this.currentScene = currentScene;
  }
}

export class SceneNotFoundError extends Error {
  constructor(sceneId) {
    super(`Scena non trovata: ${sceneId}`);
    this.name = 'SceneNotFoundError';
    this.statusCode = 404;
  }
}

function clone(value) {
  return value === null ? null : structuredClone(value);
}

function sameDrawings(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function applyDrawingCommand(drawings, command) {
  const result = [...drawings];
  if (command.kind === 'erase') {
    const ids = new Set(command.ids);
    if (result.filter((drawing) => ids.has(drawing.id)).length !== ids.size) return null;
    return result.filter((drawing) => !ids.has(drawing.id));
  }
  const existingIds = new Set(result.map((drawing) => drawing.id));
  for (const { index, drawing } of command.items) {
    if (existingIds.has(drawing.id) || index > result.length) return null;
    result.splice(index, 0, drawing);
    existingIds.add(drawing.id);
  }
  return result;
}

export class SceneService {
  constructor({ repository, campaignId }) {
    this.repository = repository;
    this.campaignId = campaignId;
    this.scenes = new Map();
    this.activeSceneId = null;
    this.drawingHistory = new Map();
  }

  load() {
    const scenes = this.repository.findByCampaign(this.campaignId);
    const active = this.repository.findActiveByCampaign(this.campaignId);
    this.scenes = new Map(scenes.map((scene) => [scene.id, scene]));
    this.activeSceneId = active?.id ?? null;
    this.drawingHistory.clear();
    return this.getCatalog();
  }

  getCatalog() {
    return [...this.scenes.values()]
      .sort((left, right) => left.sortOrder - right.sortOrder
        || left.name.localeCompare(right.name)
        || left.id.localeCompare(right.id))
      .map(clone);
  }

  getScene(sceneId) {
    return clone(this.scenes.get(sceneId) ?? null);
  }

  getActiveScene() {
    return clone(this.scenes.get(this.activeSceneId) ?? null);
  }

  getDrawingHistoryState(sceneId) {
    const history = this.drawingHistory.get(sceneId);
    return { canUndo: Boolean(history?.undo.length), canRedo: Boolean(history?.redo.length) };
  }

  createScene(input) {
    const persisted = this.repository.create({ ...input, campaignId: this.campaignId });
    this.scenes.set(persisted.id, persisted);
    return clone(persisted);
  }

  updateScene({ id, expectedVersion, name, document, sortOrder, preserveDrawingHistory = false }) {
    if (!this.scenes.has(id)) throw new SceneNotFoundError(id);

    const previous = this.scenes.get(id);

    const persisted = this.repository.saveVersion({
      id,
      campaignId: this.campaignId,
      expectedVersion,
      name,
      document,
      sortOrder,
    });
    if (!persisted) {
      const current = this.repository.findById(id);
      if (current && !sameDrawings(previous.document.drawings, current.document.drawings)) {
        this.drawingHistory.delete(id);
      }
      throw new ScenePersistenceConflictError(current?.campaignId === this.campaignId ? clone(current) : null);
    }

    this.scenes.set(id, persisted);
    if (!preserveDrawingHistory && !sameDrawings(previous.document.drawings, persisted.document.drawings)) {
      this.drawingHistory.delete(id);
    }
    return clone(persisted);
  }

  versionedDrawingScene(id, expectedVersion) {
    const current = this.getScene(id);
    if (!current) throw new SceneNotFoundError(id);
    if (current.version !== expectedVersion) throw new ScenePersistenceConflictError(current);
    return current;
  }

  persistDrawings(current, expectedVersion, drawings) {
    return this.updateScene({
      id: current.id,
      expectedVersion,
      name: current.name,
      document: { ...current.document, drawings },
      sortOrder: current.sortOrder,
      preserveDrawingHistory: true,
    });
  }

  recordDrawingChange(id, entry) {
    const history = this.drawingHistory.get(id) ?? { undo: [], redo: [] };
    history.undo.push(entry);
    if (history.undo.length > DRAWING_HISTORY_LIMIT) history.undo.shift();
    history.redo = [];
    this.drawingHistory.set(id, history);
  }

  addDrawing({ id, expectedVersion, drawing }) {
    const current = this.versionedDrawingScene(id, expectedVersion);
    const [normalized] = normalizeSceneDrawings([drawing]);
    const drawings = normalizeSceneDrawings([...current.document.drawings, normalized]);
    const updated = this.persistDrawings(current, expectedVersion, drawings);
    this.recordDrawingChange(id, {
      undo: { kind: 'erase', ids: [normalized.id] },
      redo: { kind: 'restore', items: [{ index: current.document.drawings.length, drawing: normalized }] },
    });
    return updated;
  }

  eraseDrawings({ id, expectedVersion, ids }) {
    const current = this.versionedDrawingScene(id, expectedVersion);
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > SCENE_LIMITS.maxLayerItems
      || ids.some((value) => typeof value !== 'string' || !value)
      || new Set(ids).size !== ids.length) {
      throw new TypeError('Specifica gli ID dei tratti da cancellare.');
    }
    const erasedIds = new Set(ids);
    const items = current.document.drawings.flatMap((drawing, index) => erasedIds.has(drawing.id) ? [{ index, drawing }] : []);
    if (items.length !== erasedIds.size) throw new ScenePersistenceConflictError(current);
    const drawings = current.document.drawings.filter((drawing) => !erasedIds.has(drawing.id));
    const updated = this.persistDrawings(current, expectedVersion, drawings);
    this.recordDrawingChange(id, {
      undo: { kind: 'restore', items },
      redo: { kind: 'erase', ids },
    });
    return updated;
  }

  replayDrawing({ id, expectedVersion, direction }) {
    const current = this.versionedDrawingScene(id, expectedVersion);
    const history = this.drawingHistory.get(id);
    const source = direction === 'undo' ? history?.undo : history?.redo;
    if (!source?.length) throw new SceneDrawingHistoryUnavailableError(current);
    const entry = source[source.length - 1];
    const drawings = applyDrawingCommand(current.document.drawings, entry[direction]);
    if (!drawings) {
      this.drawingHistory.delete(id);
      throw new ScenePersistenceConflictError(current);
    }
    const updated = this.persistDrawings(current, expectedVersion, drawings);
    source.pop();
    const destination = direction === 'undo' ? history.redo : history.undo;
    destination.push(entry);
    return updated;
  }

  async replaceBackground({ id, expectedVersion, buffer, mediaType, storage }) {
    const current = this.getScene(id);
    if (!current) throw new SceneNotFoundError(id);
    const staged = await storage.stage(buffer, mediaType);
    const previous = current.document.background;
    try {
      const updated = this.updateScene({
        id,
        expectedVersion,
        name: current.name,
        document: { ...current.document, background: staged },
        sortOrder: current.sortOrder,
      });
      if (previous.kind === 'image') await storage.remove(previous).catch(() => {});
      return updated;
    } catch (error) {
      await storage.remove(staged);
      throw error;
    }
  }

  async clearBackground({ id, expectedVersion, storage }) {
    const current = this.getScene(id);
    if (!current) throw new SceneNotFoundError(id);
    const previous = current.document.background;
    const updated = this.updateScene({
      id,
      expectedVersion,
      name: current.name,
      document: { ...current.document, background: { kind: 'blank' } },
      sortOrder: current.sortOrder,
    });
    if (previous.kind === 'image') await storage.remove(previous).catch(() => {});
    return updated;
  }

  setActiveScene(sceneId) {
    if (!this.scenes.has(sceneId)) throw new SceneNotFoundError(sceneId);
    const persisted = this.repository.setActiveScene(this.campaignId, sceneId);
    if (!persisted) throw new SceneNotFoundError(sceneId);
    this.activeSceneId = persisted.id;
    return clone(persisted);
  }
}
