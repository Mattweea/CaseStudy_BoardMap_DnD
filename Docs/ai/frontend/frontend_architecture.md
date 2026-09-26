# Frontend Architecture

## Purpose

Define the stable React boundaries and client-state rules used by D&D Battle Map.

## Runtime composition

- `src/main.tsx` mounts the application.
- `src/App.tsx` is the composition root for authentication gates, sidebar sections, modals, board actions, keyboard commands, notes, session controls, and combat announcements.
- `src/hooks/useAuthSession.ts` owns session discovery, login, logout, and authentication feedback.
- `src/hooks/useBattleMapState.ts` owns the client copy of shared game state, SSE subscription, version tracking, optimistic mutations, mutation serialization, and local zoom.
- `src/hooks/useSceneCatalog.ts` owns the Master-only scene catalog request state, management selection, local edit draft reconciliation, and version-conflict feedback. Catalog selection is not active-scene selection and never mutates the battle-map snapshot.
- `src/components/Board.tsx` owns board-space rendering and pointer interaction.
- `src/components/SceneCatalogPanel.tsx` is the dedicated Master workspace surface for creating, listing, selecting and renaming persisted scenes. It is not mounted for an Adventurer and exposes no delete, archive or activation control.
- `src/components/Dice3DOverlay.tsx` owns the single client-local 3D dice scene, its FIFO presentation queue, and capability fallback. It draws no textual result summary over the map: the dice log is the only place where a roll is read. `App.tsx` points it at the currently active normal or fullscreen board host; individual `Board` instances do not own renderer instances.
- Feature components receive state and actions through typed props; they must not create a second shared-state source.

## State ownership

Use three explicit state classes:

1. Server-shared state is represented by `BattleMapSharedState`, delivered by HTTP/SSE, and mutated through `useBattleMapState` actions.
2. Local persistent preferences contain board zoom, the versioned dice-presentation toggles (`animationEnabled`, `soundEnabled`), and the versioned combat-audio preferences (`enabled`, `volume`, `shared/combat-audio-preferences.mjs` via `useCombatAudioPreferences`) stored in `localStorage`; they never enter the shared snapshot.
3. Ephemeral UI state belongs in the nearest component or in `App.tsx` when several sibling surfaces coordinate it.

Dice animation deliveries are ephemeral client state derived inside `useBattleMapState` from already sanitized snapshots. The initial HTTP state and first snapshot of every SSE connection seed a local id baseline; subsequent unseen log ids are delivered once to the presentation queue. This feed must not enter `BattleMapSharedState`, persistence, undo, or authorization logic.

Do not add a shared game field only to React state. A shared field requires the type, client normalizer, server normalizer, snapshot, sanitization, mutation path, and SSE payload to remain compatible.

## Server authority and optimistic updates

- The server is authoritative for authentication, permissions, valid shared state, and persistence.
- Shared authoritative rolls include optional per-die metadata for newer snapshots. The client normalizer preserves a wholly valid list, drops a malformed list as a unit, and keeps legacy aggregate-only logs readable; it never invents ids or dispositions for old results.
- Optimistic client updates may improve responsiveness, but failures must restore or apply the authoritative snapshot returned by the server.
- Mutations are serialized by the shared-state hook to avoid racing local writes.
- Full master state commits include `baseVersion`; HTTP `409` means the client must accept the returned snapshot before retrying.
- Combat mutations with role rules (enter/leave combat, round start, turn advance and end of turn, initiative roll and roll-all, `playersCanEndTurn`) go through dedicated endpoints via the hook's serialized queue; a rejection applies the snapshot the server returns (or restores the previous one) and returns the server's reason to the caller. Tracker controls stay disabled while their request is in flight. The movement-budget predicate (`isMovementBudgetActive`: combat with the round started) is shared by the optimistic move, the board's budget display, and the dash control.
- SSE can update the state at any time. Never assume the client is the only writer.

## Component conventions

- Keep domain calculations in focused utilities or the owning state hook rather than JSX.
- Reuse `Modal` for modal surfaces and preserve close behavior and focus expectations.
- Keep permission-based controls out of the DOM when the user cannot invoke them, while still enforcing permissions server-side.
- Pass stable identifiers such as token IDs through UI actions; resolve mutable token data from current state.
- Avoid changing the very large shared `App`, `Board`, or `ElementModals` surfaces for a local concern unless their shared contract is the actual root cause.
- `src/utils/dice.ts` is only the browser adapter for local dice uses: it supplies Web Crypto entropy to the dependency-free shared engine and preserves its current UI-facing API. It is not an authority for shared roll results and must not import Node runtime code.
- The 3D dice adapter consumes only valid `DiceRollLog.dice` values and forces the renderer faces. Renderer totals, physics and completion are decorative and must never mutate the authoritative log or delay a successful roll response.
- `App` owns one local dice-preference snapshot shared by `DicePanel` and `Dice3DOverlay`. Disabling animation aborts the active presentation and discards pending presentations while retaining their deduplication; disabling sound stops only the local audio layer.
- Dice audio is a cancellable browser adapter over selected local DiceBox samples. It remains gated until a trusted page interaction, never delays the renderer, and absorbs loading or playback failures without affecting the visual queue or log.
- `DicePanel`'s tray selection is cumulative across dice types (a per-type counter, not a single selected type); the client composes the formula by sorting active types by face count and blocks adding a `d20` to a selection that already has another type (and vice versa) before the request ever reaches the server, since the server rejects a mixed `d20` formula outright. The panel never sends a `mode`; the server derives it from the formula alone.
- `DiceLogEntry` renders one card shape for every roll origin (free roll, character-sheet ability/attack/damage/single target): a shared model function classifies the log into result boxes (one totalizable box, or one box per independent/paired outcome), an optional pair marker, a formula line, and a shared click-to-expand detail — not per-origin branches with different affordances (a native `title` tooltip is not keyboard-reachable).

## Error and loading behavior

- Authentication remains gated until the initial session request finishes.
- Shared-state UI remains gated until the first authenticated snapshot is loaded.
- Mutating feedback must not imply success before the server accepts the change unless rollback is implemented.
- Scene catalog forms keep edits local until submit. A `409` replaces catalog/detail data with the server-provided current scene and asks the Master to review the newer version before retrying.
- Network and validation errors should be user-actionable; unexpected errors may also be logged for diagnosis.

## Verification

For frontend changes, run `npm run build`. Manually verify the affected role and the nearest alternate role when visibility or permissions change. For optimistic or realtime work, verify rejection/reconciliation and a second connected client when practical.
