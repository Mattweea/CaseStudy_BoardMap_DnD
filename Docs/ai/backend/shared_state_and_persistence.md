# Shared State and Persistence

## Purpose

Define the lifecycle and compatibility rules for shared game state, user-specific delivery, undo, and saved sessions.

## Canonical shape

`BattleMapSharedState` is the client-side type contract. The server owns an equivalent normalized JavaScript shape. It includes tokens, dice logs and preview, combat announcement, session mode (`sessionMode`, `isRoundStarted`, `playersCanEndTurn`), initiatives, active turn and round, movement bookkeeping (`movementUsedByTokenId`, `diagonalParityByTokenId`), the game's `diagonalRule` and `measurementUnit`, board lighting flags, shared notes, and light sources.

Zoom and other presentation-only UI state are not shared.

## Scene model foundation

The shared/scene-model.mjs module owns the runtime-neutral scene contract used by both Node and Vite. A scene has a stable identifier, trimmed name, positive concurrency version, and an explicitly versioned document. The document keeps background, board configuration, drawings, scene elements, entity references, prepared placements, and runtime tokens in separate sections. A background is either explicitly blank or references a managed JPEG, PNG, or WebP asset by identifier and verified metadata; it never contains an arbitrary remote URL or filesystem path. Image metadata also carries presentation-only calibration: scale defaults to `1`, signed pixel offsets default to `0`, and all three values are finite and bounded. Its normalizer supplies defaults for older partial documents and rejects unsupported versions, duplicate identifiers within one collection, orphan placement references, unsafe coordinates, invalid board values, invalid background metadata or calibration, non-JSON data, and documents over the declared size limit.

Scene configuration and live runtime use distinct adapters. captureSceneConfiguration removes runtime tokens and unrelated live-session fields; projectSceneRuntime combines normalized configuration with an explicitly supplied runtime without mutating either input. Scene persistence stores only the captured configuration in SQLite and does not add fields to BattleMapSharedState, replace snapshot behavior, or make round, initiative, hit-point, movement, or dice-log recovery durable.

## Normalization

Both client and server normalize incoming state because data can come from older snapshots, HTTP responses, optimistic updates, or untyped JavaScript.

- Supply defaults for missing fields.
- Drop or repair invalid references, such as initiatives for missing tokens.
- Clamp grid dimensions, light radii, and other bounded numbers. Board dimensions accept positive finite counts or exactly `0 × 0`; a mixed zero pair is invalid.
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

Scene isolation is narrower than complete secret filtering. An Adventurer snapshot contains only the active scene identity and projection and never contains `sceneCatalog`, inactive documents, or inactive asset URLs. Within the active projection, the existing token/dice sanitizers still apply; fog, lighting, drawings and scene elements are presentation data already delivered to the client and are not a P0.9 guarantee that every unrevealed secret is absent. Complete server-side fog/secrets remain the P0.10 boundary.

## Ephemeral events

Ping, template-drawing, and token-walk events (`ephemeral-ping`, `ephemeral-template`, `ephemeral-template-end`, `token-walk`) are named SSE events on the same stream as the snapshot, on the model of `server/character-sheet-events.mjs`. They:

- are never written to `battleMapState`, never bump `battleMapVersion`, and never appear in a snapshot, a suspend, or a resumed session;
- derive their author from the authenticated session, never from a client-declared field;
- for a template or a token-walk, are filtered per recipient using the same token-visibility predicate (`isTokenVisibleToUser`) that sanitizes the shared state for that user — keyed on whichever token (if any) occupies the template's origin cell, or on the moved token itself for `token-walk`; a ping has no such filter and reaches every connected client.
- carry the current `sceneId`; clients discard a named event that arrives after its scene has ceased to be active.

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
- Scene background binaries live under ignored `server/data/scene-backgrounds/`. Storage validates size and magic bytes, stages with a unique temporary name, atomically renames inside the confined root, and removes abandoned staging files during startup. A failed versioned SQLite write removes the new asset and leaves the previous scene reference intact; old assets are removed only after a successful commit.
- The scene catalog, normalized scene configuration, optimistic version and active-scene reference are persisted in SQLite. Scene services persist before replacing their in-memory projection.
- Gli encounter sono una collezione di configurazione del documento scena, con ID, nome, tipo descrittivo e descrizione; i placement preparati possono riferirsi a un encounter tramite `encounterId`. I documenti legacy senza la collezione normalizzano a `[]` e i placement legacy senza tale riferimento restano validi. Ogni CRUD encounter usa la versione della scena e persiste prima di aggiornare la proiezione in memoria; un encounter con placement collegati non è cancellato in cascade. La definizione resta privata al Master: una modifica sulla scena attiva aggiorna soltanto la versione/proiezione condivisa compatibile, non espone gli encounter al Player.
- Le entità monster/npc di E.2 riusano `entityReferences`: ogni nuova voce ha ID di riferimento, ID di definizione, `encounterId`, kind e nome. I riferimenti legacy senza `encounterId` rimangono leggibili; quelli associati richiedono un encounter esistente e kind supportato. Un placement collegato deve indicare lo stesso encounter della sua entità. Le mutazioni sono versionate e persistite prima della pubblicazione; rimuovere un'entità usata da placement è vietato e rimuovere un encounter elimina soltanto le sue entità non utilizzate. L'adapter token è puro e non materializza placement, token live o iniziativa: la comparsa sulla board spetta a E.4.
- The Master catalog reads and mutates this persistence boundary through dedicated authorized routes. Its selected detail is local management state: reading or editing an inactive scene does not alter the persisted active-scene reference and does not broadcast it to Player clients.
- Scene activation is a dedicated Master-only optimistic operation. The server validates the target and its version and rejects an active combat round before writing the active-scene reference. A storage failure leaves the in-memory identity and live projection unchanged. After persistence, it installs one prepared projection, advances the shared version once, clears cross-scene undo history, and broadcasts one role-specific snapshot.
- `activeSceneId`, `activeSceneVersion`, `activeSceneSummary`, and `activeSceneBackground` identify the one persisted active
  scene in shared snapshots. `activeSceneDrawings` contains only that scene's normalized strokes and defaults to `[]` for older snapshots.
  `activeSceneElements` contiene solo gli arredi normalizzati della scena attiva e defaulta a `[]` per snapshot precedenti. Gli elementi hanno kind chiuso, posizione e ingombro interi in caselle, rotazione limitata; la normalizzazione elimina qualsiasi campo da token. Le scritture elementi passano dal documento scena versionato, non dal live-state undo o dalla history drawing.
  `blocksMovement` e `blocksVision` sono booleani indipendenti del documento scena e defaultano a `false` per documenti precedenti. Soltanto gli elementi della proiezione attiva entrano nella validazione dei segmenti di movimento e nella visuale client; la rotazione resta presentazionale e non cambia l'ingombro usato dagli adapter.
  A drawing mutation saves the document to SQLite with optimistic concurrency and refreshes the realtime projection only for the active scene; it does not enter live-state undo. A centralized projection adapter installs the scene's board
  configuration into the legacy top-level fields consumed by current board code while retaining
  live runtime tokens in memory. A legacy snapshot without active-scene metadata receives the
  persisted active identity and configuration during installation.
- `boardDimensions`, `measurementUnit`, and `diagonalRule` remain top-level compatibility fields for current consumers, but their authority is the active scene document. Master settings validate and persist a versioned scene update before refreshing and broadcasting these values. Board dimensions accept positive finite counts or `0 × 0`; legacy documents default to 30 × 30 cells, `1.5 m`, and the standard diagonal rule.
- `isBoardFullyLit` is likewise a compatible top-level projection of the active scene's `board.isFullyLit`. The Master edits it through the selected scene's versioned preparation draft; inactive edits do not alter or broadcast the live board. A missing scene value defaults to `false` (darkness enabled).
- Image scale and offsets remain nested in the managed scene background and are projected only with the active background. Preview edits are client-local; confirmation is one optimistic scene write, is intentionally outside live-state undo, and refreshes the shared projection only when that scene is active.
- Snapshot construction is role-specific: the Master receives metadata-only `sceneCatalog`
  summaries plus the active projection; an Adventurer receives only the active identity and
  sanitized projection. Complete inactive documents and assets never enter either repeated
  battle-map broadcast. Renaming/versioning or replacing the background of the active scene refreshes the projection, increments
  the shared version, and broadcasts; changes to an inactive scene remain catalog-local.
- When the scene catalog is empty, startup creates one initial scene and imports only supported board configuration from the legacy suspend snapshot. Existing scenes prevent every later reimport; absent or malformed legacy data produces safe defaults.
- Battle-map suspend/resume remains responsible for the current live snapshot. Scene persistence does not recover runtime tokens, round, hit points, movement, initiative or logs; complete automatic live recovery remains a separate capability.
- Durante il processo, `battleMapState.tokens` appartiene alla sola scena attiva e una mappa server in memoria conserva i token delle scene inattive. L'attivazione salva il runtime uscente e installa quello entrante (vuoto alla prima visita), azzerando i riferimenti a token del vecchio tracker e delle contabilità di movimento; in roll phase conserva la modalità Combattimento ma riparte senza iniziative. Un round attivo blocca il cambio. Il login non ricrea un personaggio già presente in un'altra scena live. La preview del party è read-only. Nel flusso combinato, la sorgente è la scena attiva e la destinazione è quella inattiva selezionata: il commit prepara e valida entrambi i runtime prima di persistere il nuovo riferimento attivo, poi installa la nuova proiezione e trasmette un solo snapshot. Un errore prima dell'attivazione persistita lascia invariati identità e token. Il trasferimento svuota gli undo stack, poiché un undo monoscena potrebbe ripristinarne solo metà.
- Le copie live inattive non sono in SQLite né nel singolo snapshot di sospensione corrente: un riavvio non le recupera automaticamente. Al resume, token di uno snapshot con identità scena diversa da quella attiva non vengono installati sulla scena corrente.

## Undo

- Master undo stores up to 40 full pre-mutation snapshots.
- Adventurer undo stores up to 40 user-specific inverse actions for movement, dash, owned-token updates, and extra movement.
- Undo stacks are in memory and are not persisted in session snapshots.
- Adding a mutation requires an explicit decision: master snapshot undo, adventurer inverse undo, both, or intentionally non-undoable.
- Combat endpoints: entering/leaving combat, starting round one, the master's turn advance, and the `playersCanEndTurn` setting use master snapshot undo. Initiative rolls (single or roll-all) are intentionally non-undoable, since undoing would also remove the log entry; the master corrects with edit or removal. An adventurer's end of turn has no inverse; the master can move the turn back.
- Active-scene grid dimensions, unit, and diagonal settings are versioned scene configuration and intentionally do not enter the live-state undo stack.
- Scene drawing add/erase populate separate, process-local undo/redo command stacks keyed by scene ID, capped at 40 operations per scene. Undo/redo persists only the resulting drawing layer through the normal versioned scene write; the stacks never enter SQLite documents, battle-map snapshots, or the live-state undo stacks. A new accepted add/erase after undo clears that scene's redo stack; restart clears all drawing history but retains persisted strokes. Unrelated scene metadata and background edits do not create drawing-history entries. A drawing replacement outside the command path invalidates the affected scene's history.

## Verification

For state-shape changes, verify an empty/default state, an older partial snapshot, malformed references, both role-specific views, SSE broadcast, version increments, suspend/resume, and the applicable undo path. For SQLite-backed changes, also verify migrations, foreign keys, version conflicts, persistence failure, and restart recovery with an isolated temporary database. For ephemeral events, verify the version and snapshot stay untouched, the author is always the session's user, per-recipient visibility filtering for templates, and that a fresh or reconnecting client finds no trace of a past ping or template.
