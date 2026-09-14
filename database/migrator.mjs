import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot } from './connection.mjs';

export const migrationsDirectory = resolve(projectRoot, 'database/migrations');
const migrationName = /^(\d{8})_(\d{3})_([a-z0-9]+(?:[-_][a-z0-9]+)*)\.mjs$/;

function checksum(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

export async function discoverMigrations(directory = migrationsDirectory) {
  mkdirSync(directory, { recursive: true });
  const names = readdirSync(directory).filter((name) => !name.startsWith('.') && name.endsWith('.mjs'));
  for (const name of names) {
    if (!migrationName.test(name)) throw new Error(`Invalid migration filename: ${name}`);
  }
  const sortedNames = names.sort((a, b) => a.localeCompare(b));
  if (new Set(sortedNames).size !== sortedNames.length) throw new Error('Duplicate migration filenames found.');

  return Promise.all(sortedNames.map(async (name) => {
    const path = join(directory, name);
    const contents = readFileSync(path);
    const module = await import(`${pathToFileURL(path).href}?checksum=${checksum(contents)}`);
    if (typeof module.up !== 'function' || typeof module.down !== 'function') {
      throw new Error(`Migration ${name} must export up(db) and down(db).`);
    }
    return { name, path, checksum: checksum(contents), up: module.up, down: module.down };
  }));
}

export function ensureMigrationTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    batch INTEGER NOT NULL CHECK (batch > 0),
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL
  )`);
}

export function assertMigrationIntegrity(db, migrations) {
  const byName = new Map(migrations.map((migration) => [migration.name, migration]));
  const applied = db.prepare('SELECT name, checksum FROM schema_migrations').all();
  for (const record of applied) {
    const migration = byName.get(record.name);
    if (!migration) throw new Error(`Applied migration is missing from disk: ${record.name}`);
    if (migration.checksum !== record.checksum) {
      throw new Error(`Applied migration has changed: ${record.name}. Create a new migration instead.`);
    }
  }
}

function begin(db) { db.exec('BEGIN IMMEDIATE'); }
function rollback(db) { try { db.exec('ROLLBACK'); } catch {} }

export async function migrate(db, directory = migrationsDirectory) {
  const migrations = await discoverMigrations(directory);
  ensureMigrationTable(db);
  assertMigrationIntegrity(db, migrations);
  const applied = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name));
  const pending = migrations.filter((migration) => !applied.has(migration.name));
  if (!pending.length) return { applied: [], batch: null };
  const batch = db.prepare('SELECT COALESCE(MAX(batch), 0) AS batch FROM schema_migrations').get().batch + 1;

  for (const migration of pending) {
    begin(db);
    try {
      const existing = db.prepare('SELECT checksum FROM schema_migrations WHERE name = ?').get(migration.name);
      if (existing) {
        if (existing.checksum !== migration.checksum) throw new Error(`Applied migration has changed: ${migration.name}`);
      } else {
        migration.up(db);
        db.prepare('INSERT INTO schema_migrations (name, batch, checksum) VALUES (?, ?, ?)')
          .run(migration.name, batch, migration.checksum);
      }
      db.exec('COMMIT');
    } catch (error) {
      rollback(db);
      throw error;
    }
  }
  return { applied: pending.map((migration) => migration.name), batch };
}

export async function migrationStatus(db, directory = migrationsDirectory) {
  const migrations = await discoverMigrations(directory);
  ensureMigrationTable(db);
  assertMigrationIntegrity(db, migrations);
  const applied = new Map(db.prepare('SELECT name, batch, applied_at, checksum FROM schema_migrations').all().map((row) => [row.name, row]));
  return migrations.map((migration) => ({ name: migration.name, ...(applied.get(migration.name) || { batch: null, applied_at: null }), applied: applied.has(migration.name) }));
}

export async function rollbackLatestBatch(db, directory = migrationsDirectory) {
  const migrations = await discoverMigrations(directory);
  ensureMigrationTable(db);
  assertMigrationIntegrity(db, migrations);
  const latest = db.prepare('SELECT MAX(batch) AS batch FROM schema_migrations').get().batch;
  if (latest === null) return { rolledBack: [], batch: null };
  const byName = new Map(migrations.map((migration) => [migration.name, migration]));
  const records = db.prepare('SELECT name FROM schema_migrations WHERE batch = ? ORDER BY name DESC').all(latest);

  for (const record of records) {
    const migration = byName.get(record.name);
    begin(db);
    try {
      migration.down(db);
      db.prepare('DELETE FROM schema_migrations WHERE name = ?').run(record.name);
      db.exec('COMMIT');
    } catch (error) {
      rollback(db);
      throw error;
    }
  }
  return { rolledBack: records.map((record) => record.name), batch: latest };
}

export function makeMigration(slug, directory = migrationsDirectory, now = new Date()) {
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug || '')) {
    throw new Error('Migration slug must use lowercase letters, numbers, hyphens, and underscores.');
  }
  mkdirSync(directory, { recursive: true });
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const prefix = `${date}_`;
  const existing = readdirSync(directory).filter((name) => name.startsWith(prefix));
  const numbers = existing.map((name) => migrationName.exec(name)?.[2]).filter(Boolean).map(Number);
  const next = String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, '0');
  const path = join(directory, `${date}_${next}_${slug}.mjs`);
  if (existsSync(path)) throw new Error(`Migration already exists: ${path}`);
  writeFileSync(path, `export function up(db) {\n  // Add schema changes here.\n}\n\nexport function down(db) {\n  // Revert the schema changes here.\n}\n`);
  return path;
}
