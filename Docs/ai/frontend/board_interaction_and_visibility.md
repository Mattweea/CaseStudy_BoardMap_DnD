# Board Interaction and Visibility

## Purpose

Define board-space interaction, visibility, and rendering invariants without duplicating gameplay authorization rules.

## Coordinate system

- Token positions and dimensions are integer grid cells.
- `BOARD_CONFIG.cellSize` converts grid units to pixels; camera and zoom transform viewport input back to world cells.
- Token footprint uses explicit positive `widthCells` and `heightCells` when present, otherwise the D&D size mapping.
- Grid movement and placement snap to cells. Helpers must clamp invalid negative or fractional inputs at the appropriate trust boundary.

## Interaction modes

- Plain click selects a token; `Shift` composes selection.
- Dragging empty board space creates area selection; `Shift` adds to the current selection.
- `Ctrl` + drag and middle-button drag pan the board.
- Wheel input controls zoom within configured limits.
- Keyboard movement must ignore editable controls and respect the same server movement rules as pointer movement.
- Fullscreen is UI state and must not enter shared snapshots.

Master multi-token and connected-obstacle movement may use a full shared-state commit. Adventurer movement must use the ownership-aware movement endpoint so server budgets and blockers remain authoritative.

## Visibility layers

- `isInvisible` controls whether a token is included in an adventurer's server snapshot; an owner still receives their own invisible token.
- The master receives the unsanitized state and may render invisible tokens as preparation/ghost elements.
- Fog and lighting are separate from server-side hidden-token sanitization. They determine what received content is visually revealed, not whether secret content was delivered.
- A fully lit board bypasses darkness presentation but does not bypass `isInvisible` sanitization.
- Blocking tokens participate in line-of-sight calculations. Source and target cells are excluded where needed to prevent self-occlusion.

## Vision and light

- Darkvision text from the canonical roster is converted to cells; explicit feet and meter values take precedence over the default range.
- Vision originates at the center of the token footprint.
- Light sources are shared state with grid position and radius.
- Visibility utilities must remain deterministic for the same token, blockers, viewport, and light inputs.

## Accessibility and feedback

- Pointer-only actions need an equivalent control when they represent a required gameplay operation.
- Selection, valid destinations, active turn, movement remaining, hidden state, and blocking errors must remain distinguishable without relying solely on color.
- Modal and fullscreen transitions must preserve a clear close/escape path.
- The authoritative dice overlay is mounted once and moved to the active normal/fullscreen board host. Its canvas and semantic result rail are pointer-transparent, unfocusable and hidden from assistive technologies because the existing dice log remains the live textual result.
- A dice scene must resize with its board host without entering camera/zoom transforms or changing grid coordinates. Reduced-motion preference, missing WebGL, invalid/legacy detail, excess logical dice, or renderer failure fall back silently to the numeric log.
- While a dice presentation is active, a primary click or `Escape` aborts only that presentation. Global listeners must not prevent default behavior, stop propagation, move focus, or make the overlay pointer-interactive; the originally targeted board or UI action still runs.
- Personal animation and sound controls remain usable from the dice dock. Reduced motion overrides visual playback without rewriting the saved animation preference, and audio stays silent until a trusted user activation.

## Verification

Check at minimum: single and multi-selection, zoom/pan coordinate accuracy, allowed and rejected movement, hidden-token behavior for both roles, obstacle occlusion, and build/type safety for any board contract change.
