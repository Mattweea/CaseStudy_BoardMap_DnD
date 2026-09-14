export function up(db) {
  db.exec(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('master', 'adventurer')),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

export function down(db) {
  db.exec('DROP TABLE users');
}
