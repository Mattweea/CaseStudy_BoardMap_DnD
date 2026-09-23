# Character-Sheet Service and Realtime

## Purpose

Define the authoritative server lifecycle for character sheets, including access policy, granular patches, concurrency, persistence, portraits, token projection, and SSE delivery.

## Authority and access

- `CharacterSheetService` owns the live document and version for every loaded sheet; clients submit operations, not replacement documents.
- The owner and master may read, write, flush, and subscribe to a sheet. Another adventurer must not receive its private data through routes or SSE.
- Portrait bytes are available to authenticated participants, while only the owner or master may replace them. Files remain outside public assets and are addressed by generated opaque names.
- The battle-map snapshot must not embed character-sheet documents.

## Patch and concurrency contract

- A patch carries `baseVersion` and 1–100 validated granular operations. The service validates each operation and the complete resulting document before committing it atomically in memory.
- Every accepted patch increments the live version and records the changed path or stable row ID.
- A stale patch may merge when its paths have not changed since `baseVersion`. A conflicting path returns `409` with its current version and value; do not overwrite it silently.
- Accepted patches are emitted immediately to authorized SSE recipients. Persistence status events report `saving`, `saved`, or `error` without exposing the sheet to unauthorized clients.

## Persistence lifecycle

- Live edits are dirty state first and are flushed to SQLite after the service debounce. Multiple rapid edits should coalesce into one repository write.
- Repository writes compare the last persisted version. Failure keeps the state dirty, emits an error status, schedules a retry, and must not claim that data is saved.
- Explicit close/flush, logout, and controlled server shutdown must flush pending changes. Restart recovery reads the last persisted version, not unflushed process memory.

## Derived values and the shared rules module

- `shared/dnd-rules.mjs` is the only source of 5e arithmetic (ability modifier, proficiency bonus, saving throw/skill/tool/attack/spellcasting values). It is a dependency-free ESM module imported as-is by both `server/` and `src/`, with no build step.
- Values the rules determine — ability modifiers, proficiency bonus, passive perception, initiative, saving throw and skill values, spellcasting DC and attack bonus — are never stored in `data_json`. Only their inputs are: ability scores, level, declared competence, and the per-row misc bonus fields. `server/character-sheet-schema.mjs` rejects any patch path for a derived value.
- `character.sectionLocks.{attacks,tools}` is ordinary sheet data (booleans), synchronized and persisted like any other field. It blocks add/edit/remove UI affordances but is never a substitute for the owner/master authorization checks above.
- Attacks and tools are flat-field rows (see the schema's `CHARACTER_COLLECTIONS`), not nested objects, so they stay inside the existing `character.<collection>.<id>.<field>` patch grammar instead of requiring a second patch mechanism.
- `damageType`/`damage2Type` on an attack row are a closed 5e list (`DAMAGE_TYPES`), not free text; `normalizeCharacterSheetData` already drops an out-of-domain legacy value to unset on next load, the same way it treats any other closed-domain field, so this is not a breaking schema change for existing documents. An attack's first damage block has no `damageEnabled` toggle in the UI and defaults to `true` for a new row (`COLLECTION_FIELD_DEFAULTS`); the field still exists and is still validated, only the client no longer offers turning it off.

## Projections and portraits

- Sheet-to-token projection is one-way for name, current/maximum/temporary HP, speed, and initiative modifier.
- Initiative is not a stored field: a patch on `character.abilities.dexterity.score` or `character.initiativeMiscBonus` triggers a recalculation via `shared/dnd-rules.mjs` and the service projects the result if computable. Every other projected field is still a direct path-to-field mapping.
- Direct token changes must not rewrite the sheet. Armor Class, portrait, and unrelated sheet fields do not alter the token image or shared state.
- Uploads accept only signature-matching JPEG, PNG, or WebP files up to 5 MB. Stage the replacement under a generated name, update metadata, then remove the former file; a failed replacement must preserve the prior portrait.

## Roll resolver and side effects (P0.5 Fase B)

- `server/character-sheet-roll-resolver.mjs` is the only place that turns a `data-roll-source` target into dice. `POST /api/battle-map/rolls` accepts `{ source: { sheetId, target }, visibility?, critical? }` as an alternative to `{ formula, mode, visibility }`; the two payloads are mutually exclusive and share the same route, response shape, and `appendDiceLog` call, so P0.6 has one generator entry point to change.
- Both the sheet resolver and free-roll resolver delegate generation and aggregation to `shared/dice-engine.mjs`; `server/dice-entropy.mjs` is the Node cryptographic adapter. The sheet resolver remains responsible for deriving authorized groups and applying side effects, not for random sampling.
- The resolver reads the sheet through `CharacterSheetService.get`, so it enforces the same `policy.canRead` as every other read route: a target on a sheet the requester cannot read is rejected before any die is generated, and the client-proposed formula or result is never consulted.
- No mode is negotiated before a roll. Every target whose formula is `1d20 + modifier` (ability, saving throw, skill, initiative, tool, death save, attack-to-hit) rolls **two independent `1d20`** in the same request and reports both raw faces in `rolls`; nothing is picked or discarded server-side. This matches the reference UX (Roll20): whoever reads the log decides which of the two counts (first for a normal roll, higher for advantage, lower for disadvantage). Hit dice is the one exception — it is not a d20 and stays a single roll.
- The per-die contract makes that distinction explicit: both dice in such a pair are `unresolved`, while `keptRolls` and `total` continue to use the first die solely for backward compatibility. Damage dice and single dice that unambiguously contribute are `kept`; separate damage blocks receive distinct logical group ids.
- An attack's to-hit roll and its damage are two separate targets and two separate log entries: `attack:<id>` resolves only the attack roll (still the dual-`1d20` shape above); `attack-damage:<id>` resolves the active damage block(s) via `computeDamageModifier`, independently, on demand. A damage block without a chosen ability contributes modifier zero (a valid "no ability" configuration, matching `computeDamageModifier`'s own contract); every other unresolvable value (non-numeric misc bonus, unparseable damage dice text, missing row, or a damage roll with no active block at all) rejects the whole roll with no log entry.
- The attack-roll entry declares `critical: true` when either of its two natural dice reaches the attack's `critRange`. Because damage is a separate request, the resolver cannot compute criticality itself for a damage roll — the client declares `critical` in the payload, trusted the same way the free-roll's modifier already is (an instruction on which variant to roll, never a proposed result). When `critical` is true, every active damage block's dice count doubles (`count * 2`) before rolling, in one group per block — not two blocks' worth of dice merged into one pool — with the modifier applied once, unchanged.
- The log record gains fields beyond the free-roll shape, all additive so a reader of only `formula`/`rolls`/`total` still works for the single-value targets and for a damage roll with one active block: `critical` (attack-roll and damage entries), `parts` (one entry per active damage block, only when an attack has two), `savingThrow` (`{ ability, dc }`, declarative metadata carried on the *attack-roll* entry, never a generated die), and `source: { sheetId, target }` on every sheet-originated entry — the reference a client uses both to derive "was the last attack on this row a crit" and to re-roll a specific past attack's damage from its own log entry. Every sheet-originated entry also carries `characterName` and `actionLabel`.
- Hit dice and death saves are the only side effects a roll may write. After the dice are generated (and, for a hit dice roll, its type/remaining-pool checks have already passed), the resolver builds a `set` patch — `character.hitDice.remaining` decremented by one, or the matching `character.deathSaves.successes`/`failures` incremented by one, decided by the *first* of the two `1d20` (the server cannot know which of the two the player will keep) — and applies it through the *same* `CharacterSheetService.applyPatch` used by client edits, with the live version as `baseVersion`. A death-save roll is refused outright, before any dice, once either pip counter is already at three. If the patch is rejected (stale version, invalid resulting document), the request fails and no log entry is added: roll and side effect stay atomic from the client's perspective.

## Legacy document conversion

- `normalizeCharacterSheetData` reconstructs rule inputs from a document written before derived values existed: an ability score from its old modifier when the score itself is missing, a level from the old proficiency bonus when the level isn't an integer, and a per-row misc bonus as the difference between the old visible value and the value the new inputs alone produce. Every total visible before the change stays identical after it.
- A spellcasting ability recognized from old free text (name or abbreviation, Italian or English) is converted the same way; when the text does not name a recognizable ability, the ability is left unset and its two derived values show a placeholder rather than being reinterpreted from stale numbers.

## Verification

Run policy, schema, service, repository, route, event, portrait, bootstrap, migration, shared-rules, and roll-resolver tests. Cover owner/master/other-player access, invalid and atomic patches, independent stale merges, same-path `409`, debounce/retry/flush, restart recovery, targeted SSE, projection direction (including the recalculated initiative), upload validation, preservation of the previous portrait on failure, that a legacy document's visible totals survive normalization unchanged, every roll target's formula (including the uninterpretable-value and unreadable-sheet rejections), the critical-doubling boundary, and that an accepted hit-dice/death-save roll's patch reaches the sheet through the same debounce/SSE chain while a rejected one leaves no log entry.
