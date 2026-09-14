export function up(db) {
  db.exec(`CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    owner_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE INDEX campaigns_owner_user_id_idx ON campaigns(owner_user_id)`);
}

export function down(db) {
  db.exec('DROP TABLE campaigns');
}
