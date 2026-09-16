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
- Preserve stable row IDs and `data-roll-source` anchors. They are integration points for later contextual rolling, not permission to add roll behavior without its capability change.
- Portrait upload updates the sheet/roster reference; it must not silently replace the battle-map token image.

## Verification

Run `npm run build` and the character-sheet test suite. Manually verify master and owner editing, another player's denied access, fast input, SSE reconciliation, same-field conflict feedback, save/error states, flush on close, all three tabs, keyboard operation, focus restoration, drag/clamping/persistence, map interaction behind the desktop window, compact layout, reduced motion, and no horizontal overflow.
