import { randomUUID } from 'node:crypto';
import { normalizeSceneDrawings, normalizeSceneElements, normalizeSceneEncounters, normalizeSceneDocument, SCENE_LIMITS, SCENE_ENTITY_KINDS } from '../shared/scene-model.mjs';

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

export class SceneEncounterReferencedError extends Error {
  constructor() {
    super('Rimuovi prima i placement collegati a questo encounter.');
    this.name = 'SceneEncounterReferencedError';
    this.statusCode = 409;
  }
}

export class SceneEntityReferencedError extends Error {
  constructor() {
    super('Rimuovi prima i placement collegati a questa entità.');
    this.name = 'SceneEntityReferencedError';
    this.statusCode = 409;
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

  versionedScene(id, expectedVersion) {
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
    const current = this.versionedScene(id, expectedVersion);
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
    const current = this.versionedScene(id, expectedVersion);
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
    const current = this.versionedScene(id, expectedVersion);
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

  persistElements(current, expectedVersion, elements) {
    return this.updateScene({
      id: current.id,
      expectedVersion,
      name: current.name,
      document: { ...current.document, elements },
      sortOrder: current.sortOrder,
    });
  }

  addElement({ id, expectedVersion, element }) {
    const current = this.versionedScene(id, expectedVersion);
    const elements = normalizeSceneElements(
      [...current.document.elements, element], current.document.board.dimensions,
    );
    return this.persistElements(current, expectedVersion, elements);
  }

  updateElement({ id, elementId, expectedVersion, transform }) {
    const current = this.versionedScene(id, expectedVersion);
    const index = current.document.elements.findIndex((element) => element.id === elementId);
    if (index < 0) throw new ScenePersistenceConflictError(current);
    if (!transform || typeof transform !== 'object' || Array.isArray(transform)
      || !transform.position || transform.widthCells === undefined
      || transform.heightCells === undefined || transform.rotation === undefined) {
      throw new TypeError('Specifica posizione, dimensioni e rotazione dell’elemento.');
    }
    const elements = [...current.document.elements];
    elements[index] = { ...elements[index], ...transform, id: elementId, kind: elements[index].kind };
    return this.persistElements(
      current, expectedVersion, normalizeSceneElements(elements, current.document.board.dimensions),
    );
  }

  removeElement({ id, elementId, expectedVersion }) {
    const current = this.versionedScene(id, expectedVersion);
    if (!current.document.elements.some((element) => element.id === elementId)) {
      throw new ScenePersistenceConflictError(current);
    }
    return this.persistElements(current, expectedVersion,
      current.document.elements.filter((element) => element.id !== elementId));
  }

  persistEncounters(current, expectedVersion, encounters) {
    return this.updateScene({
      id: current.id,
      expectedVersion,
      name: current.name,
      document: { ...current.document, encounters },
      sortOrder: current.sortOrder,
    });
  }

  createEncounter({ id, expectedVersion, encounter }) {
    const current = this.versionedScene(id, expectedVersion);
    if (!encounter || typeof encounter !== 'object' || Array.isArray(encounter)) {
      throw new TypeError('Specifica i dati dell’encounter.');
    }
    const encounters = normalizeSceneEncounters([
      ...current.document.encounters,
      { ...encounter, id: randomUUID() },
    ]);
    return this.persistEncounters(current, expectedVersion, encounters);
  }

  updateEncounter({ id, encounterId, expectedVersion, patch }) {
    const current = this.versionedScene(id, expectedVersion);
    const index = current.document.encounters.findIndex((encounter) => encounter.id === encounterId);
    if (index < 0) throw new ScenePersistenceConflictError(current);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)
      || (patch.name === undefined && patch.kind === undefined && patch.description === undefined)) {
      throw new TypeError('Specifica i dati da modificare.');
    }
    const encounters = [...current.document.encounters];
    encounters[index] = { ...encounters[index],
      name: patch.name === undefined ? encounters[index].name : patch.name,
      kind: patch.kind === undefined ? encounters[index].kind : patch.kind,
      description: patch.description === undefined ? encounters[index].description : patch.description };
    return this.persistEncounters(current, expectedVersion, normalizeSceneEncounters(encounters));
  }

  removeEncounter({ id, encounterId, expectedVersion }) {
    const current = this.versionedScene(id, expectedVersion);
    if (!current.document.encounters.some((encounter) => encounter.id === encounterId)) {
      throw new ScenePersistenceConflictError(current);
    }
    const entityIds = new Set(current.document.entityReferences
      .filter((reference) => reference.encounterId === encounterId).map((reference) => reference.id));
    if (current.document.preparedPlacements.some((placement) => placement.encounterId === encounterId
      || entityIds.has(placement.entityReferenceId))) {
      throw new SceneEncounterReferencedError();
    }
    return this.updateScene({
      id: current.id,
      expectedVersion,
      name: current.name,
      document: {
        ...current.document,
        encounters: current.document.encounters.filter((encounter) => encounter.id !== encounterId),
        entityReferences: current.document.entityReferences.filter((reference) => reference.encounterId !== encounterId),
      },
      sortOrder: current.sortOrder,
    });
  }

  createEncounterEntity({ id, encounterId, expectedVersion, entity }) {
    const current = this.versionedScene(id, expectedVersion);
    if (!current.document.encounters.some((encounter) => encounter.id === encounterId)) {
      throw new ScenePersistenceConflictError(current);
    }
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)
      || !SCENE_ENTITY_KINDS.includes(entity.kind)
      || Object.keys(entity).some((key) => !['kind', 'name', 'tokenProperties'].includes(key))) {
      throw new TypeError('Specifica nome e tipo monster o npc dell’entità.');
    }
    const reference = {
      id: randomUUID(),
      entityId: randomUUID(),
      entityType: entity.kind,
      encounterId,
      name: entity.name,
      ...(entity.tokenProperties === undefined ? {} : { tokenProperties: entity.tokenProperties }),
    };
    const document = normalizeSceneDocument({
      ...current.document,
      entityReferences: [...current.document.entityReferences, reference],
    });
    return this.updateScene({
      id: current.id, expectedVersion, name: current.name, document, sortOrder: current.sortOrder,
    });
  }

  updateEncounterEntity({ id, encounterId, referenceId, expectedVersion, entity }) {
    const current = this.versionedScene(id, expectedVersion);
    const existing = current.document.entityReferences.find((reference) => reference.id === referenceId
      && reference.encounterId === encounterId);
    if (!existing) throw new ScenePersistenceConflictError(current);
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)
      || !SCENE_ENTITY_KINDS.includes(entity.kind)
      || Object.keys(entity).some((key) => !['kind', 'name', 'tokenProperties'].includes(key))) {
      throw new TypeError('Specifica nome e tipo monster o npc dell’entità.');
    }
    const replacement = {
      ...existing,
      entityType: entity.kind,
      name: entity.name,
      ...(entity.tokenProperties === undefined ? {} : { tokenProperties: entity.tokenProperties }),
    };
    const document = normalizeSceneDocument({
      ...current.document,
      entityReferences: current.document.entityReferences.map((reference) => reference.id === referenceId
        ? replacement : reference),
    });
    return this.updateScene({
      id: current.id, expectedVersion, name: current.name, document, sortOrder: current.sortOrder,
    });
  }

  removeEncounterEntity({ id, encounterId, referenceId, expectedVersion }) {
    const current = this.versionedScene(id, expectedVersion);
    if (!current.document.entityReferences.some((reference) => reference.id === referenceId
      && reference.encounterId === encounterId)) {
      throw new ScenePersistenceConflictError(current);
    }
    if (current.document.preparedPlacements.some((placement) => placement.entityReferenceId === referenceId)) {
      throw new SceneEntityReferencedError();
    }
    return this.updateScene({
      id: current.id,
      expectedVersion,
      name: current.name,
      document: {
        ...current.document,
        entityReferences: current.document.entityReferences.filter((reference) => reference.id !== referenceId),
      },
      sortOrder: current.sortOrder,
    });
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

  activateScene({ id, expectedVersion }) {
    const current = this.versionedScene(id, expectedVersion);
    const persisted = this.repository.setActiveScene(this.campaignId, current.id);
    if (!persisted) throw new SceneNotFoundError(id);
    this.activeSceneId = persisted.id;
    return clone(persisted);
  }
}
