# Development and Live-Session Workflow

## Purpose

Define supported local, preview, and ngrok workflows plus their configuration boundaries.

## Prerequisites and commands

- Install dependencies with `npm install`.
- Run Fastify in watch mode with `npm run dev:server`.
- Run Vite with `npm run dev` or `npm run dev:client`.
- Produce a type-checked production build with `npm run build`.
- Regenerate the locally served DiceBox assets with `npm run assets:dice`. The command recreates `public/dice-box`, copies all renderer textures plus only the audio samples referenced by the local dice-audio adapter, and normalizes file modes. `npm run build` invokes it automatically before Vite so a clean build does not depend on a CDN or manually copied files.
- Serve the build locally with `npm run preview` while the backend remains separately available.
- Run the Node test suite with `npm test`.
- Manage the SQLite schema with `npm run db:migrate`, `npm run db:status`, `npm run db:rollback`, and the explicitly confirmed development reset command.
- Validate documentation topology with `npm run docs:check`.

The frontend and backend are separate processes. The default backend listens on `0.0.0.0:3001`; Vite normally serves on port `5173` and proxies `/api` to the backend.

## Environment contract

| Variable | Owner | Purpose |
|---|---|---|
| `PORT`, `HOST` | Fastify | Backend bind address |
| `CORS_ORIGINS` | Fastify | Comma-separated exact additional browser origins |
| `VTT_DB_PATH` | SQLite | Optional database path; defaults to `database/database.sqlite` |
| `BACKEND_PORT` | Vite/script | Proxy target and live-session backend port |
| `VITE_API_BASE_URL` | Browser build | Override the client API base URL |
| `VITE_EVENTS_URL` | Browser build | Override the SSE URL |
| `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` | Vite/script | Comma-separated additional dev/preview hosts |
| `FRONTEND_PORT`, `NGROK_API_URL` | live script | Local frontend port and ngrok inspector endpoint |

Do not commit real credentials, database files, portraits, session snapshots, or secrets. When `VTT_DB_PATH` points inside the repository, add that exact runtime location to the ignore rules.

## API URL behavior

On `localhost` or `127.0.0.1`, the browser defaults directly to `http://localhost:3001/api`. On non-local hosts it uses relative `/api`, relying on the Vite proxy or same-origin deployment. Explicit Vite environment overrides take precedence.

## Live session

`./start-live-session.sh` checks for npm and ngrok, starts the backend, waits for health, opens an ngrok tunnel to the frontend, discovers the HTTPS hostname, starts Vite with that host allowed, and prints the public URL and demo credentials. Its exit trap stops all three child processes.

Share the frontend HTTPS URL, not the backend port. The default allowed-host list accepts standard ngrok domains, while the discovered host is also passed explicitly.

## Runtime durability

- Authentication sessions, undo stacks, SSE clients, and battle-map live state are process memory.
- Saved game state is written only when the master suspends the session.
- The saved file lives under ignored `server/data/`.
- Users, roles, campaigns, and character sheets are SQLite-backed; character-sheet writes are debounced and flushed on controlled lifecycle boundaries.
- Starting the backend loads only saved-session metadata; the master resumes the snapshot explicitly.

## Verification and troubleshooting

- Check `GET /api/health` for backend availability and version.
- A failed login or missing SSE connection often means the API URL/proxy, backend process, cookie origin, or CORS origin is wrong.
- If Vite rejects a tunnel host, pass it through `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` and restart Vite.
- After server roster changes, restart the backend.
- A restart without a prior suspend loses unsaved live state and all in-memory sessions.
- Migration and persistence tests must use temporary database paths, never the developer database.
