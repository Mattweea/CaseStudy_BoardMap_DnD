# Character-Sheet Client and Window

## Purpose

Define the browser-side editing, reconciliation, window, accessibility, and presentation boundaries for the character sheet.

## Client state and synchronization

- `useCharacterSheet` owns the loaded record, optimistic draft, server version, pending operations, save state, errors, and conflicts for the open sheet.
- Local edits update the draft immediately, coalesce by operation path, and are sent after the short client debounce. Requests remain serialized.
- Incoming sheet patch events apply only when newer and must not overwrite a path that still has a local pending operation.
- A `409` keeps the local value available and displays the server value, path, and version for explicit resolution. Persistence errors must remain visible and must not be presented as saved.
- Closing the sheet invokes the explicit flush path after queued client operations have been sent.

## Window and accessibility

- `CharacterSheetWindow` is a non-modal floating dialog on desktop so the exposed map remains interactive. It becomes a non-draggable full-screen surface on viewports at or below 820 px.
- The header supports pointer dragging and `Alt` plus arrow keys, clamps the window inside the viewport, and stores its desktop position locally.
- Opening focuses the close control; Escape closes and flushes; closing restores the previously focused element. Because the window is non-modal, do not add a focus trap.
- The three tabs expose tab semantics and keyboard left/right navigation. Only one panel is rendered at a time, while the shared draft survives tab changes.

## Presentation boundaries

- Keep the Grimorio di brace visual system in `src/styles/character-sheet.css` and reuse its established field, panel, collection-row, focus, and reduced-motion conventions.
- Preserve stable row IDs and `data-roll-source` anchors. They are wired to the roll engine (see "Roll interaction" below), not a decoration. The current anchor set (six abilities, six saving throws, eighteen skills, initiative, one per tool row, two per attack row — `attack:<id>` on the bonus and `attack-damage:<id>` on the damage — the hit dice panel, the death-saves panel) is exhaustive; passive perception and every spell-tab row are deliberately unanchored.
- Portrait upload updates the sheet/roster reference; it must not silently replace the battle-map token image.

## Derived values and row editors

- Every value `shared/dnd-rules.mjs` can compute (ability modifier, proficiency bonus, saving throw/skill/tool/attack value, passive perception, initiative, spellcasting DC and attack bonus) renders as a read-only `<output>`, never a disabled `<input>`, so it never enters the tab order and cannot be mistaken for an editable field. A `null` result renders a neutral placeholder instead of a fabricated number.
- Ability score is the only editable half of the score/modifier pair. Skill and saving-throw competence is a cyclable indicator (`CompetenceRow` in `SheetPrimitives.tsx`) — two states for saving throws, three for skills — built on a native `<button>` so keyboard operation and the exposed current state come for free from the element, not from ARIA bolted on afterward.
- Attacks and tools are created and edited only through the dedicated editor in `RowEditor.tsx`. The editor holds a local draft; confirming diffs the draft against the row's state at open time and sends one `set` patch per changed field (or one `add` for a new row), and cancelling emits nothing. The sheet's list only ever renders the collection's compact, computed row — never the editor's own fields.
- An attack's first damage block has no on/off toggle: every attack deals damage. `AttackEditor` forces `damageEnabled: true` on open and on a new draft (`rowDefaults.ts`), matching the server's default for a freshly created row; only the second block stays optional. `damageType`/`damage2Type` are a closed 5e list (`DAMAGE_TYPES` in `server/character-sheet-schema.mjs`, mirrored as `damageTypeOptions` in `RowEditor.tsx`), not free text.
- `character.sectionLocks.{attacks,tools}` gates the add/edit/remove affordances of its section in the UI only; it is sheet data like any other field and carries no authorization meaning of its own.

## Aura editing

- The `Aure` section after `Privilegi e tratti` follows the same local-draft editor rule as attacks and tools. Its compact row shows color, name, radius in the current session unit, and an `active` switch that patches the sheet field directly. The editor holds name, private description, public effect, radius, and palette color; its color picker names each palette color and shows its swatch in the trigger and choices. Cancel emits no patch.
- `CharacterSheetWindow` passes the shared `measurementUnit` to the tab. Editing converts the entered unit value to 1–24 cells with `radiusCellsFromUnit` and displays a stored radius as cells × `cellsValue`. The list stops offering Add at ten rows.

## Roll interaction (P0.5 Fase B)

- `CharacterTab` attaches one delegated `onClick` handler to its root element instead of a handler per `data-roll-source` node: a click walks up from `event.target` to the nearest `[data-roll-source]` ancestor, but only when the click did not land on an interactive element (`button`, `input`, `select`, `textarea`, `a`) first. This keeps every existing interactive control inside a roll target — the ability-score input, a competence toggle, a misc-bonus field, a row's gear/lock button — working exactly as before; editing a field can never start a roll, and the target's plain area (label, computed value) is what starts one. There is no secondary interaction and no pre-roll modal: a click always fires immediately, public. An attack row carries two roll anchors instead of one — `attack:<id>` on the bonus column (to-hit) and `attack-damage:<id>` on the damage column — matching the server's split between the attack roll and its damage.
- Clicking a damage anchor on the sheet does not let the player choose critical: `CharacterTab` looks at the shared `diceLogs` (passed down from `App.tsx` through `CharacterSheetWindow`) for the most recent entry whose `source.target` is that same `attack:<id>`, and forwards its `critical` flag in the damage request. No prior attack roll (or none visible to this client) means a normal damage roll.
- `useBattleMapState`'s existing `rollDice` is the single client-side entry point for both the free roll and a sheet roll: `DicePanel` posts `{ formula, visibility }` (no `mode` — the server derives it from the formula), while the sheet posts `{ source, visibility, critical? }` through the same function, so opening the sheet never hides or disables the dice panel.
- `visibility` on a sheet roll (P0.7.5) comes from a per-sheet, browser-local toggle owned by `CharacterSheetWindow` (`board-map:character-sheet-roll-visibility:<sheetId>` in `localStorage`, mirroring the position-persistence pattern already on that component), passed down through `CharacterTab`'s `rollVisibility` prop and read at click time in `handleSheetClick`. It is not shared state and does not affect another participant's view; a secret banner rendered sticky at the top of the scrolling sheet body keeps that state visible next to whichever roll target the player scrolls to, since a roll made public while its author believed it secret cannot be undone.
- The actual "Chat + Dadi" surface is the inline feed in `App.tsx` (`workspaceTab === 'chat'`), rendered per entry by `src/components/DiceLogEntry.tsx` — not `DiceLogModal.tsx`, which the app builds but never opens (`isDiceLogModalOpen` has no toggle). `DiceLogEntry` (P0.7.5) builds one shared card model for every `log.source?.target` kind instead of branching render trees: a `1d20` target (including the attack roll) always produces a paired, marked pair of totals with a green/red highlight on a natural 20/1; `attack-damage:<id>` produces one total per active damage block (`parts` when an attack has two), each block's own dice in the shared detail; `hit-dice`/death-saves produce one total; the free roll (no `source`) produces one total per `1d20` when the formula is pure `d20`, or a single aggregate total with a per-group detail otherwise. Every card's detail opens on a click on any of its totals (shared `isExpanded`/`onToggle`), not a native tooltip. An attack-roll entry's name renders as a button when `onRoll` is available, re-firing that same attack's damage on click.

## Verification

Run `npm run build` and the character-sheet test suite. Manually verify master and owner editing, another player's denied access, fast input, SSE reconciliation, same-field conflict feedback, save/error states, flush on close, all three tabs, keyboard operation, focus restoration, drag/clamping/persistence, map interaction behind the desktop window, compact layout, reduced motion, no horizontal overflow, competence cycling by keyboard and mouse, an editor's confirm/cancel/remove round trip, that a locked section blocks add/edit/remove while staying readable, that a click on every one of the eight roll-target kinds rolls immediately while a click on an interactive control inside one does not, that the secondary interaction opens the precompiled modal without rolling, that the free-roll dice panel stays available and unaffected while the sheet is open, and that the roll-visibility toggle persists across a reload, stays scoped to its own sheet, and its secret banner stays visible while scrolling to a roll target.
