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
- Owner-scoped with role rules: `POST /api/battle-map/initiative/roll` (an adventurer only for their own character without an entry; the master for any creature) and `POST /api/battle-map/turn/advance` (the master in both directions; an adventurer only `next`, only with `playersCanEndTurn`, only on their own active token).
- Master-only: full state replacement, combat start/end (`/combat/start`, `/combat/end`), round start (`/combat/round/start`), initiative roll-all (`/initiative/roll-all`), the `playersCanEndTurn` setting (`/settings/players-can-end-turn`), snapshot suspend, and snapshot resume.
- Master-only scene catalog: list, create, read and versioned update under `/api/scenes`. Reading one scene is a management selection only; it never activates or broadcasts that scene. No delete or archive route exists until lifecycle semantics are approved.
- Scene background delivery is authenticated. A Master may read any managed scene asset; an Adventurer may read only the active scene asset. Upload and reset-to-blank are Master-only, versioned scene mutations under `/api/scenes/:id/background`.
- `POST` e `DELETE /api/scenes/:id/drawings` sono Master-only: aggiungono un tratto normalizzato o cancellano gli ID esistenti in una sola scrittura versionata; ID mancanti e versioni obsolete restituiscono `409` con la scena corrente. Un Player riceve i soli tratti della scena attiva tramite snapshot, senza accesso alle mutazioni.
- `POST /api/scenes/:id/drawings/undo` e `/redo` sono Master-only e richiedono `baseVersion`. Ogni risposta di dettaglio scena include soltanto lo stato transitorio `drawingHistory.canUndo/canRedo`, non gli stack; un conflitto restituisce la scena corrente. Undo e redo persistono il nuovo layer drawing come una normale scrittura versionata.
- `POST /api/scenes/:id/elements`, `PATCH` e `DELETE /api/scenes/:id/elements/:elementId` sono Master-only e richiedono `baseVersion`. Ogni add/update/remove modifica il solo layer elementi con una scrittura versionata; versioni obsolete o ID mancanti restituiscono `409` con la scena corrente. Gli elementi non hanno campi token e non entrano nella cronologia drawing o nell'undo dello stato live.

Ownership-aware endpoints must validate the current server token and user. New mutations must be assigned deliberately to public, authenticated, owner-scoped, or master-only access.

## API behavior

- JSON mutation payloads are validated at the endpoint and again through normalization/domain validation where relevant.
- `POST /api/battle-map/rolls` accepts only roll instructions. Results, per-die identities, and seeds supplied by a client are ignored; the authoritative resolver creates the complete aggregate and per-die result through the shared dice engine.
- Invalid authentication returns `401`; insufficient authority returns `403`; invalid data or rule violations return `400`; stale versioned commits return `409`; missing resources return `404`.
- Rejected state mutations should return the current sanitized snapshot when the client can use it to reconcile.
- Full state replacement accepts `baseVersion` and rejects stale commits.
- Scene updates accept `baseVersion`; a stale update returns `409` with `currentScene` so the Master client can replace its obsolete draft base. One update may carry the scene name and a complete image calibration (`scale`, `offsetX`, `offsetY`), producing one persisted version regardless of how many local preview adjustments preceded confirmation. Calibration is rejected for a blank background. Scene names are labels rather than identities, so duplicate names remain valid and stable scene IDs disambiguate them.
- Scene updates may also carry the boolean `isFullyLit`. It is Master-only and belongs to the selected scene document: updating the active scene refreshes its shared projection once, while updating an inactive scene remains private preparation until activation. Missing legacy values normalize to `false`, which keeps darkness enabled.
- `POST /api/battle-map/settings` remains Master-only for diagonal rule, measurement unit, and legacy-compatible settings writes; accepted values are persisted as one update of the active scene and then projected into the shared snapshot. Scene preparation saves finite or `0 × 0` board dimensions through its versioned scene update. Invalid dimensions, units, stale versions, or an active-scene shrink that excludes existing tokens are rejected without changing the scene.
- Scene background upload accepts only raw JPEG, PNG, or WebP bodies whose declared media type matches their signature. `X-Scene-Base-Version` supplies the optimistic base; the response is the updated scene. Asset responses use an ETag and `Cache-Control: private`, and never expose a runtime filesystem path.

## Realtime

- `GET /api/battle-map/stream` is an authenticated SSE connection.
- The server sends a retry hint, an immediate user-sanitized snapshot, mutation broadcasts, and periodic keepalive comments.
- Every accepted map-state mutation increments `battleMapVersion` and broadcasts a separately sanitized snapshot to each connected user. Character-sheet events reuse the stream but are addressed only to the owner and master according to policy.
- HTTP and SSE battle-map snapshots carry the active scene identity, version, summary, and its
  compatible top-level board projection. The Master view may also carry catalog summaries; a
  Player view omits the catalog and every inactive document or asset. Updating the active scene
  refreshes and broadcasts that projection once, while managing an inactive scene does not
  broadcast its preparation data.
- The active projection carries `activeSceneBackground`: blank, or verified metadata, normalized calibration and the authenticated asset URL. Inactive background metadata and URLs remain outside Player snapshots.
- La proiezione attiva porta anche `activeSceneDrawings`. Un aggiornamento del drawing della scena attiva incrementa la versione condivisa e viene diffuso ai client; la modifica di una scena inattiva non espone il suo documento.
- La proiezione attiva porta `activeSceneElements` della sola scena attiva a Master e Player. Una mutazione elementi sulla scena attiva aggiorna la proiezione e il broadcast; la preparazione di una scena inattiva resta nel suo dettaglio Master e non raggiunge gli snapshot Player.
- Disconnect cleanup must remove the client and its keepalive timer.
- Never broadcast raw master state to all clients.
- Per-die roll detail is part of its parent log rather than a separate event. The existing per-recipient snapshot sanitization therefore delivers the complete detail wherever that log is visible and delivers none of it where a secret log is hidden.

## CORS and origins

Localhost and `127.0.0.1` origins are allowed for development. Additional exact origins come from comma-separated `CORS_ORIGINS`. Allowed origins receive credentials-enabled CORS headers; unknown origins are not reflected.

## Verification

For backend changes, exercise success, unauthenticated, unauthorized, malformed, and stale/version-conflict paths as applicable. Verify SSE output with both master and adventurer identities when hidden or private fields are involved.
