import type { Scene, SceneDrawing } from '../types';
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

export interface SceneBackgroundCalibration {
  scale: number;
  offsetX: number;
  offsetY: number;
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
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !(init.body instanceof Blob) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers,
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
  update: (id: string, baseVersion: number, patch: {
    name?: string;
    backgroundCalibration?: SceneBackgroundCalibration;
    boardDimensions?: { columns: number; rows: number };
  }) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ baseVersion, ...patch }),
  }),
  uploadBackground: (id: string, baseVersion: number, file: File) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}/background`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type, 'X-Scene-Base-Version': String(baseVersion) },
    body: file,
  }),
  clearBackground: (id: string, baseVersion: number) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}/background`, {
    method: 'DELETE',
    headers: { 'X-Scene-Base-Version': String(baseVersion) },
  }),
  addDrawing: (id: string, baseVersion: number, drawing: SceneDrawing) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}/drawings`, {
    method: 'POST',
    body: JSON.stringify({ baseVersion, drawing }),
  }),
  eraseDrawings: (id: string, baseVersion: number, ids: string[]) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}/drawings`, {
    method: 'DELETE',
    body: JSON.stringify({ baseVersion, ids }),
  }),
};

export function sceneBackgroundUrl(scene: PersistedScene): string | null {
  const background = scene.document.background;
  return background.kind === 'image'
    ? `${API_BASE_URL}/scenes/${encodeURIComponent(scene.id)}/background?v=${background.etag}`
    : null;
}
