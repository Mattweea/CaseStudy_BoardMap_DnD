const INITIAL_PASSWORD_HASH = '$2b$12$Ujbr.uA14YhfXKue5Hy1E.DvmroAb4LJXntZZLNS9XzgkrapyxIOW';

export function up(db) {
  db.exec(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    role_code TEXT NOT NULL REFERENCES roles(code) ON DELETE RESTRICT ON UPDATE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const insertUser = db.prepare(
    'INSERT INTO users (id, username, role_code, password_hash) VALUES (?, ?, ?, ?)',
  );
  [
    ['master-user', 'master', 'master'],
    ['player-ilthar', 'ilthar', 'adventurer'],
    ['player-thalendir', 'thalendir', 'adventurer'],
    ['player-ragnar', 'ragnar', 'adventurer'],
    ['player-hunter', 'hunter', 'adventurer'],
    ['player-sylas', 'sylas', 'adventurer'],
    ['player-vesuth', 'vesuth', 'adventurer'],
  ].forEach(([id, username, roleCode]) => insertUser.run(id, username, roleCode, INITIAL_PASSWORD_HASH));
}

export function down(db) {
  db.exec('DROP TABLE users');
}
