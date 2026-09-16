# Token and Vehicle Rules

## Purpose

Define the shared token model and the invariants that keep creatures, objects, obstacles, auras, and vehicles coherent.

## Token categories and footprint

Supported types are player, enemy, object, and vehicle. D&D size maps to a square footprint from one to four cells, unless positive explicit width and height override it.

Every token has a stable ID, name, grid position, color, initiative modifier, and conditions. Optional fields describe ownership, roster identity, movement, affiliation, vehicle state, grouping, HP, visibility, familiarity, collision blocking, initiative exclusion, and auras.

## Visibility and ownership

- `isInvisible` means hidden from non-owner adventurer snapshots, not merely transparent CSS.
- A familiar may expose owner-scoped capabilities such as changing its invisibility, but it does not replace the owner's canonical player token.
- `excludeFromInitiative` is master-controlled.
- Adventurers may update only allowed fields on owned tokens; the server filters the update payload.
- Conditions must remain compatible with the token category: creature conditions and vehicle conditions are separate catalogs.

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

HP and max HP are nullable numeric gameplay fields. Auras belong to player or enemy tokens, have stable IDs, non-negative cell radii, explicit visibility, and a color fallback to the token color. Snapshot normalization retains the supported legacy single-aura shape only as a compatibility migration.

## Verification

Exercise each affected token category, explicit and size-derived footprint, hidden owner/non-owner views, grouped blockers, vehicle add/remove/move and capacity, overlap rejection, and load of older token snapshots.
