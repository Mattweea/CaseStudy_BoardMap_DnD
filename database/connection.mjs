import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultDatabasePath = resolve(projectRoot, 'database/database.sqlite');

export function resolveDatabasePath(value = process.env.VTT_DB_PATH) {
  if (!value) return defaultDatabasePath;
  return isAbsolute(value) ? value : resolve(projectRoot, value);
}

export function openDatabase({ path } = {}) {
  const databasePath = resolveDatabasePath(path);
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);

  try {
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    const journalMode = db.pragma('journal_mode = WAL', { simple: true });
    const foreignKeys = db.pragma('foreign_keys', { simple: true });
    const activeJournalMode = db.pragma('journal_mode', { simple: true });

    if (foreignKeys !== 1) throw new Error('SQLite foreign key enforcement could not be enabled.');
    if (journalMode !== 'wal' || activeJournalMode !== 'wal') {
      throw new Error(`SQLite WAL journal mode is unavailable (active: ${activeJournalMode}).`);
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export { defaultDatabasePath, projectRoot };
