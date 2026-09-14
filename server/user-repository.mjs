export class UserRepository {
  constructor(db) {
    this.db = db;
    this.byUsername = db.prepare(`SELECT u.id, u.username, u.password_hash AS passwordHash, r.code AS role
      FROM users u JOIN roles r ON r.code = u.role_code WHERE u.username = ? COLLATE NOCASE`);
    this.byId = db.prepare(`SELECT u.id, u.username, u.password_hash AS passwordHash, r.code AS role
      FROM users u JOIN roles r ON r.code = u.role_code WHERE u.id = ?`);
    this.count = db.prepare('SELECT COUNT(*) AS count FROM users');
  }

  findByUsername(username) { return this.byUsername.get(username) ?? null; }
  findById(id) { return this.byId.get(id) ?? null; }
  userCount() { return this.count.get().count; }
}
