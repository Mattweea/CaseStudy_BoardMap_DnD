# Token and Vehicle Rules

## Purpose

Define the shared token model and the invariants that keep creatures, objects, obstacles, auras, and vehicles coherent.

## Token categories and footprint

Supported types are player, enemy, object, and vehicle. D&D size maps to a square footprint from one to four cells, unless positive explicit width and height override it.

Every token has a stable ID, name, grid position, color, initiative modifier, and conditions. Optional fields describe ownership, roster identity, movement, affiliation, vehicle state, grouping, HP, visibility, familiarity, collision blocking, initiative exclusion, auras, and an exhaustion level.

## Conditions and exhaustion

- `shared/token-conditions.mjs` is the single source of truth for the condition catalogs, imported directly by the server and re-exported (with Italian labels) by `src/utils/tokens.ts`; neither side keeps a second copy of the catalog.
- A creature (player or enemy token) may carry only the fourteen PHB 2014 conditions (`blinded`, `charmed`, `deafened`, `frightened`, `grappled`, `incapacitated`, `invisible`, `paralyzed`, `petrified`, `poisoned`, `prone`, `restrained`, `stunned`, `unconscious`). A vehicle may carry only `broken`/`overturned`. An object carries none. Every write path — including a master full-state commit — is normalized against the catalog for the token's own type; an out-of-catalog identifier is silently dropped, never stored.
- `exhaustionLevel` is a separate numeric field, an integer from 0 (absent) to 6, clamped on every normalization. It is always forced to 0 for objects and vehicles.
- A condition change is a single operation (add one, remove one, or set the exhaustion level) applied to the token's current conditions, never a replacement of the whole array; this is what lets a master's and an adventurer's concurrent changes to the same token both survive. `updateOwnedToken` (`POST /api/battle-map/token-update`) silently ignores an incoming `conditions` field for exactly this reason — it exists in the payload only for backward compatibility with an older client, and conditions change solely through the dedicated conditions endpoint. See the Backend router for the endpoint, its authorization, and its undo shape.
- Adding `unconscious` to a creature also adds `prone` in the same operation if it is not already present, per the PHB. Removing `unconscious` does not remove `prone`.
- `invisible` is a condition, not a visibility mechanism: an invisible token stays in every recipient's sanitized snapshot and is rendered semi-transparent, badge included. It is independent of `isInvisible`, the master's hide flag, which keeps its own separate meaning and sanitization rule below.

## Visibility and ownership

- `isInvisible` means hidden from non-owner adventurer snapshots, not merely transparent CSS. It is unrelated to the `invisible` condition described above.
- A familiar may expose owner-scoped capabilities such as changing its invisibility or its own conditions, but it does not replace the owner's canonical player token.
- `excludeFromInitiative` is master-controlled.
- Adventurers may update only allowed fields on owned tokens; the server filters the update payload. Conditions are excluded from that payload and travel only through the conditions endpoint.
- Conditions must remain compatible with the token category: creature conditions and vehicle conditions are separate catalogs (see above).

## Obstacles and groups

Objects can block movement through `blocksMovement`. Connected obstacle pieces share `groupId`; group-aware movement and vision must preserve the collection's spatial relationship and avoid treating a target group as its own occluder.

Obstacle drawing or grouped movement must produce valid integer positions and stable group membership.

## Vehicles

- Vehicle kinds define default size and seat capacity.
- A vehicle owns the canonical ordered `vehicleOccupantIds` list.
- Normalization deduplicates occupants, rejects missing/self/object/vehicle occupants, and derives each occupant's `containedInVehicleId`.
- Occupants are positioned on vehicle footprint cells in list order.
- Moving a vehicle realigns its occupants.
- An adventurer assigned to a vehicle may control that vehicle through the ownership-aware movement endpoint.
- Creature overlap validation ignores contained occupants but rejects ordinary player/enemy overlaps.
- Occupant count may not exceed vehicle capacity.

Do not update only one side of an occupant relationship.

## Auras and HP

HP and max HP are nullable numeric gameplay fields. Auras are defined in a character sheet and projected only onto its canonical player token as `{ id, name, effect, radiusCells, color, active }`; descriptions stay private in the sheet. Familiars, enemies, objects, and vehicles have no projected auras. Auras cannot be authored through a token update. Each active aura covers the owner's footprint expanded by its radius on every side, with each diagonal costing one cell regardless of the movement rule; a target is inside when any part of its footprint intersects that rectangle. A token inside a vehicle does not project an area. An aura follows its owner's token visibility and remains active until explicitly switched off.

## Verification

Exercise each affected token category, explicit and size-derived footprint, hidden owner/non-owner views, grouped blockers, vehicle add/remove/move and capacity, overlap rejection, and load of older token snapshots. For conditions, also exercise: every condition and vehicle-only condition rejected on the wrong token type, an out-of-catalog string dropped from a master full-state commit, concurrent master/adventurer condition changes on the same token, the `unconscious`→`prone` automatism in both directions, and an older snapshot carrying the retired `dead`/`conditioned`/`inspired` identifiers loading with them stripped.
