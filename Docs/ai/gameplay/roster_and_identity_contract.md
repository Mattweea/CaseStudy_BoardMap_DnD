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
- Demo passwords follow `username + 123`; custom `AUTH_USERS_JSON` entries provide explicit passwords.
- The master does not spawn a player token.
- Each spawning adventurer owns one canonical non-familiar player token.
- Token ownership uses `ownerUserId`; `characterKey` connects the token to roster metadata.

## Login reconciliation

On successful adventurer login, the server finds a token by owner or character key. If none exists, it creates the canonical token at the first unoccupied position at or to the right of the configured spawn. If one exists, roster-owned fields are realigned while mutable game fields are preserved where applicable.

Do not create duplicate canonical character tokens in a frontend-only flow.

## Custom users

`AUTH_USERS_JSON` can replace authentication records, but character presentation and spawning still resolve through the canonical profile ID. A custom user without a matching canonical profile can authenticate but does not gain canonical character metadata or automatic spawning.

Changes that intend fully configurable rosters must first define a single source for both server and frontend rather than expanding this partial override implicitly.

## Verification

Check master login, one adventurer login with missing token, repeat login with an existing token, collision-free spawn, client/server roster parity, and behavior of custom users when the configuration contract changes.
