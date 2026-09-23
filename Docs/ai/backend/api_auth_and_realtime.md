# API, Authentication, and Realtime

## Purpose

Define the Fastify server boundary, authorization model, HTTP contracts, and SSE delivery invariants.

## Server boundary

`server/index.mjs` is the authoritative process for authentication, shared game state, validation, versioning, snapshots, and broadcasts. The frontend may hide controls and update optimistically, but it cannot grant permission or make an invalid state valid.

## Authentication

- The server bootstraps the canonical roster into SQLite and resolves users through `UserRepository` on every authenticated request.
- Passwords are hashed with bcrypt. The initial roster password is `password`; legacy `<username>123` credentials and `AUTH_USERS_JSON` are not authentication alternatives.
- Successful login creates an opaque random in-memory session with a 12-hour expiry and an HTTP-only `battle_map_session` cookie.
- Cookies use `SameSite=Lax`, path `/`, and `Secure` in production.
- Sessions are process-local: a server restart signs users out even when a game snapshot exists on disk.
- Login accepts only users whose stable IDs belong to the canonical roster, then ensures the adventurer token exists and aligns its roster-owned fields.

## Authorization classes

- Public: `GET /api/health`.
- Session discovery: `GET /api/auth/session`, plus login/logout.
- Authenticated state: state read, session status, authoritative dice rolls, notes, movement, owned token changes, extra movement, undo, authorized character-sheet routes, portrait delivery, and SSE.
- Master-only: full state replacement, combat start, snapshot suspend, and snapshot resume.

Ownership-aware endpoints must validate the current server token and user. New mutations must be assigned deliberately to public, authenticated, owner-scoped, or master-only access.

## API behavior

- JSON mutation payloads are validated at the endpoint and again through normalization/domain validation where relevant.
- `POST /api/battle-map/rolls` accepts only roll instructions. Results, per-die identities, and seeds supplied by a client are ignored; the authoritative resolver creates the complete aggregate and per-die result through the shared dice engine.
- Invalid authentication returns `401`; insufficient authority returns `403`; invalid data or rule violations return `400`; stale versioned commits return `409`; missing resources return `404`.
- Rejected state mutations should return the current sanitized snapshot when the client can use it to reconcile.
- Full state replacement accepts `baseVersion` and rejects stale commits.

## Realtime

- `GET /api/battle-map/stream` is an authenticated SSE connection.
- The server sends a retry hint, an immediate user-sanitized snapshot, mutation broadcasts, and periodic keepalive comments.
- Every accepted map-state mutation increments `battleMapVersion` and broadcasts a separately sanitized snapshot to each connected user. Character-sheet events reuse the stream but are addressed only to the owner and master according to policy.
- Disconnect cleanup must remove the client and its keepalive timer.
- Never broadcast raw master state to all clients.
- Per-die roll detail is part of its parent log rather than a separate event. The existing per-recipient snapshot sanitization therefore delivers the complete detail wherever that log is visible and delivers none of it where a secret log is hidden.

## CORS and origins

Localhost and `127.0.0.1` origins are allowed for development. Additional exact origins come from comma-separated `CORS_ORIGINS`. Allowed origins receive credentials-enabled CORS headers; unknown origins are not reflected.

## Verification

For backend changes, exercise success, unauthenticated, unauthorized, malformed, and stale/version-conflict paths as applicable. Verify SSE output with both master and adventurer identities when hidden or private fields are involved.
