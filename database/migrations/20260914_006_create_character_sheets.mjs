export function up(db) {
  db.exec(`CREATE TABLE character_sheets (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    data_json TEXT NOT NULL CHECK (json_valid(data_json)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE INDEX character_sheets_owner_campaign_idx ON character_sheets(owner_user_id, campaign_id);
  CREATE INDEX character_sheets_campaign_id_idx ON character_sheets(campaign_id)`);
}

export function down(db) {
  db.exec('DROP TABLE character_sheets');
}
