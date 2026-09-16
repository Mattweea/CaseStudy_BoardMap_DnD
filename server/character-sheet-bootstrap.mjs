import { CharacterSheetRepository } from './character-sheet-repository.mjs';
import { createInitialCharacterSheetData, normalizeCharacterSheetData } from './character-sheet-schema.mjs';

export const LOCAL_CAMPAIGN_ID = 'local-campaign';

export function bootstrapCharacterSheets(db, profiles, { campaignId = LOCAL_CAMPAIGN_ID } = {}) {
  const repository = new CharacterSheetRepository(db);
  const insertCampaign = db.prepare(`INSERT INTO campaigns (id, name, owner_user_id)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO NOTHING`);
  const rawSheet = db.prepare('SELECT id, data_json FROM character_sheets WHERE owner_user_id = ? AND campaign_id = ?');
  const normalizeSheet = db.prepare('UPDATE character_sheets SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const master = profiles.find((profile) => profile.role === 'master');
  if (!master) throw new Error('Il roster deve includere un Master per la campagna locale.');

  const run = db.transaction(() => {
    insertCampaign.run(campaignId, 'Campagna locale', master.id);
    for (const profile of profiles.filter((entry) => entry.role === 'adventurer')) {
      const existing = rawSheet.get(profile.id, campaignId);
      if (!existing) {
        repository.createOrGet({
          ownerUserId: profile.id,
          campaignId,
          data: createInitialCharacterSheetData(profile),
        });
        continue;
      }
      let parsed;
      try { parsed = JSON.parse(existing.data_json); } catch { parsed = null; }
      const normalized = normalizeCharacterSheetData(parsed, profile);
      const serialized = JSON.stringify(normalized);
      if (serialized !== existing.data_json) normalizeSheet.run(serialized, existing.id);
    }
  });
  run();
  return repository.findByCampaign(campaignId);
}
