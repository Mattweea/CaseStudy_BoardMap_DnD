import { useCallback, useEffect, useRef, useState } from 'react';
import type { CharacterCollectionKey, CharacterSheetData, CharacterSheetPatchOperation, CharacterSheetRecord } from '../types/character-sheet';
import { characterSheetApi } from '../utils/characterSheetApi';

export type CharacterSheetSaveState = 'loading' | 'editing' | 'saving' | 'saved' | 'error';
export interface SheetConflict { path: string; version: number; value: unknown; localValue: unknown }

function collectionAt(data: CharacterSheetData, parts: string[]): Array<{ id: string }> {
  return parts[0] === 'character'
    ? data.character[parts[1] as CharacterCollectionKey] as unknown as Array<{ id: string }>
    : data.spells.levels[parts[2] as keyof typeof data.spells.levels].spells;
}

function applyOperation(data: CharacterSheetData, operation: CharacterSheetPatchOperation) {
  const parts = operation.path.split('.');
  if (operation.op === 'add') {
    collectionAt(data, parts).push(structuredClone(operation.value)); return;
  }
  if (operation.op === 'remove') {
    const collection = collectionAt(data, parts);
    const index = collection.findIndex((item) => item.id === parts[parts.length - 1]);
    if (index >= 0) collection.splice(index, 1); return;
  }
  let current: unknown = data;
  for (const part of parts.slice(0, -1)) {
    if (Array.isArray(current)) current = current.find((item: { id?: string }) => item.id === part);
    else current = (current as Record<string, unknown>)[part];
  }
  (current as Record<string, unknown>)[parts[parts.length - 1]] = operation.value;
}

function operationKey(operation: CharacterSheetPatchOperation) {
  return operation.op === 'add' ? `${operation.path}.${operation.value.id}` : operation.path;
}

export function useCharacterSheet(sheetId: string | null, isOpen: boolean) {
  const [sheet, setSheet] = useState<CharacterSheetRecord | null>(null);
  const [draft, setDraft] = useState<CharacterSheetData | null>(null);
  const [saveState, setSaveState] = useState<CharacterSheetSaveState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SheetConflict[]>([]);
  const versionRef = useRef(0);
  const pendingRef = useRef(new Map<string, CharacterSheetPatchOperation>());
  const timerRef = useRef<number | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!sheetId || !isOpen) return;
    let active = true;
    setSaveState('loading'); setError(null); setConflicts([]); pendingRef.current.clear();
    void characterSheetApi.get(sheetId).then((record) => {
      if (!active) return;
      versionRef.current = record.version; setSheet(record); setDraft(record.data); setSaveState(record.persistence.status === 'error' ? 'error' : 'saved');
    }).catch((reason: Error) => { if (active) { setError(reason.message); setSaveState('error'); } });
    return () => { active = false; };
  }, [isOpen, sheetId]);

  const sendPending = useCallback(async () => {
    if (!sheetId || pendingRef.current.size === 0) return;
    const operations = [...pendingRef.current.values()];
    pendingRef.current.clear();
    setSaveState('saving');
    try {
      const response = await characterSheetApi.patch(sheetId, versionRef.current, operations);
      if (response.version >= versionRef.current) {
        versionRef.current = response.version; setSheet(response); setConflicts([]); setError(null);
      }
      setSaveState(pendingRef.current.size ? 'editing' : 'saving');
    } catch (reason) {
      const requestError = reason as Error & { status?: number; payload?: { conflicts?: Array<{ path: string; version: number; value: unknown }> } };
      setError(requestError.message); setSaveState('error');
      if (requestError.status === 409) {
        setConflicts((requestError.payload?.conflicts ?? []).map((conflict) => {
          const localOperation = operations.find((operation) => operationKey(operation).startsWith(conflict.path));
          return {
            ...conflict,
            localValue: localOperation && 'value' in localOperation ? localOperation.value : null,
          };
        }));
      } else operations.forEach((operation) => pendingRef.current.set(operationKey(operation), operation));
    }
  }, [sheetId]);

  const scheduleSend = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      queueRef.current = queueRef.current.then(sendPending, sendPending);
    }, 280);
  }, [sendPending]);

  const patch = useCallback((operation: CharacterSheetPatchOperation) => {
    setDraft((current) => {
      if (!current) return current;
      const next = structuredClone(current); applyOperation(next, operation); return next;
    });
    pendingRef.current.set(operationKey(operation), operation);
    setSaveState('editing'); setError(null); scheduleSend();
  }, [scheduleSend]);

  const flush = useCallback(async () => {
    if (!sheetId) return;
    if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    await sendPending(); await queueRef.current;
    try { const response = await characterSheetApi.flush(sheetId); setSheet(response); setSaveState('saved'); }
    catch (reason) { setError((reason as Error).message); setSaveState('error'); }
  }, [sendPending, sheetId]);

  const uploadPortrait = useCallback(async (file: File) => {
    if (!sheetId) return;
    setSaveState('saving');
    try { const response = await characterSheetApi.portrait(sheetId, file); setSheet(response); setSaveState('saved'); }
    catch (reason) { setError((reason as Error).message); setSaveState('error'); }
  }, [sheetId]);

  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent).detail as { type: string; sheetId: string; version?: number; operations?: CharacterSheetPatchOperation[]; status?: string; message?: string };
      if (!sheetId || detail.sheetId !== sheetId) return;
      if (detail.type === 'character-sheet-patch' && detail.operations && (detail.version ?? 0) > versionRef.current) {
        versionRef.current = detail.version!;
        setDraft((current) => {
          if (!current) return current;
          const next = structuredClone(current);
          detail.operations!.forEach((operation) => { if (!pendingRef.current.has(operationKey(operation))) applyOperation(next, operation); });
          return next;
        });
      }
      if (detail.type === 'character-sheet-persistence') {
        setSaveState(detail.status === 'saved' ? 'saved' : 'error'); if (detail.message) setError(detail.message);
      }
    };
    window.addEventListener('vtt:character-sheet-event', handle);
    return () => window.removeEventListener('vtt:character-sheet-event', handle);
  }, [sheetId]);

  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); }, []);
  return { sheet, draft, saveState, error, conflicts, patch, flush, uploadPortrait };
}
