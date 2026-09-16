function resolveLocalApiBaseUrl() {
  return '/api';
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? resolveLocalApiBaseUrl();
export const EVENTS_URL =
  import.meta.env.VITE_EVENTS_URL ?? '/api/battle-map/stream';
