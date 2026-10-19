import { randomUUID } from 'node:crypto';
import {
  captureSceneConfiguration,
  normalizeScene,
  normalizeSceneMetadata,
} from '../shared/scene-model.mjs';

function normalizeSortOrder(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('L\'ordinamento della scena deve essere un intero non negativo.');
  }
  return value;
}

function mapRow(row) {
  if (!row) return null;

  let document;
  try {
    document = JSON.parse(row.document_json);
  } catch {
    document = null;
  }

  const scene = normalizeScene({
    id: row.id,
    name: row.name,
    version: row.version,
    document,
  });
  return {
    ...scene,
    campaignId: row.campaign_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SceneRepository {
  constructor(db) {
    this.db = db;
    this.selectColumns = `id, campaign_id, name, sort_order, version, document_json,
      created_at, updated_at`;
    this.byId = db.prepare(`SELECT ${this.selectColumns} FROM scenes WHERE id = ?`);
    this.byCampaign = db.prepare(`SELECT ${this.selectColumns} FROM scenes
      WHERE campaign_id = ? ORDER BY sort_order, name COLLATE NOCASE, id`);
    this.activeByCampaign = db.prepare(`SELECT scenes.id, scenes.campaign_id, scenes.name,
      scenes.sort_order, scenes.version, scenes.document_json, scenes.created_at, scenes.updated_at
      FROM campaign_active_scenes
      JOIN scenes ON scenes.campaign_id = campaign_active_scenes.campaign_id
        AND scenes.id = campaign_active_scenes.scene_id
      WHERE campaign_active_scenes.campaign_id = ?`);
    this.insert = db.prepare(`INSERT INTO scenes
      (id, campaign_id, name, sort_order, version, document_json)
      VALUES (?, ?, ?, ?, 1, ?)`);
    this.updateVersioned = db.prepare(`UPDATE scenes
      SET name = ?, sort_order = ?, document_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND campaign_id = ? AND version = ?`);
    this.upsertActive = db.prepare(`INSERT INTO campaign_active_scenes
      (campaign_id, scene_id) SELECT campaign_id, id FROM scenes
      WHERE campaign_id = ? AND id = ?
      ON CONFLICT(campaign_id) DO UPDATE SET
        scene_id = excluded.scene_id,
        updated_at = CURRENT_TIMESTAMP`);
  }

  findById(id) {
    return mapRow(this.byId.get(id));
  }

  findByCampaign(campaignId) {
    return this.byCampaign.all(campaignId).map(mapRow);
  }

  findActiveByCampaign(campaignId) {
    return mapRow(this.activeByCampaign.get(campaignId));
  }

  create({ id = randomUUID(), campaignId, name, document, sortOrder = 0 }) {
    const metadata = normalizeSceneMetadata({ id, name, version: 1 });
    const configuration = captureSceneConfiguration(document);
    const order = normalizeSortOrder(sortOrder);
    const create = this.db.transaction(() => {
      this.insert.run(
        metadata.id,
        campaignId,
        metadata.name,
        order,
        JSON.stringify(configuration),
      );
      return this.findById(metadata.id);
    });
    return create();
  }

  createAndActivate(input) {
    const create = this.db.transaction(() => {
      const scene = this.create(input);
      const result = this.upsertActive.run(scene.campaignId, scene.id);
      if (result.changes !== 1) throw new Error('Impossibile attivare la scena appena creata.');
      return scene;
    });
    return create();
  }

  saveVersion({ id, campaignId, expectedVersion, name, document, sortOrder }) {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      throw new TypeError('La versione attesa deve essere un intero positivo.');
    }
    const metadata = normalizeSceneMetadata({ id, name, version: expectedVersion + 1 });
    const configuration = captureSceneConfiguration(document);
    const order = normalizeSortOrder(sortOrder);
    const save = this.db.transaction(() => {
      const result = this.updateVersioned.run(
        metadata.name,
        order,
        JSON.stringify(configuration),
        metadata.version,
        metadata.id,
        campaignId,
        expectedVersion,
      );
      return result.changes === 1 ? this.findById(metadata.id) : null;
    });
    return save();
  }

  setActiveScene(campaignId, sceneId) {
    const setActive = this.db.transaction(() => {
      const result = this.upsertActive.run(campaignId, sceneId);
      return result.changes === 1 ? this.findActiveByCampaign(campaignId) : null;
    });
    return setActive();
  }
}
