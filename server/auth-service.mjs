import bcrypt from 'bcrypt';

export async function bootstrapRoster(db, profiles) {
  const roles = new Set(db.prepare('SELECT code FROM roles').all().map(({ code }) => code));
  if (!roles.has('master') || !roles.has('adventurer')) {
    throw new Error('Schema ruoli non valido. Esegui npm run db:migrate.');
  }
  const byId = db.prepare('SELECT id, username, password_hash FROM users WHERE id = ?');
  const byUsername = db.prepare('SELECT id, username FROM users WHERE username = ? COLLATE NOCASE');
  const insert = db.prepare('INSERT INTO users (id, username, role_code, password_hash) VALUES (?, ?, ?, ?)');
  const updateLegacyHash = db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

  for (const profile of profiles) {
    const byStableId = byId.get(profile.id);
    const byName = byUsername.get(profile.username);
    if (byStableId && byStableId.username.toLowerCase() !== profile.username) {
      throw new Error(`Conflitto roster: ID ${profile.id} appartiene a ${byStableId.username}.`);
    }
    if (byName && byName.id !== profile.id) {
      throw new Error(`Conflitto roster: username ${profile.username} appartiene a ${byName.id}.`);
    }
    if (!byStableId) {
      insert.run(profile.id, profile.username, profile.role, await bcrypt.hash('password', 12));
    } else if (!byStableId.password_hash.startsWith('$2')) {
      updateLegacyHash.run(await bcrypt.hash('password', 12), profile.id);
    }
  }
}

export class AuthService {
  constructor(repository, sessionStore, sessionTtlMs, rosterUserIds) {
    this.repository = repository;
    this.sessionStore = sessionStore;
    this.sessionTtlMs = sessionTtlMs;
    this.rosterUserIds = new Set(rosterUserIds);
  }

  async authenticate(username, password) {
    const user = this.repository.findByUsername(username);
    if (!user || !this.rosterUserIds.has(user.id) || !(await bcrypt.compare(password, user.passwordHash))) return null;
    return user;
  }

  createSession(sessionId, userId) {
    this.sessionStore.set(sessionId, { userId, expiresAt: Date.now() + this.sessionTtlMs });
  }
}
