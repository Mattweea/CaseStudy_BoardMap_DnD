# Combat, Movement, and Dice

## Purpose

Define current combat sequencing, movement accounting, dice behavior, and role boundaries.

## Session mode and encounter lifecycle

- The session is always in one shared mode: `exploration` (default) or `combat`. Only the master switches it (`POST /api/battle-map/combat/start`, `/combat/end`).
- `exploration` has no initiative entries, no active turn, and no round in progress; initiative rolls are rejected there.
- Entering `combat` empties the tracker, resets active turn, round (to one), movement used, diagonal parity, dash, and extra movement, and opens the **roll phase** (`isRoundStarted: false`, no active turn). Leaving `combat` applies the same resets.
- The round starts only when the master starts round one (`/combat/round/start`), which is rejected with an empty order; the active turn becomes the first entry.
- Turn advance (`/turn/advance`) is rejected outside a started round. Advancing past the last entry increments the round; moving back from the first entry decrements it without going below one. A round wrap clears movement use, diagonal-alternation parity, dash use, and extra movement for all tokens.
- The shared `playersCanEndTurn` setting (default off, master-only) lets an adventurer advance `next` only while the active token is their own character.

## Initiative

- Entries refer to existing creature tokens and carry an integer `value`, `rolled`/`manual` source, the `dexModifier` recorded when the entry was created, a hidden server-generated `tiebreaker` in `[0, 1)`, and, for rolled entries, the roll `mode`.
- Ordering (`shared/initiative-order.mjs`): value descending, then `dexModifier` descending, then `tiebreaker` descending. A new or replaced entry is inserted before the first existing entry it beats; the existing array is never globally re-sorted, so a master's explicit move survives later insertions.
- `dexModifier` comes from the linked sheet's Dexterity score, or from `initiativeModifier` for a token without a sheet; it is not recomputed afterwards.
- Initiative rolls are server-authoritative (`server/initiative-roll.mjs`), from the sheet's `initiative` target or the tracker. The client sends only the token and, for the master rolling a sheet-less token, the mode. A sheet-linked token uses the sheet's `computeInitiative` value and its `character.initiativeRollMode`; roster and token `initiativeMode` are no longer read by any flow. Advantage/disadvantage roll two d20s and keep one; the result is always one value.
- An adventurer may roll only for their own character and only once; the master may roll for any non-excluded creature, replace an entry, and "roll for all" creatures without an entry in one commit. Roll + tracker entry + log are one commit with one version bump; rolls have no undo.
- A character's roll log is public; any other creature's roll is secret (master-authored). Tokens marked `excludeFromInitiative` never enter the roll workflow.
- Reordering, manual values, removal, and explicit active-turn choice remain master full-state commits; the server places a new manual entry with the insertion rule after completing its Dexterity and tiebreaker.

## Movement

- Adventurers can move their owned player token or the vehicle containing that token.
- The master can move any token and bypasses movement budgets and blocking obstacles.
- Vehicles bypass blocking obstacles.
- The movement budget applies only when `sessionMode === 'combat' && isRoundStarted`, never from the mere presence of initiative entries. In exploration and during the roll phase (so the master can have characters take positions) adventurer movement is unbudgeted and not charged (no movement used, no diagonal parity). Obstacles and overlap are always checked.
- Movement cost is the sum of the per-step costs of the path actually walked, computed by the shared `shared/grid-movement.mjs` module (`pathCost`) from client and server alike — never the maximum of the accumulated horizontal/vertical distance. A broken (non-straight, non-diagonal) path costs more than the same start-to-end displacement in a straight or diagonal line.
- The game has a diagonal rule, `standard` (every diagonal step costs one cell) or `alternating` (the 5-10-5 variant: diagonal steps alternate costing one and two cells), master-only to change, defaulting to `standard`. The alternation is counted per token and per turn via `diagonalParityByTokenId`, reset at the same points as `movementUsedByTokenId` (round wrap, initiative cleared), and never crosses a round boundary.
- The game has a measurement unit (a label plus a per-cell value in that unit), master-only to change, defaulting to `1.5` labeled `m`. Every distance shown to a user — ruler, drag measurement, template radius/length — is expressed in both cells and this unit.
- A move request carries `waypoints` (or, for a single-cell step such as keyboard movement, `x`/`y` treated as a one-segment path from the token's current position). The server recomputes the full path cost, checks obstacles and overlap per segment, and ignores any cost or distance the client declares.
- Base budget is `movementCells`; dash doubles it; extra movement adds to it.
- Dash is owner-only, active-turn-only, and once per round.
- A valid movement cannot overlap another uncontained creature or cross a blocking obstacle when the mover is subject to blockers, on any segment of the path — the server never reroutes around a blocked segment, it simply rejects the request.

Client pointer and keyboard paths must call the same server-authoritative movement operation for adventurers.

### Measurement tools (ruler, templates, ping)

- A ruler, independent of movement and token ownership, lets any authenticated participant measure a waypoint path anywhere on the map; it never moves a token, spends budget, or touches shared state.
- Planning an owned token's move (click the token, click each waypoint cell, `Space` to confirm; clicking a token while planning selects it instead of adding a waypoint — no effect on the planned token, another token closes the plan and becomes selected, reopening a plan if movable) shows the same measured path and cost, plus the turn's remaining budget when the movement budget applies (combat with the round started); the token stays at its current position until confirmed, then animates along the path. `Esc` cancels without any request. The master's own multi-token movement stays a direct drag, since the master endpoint ignores budget and blockers regardless.
- Circular, cone, and line templates and a ping are ephemeral: broadcast as named SSE events (`ephemeral-ping`, `ephemeral-template`, `ephemeral-template-end`) on the same stream as the snapshot, never written to `battleMapState`, never versioned, and gone for a client that reconnects after they disappear. A template's visibility follows the same token-visibility sanitization as the shared state, so it cannot reveal a token a recipient could not already see. A ping never moves any participant's camera.

## Undo

Master actions use full snapshot undo. Adventurer movement, dash, owned-token updates, and extra movement use per-user inverse actions. A user cannot undo another user's action.

## Dice

- The client sends only a roll request: formula and visibility (the free roll never declares a mode; the server derives it). The Fastify server validates it, generates individual results, calculates the total, and supplies author and timestamp from the authenticated session.
- Every authoritative roll uses the dependency-free `shared/dice-engine.mjs` entry point. Runtime adapters supply cryptographic unsigned 32-bit entropy; the engine uses rejection sampling so the modulo operation cannot favor any face. Deterministic sources are test-only and no seed belongs in an API request, shared state, or log.
- A free-roll formula is a sum of signed terms (`+`/`-`, whitespace ignored): each term is either a `NdS` group (`S` among the supported dice) or a plain integer modifier. A signed group's subtotal is added or subtracted from the roll's aggregate total; the individual dice it generates never carry a negative value. A formula that includes a `d20` group SHALL NOT include any other dice group — the `d20` always rolls alone, because mixing it with other groups would force the server to pick which of its two outcomes counts. `server/authoritative-roll.mjs` rejects anything outside these rules with an error naming the violated term or limit, and rejects a client-declared `mode` outright for a free roll.
- Formula limits are aggregate, not per group: at most 10 dice groups, and at most `MAX_PRESENTATION_DICE` (from `shared/dice-3d-presentation.mjs`) dice **generated** — a lone `1d20` counts as 2 generated dice even though the formula writes one — and an aggregate modifier within ±1000.
- A lone `1d20` free roll (or a character-sheet `1d20` target other than initiative) resolves as `unresolved`: two independent d20 values, neither picked by the server, with the same modifier applied to both. An `Xd20` with `X > 1` resolves as `normal`: `X` independent outcomes with no pairing semantics. Initiative is the only server-authoritative caller of advantage/disadvantage: its value drives the turn order, so it resolves to one value with the mode saved on the sheet (or chosen by the master for a sheet-less token). No client may request a mode for a free roll, and the browser never rolls initiative locally.
- New logs carry additive per-die detail: an id unique within the roll, sides, value, logical group, and `kept`/`discarded`/`unresolved` disposition. `discarded` is produced again only by an initiative roll with advantage or disadvantage (the kept d20 is `kept`, the other `discarded`); the presentation renders `kept` and `discarded` with equal emphasis. The two independent d20s of any other `1d20` target remain `unresolved` because the reader chooses which applies. A d100 remains one logical die from 1 to 100.
- The logical result is authoritative and independent of presentation. A future 3D renderer may consume the detail, including expanding a logical d100 visually, but animation cannot choose or change the result.
- The local 3D presentation forces every visible die to its logged value, serializes newly delivered log ids, and never replays the initial or reconnect history. A logical d100 may expand to coordinated tens and units models, while still remaining one die for limits and game semantics.
- Every die in a voice's presentation renders with equal emphasis, regardless of its `disposition`. Missing or invalid detail causes an all-or-nothing numeric fallback; the client must not reconstruct a partial roll from the formula.
- A character sheet's rolls declare `visibility` from a per-sheet, browser-local toggle (`board-map:character-sheet-roll-visibility:<sheetId>` in `localStorage`), not a session-wide setting; it defaults to public and is shown on the sheet itself while it is active, since a roll made public while the author believed it secret cannot be undone.
- Animation and sound are independent, persistent browser-local preferences with compatible enabled defaults. They do not enter shared state or affect another participant; reduced motion still takes precedence over visual animation without changing the stored preference.
- A primary click or `Escape` may skip the current local presentation without changing the authoritative result. Dice audio begins only after a trusted page interaction, uses local assets, and fails silently without stopping visual presentation or queue progress.
- Public rolls are delivered to every authenticated participant. Secret rolls are delivered only to their author and the master through HTTP state and SSE sanitization.
- Accepted logs are prepended and capped at 30; no secret formula, result, preview, or metadata may reach an unauthorized player.
- The legacy client-log endpoint is rejected; callers must use the authoritative `/api/battle-map/rolls` endpoint.
- Clearing logs remains authenticated for both roles under the current contract.

## Combat announcement, turn notices, and audio

Entering combat stores a new announcement ID in shared state so every connected client displays it once, with the crossed-swords-and-shield emblem and a sound. Client-local storage may remember the last displayed ID; it is not authoritative combat state. The server computes the per-user `turnNotice` ("next"/"turn") only while the round is started, so the roll phase produces none. Combat sounds are local CC0 assets played after a trusted page interaction, governed by browser-local preferences (`shared/combat-audio-preferences.mjs`); a playback failure never hides the visual notice.

## Verification

Verify session-mode entry/exit resets, round-one start (and rejection with an empty order), role checks on every combat endpoint, initiative insertion and tie-breaking, authoritative initiative rolls (modes, visibility, second-roll and concurrency rejection), `tiebreaker` absent for adventurers, initiative sorting and wrap in both directions, per-round resets (including diagonal parity), owned/unowned/vehicle movement, path cost under both diagonal rules, budget and per-segment blocker rejection, dash rules, undo isolation (position, movement used, diagonal parity), roll validation, authoritative identity/results, public/secret delivery, log cap, reconnect privacy, master-only combat start, master-only diagonal rule/unit changes, ruler and planned-move measurement matching the charged cost, and that no ping or template survives a reconnect.
