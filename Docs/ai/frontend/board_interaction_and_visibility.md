# Board Interaction and Visibility

## Purpose

Define board-space interaction, visibility, and rendering invariants without duplicating gameplay authorization rules.

## Coordinate system

- Token positions and dimensions are integer grid cells.
- `BOARD_CONFIG.cellSize` converts grid units to pixels; camera and zoom transform viewport input back to world cells.
- The active scene supplies either finite positive column/row counts or `0 × 0` for a board with no positive boundary. Rendering virtualizes cells to the visible viewport. Finite camera panning stays within the scene dimensions; unlimited panning stays non-negative and within the coordinate safety limit. A legacy scene defaults to 30 × 30 cells.
- Token footprint uses explicit positive `widthCells` and `heightCells` when present, otherwise the D&D size mapping.
- Grid movement and placement snap to cells. Helpers must clamp invalid negative or fractional inputs at the appropriate trust boundary.

## Interaction modes

- Plain click selects a token; `Shift` composes selection.
- Dragging empty board space creates area selection; `Shift` adds to the current selection.
- `Ctrl` + drag and middle-button drag pan the board.
- Wheel input controls zoom within configured limits. Each rendered finite Board derives its effective minimum from the available viewport and active-scene dimensions, so zooming fully out fits the board on both axes when that scale is above the absolute lower bound. Unlimited Boards use the configured minimum zoom because they have no total extent to fit. That bound protects interaction precision for very large scenes.
- Scene-preparation dimensions are local draft state until the versioned scene update succeeds. Its preview draws the draft boundary over the calibrated image and dims the image outside a finite board; the preview scales both axes equally so every grid cell remains square. The `0 × 0` preview shows a representative viewport without a boundary.
- Keyboard movement must ignore editable controls and respect the same server movement rules as pointer movement.
- Fullscreen is UI state and must not enter shared snapshots.
- La matita Master usa punti frazionari in coordinate di cella nella preview del dialog Preparazione scena. La bozza resta locale fino al rilascio del puntatore; un gesto invia un solo tratto versionato sulla scena selezionata. La gomma identifica solo tratti intersecati e invia un'unica cancellazione per gesto; `Esc` annulla la bozza. Colore e spessore sono controlli locali del Master. Le modifiche non salvate a nome, sfondo, calibrazione o dimensioni bloccano il disegno fino al salvataggio o annullamento.
- Il layer di cattura è confinato alla preview e non copre i controlli del dialog. L'anteprima circolare della gomma usa lo stesso raggio logico del rilevamento. La board live, normale o fullscreen, rende i tratti proiettati con camera e zoom ma non offre strumenti per modificarli.

Master multi-token and connected-obstacle movement may use a full shared-state commit. Adventurer movement must use the ownership-aware movement endpoint so server budgets and blockers remain authoritative.

### Waypoints, ruler, templates, and ping

- Every role plans a move the same way, through a single `PlanInteraction`. There is no separate master drag path: if a role can move a token, it sees the measured path for that move. The token stays drawn at its starting position while planning — the destination is shown by the path and by the destination highlight, not by moving the piece, so the origin stays visible.
- A click means exactly one thing during a move: append a point to the path. Clicking a movable token selects it *and* opens planning; each later click appends a waypoint. The destination is never clicked — it is the cell under the pointer when `Space` is pressed, and `Space` is the only confirm gesture. No pointer release ever sends a move, including the release of the press that opened the plan. `Backspace` drops the last waypoint, `Esc` cancels without sending a request.
- That keeps a straight move at one click plus one key, and an L-shaped move at two clicks plus one key. Opening a plan is non-destructive: nothing moves until `Space`, and `Esc` leaves the token selected where it was, so no second click is needed to start. `Shift`+click stays pure multi-selection and does not open a plan.
- A master group plan carries the selection's per-token offsets and applies them to the confirmed destination; obstacle clusters move with the same gesture.
- `Space` and `Backspace` are inert while focus is in an input, textarea, select, or contenteditable element, and the context-menu suppression that keeps right-click usable as a waypoint gesture is attached to the board shell only, never to `window`.
- A walk animation starts from the `token-walk` SSE event the server broadcasts *after* it accepts a move, filtered by the same token-visibility rule as templates — including for the client that requested the move. Starting it locally on confirm would animate a full walk for a move the server then rejects, making the snap-back look like a bug rather than a refusal. The `requestAnimationFrame` loop supports several tokens walking at once (a per-token map, one persistent loop), and a token's CSS transform transition is suppressed while it is walking. A finished walk leaves the per-token map, so the token follows the shared position again. A single keyboard or pad step (`token-walk` with `showTrack: false`) animates without drawing the path track.
- When the server rejects a move, its reason (insufficient budget, blocking obstacle, occupied destination) is surfaced to the requester as a dismissible `MovementNotice` rendered with `role="alert"` as a fixed toast above the map (fullscreen included) that expires after a few seconds, so a rejected planned or keyboard move is never silent. A roll rejected by the server (for example a second initiative roll from the sheet) uses the same toast area and realigns the state from the returned snapshot.
- While a path plan, the ruler, or a template is active, the board reports it (`onMapInteractionChange`) and `App` ignores arrow-key movement and Delete/Backspace token removal: those keys belong to the map interaction. It is client-local state, never part of the shared state, and it is not silently swallowed into the console.
- Both the plan path and the ruler render their cost through the shared `pathCost` function, so the number shown on the map is always the one the server would charge. Each segment's own cost is drawn next to that segment (diagonal parity carried forward segment by segment, exactly as the server does) and the total sits at the path tip, in cells plus the configured unit (`formatRulerMeasurement`). Any extra unit shown alongside — feet next to meters — is converted from the measured value, never from a fixed per-cell scale, so the master's configured cell size stays the single reference. A blocked or over-budget plan replaces that same on-map label with a warning instead of adding a second banner.
- Board dimensions, diagonal rule, and measurement unit arrive from the same active-scene projection. Background image calibration is presentation-only and must never enter `pathCost`, budget, template size, or unit conversion.
- Image calibration uses the managed background's dimensionless scale and signed X/Y offsets in logical board pixels. Rendering composes `(offset - camera × cellSize) × zoom` for translation and `scale × zoom` for image scale, then draws the canonical grid above that image in the same Board stage. The virtual stage dimensions are also multiplied by zoom because every child layer uses zoomed pixel coordinates; only the outer shell clips content beyond the visible viewport. Normal and fullscreen Boards use this identical composition.
- A single hint line above the toolbar states, as text, which gestures confirm, cancel, and edit the interaction in progress, and it doubles as the `role="status"` live region for blocked-path, over-budget, and occupied-destination warnings. On-map color and icons alone do not reach a screen reader.
- Template and ping tools are exclusive, toggleable modes: a template's origin is fixed by the first click and its orientation/size follow the pointer until release, which ends it for every viewer; a ping is placed with a single click. Every template type draws a persistent origin marker (dashed cell outline, crosshair, dot) in white over a dark outline, so the cell an effect is measured from stays readable regardless of the template's fill color. Both call the ephemeral, session-authenticated endpoints — never the versioned shared-state path — and are rendered from the `ephemeral-*` SSE events the hook relays, including for the author's own client.
- The ruler, ping, and template toggle buttons live in the board's own always-rendered toolbar (not the collapsible side panel), so they stay reachable by keyboard and visible with the panel open or closed, matching the zoom controls. Each carries a textual `aria-label` with its emoji marked `aria-hidden`, and each has a single-key shortcut (`R` ruler, `P` ping, `C` circle, `O` cone, `L` line) that is inert while focus is in a text field and while an interaction is in progress. Planning a move has no toggle button: it starts from dragging or re-clicking a movable token.

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
- An out-of-budget or blocked-segment warning while planning a move must carry a textual cue in the hint line's live region, not a color change alone, and a server rejection must reach the requester as an `role="alert"` message rather than only a console entry.
- Map tool controls must not take their accessible name from an emoji; each needs an explicit textual label, and any single-key shortcut must be inert during text entry.
- Modal and fullscreen transitions must preserve a clear close/escape path.
- The ruler and the template/ping tools must be reachable and dismissible (`Esc`) by keyboard, and remain usable whether the collapsible side panel is open or closed.
- The authoritative dice overlay is mounted once and moved to the active normal/fullscreen board host. Its canvas is pointer-transparent, unfocusable and hidden from assistive technologies; it shows no textual result summary, because the dice log remains the live textual result.
- A dice scene must resize with its board host without entering camera/zoom transforms or changing grid coordinates. Reduced-motion preference, missing WebGL, invalid/legacy detail, excess logical dice, or renderer failure fall back silently to the numeric log.
- While a dice presentation is active, a primary click or `Escape` aborts only that presentation. Global listeners must not prevent default behavior, stop propagation, move focus, or make the overlay pointer-interactive; the originally targeted board or UI action still runs.
- Personal animation and sound controls remain usable from the dice dock. Reduced motion overrides visual playback without rewriting the saved animation preference, and audio stays silent until a trusted user activation.

## Verification

Check at minimum: single and multi-selection, zoom/pan coordinate accuracy, allowed and rejected movement, hidden-token behavior for both roles, obstacle occlusion, build/type safety for any board contract change, planned-move and ruler measurement matching the server-charged cost, master and adventurer confirming a move with the same gesture and seeing the same measurement, a first click selecting rather than planning, `Esc` cancelling a plan/ruler/template without a network request, `Space` confirming to the pointer's cell with no click on the destination, press-drag-release sending nothing, `Space` staying inert while typing in a text field, a rejected move surfacing its reason and producing no walk animation, and the ruler/ping/template controls remaining keyboard-reachable — by shortcut and by tab order — with the side panel open or closed.
