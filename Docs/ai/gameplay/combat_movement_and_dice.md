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

- Dice are rolled client-side with `crypto.getRandomValues` and rejection sampling for uniform integer results.
- Normal rolls support configured die size, count, and modifier.
- Advantage/disadvantage roll two d20s and keep the higher/lower value.
- The authenticated profile supplies the roller identity; board selection does not.
- Accepted logs are prepended and capped at 30.
- A flavored latest preview is private to the roller in adventurer snapshots; the shared history remains visible.
- Clearing logs is authenticated for both roles under the current contract.

## Combat announcement

Starting combat is master-only and stores a new announcement ID in shared state so all connected clients can display it once. Client-local storage may remember the last displayed ID; it is not authoritative combat state.

## Verification

Verify initiative sorting and wrap in both directions, per-round resets, owned/unowned/vehicle movement, budget and blocker rejection, dash rules, undo isolation, normal and advantage/disadvantage dice totals, log cap, preview privacy, and master-only combat start.
