import { randomUUID } from 'node:crypto';
import { assertValidCharacterSheetData, normalizeCharacterSheetData } from './character-sheet-schema.mjs';

function mapRow(row) {
  if (!row) return null;
  let parsed;
  try {
    parsed = JSON.parse(row.data_json);
  } catch {
    parsed = null;
  }
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    campaignId: row.campaign_id,
    version: row.version,
    data: normalizeCharacterSheetData(parsed),
    portraitFileName: row.portrait_file_name ?? null,
    portraitMediaType: row.portrait_media_type ?? null,
    portraitUpdatedAt: row.portrait_updated_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CharacterSheetRepository {
  constructor(db) {
    this.db = db;
    this.selectColumns = `id, owner_user_id, campaign_id, version, data_json,
      portrait_file_name, portrait_media_type, portrait_updated_at, created_at, updated_at`;
    this.byId = db.prepare(`SELECT ${this.selectColumns} FROM character_sheets WHERE id = ?`);
    this.byOwnerCampaign = db.prepare(`SELECT ${this.selectColumns} FROM character_sheets
      WHERE owner_user_id = ? AND campaign_id = ?`);
    this.byCampaign = db.prepare(`SELECT ${this.selectColumns} FROM character_sheets
      WHERE campaign_id = ? ORDER BY owner_user_id`);
    this.insert = db.prepare(`INSERT INTO character_sheets
      (id, owner_user_id, campaign_id, version, data_json)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(owner_user_id, campaign_id) DO NOTHING`);
    this.updateVersioned = db.prepare(`UPDATE character_sheets
      SET data_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND version = ?`);
    this.updatePortraitStatement = db.prepare(`UPDATE character_sheets
      SET portrait_file_name = ?, portrait_media_type = ?, portrait_updated_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`);
  }

  findById(id) { return mapRow(this.byId.get(id)); }
  findByOwnerCampaign(ownerUserId, campaignId) { return mapRow(this.byOwnerCampaign.get(ownerUserId, campaignId)); }
  findByCampaign(campaignId) { return this.byCampaign.all(campaignId).map(mapRow); }

  createOrGet({ id = randomUUID(), ownerUserId, campaignId, data }) {
    assertValidCharacterSheetData(data);
    const create = this.db.transaction(() => {
      this.insert.run(id, ownerUserId, campaignId, JSON.stringify(data));
      return this.findByOwnerCampaign(ownerUserId, campaignId);
    });
    return create();
  }

  saveVersion({ id, expectedVersion, version, data }) {
    assertValidCharacterSheetData(data);
    if (!Number.isInteger(expectedVersion) || !Number.isInteger(version) || version <= expectedVersion) {
      throw new TypeError('Versioni di persistenza non valide.');
    }
    const save = this.db.transaction(() => {
      const result = this.updateVersioned.run(JSON.stringify(data), version, id, expectedVersion);
      return result.changes === 1 ? this.findById(id) : null;
    });
    return save();
  }

  updatePortrait(id, { fileName, mediaType, updatedAt = new Date().toISOString() }) {
    const update = this.db.transaction(() => {
      const result = this.updatePortraitStatement.run(fileName, mediaType, updatedAt, id);
      return result.changes === 1 ? this.findById(id) : null;
    });
    return update();
  }
}
