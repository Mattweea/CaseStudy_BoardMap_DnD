# Operations Context Router

## Purpose

Route local development, build, environment, proxy, public-session, and runtime storage work.

| Document | Read when the task involves | Usually skip when |
|---|---|---|
| [Development and live-session workflow](development_and_live_session.md) | Install/start/build commands, ports, environment variables, Vite proxying, allowed hosts, ngrok, runtime files, process lifecycle, or troubleshooting | Pure application behavior with unchanged runtime configuration |

## Cross-context routes

- Add [Backend](../backend/backend_context_router.md) for cookie, CORS, API, snapshot, or process-state behavior.
- Add [Frontend](../frontend/frontend_context_router.md) for Vite/client environment or API URL behavior.
- Add [Gameplay roster](../gameplay/roster_and_identity_contract.md) when authentication configuration changes character behavior.

## Maintenance rule

This router owns how the application is run and exposed. It does not own gameplay or UI contracts.
