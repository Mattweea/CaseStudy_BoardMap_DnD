# Combat, Movement, and Dice

## Purpose

Define current combat sequencing, movement accounting, dice behavior, and role boundaries.

## Initiative and rounds

- Initiative entries refer to existing creature tokens and carry a numeric value plus rolled/manual source.
- Entries are ordered descending by value; the master may reorder ties or choose the active token explicitly.
- Clearing all initiative resets the active token, round to one, and all per-round movement state.
- Cycling past the end increments the round; cycling backward from the start decrements it without going below one.
- A round wrap clears movement use, axis use, dash use, and extra movement for all tokens.
- Tokens marked `excludeFromInitiative` must not participate in the roll workflow.
- Ragnar's canonical profile uses advantage for initiative; initiative mode comes from roster/token metadata rather than a display-name check.

Initiative mutation through the shared-state hook is a master flow and is ultimately protected by the full-state master endpoint.

## Movement

- Adventurers can move their owned player token or the vehicle containing that token.
- The master can move any token and bypasses movement budgets and blocking obstacles.
- Vehicles bypass blocking obstacles.
- During an initiative order, adventurer movement consumes the controlling character's budget; outside initiative it is unrestricted by the round budget.
- Movement uses the maximum accumulated horizontal/vertical axis distance, matching grid diagonal movement rather than summing every axis.
- Base budget is `movementCells`; dash doubles it; extra movement adds to it.
- Dash is owner-only, active-turn-only, and once per round.
- A valid movement cannot overlap another uncontained creature or cross a blocking obstacle when the mover is subject to blockers.

Client pointer and keyboard paths must call the same server-authoritative movement operation for adventurers.

## Undo

Master actions use full snapshot undo. Adventurer movement, dash, owned-token updates, and extra movement use per-user inverse actions. A user cannot undo another user's action.

## Dice

- The client sends only a roll request: formula, visibility, and mode. The Fastify server validates it, generates individual results, calculates the total, and supplies author and timestamp from the authenticated session.
- Every authoritative roll uses the dependency-free `shared/dice-engine.mjs` entry point. Runtime adapters supply cryptographic unsigned 32-bit entropy; the engine uses rejection sampling so the modulo operation cannot favor any face. Deterministic sources are test-only and no seed belongs in an API request, shared state, or log.
- Supported formulas use 1–20 dice with d4/d6/d8/d10/d12/d20/d100 and a modifier between -1000 and +1000.
- Advantage/disadvantage are valid only for `1d20`, roll two d20s, and keep the higher/lower result.
- New logs carry additive per-die detail: an id unique within the roll, sides, value, logical group, and `kept`/`discarded`/`unresolved` disposition. Normal dice are `kept`; advantage/disadvantage selects exactly one die (the first on a tie); the two independent d20s of a character-sheet target remain `unresolved` because the reader chooses which applies. A d100 remains one logical die from 1 to 100.
- The logical result is authoritative and independent of presentation. A future 3D renderer may consume the detail, including expanding a logical d100 visually, but animation cannot choose or change the result.
- Public rolls are delivered to every authenticated participant. Secret rolls are delivered only to their author and the master through HTTP state and SSE sanitization.
- Accepted logs are prepended and capped at 30; no secret formula, result, preview, or metadata may reach an unauthorized player.
- The legacy client-log endpoint is rejected; callers must use the authoritative `/api/battle-map/rolls` endpoint.
- Clearing logs remains authenticated for both roles under the current contract.

## Combat announcement

Starting combat is master-only and stores a new announcement ID in shared state so all connected clients can display it once. Client-local storage may remember the last displayed ID; it is not authoritative combat state.

## Verification

Verify initiative sorting and wrap in both directions, per-round resets, owned/unowned/vehicle movement, budget and blocker rejection, dash rules, undo isolation, roll validation, authoritative identity/results, public/secret delivery, log cap, reconnect privacy, and master-only combat start.
