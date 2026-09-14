export function up(db) {
  db.exec(`CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE INDEX sessions_user_id_idx ON sessions(user_id);
  CREATE INDEX sessions_expires_at_idx ON sessions(expires_at)`);
}

export function down(db) {
  db.exec('DROP TABLE sessions');
}
