export function up(db) {
  db.exec(`CREATE TABLE scenes (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    document_json TEXT NOT NULL CHECK (json_valid(document_json)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE (campaign_id, id)
  );
  CREATE INDEX scenes_campaign_order_idx ON scenes(campaign_id, sort_order, id);

  CREATE TABLE campaign_active_scenes (
    campaign_id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (campaign_id, scene_id) REFERENCES scenes(campaign_id, id)
      ON DELETE RESTRICT ON UPDATE CASCADE
  )`);
}

export function down(db) {
  db.exec(`DROP TABLE campaign_active_scenes;
  DROP INDEX scenes_campaign_order_idx;
  DROP TABLE scenes`);
}
