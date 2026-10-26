import { API_BASE_URL } from './api';
import type { CharacterSheetData } from '../types/character-sheet';
import type { MonsterData } from '../../shared/creature-sheet-data.mjs';
export interface CreatureTarget {
  id: string;
  tokenId: string;
  name: string;
  sceneId: string;
  sceneName: string;
  sceneVersion: number;
  version: number;
}
export interface CreatureRecord {
  id: string;
  sheetId: string;
  kind: 'monster' | 'character';
  sceneId: string;
  tokenId: string;
  name: string;
  version: number;
  bindingVersion: number;
  data: CharacterSheetData | MonsterData;
  targets: CreatureTarget[];
  signature: string;
  portraitUrl: string | null;
}
export interface CreatureContext {
  record: CreatureRecord | null;
  kind: 'monster' | 'character';
  related: { tokenId: string; name: string }[];
  sheets: { id: string; name: string }[];
}
export interface CreatureSavePreview {
  targets: CreatureTarget[];
  signature: string;
  individualFields: string[];
}
async function request<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/creature-sheets${path}`, {
    credentials: 'include',
    method: body === undefined && method === 'POST' ? 'GET' : method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.message ?? 'Scheda creatura non disponibile.');
  return value;
}
export const creatureSheetApi = {
  previewHitPoints: (record: CreatureRecord, data: CreatureRecord['data'], delta: number) =>
    request<{ data: CreatureRecord['data'] }>(`/bindings/${encodeURIComponent(record.id)}/hit-points/preview`, {
      data,
      baseVersion: record.version,
      bindingVersion: record.bindingVersion,
      delta,
    }),
  context: (sceneId: string, tokenId: string) =>
    request<CreatureContext>(`/context?sceneId=${encodeURIComponent(sceneId)}&tokenId=${encodeURIComponent(tokenId)}`),
  bind: (sceneId: string, tokenId: string, sheetId: string, includeRelated: boolean) =>
    request<CreatureRecord>('/bindings', { sceneId, tokenId, sheetId: sheetId || undefined, includeRelated }),
  get: (id: string) => request<CreatureRecord>(`/bindings/${encodeURIComponent(id)}`),
  preview: (record: CreatureRecord, data: CreatureRecord['data']) =>
    request<CreatureSavePreview>(`/bindings/${encodeURIComponent(record.id)}/preview`, {
      data,
      baseVersion: record.version,
      bindingVersion: record.bindingVersion,
    }),
  save: (
    record: CreatureRecord,
    data: CreatureRecord['data'],
    signature: string,
    scope: 'one' | 'all',
    portrait?: string,
  ) =>
    request<CreatureRecord>(
      `/bindings/${encodeURIComponent(record.id)}`,
      { data, baseVersion: record.version, bindingVersion: record.bindingVersion, signature, scope, portrait },
      'PUT',
    ),
  unbind: (id: string) => request<{ ok: boolean }>(`/bindings/${encodeURIComponent(id)}`, {}, 'DELETE'),
};
