export class ScenePersistenceConflictError extends Error {
  constructor(currentScene) {
    super('La scena e stata modificata da un altro client.');
    this.name = 'ScenePersistenceConflictError';
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

export class SceneService {
  constructor({ repository, campaignId }) {
    this.repository = repository;
    this.campaignId = campaignId;
    this.scenes = new Map();
    this.activeSceneId = null;
  }

  load() {
    const scenes = this.repository.findByCampaign(this.campaignId);
    const active = this.repository.findActiveByCampaign(this.campaignId);
    this.scenes = new Map(scenes.map((scene) => [scene.id, scene]));
    this.activeSceneId = active?.id ?? null;
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

  createScene(input) {
    const persisted = this.repository.create({ ...input, campaignId: this.campaignId });
    this.scenes.set(persisted.id, persisted);
    return clone(persisted);
  }

  updateScene({ id, expectedVersion, name, document, sortOrder }) {
    if (!this.scenes.has(id)) throw new SceneNotFoundError(id);

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
      throw new ScenePersistenceConflictError(current?.campaignId === this.campaignId ? clone(current) : null);
    }

    this.scenes.set(id, persisted);
    return clone(persisted);
  }

  setActiveScene(sceneId) {
    if (!this.scenes.has(sceneId)) throw new SceneNotFoundError(sceneId);
    const persisted = this.repository.setActiveScene(this.campaignId, sceneId);
    if (!persisted) throw new SceneNotFoundError(sceneId);
    this.activeSceneId = persisted.id;
    return clone(persisted);
  }
}
