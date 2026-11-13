import { createContext, useContext, useEffect, useId } from 'react';
export interface SceneDraft {
  save: () => Promise<boolean>;
  discard: () => void;
}
export const SceneDraftContext = createContext<{ register: (id: string, draft: SceneDraft | null) => void } | null>(null);
/** Lets the enclosing wizard resolve field drafts before leaving an encounter editor. */
export function useSceneDraft(dirty: boolean, save: SceneDraft['save'], discard: SceneDraft['discard']) {
  const registry = useContext(SceneDraftContext);
  const id = useId();
  useEffect(() => { registry?.register(id, dirty ? { save, discard } : null); });
  useEffect(() => () => registry?.register(id, null), [registry, id]);
}
