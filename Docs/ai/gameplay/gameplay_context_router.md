# Gameplay Context Router

## Purpose

Route domain work to the smallest current gameplay contract. Read every applicable row; routes are cumulative.

| Document | Read when the task involves | Usually skip when |
|---|---|---|
| [Roster and identity contract](roster_and_identity_contract.md) | Profiles, credentials, character metadata, token spawning, ownership, images, initiative modifiers, movement, darkvision, or custom users | Work unrelated to canonical characters or authenticated identity |
| [Token and vehicle rules](token_and_vehicle_rules.md) | Token shape, types, sizes, conditions, HP, auras, invisibility, familiars, obstacles, vehicles, occupants, placement, or overlap | Initiative/dice-only changes without token-shape impact |
| [Combat, movement, and dice](combat_movement_and_dice.md) | Initiative, turns, rounds, movement budgets, dash, extra movement, blockers, dice logs/previews, or combat announcements | Static roster or rendering work with no combat rule impact |

## Cross-context routes

- Add [Backend](../backend/backend_context_router.md) when a gameplay rule is normalized, validated, authorized, persisted, or broadcast.
- Add [Frontend](../frontend/frontend_context_router.md) when a gameplay rule affects rendering, controls, feedback, or optimistic behavior.
- Add [Operations](../operations/operations_context_router.md) when roster or gameplay configuration moves into environment/deployment settings.

## Maintenance rule

This router owns game meaning and invariants. Transport and authorization mechanisms remain owned by Backend; visual interaction remains owned by Frontend.
