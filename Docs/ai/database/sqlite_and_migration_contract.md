# SQLite and Migration Contract

## Purpose

Define the stable connection, schema-evolution, safety, and verification rules for the project's SQLite persistence boundary.

## Connection boundary

- `database/connection.mjs` resolves `VTT_DB_PATH`; relative paths are resolved from the project root and the default is `database/database.sqlite`.
- Opening a database creates its parent directory, enables foreign keys, sets a 5-second busy timeout, and requires WAL journal mode. Startup must fail if these invariants cannot be established.
- The application must close the connection only after pending character-sheet state has been flushed during a controlled shutdown.
- Database files and their WAL/SHM companions are runtime data and must remain untracked.

## Versioned migrations

- Migration filenames follow `YYYYMMDD_NNN_slug.mjs`, sort lexicographically, and export both `up(db)` and `down(db)`.
- `schema_migrations` records name, batch, application time, and SHA-256 checksum.
- An applied migration is immutable. A missing or checksum-mismatched applied file is an integrity failure; introduce a new migration instead of editing history.
- Each migration is applied or rolled back inside `BEGIN IMMEDIATE` and its own transaction. `db:rollback` reverts only the latest batch in reverse order.
- A destructive development reset requires explicit confirmation and renames the database plus WAL/SHM files to dated backups before rebuilding the schema.

## Repository and change rules

- Repositories own SQL and row-to-domain mapping; services own authorization, live state, conflict handling, and realtime effects.
- Preserve foreign-key behavior, stable IDs, existing data, and rollback semantics when changing schema.
- Detect incompatible existing rows before destructive or uniqueness-altering statements so failure leaves the prior schema usable.
- Do not silently migrate the JSON battle-map snapshot into SQLite. It is a separate persistence boundary until an approved capability change defines the migration.

## Verification

Use a unique temporary `VTT_DB_PATH`, never the developer database. Verify fresh migration, status, rollback, reapplication, foreign keys, checksum protection, failure atomicity, data survival after reopen, and any new repository concurrency rule. Run `npm test`; schema work also requires the applicable strict OpenSpec validation when a change is in scope.
