export function up(db) {
  // The migrator bootstraps this same table before it can record this migration.
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    batch INTEGER NOT NULL CHECK (batch > 0),
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL
  )`);
}

export function down() {
  // The migrator requires this ledger to remain available while removing its record.
}
