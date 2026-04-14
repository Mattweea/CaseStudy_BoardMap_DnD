#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
NGROK_API_URL="${NGROK_API_URL:-http://127.0.0.1:4040/api/tunnels}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm non trovato nel PATH."
  exit 1
fi

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok non trovato nel PATH."
  echo "Installa ngrok e configura il token con: ngrok config add-authtoken <TOKEN>"
  exit 1
fi

cleanup() {
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "${NGROK_PID:-}" ]] && kill -0 "$NGROK_PID" >/dev/null 2>&1; then
    kill "$NGROK_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

wait_for_http() {
  local url="$1"
  local label="$2"

  for _ in {1..40}; do
    if curl --silent --fail "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  echo "Timeout in attesa di ${label}: ${url}"
  exit 1
}

get_ngrok_public_url() {
  local tunnels_json
  tunnels_json="$(curl --silent --fail "$NGROK_API_URL")"

  node -e '
    const payload = JSON.parse(process.argv[1]);
    const tunnel = (payload.tunnels || []).find((item) =>
      item.proto === "https" && typeof item.public_url === "string"
    );
    if (!tunnel) {
      process.exit(1);
    }
    process.stdout.write(tunnel.public_url);
  ' "$tunnels_json"
}

echo "Avvio backend Fastify sulla porta ${BACKEND_PORT}..."
(
  cd "$ROOT_DIR"
  npm run dev:server
) &
BACKEND_PID=$!

wait_for_http "http://127.0.0.1:${BACKEND_PORT}/api/health" "backend Fastify"

echo "Apertura tunnel ngrok sulla porta ${FRONTEND_PORT}..."
ngrok http "$FRONTEND_PORT" >/tmp/boardmap-ngrok.log 2>&1 &
NGROK_PID=$!

wait_for_http "$NGROK_API_URL" "API locale di ngrok"

PUBLIC_URL="$(get_ngrok_public_url)"
PUBLIC_HOST="${PUBLIC_URL#https://}"
PUBLIC_HOST="${PUBLIC_HOST#http://}"

if [[ -z "$PUBLIC_HOST" ]]; then
  echo "Impossibile ricavare il dominio pubblico ngrok."
  exit 1
fi

echo "Avvio frontend Vite sulla porta ${FRONTEND_PORT} con host consentito ${PUBLIC_HOST}..."
(
  cd "$ROOT_DIR"
  __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="$PUBLIC_HOST" npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

wait_for_http "http://127.0.0.1:${FRONTEND_PORT}" "frontend Vite"

cat <<EOF

Live session pronta.

Link pubblico:
  ${PUBLIC_URL}

Credenziali demo:
  master / master123
  aria / adventurer123
  borin / adventurer123

Se hai esportato AUTH_USERS_JSON prima di lanciare lo script, il backend usera quegli utenti.

Premi Ctrl+C per chiudere backend, frontend e tunnel ngrok.
EOF

wait
