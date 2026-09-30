import type { Scene, SceneDrawing, SceneElement } from '../types';
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
  drawingHistory?: { canUndo: boolean; canRedo: boolean };
}

export interface SceneBackgroundCalibration {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface PartyTransferPreview {
  sourceSceneId: string;
  sourceVersion: number;
  targetSceneId: string;
  targetVersion: number;
  stateVersion: number;
  anchor: { x: number; y: number };
  placements: { tokenId: string; name: string; position: { x: number; y: number } }[];
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
  activate: (id: string, baseVersion: number) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}/activate`, {
    method: 'POST',
    body: JSON.stringify({ baseVersion }),
  }),
  previewPartyTransfer: (sourceSceneId: string, sourceVersion: number, targetVersion: number, anchor: { x: number; y: number }) =>
    request<PartyTransferPreview>('/scenes/party-transfer/preview', {
      method: 'POST', body: JSON.stringify({ sourceSceneId, sourceVersion, targetVersion, anchor }),
    }),
  commitPartyTransfer: (preview: PartyTransferPreview) => request<{ state: unknown; version: number }>('/scenes/party-transfer/commit', {
    method: 'POST', body: JSON.stringify({ sourceSceneId: preview.sourceSceneId, sourceVersion: preview.sourceVersion,
      targetVersion: preview.targetVersion, stateVersion: preview.stateVersion, anchor: preview.anchor }),
  }),
  previewPartySceneTransition: (targetSceneId: string, sourceVersion: number, targetVersion: number,
    anchor: { x: number; y: number }) => request<PartyTransferPreview>('/scenes/party-transition/preview', {
    method: 'POST', body: JSON.stringify({ targetSceneId, sourceVersion, targetVersion, anchor }),
  }),
  commitPartySceneTransition: (preview: PartyTransferPreview) => request<{ state: unknown; version: number }>(
    '/scenes/party-transition/commit', {
      method: 'POST', body: JSON.stringify({ targetSceneId: preview.targetSceneId,
        sourceVersion: preview.sourceVersion, targetVersion: preview.targetVersion,
        stateVersion: preview.stateVersion, anchor: preview.anchor }),
    }),
  update: (id: string, baseVersion: number, patch: {
    name?: string;
    backgroundCalibration?: SceneBackgroundCalibration;
    boardDimensions?: { columns: number; rows: number };
    isFullyLit?: boolean;
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
  undoDrawing: (id: string, baseVersion: number) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}/drawings/undo`, {
    method: 'POST',
    body: JSON.stringify({ baseVersion }),
  }),
  redoDrawing: (id: string, baseVersion: number) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}/drawings/redo`, {
    method: 'POST',
    body: JSON.stringify({ baseVersion }),
  }),
  addElement: (id: string, baseVersion: number, element: SceneElement) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}/elements`, {
    method: 'POST',
    body: JSON.stringify({ baseVersion, element }),
  }),
  updateElement: (id: string, elementId: string, baseVersion: number, transform: Pick<SceneElement, 'position' | 'widthCells' | 'heightCells' | 'rotation' | 'blocksMovement' | 'blocksVision'>) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}/elements/${encodeURIComponent(elementId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ baseVersion, transform }),
  }),
  removeElement: (id: string, elementId: string, baseVersion: number) => request<PersistedScene>(`/scenes/${encodeURIComponent(id)}/elements/${encodeURIComponent(elementId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ baseVersion }),
  }),
};

export function sceneBackgroundUrl(scene: PersistedScene): string | null {
  const background = scene.document.background;
  return background.kind === 'image'
    ? `${API_BASE_URL}/scenes/${encodeURIComponent(scene.id)}/background?v=${background.etag}`
    : null;
}
