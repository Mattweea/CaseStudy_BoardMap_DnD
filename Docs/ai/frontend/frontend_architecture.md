# Frontend Architecture

## Purpose

Define the stable React boundaries and client-state rules used by D&D Battle Map.

## Runtime composition

- `src/main.tsx` mounts the application.
- `src/App.tsx` is the composition root for authentication gates, sidebar sections, modals, board actions, keyboard commands, notes, session controls, and combat announcements.
- `src/hooks/useAuthSession.ts` owns session discovery, login, logout, and authentication feedback.
- `src/hooks/useBattleMapState.ts` owns the client copy of shared game state, SSE subscription, version tracking, optimistic mutations, mutation serialization, and local zoom.
- `src/components/Board.tsx` owns board-space rendering and pointer interaction.
- `src/components/Dice3DOverlay.tsx` owns the single client-local 3D dice scene, its FIFO presentation queue, capability fallback, and result rail. `App.tsx` points it at the currently active normal or fullscreen board host; individual `Board` instances do not own renderer instances.
- Feature components receive state and actions through typed props; they must not create a second shared-state source.

## State ownership

Use three explicit state classes:

1. Server-shared state is represented by `BattleMapSharedState`, delivered by HTTP/SSE, and mutated through `useBattleMapState` actions.
2. Local persistent preference currently contains board zoom only and is stored in `localStorage`.
3. Ephemeral UI state belongs in the nearest component or in `App.tsx` when several sibling surfaces coordinate it.

Dice animation deliveries are ephemeral client state derived inside `useBattleMapState` from already sanitized snapshots. The initial HTTP state and first snapshot of every SSE connection seed a local id baseline; subsequent unseen log ids are delivered once to the presentation queue. This feed must not enter `BattleMapSharedState`, persistence, undo, or authorization logic.

Do not add a shared game field only to React state. A shared field requires the type, client normalizer, server normalizer, snapshot, sanitization, mutation path, and SSE payload to remain compatible.

## Server authority and optimistic updates

- The server is authoritative for authentication, permissions, valid shared state, and persistence.
- Shared authoritative rolls include optional per-die metadata for newer snapshots. The client normalizer preserves a wholly valid list, drops a malformed list as a unit, and keeps legacy aggregate-only logs readable; it never invents ids or dispositions for old results.
- Optimistic client updates may improve responsiveness, but failures must restore or apply the authoritative snapshot returned by the server.
- Mutations are serialized by the shared-state hook to avoid racing local writes.
- Full master state commits include `baseVersion`; HTTP `409` means the client must accept the returned snapshot before retrying.
- SSE can update the state at any time. Never assume the client is the only writer.

## Component conventions

- Keep domain calculations in focused utilities or the owning state hook rather than JSX.
- Reuse `Modal` for modal surfaces and preserve close behavior and focus expectations.
- Keep permission-based controls out of the DOM when the user cannot invoke them, while still enforcing permissions server-side.
- Pass stable identifiers such as token IDs through UI actions; resolve mutable token data from current state.
- Avoid changing the very large shared `App`, `Board`, or `ElementModals` surfaces for a local concern unless their shared contract is the actual root cause.
- `src/utils/dice.ts` is only the browser adapter for local dice uses: it supplies Web Crypto entropy to the dependency-free shared engine and preserves its current UI-facing API. It is not an authority for shared roll results and must not import Node runtime code.
- The 3D dice adapter consumes only valid `DiceRollLog.dice` values and forces the renderer faces. Renderer totals, physics and completion are decorative and must never mutate the authoritative log or delay a successful roll response.

## Error and loading behavior

- Authentication remains gated until the initial session request finishes.
- Shared-state UI remains gated until the first authenticated snapshot is loaded.
- Mutating feedback must not imply success before the server accepts the change unless rollback is implemented.
- Network and validation errors should be user-actionable; unexpected errors may also be logged for diagnosis.

## Verification

For frontend changes, run `npm run build`. Manually verify the affected role and the nearest alternate role when visibility or permissions change. For optimistic or realtime work, verify rejection/reconciliation and a second connected client when practical.
