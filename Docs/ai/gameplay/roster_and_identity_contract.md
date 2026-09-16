# Roster and Identity Contract

## Purpose

Define how canonical characters, authenticated users, and player tokens stay aligned.

## Canonical duplication

The roster currently exists in two files:

- `src/constants/characters.ts` for login and presentation metadata;
- `server/characters.mjs` for authentication defaults and authoritative spawn metadata.

Any change to IDs, keys, usernames, display names, roles, images, spawn settings, initiative, movement, or darkvision must update both files in the same change. This duplication is an explicit compatibility constraint until a single shared source is introduced deliberately.

The frontend may include presentation-only notes, but identity and gameplay values shared with the server must match exactly.

## Identity invariants

- Character keys and user IDs are stable identifiers; display names are labels.
- Usernames are trimmed and lowercased before lookup.
- The initial password for every bootstrapped roster user is `password`, stored only as a bcrypt hash.
- The master does not spawn a player token.
- Each spawning adventurer owns one canonical non-familiar player token.
- Token ownership uses `ownerUserId`; `characterKey` connects the token to roster metadata.

## Login reconciliation

On successful adventurer login, the server finds a token by owner or character key. If none exists, it creates the canonical token at the first unoccupied position at or to the right of the configured spawn. If one exists, roster-owned fields are realigned while mutable game fields are preserved where applicable.

Do not create duplicate canonical character tokens in a frontend-only flow.

## Persistent roster

SQLite persists role and authentication identity, while the canonical frontend/server roster supplies presentation and gameplay metadata. Bootstrap is idempotent, rejects stable-ID/username conflicts, and does not create accounts outside the roster.

Changes that intend configurable or runtime-created users must first update the capability specification and define a single source for authentication plus frontend/server character metadata. Do not restore `AUTH_USERS_JSON` or `<username>123` as compatibility fallbacks.

## Verification

Check database bootstrap, bcrypt login success/failure, master login, one adventurer login with missing token, repeat login with an existing token, collision-free spawn, role enforcement, and client/server roster parity.
