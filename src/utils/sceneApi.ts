import type { Scene } from '../types';
import { API_BASE_URL } from './api';

export interface SceneCatalogEntry {
  id: string;
  name: string;
  version: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface PersistedScene extends Scene {
  campaignId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export class SceneApiError extends Error {
  status: number;
  payload: { message?: string; currentScene?: PersistedScene | null };

  constructor(status: number, payload: { message?: string; currentScene?: PersistedScene | null }) {
    super(payload.message ?? 'Richiesta scene non riuscita.');
    this.name = 'SceneApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new SceneApiError(response.status, payload);
  return payload as T;
}

export const sceneApi = {
  list: () => request<{ scenes: SceneCatalogEntry[] }>('/scenes'),
  get: (id: string) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}`),
  create: (name: string) => request<PersistedScene>('/scenes', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),
  update: (id: string, baseVersion: number, name: string) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ baseVersion, name }),
  }),
};
