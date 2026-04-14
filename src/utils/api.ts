function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function resolveLocalApiBaseUrl() {
  if (typeof window === 'undefined') {
    return '/api';
  }

  if (isLocalHostname(window.location.hostname)) {
    return 'http://localhost:3001/api';
  }

  return '/api';
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? resolveLocalApiBaseUrl();
export const EVENTS_URL =
  import.meta.env.VITE_EVENTS_URL ?? `${API_BASE_URL}/battle-map/stream`;
