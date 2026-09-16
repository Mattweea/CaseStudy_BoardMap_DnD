function assertNoDuplicateSheets(db) {
  const duplicate = db.prepare(`SELECT owner_user_id, campaign_id, COUNT(*) AS count
    FROM character_sheets
    GROUP BY owner_user_id, campaign_id
    HAVING COUNT(*) > 1
    LIMIT 1`).get();

  if (duplicate) {
    throw new Error(
      `Impossibile applicare P0.4: esistono ${duplicate.count} schede per ${duplicate.owner_user_id}/${duplicate.campaign_id}.`,
    );
  }
}

export function up(db) {
  assertNoDuplicateSheets(db);
  db.exec(`ALTER TABLE character_sheets ADD COLUMN portrait_file_name TEXT;
  ALTER TABLE character_sheets ADD COLUMN portrait_media_type TEXT;
  ALTER TABLE character_sheets ADD COLUMN portrait_updated_at TEXT;
  CREATE UNIQUE INDEX character_sheets_owner_campaign_unique
    ON character_sheets(owner_user_id, campaign_id)`);
}

export function down(db) {
  db.exec(`DROP INDEX character_sheets_owner_campaign_unique;
  ALTER TABLE character_sheets DROP COLUMN portrait_updated_at;
  ALTER TABLE character_sheets DROP COLUMN portrait_media_type;
  ALTER TABLE character_sheets DROP COLUMN portrait_file_name`);
}
