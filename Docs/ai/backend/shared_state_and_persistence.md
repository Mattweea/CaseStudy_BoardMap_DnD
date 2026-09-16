# Shared State and Persistence

## Purpose

Define the lifecycle and compatibility rules for shared game state, user-specific delivery, undo, and saved sessions.

## Canonical shape

`BattleMapSharedState` is the client-side type contract. The server owns an equivalent normalized JavaScript shape. It includes tokens, dice logs and preview, combat announcement, initiatives, active turn and round, movement bookkeeping, board lighting flags, shared notes, and light sources.

Zoom and other presentation-only UI state are not shared.

## Normalization

Both client and server normalize incoming state because data can come from older snapshots, HTTP responses, optimistic updates, or untyped JavaScript.

- Supply defaults for missing fields.
- Drop or repair invalid references, such as initiatives for missing tokens.
- Clamp grid dimensions, light radii, and other bounded numbers.
- Rebuild bidirectional vehicle/occupant relationships from canonical vehicle occupant lists.
- Preserve backward compatibility intentionally when a legacy field is still supported.

Every new shared field requires coordinated defaults and validation on both sides. Saved snapshots without the new field must still load safely.

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
- deliver the latest flavored dice preview only to its roller.

The master receives full state. Sanitization applies independently for HTTP and each SSE client.

## Persistence

- Live state remains in memory.
- Suspend writes a versioned JSON snapshot to `server/data/last-session.json`.
- Startup loads snapshot metadata but does not automatically replace the initial live state.
- Resume reads, normalizes, installs, versions, and broadcasts the saved snapshot.
- `server/data/` is runtime data and must remain untracked.
- Write failures must be surfaced; do not report a successful suspend before the file is persisted.

## Undo

- Master undo stores up to 40 full pre-mutation snapshots.
- Adventurer undo stores up to 40 user-specific inverse actions for movement, dash, owned-token updates, and extra movement.
- Undo stacks are in memory and are not persisted in session snapshots.
- Adding a mutation requires an explicit decision: master snapshot undo, adventurer inverse undo, both, or intentionally non-undoable.

## Verification

For state-shape changes, verify an empty/default state, an older partial snapshot, malformed references, both role-specific views, SSE broadcast, version increments, suspend/resume, and the applicable undo path.
