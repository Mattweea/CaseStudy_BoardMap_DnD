# Documentation Context Router

## Purpose

This is the mandatory entry point for project documentation. It routes contributors to the smallest useful context while keeping domain rules out of `AGENTS.md`.

## Routing algorithm

Before proposing or implementing a solution:

1. Classify every domain and cross-cutting concern touched by the task.
2. Open every matching router below. Routes are cumulative.
3. Follow nested routers until they identify the required leaf documents.
4. Read mandatory baselines and only the selected optional leaves.
5. Combine documentation with code and runtime inspection whenever current behavior matters.

Process each router at most once. Cross-context links compose concerns but do not restart an already visited router.

## Domain routing table

| Task area | Start with |
|---|---|
| Documentation architecture, ownership, naming, reachability, or create/move/split/delete workflows | [Documentation governance router](documentation/documentation_governance_context_router.md) |
| OpenSpec, spec-driven development, capability requirements, change proposals, delta specs, planning gates, verification, or archival | [Developer workflows context router](developer_workflows/developer_workflows_context_router.md) |
| React UI, components, board rendering, interaction, styling, accessibility, modals, hooks, or client state | [Frontend context router](frontend/frontend_context_router.md) |
| Fastify API, authentication, authorization, shared-state mutation, SSE, snapshots, or server validation | [Backend context router](backend/backend_context_router.md) |
| SQLite connection policy, schema migrations, repositories, database lifecycle, or persisted relational data | [Database context router](database/database_context_router.md) |
| Tokens, roster, vehicles, visibility, movement, combat, initiative, dice, or gameplay invariants | [Gameplay context router](gameplay/gameplay_context_router.md) |
| Local development, build, environment variables, Vite proxying, ngrok, deployment, or troubleshooting | [Operations context router](operations/operations_context_router.md) |

## Cumulative routing examples

- Changing player movement requires Gameplay + Backend + Frontend because the rule is enforced on the server and surfaced optimistically on the board.
- Adding a token field usually requires Gameplay + Backend + Frontend because its type, normalization, persistence, sanitization, and editing UI must agree.
- Changing login or roster credentials requires Backend + Gameplay + Frontend; add Operations when environment configuration changes.
- Changing the SSE payload requires Backend + Frontend and the gameplay router for every affected domain field.
- Changing a character sheet requires Backend + Frontend + Database; add Gameplay when projecting sheet values onto tokens or changing roster access.
- A new user-visible capability requires Developer Workflows plus every implementation domain it touches.

## When no route is exact

Choose the closest router, inspect the relevant code, and identify the canonical owner before creating documentation. Add a new top-level domain only when it has a distinct consultation trigger and lifecycle.

## Router ownership and maintenance

- Every artifact under `Docs/ai` has one canonical owning router.
- Other routers may cross-link to an artifact but must not duplicate its rules.
- Every artifact, including non-Markdown references, must be reachable from this macro-router through router links.
- Router filenames end in `_context_router.md`.
- Historical evidence is isolated and explicitly marked non-authoritative.
- `AGENTS.md` links only to this macro-router, never directly to leaves or domain routers.

## Verification

After changing documentation content, paths, links, routers, or topology, run:

```bash
npm run docs:check
```

The validator confirms reachability, local links and anchors, router naming, and the single-entry-point rule for `AGENTS.md`.
