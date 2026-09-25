# Shared State and Persistence

## Purpose

Define the lifecycle and compatibility rules for shared game state, user-specific delivery, undo, and saved sessions.

## Canonical shape

`BattleMapSharedState` is the client-side type contract. The server owns an equivalent normalized JavaScript shape. It includes tokens, dice logs and preview, combat announcement, session mode (`sessionMode`, `isRoundStarted`, `playersCanEndTurn`), initiatives, active turn and round, movement bookkeeping (`movementUsedByTokenId`, `diagonalParityByTokenId`), the game's `diagonalRule` and `measurementUnit`, board lighting flags, shared notes, and light sources.

Zoom and other presentation-only UI state are not shared.

## Normalization

Both client and server normalize incoming state because data can come from older snapshots, HTTP responses, optimistic updates, or untyped JavaScript.

- Supply defaults for missing fields.
- Drop or repair invalid references, such as initiatives for missing tokens.
- Clamp grid dimensions, light radii, and other bounded numbers.
- Rebuild bidirectional vehicle/occupant relationships from canonical vehicle occupant lists.
- Preserve backward compatibility intentionally when a legacy field is still supported.
- `DiceRollLog.dice` is additive. A legacy log without it remains valid; when present, the list is retained only if every die has a unique non-empty id, supported sides, in-range integer value, non-empty group id, and valid disposition. One malformed entry removes the whole detail list without discarding or reconstructing the compatible aggregate log.

Every new shared field requires coordinated defaults and validation on both sides. Saved snapshots without the new field must still load safely.

`movementAxisUsageByTokenId` (the pre-P0.7 per-axis movement counter) is removed from the shape. Normalization converts it into `movementUsedByTokenId` with the old rule — `max(horizontal, vertical)` — only for a token that does not already have a `movementUsedByTokenId` entry, then discards it; this is a one-time, conservative compatibility conversion and must not otherwise be referenced. `diagonalParityByTokenId` and `diagonalRule`/`measurementUnit` default to `{}`, `'standard'`, and `{ label: 'm', cellsValue: 1.5 }` respectively when absent from an older snapshot.

Session mode and initiative (P0.8a) follow invariants enforced by both normalizers:

- `sessionMode` defaults to `'exploration'`, `playersCanEndTurn` to `false`. A snapshot without `sessionMode` infers it: initiative entries present → `'combat'` with `isRoundStarted = activeTurnTokenId !== null` (an encounter in progress keeps order, active turn, round, and movement already charged); no entries → `'exploration'`.
- In `'exploration'`, `initiatives` is empty, `activeTurnTokenId` is null, and `isRoundStarted` is false. During the roll phase (`combat` without `isRoundStarted`) `activeTurnTokenId` is null.
- Each initiative entry is deduplicated per token and requires a finite `value`. A missing `dexModifier` is derived by the server (linked sheet Dexterity, else `initiativeModifier`). A missing `tiebreaker` is generated **only by the server** with `crypto`; the client normalizer leaves it absent, because client randomness would produce diverging orders. An existing tiebreaker is never regenerated, so the order stays stable across updates and legacy entries keep their sequence.
- A master full-state commit may add manual entries without `dexModifier`/`tiebreaker`; the `PUT` route places each new or changed entry with the shared insertion rule after completing it, leaving existing positions untouched.

## Validation and commit

- Normalize before validation and commit.
- Creature tokens cannot overlap outside a vehicle.
- Vehicle occupancy cannot exceed the configured capacity.
- Accepted commits update state, increment the version, and broadcast.
- Full-state master commits record undo state and validate the complete candidate.
- Specialized endpoints may validate a narrower operation but must still produce normalized shared state.

Do not mutate the shared object in place and then broadcast it without versioning.

## User-specific sanitization

Before an adventurer receives a snapshot:

- remove invisible tokens not owned by that user;
- remove initiative entries for removed tokens;
- clear the active turn when it points to a removed token;
- filter dice logs by public/secret visibility before every HTTP or SSE delivery;
- remove the initiative `tiebreaker` from every entry (the order arrives already decided). The master keeps it, because full-state master commits must send it back intact.

`latestDicePreview` remains in the snapshot shape only for compatibility with older snapshots. The server-authoritative roll flow clears it and presents accepted results through the authorized dice log; new behavior must not depend on a flavored preview being populated.

The master receives full state. Sanitization applies independently for HTTP and each SSE client.

## Ephemeral events

Ping, template-drawing, and token-walk events (`ephemeral-ping`, `ephemeral-template`, `ephemeral-template-end`, `token-walk`) are named SSE events on the same stream as the snapshot, on the model of `server/character-sheet-events.mjs`. They:

- are never written to `battleMapState`, never bump `battleMapVersion`, and never appear in a snapshot, a suspend, or a resumed session;
- derive their author from the authenticated session, never from a client-declared field;
- for a template or a token-walk, are filtered per recipient using the same token-visibility predicate (`isTokenVisibleToUser`) that sanitizes the shared state for that user — keyed on whichever token (if any) occupies the template's origin cell, or on the moved token itself for `token-walk`; a ping has no such filter and reaches every connected client.

`token-walk` carries the exact waypoints of a move that `moveOwnedToken` just accepted, purely so every connected client can play the same walking animation instead of only seeing the token's final cell once the snapshot arrives; it is broadcast in addition to, never instead of, the normal snapshot broadcast for that move. `showTrack` is `false` for an `x`/`y` single-step request (keyboard or movement pad), so clients animate it without the path track.

A client that reconnects after a ping, a template, or a walk animation has finished receives no trace of it in either the snapshot or a replayed event, because nothing about them is retained anywhere once the SSE write completes.

## Persistence

- Live state remains in memory.
- Suspend writes a versioned JSON snapshot to `server/data/last-session.json`.
- Startup loads snapshot metadata but does not automatically replace the initial live state.
- Resume reads, normalizes, installs, versions, and broadcasts the saved snapshot.
- `server/data/` is runtime data and must remain untracked.
- Write failures must be surfaced; do not report a successful suspend before the file is persisted.

SQLite is a separate persistence boundary:

- `database/database.sqlite` is the default database and `VTT_DB_PATH` may select another path.
- Versioned migrations own schema evolution; applied migration files are immutable and checksum-validated.
- Users, roles, campaigns, and character sheets are persisted in SQLite.
- Character-sheet live state is versioned in the service, broadcast immediately, and flushed to SQLite with a short debounce plus explicit lifecycle flushes.
- Portraits live under ignored server runtime storage and are served through authenticated routes rather than as public files.
- Battle-map suspend/resume snapshots are not replaced by SQLite unless a future approved specification explicitly migrates that boundary.

## Undo

- Master undo stores up to 40 full pre-mutation snapshots.
- Adventurer undo stores up to 40 user-specific inverse actions for movement, dash, owned-token updates, and extra movement.
- Undo stacks are in memory and are not persisted in session snapshots.
- Adding a mutation requires an explicit decision: master snapshot undo, adventurer inverse undo, both, or intentionally non-undoable.
- Combat endpoints: entering/leaving combat, starting round one, the master's turn advance, and the `playersCanEndTurn` setting use master snapshot undo. Initiative rolls (single or roll-all) are intentionally non-undoable, since undoing would also remove the log entry; the master corrects with edit or removal. An adventurer's end of turn has no inverse; the master can move the turn back.

## Verification

For state-shape changes, verify an empty/default state, an older partial snapshot, malformed references, both role-specific views, SSE broadcast, version increments, suspend/resume, and the applicable undo path. For SQLite-backed changes, also verify migrations, foreign keys, version conflicts, persistence failure, and restart recovery with an isolated temporary database. For ephemeral events, verify the version and snapshot stay untouched, the author is always the session's user, per-recipient visibility filtering for templates, and that a fresh or reconnecting client finds no trace of a past ping or template.
