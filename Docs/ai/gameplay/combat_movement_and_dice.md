# Combat, Movement, and Dice

## Purpose

Define current combat sequencing, movement accounting, dice behavior, and role boundaries.

## Initiative and rounds

- Initiative entries refer to existing creature tokens and carry a numeric value plus rolled/manual source.
- Entries are ordered descending by value; the master may reorder ties or choose the active token explicitly.
- Clearing all initiative resets the active token, round to one, and all per-round movement state.
- Cycling past the end increments the round; cycling backward from the start decrements it without going below one.
- A round wrap clears movement use, diagonal-alternation parity, dash use, and extra movement for all tokens.
- Tokens marked `excludeFromInitiative` must not participate in the roll workflow.
- Ragnar's canonical profile uses advantage for initiative; initiative mode comes from roster/token metadata rather than a display-name check.

Initiative mutation through the shared-state hook is a master flow and is ultimately protected by the full-state master endpoint.

## Movement

- Adventurers can move their owned player token or the vehicle containing that token.
- The master can move any token and bypasses movement budgets and blocking obstacles.
- Vehicles bypass blocking obstacles.
- During an initiative order, adventurer movement consumes the controlling character's budget; outside initiative it is unrestricted by the round budget.
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
- Planning an owned token's move (click the token, click each waypoint, `Space` to confirm) shows the same measured path and cost, plus the turn's remaining budget when an initiative order is active; the token stays at its current position until confirmed, then animates along the path. `Esc` cancels without any request. The master's own multi-token movement stays a direct drag, since the master endpoint ignores budget and blockers regardless.
- Circular, cone, and line templates and a ping are ephemeral: broadcast as named SSE events (`ephemeral-ping`, `ephemeral-template`, `ephemeral-template-end`) on the same stream as the snapshot, never written to `battleMapState`, never versioned, and gone for a client that reconnects after they disappear. A template's visibility follows the same token-visibility sanitization as the shared state, so it cannot reveal a token a recipient could not already see. A ping never moves any participant's camera.

## Undo

Master actions use full snapshot undo. Adventurer movement, dash, owned-token updates, and extra movement use per-user inverse actions. A user cannot undo another user's action.

## Dice

- The client sends only a roll request: formula, visibility, and mode. The Fastify server validates it, generates individual results, calculates the total, and supplies author and timestamp from the authenticated session.
- Every authoritative roll uses the dependency-free `shared/dice-engine.mjs` entry point. Runtime adapters supply cryptographic unsigned 32-bit entropy; the engine uses rejection sampling so the modulo operation cannot favor any face. Deterministic sources are test-only and no seed belongs in an API request, shared state, or log.
- Supported formulas use 1–20 dice with d4/d6/d8/d10/d12/d20/d100 and a modifier between -1000 and +1000.
- Advantage/disadvantage are valid only for `1d20`, roll two d20s, and keep the higher/lower result.
- New logs carry additive per-die detail: an id unique within the roll, sides, value, logical group, and `kept`/`discarded`/`unresolved` disposition. Normal dice are `kept`; advantage/disadvantage selects exactly one die (the first on a tie); the two independent d20s of a character-sheet target remain `unresolved` because the reader chooses which applies. A d100 remains one logical die from 1 to 100.
- The logical result is authoritative and independent of presentation. A future 3D renderer may consume the detail, including expanding a logical d100 visually, but animation cannot choose or change the result.
- The local 3D presentation forces every visible die to its logged value, serializes newly delivered log ids, and never replays the initial or reconnect history. A logical d100 may expand to coordinated tens and units models, while still remaining one die for limits and game semantics.
- Kept, discarded and unresolved results retain their server meanings in the visual result rail. Missing or invalid detail causes an all-or-nothing numeric fallback; the client must not reconstruct a partial roll from the formula.
- Animation and sound are independent, persistent browser-local preferences with compatible enabled defaults. They do not enter shared state or affect another participant; reduced motion still takes precedence over visual animation without changing the stored preference.
- A primary click or `Escape` may skip the current local presentation without changing the authoritative result. Dice audio begins only after a trusted page interaction, uses local assets, and fails silently without stopping visual presentation or queue progress.
- Public rolls are delivered to every authenticated participant. Secret rolls are delivered only to their author and the master through HTTP state and SSE sanitization.
- Accepted logs are prepended and capped at 30; no secret formula, result, preview, or metadata may reach an unauthorized player.
- The legacy client-log endpoint is rejected; callers must use the authoritative `/api/battle-map/rolls` endpoint.
- Clearing logs remains authenticated for both roles under the current contract.

## Combat announcement

Starting combat is master-only and stores a new announcement ID in shared state so all connected clients can display it once. Client-local storage may remember the last displayed ID; it is not authoritative combat state.

## Verification

Verify initiative sorting and wrap in both directions, per-round resets (including diagonal parity), owned/unowned/vehicle movement, path cost under both diagonal rules, budget and per-segment blocker rejection, dash rules, undo isolation (position, movement used, diagonal parity), roll validation, authoritative identity/results, public/secret delivery, log cap, reconnect privacy, master-only combat start, master-only diagonal rule/unit changes, ruler and planned-move measurement matching the charged cost, and that no ping or template survives a reconnect.
