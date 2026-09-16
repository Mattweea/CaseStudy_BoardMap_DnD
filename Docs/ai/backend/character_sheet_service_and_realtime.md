# Character-Sheet Service and Realtime

## Purpose

Define the authoritative server lifecycle for character sheets, including access policy, granular patches, concurrency, persistence, portraits, token projection, and SSE delivery.

## Authority and access

- `CharacterSheetService` owns the live document and version for every loaded sheet; clients submit operations, not replacement documents.
- The owner and master may read, write, flush, and subscribe to a sheet. Another adventurer must not receive its private data through routes or SSE.
- Portrait bytes are available to authenticated participants, while only the owner or master may replace them. Files remain outside public assets and are addressed by generated opaque names.
- The battle-map snapshot must not embed character-sheet documents.

## Patch and concurrency contract

- A patch carries `baseVersion` and 1–100 validated granular operations. The service validates each operation and the complete resulting document before committing it atomically in memory.
- Every accepted patch increments the live version and records the changed path or stable row ID.
- A stale patch may merge when its paths have not changed since `baseVersion`. A conflicting path returns `409` with its current version and value; do not overwrite it silently.
- Accepted patches are emitted immediately to authorized SSE recipients. Persistence status events report `saving`, `saved`, or `error` without exposing the sheet to unauthorized clients.

## Persistence lifecycle

- Live edits are dirty state first and are flushed to SQLite after the service debounce. Multiple rapid edits should coalesce into one repository write.
- Repository writes compare the last persisted version. Failure keeps the state dirty, emits an error status, schedules a retry, and must not claim that data is saved.
- Explicit close/flush, logout, and controlled server shutdown must flush pending changes. Restart recovery reads the last persisted version, not unflushed process memory.

## Projections and portraits

- Sheet-to-token projection is one-way for name, current/maximum/temporary HP, speed, and initiative modifier.
- Direct token changes must not rewrite the sheet. Armor Class, portrait, and unrelated sheet fields do not alter the token image or shared state.
- Uploads accept only signature-matching JPEG, PNG, or WebP files up to 5 MB. Stage the replacement under a generated name, update metadata, then remove the former file; a failed replacement must preserve the prior portrait.

## Verification

Run policy, schema, service, repository, route, event, portrait, bootstrap, and migration tests. Cover owner/master/other-player access, invalid and atomic patches, independent stale merges, same-path `409`, debounce/retry/flush, restart recovery, targeted SSE, projection direction, upload validation, and preservation of the previous portrait on failure.
