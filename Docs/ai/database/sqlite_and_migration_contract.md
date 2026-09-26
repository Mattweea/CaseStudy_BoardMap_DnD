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
- Scene persistence is the approved, narrow exception to the former separation from the JSON battle-map snapshot. On an empty scene catalog, startup imports the supported board configuration once into an initial scene; the existence of any persisted scene is the idempotence marker. Runtime tokens, round, hit points, movement and logs are not imported as durable live state.

## Scene persistence

- `scenes` stores stable scene and campaign identifiers, ordered catalog metadata, an optimistic concurrency version, and the normalized configuration document as valid JSON.
- `campaign_active_scenes` stores at most one active scene per campaign. Its composite foreign key guarantees that the selected scene belongs to the same campaign; deleting an active scene remains restricted until its lifecycle is explicitly handled.
- Scene repository writes normalize the document and remove its runtime projection before serialization. An update succeeds only when its expected version still matches, then advances by one.
- Structural scene changes use persist-before-project: the service changes its in-memory catalog only after SQLite accepts the write. A stale write returns the persisted current scene as conflict context and a storage error leaves the projection untouched.

## Verification

Use a unique temporary `VTT_DB_PATH`, never the developer database. Verify fresh migration, a second no-op migration, status, rollback, reapplication, foreign keys, checksum protection, failure atomicity, data survival after reopen, and any new repository concurrency rule. Scene changes additionally verify cross-campaign active-scene rejection, stale-write behavior and idempotent legacy bootstrap. Run `npm test`; schema work also requires the applicable strict OpenSpec validation when a change is in scope.
