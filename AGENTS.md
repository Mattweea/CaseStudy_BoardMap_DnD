# AGENTS.md

## Purpose

This file defines the operating rules for contributors and AI agents working on D&D Battle Map. These rules take precedence over generic workflow preferences, except for hard environment limitations.

## Source of truth

Resolve uncertainty in this order:

1. an approved active OpenSpec change for the intended behavior delta, when that exact change is being implemented;
2. canonical OpenSpec capability specs for current observable product behavior, when `openspec/specs` exists;
3. routed project documentation under `Docs/ai` for architecture, conventions, boundaries, and operations;
4. observed application behavior and focused runtime inspection;
5. existing code and repository conventions;
6. generic React, TypeScript, Fastify, or Vite knowledge.

An active delta describes intended future behavior, not current runtime behavior, until it is applied. If specifications, routed documentation, and implementation disagree, do not silently choose one. Report the conflict and resolve it as part of the task when it is in scope.

## Mandatory documentation routing

Before proposing or implementing a solution:

1. Open `Docs/ai/documentation_context_router.md`.
2. Classify every domain and cross-cutting concern touched by the task.
3. Follow every applicable route, including nested routers, until the required leaf documents are identified.
4. Read mandatory baselines and only the additional leaves selected by the routers.
5. Treat routes as cumulative; never stop at the first matching domain.

`Docs/ai/documentation_context_router.md` is the only documentation entry point that belongs in this file. Leaf paths and consultation matrices must remain in the routers.

## Task classification

Before implementation, classify the work as one or more of:

- bug fix;
- frontend work;
- backend or realtime feature;
- gameplay/domain change;
- operations change;
- documentation update;
- refactor.

Use the classification to select documentation and verification. A task may span several categories.

## Spec-driven development gate

When an `openspec/` root exists, inspect active changes and applicable canonical specs before implementing non-trivial product behavior.

Use an OpenSpec change for:

- a new user-visible capability;
- a material change to observable behavior or an existing requirement;
- a breaking API, state, persistence, authorization, or compatibility change;
- a cross-cutting or high-risk architectural change whose intent and rollout need review.

A standalone OpenSpec change is normally unnecessary for documentation-only edits, cosmetic-only work, dependency/tooling maintenance, mechanical refactors with no behavior change, or a focused bug fix that restores an already explicit canonical requirement. If such work still benefits from coordinated planning, use `skip_specs: true` only when no observable requirement changes.

The lifecycle is Explore → Propose → Review → Apply → Verify → Archive:

- Explore is read-only unless the user explicitly asks to capture conclusions.
- Propose creates planning artifacts and stops before code.
- Apply begins only after the proposal, delta specs, applicable design, and tasks are coherent and accepted.
- Tests and documentation impact belong in `tasks.md`; do not mark a task complete before its verification passes.
- Validate the selected change before implementation and again before archive.
- Verify implementation against requirements and scenarios before archive; use the optional OpenSpec verify workflow when installed, otherwise perform the comparison explicitly.
- Archive only completed, verified changes and sync their implemented deltas into canonical specs.

OpenSpec defines what observable behavior is required. `Docs/ai` defines how this repository is structured and operated. Do not duplicate complete requirement catalogs in `Docs/ai`, and do not put internal implementation instructions into capability specs.

## Change workflow

Before editing:

1. State the intended behavior and acceptance criteria.
2. Inspect the relevant code paths and routed documentation.
3. Identify likely regression surfaces, especially shared hooks, state normalization, authorization, realtime synchronization, and persistence.
4. Choose verification proportional to the risk.

During implementation:

- prefer the smallest change that satisfies the requirement;
- reuse existing components and utilities before introducing new abstractions;
- keep server authority, client optimism, and user-specific state sanitization aligned;
- preserve unrelated user changes;
- update reusable documentation in the same change when contracts or conventions change.

After implementation:

- run the narrowest meaningful checks, then broader checks when risk justifies them;
- run `npm run docs:check` whenever documentation, routers, or documentation paths change;
- run `npm run build` for TypeScript or frontend changes;
- run `npm test` for backend, persistence, authorization, character-sheet, or shared-domain changes;
- run `openspec validate <change> --strict --no-interactive` when an OpenSpec change is in scope and the CLI is available;
- verify both the requested behavior and the most likely adjacent regression;
- report skipped checks and why they were not applicable.

## Shared contracts and regression risk

Treat these as high-risk shared contracts:

- `src/hooks/useBattleMapState.ts`;
- the shared-state types in `src/types/index.ts`;
- normalization, validation, authorization, snapshots, and broadcasting in `server/index.mjs`;
- the duplicated roster in `src/constants/characters.ts` and `server/characters.mjs`;
- board geometry, visibility, movement, initiative, and vehicle-link helpers.

Change a shared contract only when the root cause is shared. Inspect all likely consumers and verify both master and adventurer behavior. Prefer a local adaptation when the requirement is local.

## Security and authorization

- Treat the Fastify server as authoritative. UI visibility is not authorization.
- Require an authenticated session for private state and mutation endpoints.
- Preserve role and ownership checks on every mutation.
- Never expose password hashes, session identifiers, hidden tokens, or another user's private dice preview.
- Keep cookie, CORS, and production security behavior explicit when changing authentication or deployment.
- Do not commit runtime snapshots, secrets, `.env` files, or tunnel credentials.

## Realtime and state integrity

- Normalize untrusted or persisted state before use.
- Increment the shared version and broadcast after every accepted shared-state mutation.
- Preserve optimistic-update rollback or reconciliation on failed client mutations.
- Maintain per-user sanitization before HTTP or SSE delivery.
- Consider stale writes, reconnects, partial failures, and snapshot compatibility for every state-shape change.
- Keep local-only UI state out of the server snapshot unless sharing it is an explicit requirement.

## Documentation quality and maintenance

`Docs/ai` is a routed conventions and contracts system, not a task log.

Document reusable rules, invariants, boundaries, decision criteria, and operational contracts. Do not add one-off implementation diaries or changelog notes to current contract leaves.

When creating, moving, renaming, splitting, merging, or deleting documentation:

- update its canonical owning router;
- update affected ancestor routers when topology changes;
- keep historical evidence explicitly non-authoritative;
- ensure every artifact remains reachable from the macro-router;
- run `npm run docs:check` and `git diff --check`.

## Definition of done

A task is not complete when applicable behavior is unverified, likely regressions were ignored, authorization or state synchronization is incomplete, routed documentation is stale, or the documentation graph fails validation.
