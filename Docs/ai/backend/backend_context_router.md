# Backend Context Router

## Purpose

Route Fastify, authentication, shared-state, realtime, and persistence work to focused server contracts.

## Mandatory baseline

Read [API, authentication, and realtime](api_auth_and_realtime.md) for every backend task.

| Document | Read when the task involves | Usually skip when |
|---|---|---|
| [Shared state and persistence](shared_state_and_persistence.md) | State shape, normalization, validation, versions, sanitization, optimistic reconciliation, undo, snapshot disk persistence, restore, or state migration | Authentication or transport work that cannot alter or expose game state |

## Cross-context routes

- Add [Frontend](../frontend/frontend_context_router.md) when changing payloads, request behavior, SSE delivery, or optimistic mutation contracts.
- Add [Gameplay](../gameplay/gameplay_context_router.md) for the domain rules enforced by an endpoint.
- Add [Operations](../operations/operations_context_router.md) for ports, environment variables, CORS, proxying, process startup, storage paths, or public exposure.

## Maintenance rule

This router owns server authority, transport, and persistence contracts. It links to gameplay rules instead of redefining their meaning.
