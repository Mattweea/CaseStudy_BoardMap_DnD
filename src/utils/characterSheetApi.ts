import type { CharacterSheetPatchOperation, CharacterSheetRecord } from '../types/character-sheet';
import { API_BASE_URL } from './api';

export interface CharacterSheetRosterEntry {
  id: string;
  ownerUserId: string;
  portraitUrl: string | null;
  portraitUpdatedAt: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message ?? 'Richiesta scheda non riuscita.') as Error & { status?: number; payload?: unknown };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload as T;
}

export interface PublicPortraitEntry {
  id: string;
  ownerUserId: string;
  portraitUrl: string | null;
}

export const characterSheetApi = {
  list: () => request<{ sheets: CharacterSheetRosterEntry[] }>('/character-sheets'),
  publicRoster: () => request<{ sheets: PublicPortraitEntry[] }>('/character-sheets/public-roster'),
  get: (id: string) => request<CharacterSheetRecord & { persistence: { status: string; version: number; message: string | null } }>(`/character-sheets/${id}`),
  patch: (id: string, baseVersion: number, operations: CharacterSheetPatchOperation[]) => request<CharacterSheetRecord & { operations: CharacterSheetPatchOperation[] }>(`/character-sheets/${id}`, {
    method: 'PATCH', body: JSON.stringify({ baseVersion, operations }),
  }),
  flush: (id: string) => request<CharacterSheetRecord>(`/character-sheets/${id}/flush`, { method: 'POST', body: '{}' }),
  portrait: (id: string, file: File) => {
    const form = new FormData(); form.append('portrait', file);
    return request<CharacterSheetRecord>(`/character-sheets/${id}/portrait`, { method: 'POST', body: form });
  },
};
