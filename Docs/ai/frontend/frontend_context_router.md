# Frontend Context Router

## Purpose

Route React and browser work to the smallest useful frontend contract. Read every applicable row; routes are cumulative.

## Mandatory baseline

Read [Frontend architecture](frontend_architecture.md) for every frontend task. It defines component boundaries, state ownership, shared hooks, and client/server responsibilities.

| Document | Read when the task involves | Usually skip when |
|---|---|---|
| [Board interaction and visibility](board_interaction_and_visibility.md) | Board rendering, selection, drag, pan, zoom, keyboard movement, fullscreen, fog/lighting, line of sight, obstacle placement, token visibility, or board accessibility | Non-board UI whose state and interaction do not affect the map |
| [Character-sheet client and window](character_sheet_client_and_window.md) | Character-sheet UI, tabs, editing, save status, conflict feedback, portrait upload, floating-window behavior, or sheet accessibility | UI work that cannot open, render, or update a character sheet |

## Cross-context routes

- Add the [Backend router](../backend/backend_context_router.md) for API calls, optimistic mutations, SSE, authentication, or shared-state changes.
- Add the [Gameplay router](../gameplay/gameplay_context_router.md) for tokens, vehicles, roster, initiative, movement, dice, visibility, or combat rules.
- Add the [Operations router](../operations/operations_context_router.md) for Vite configuration, API base URLs, proxying, builds, or public-session behavior.

## Maintenance rule

This router owns browser architecture and interaction conventions. Gameplay meaning belongs to Gameplay; server validation and transport belong to Backend.
