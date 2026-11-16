import { createContext, useContext, useId, useLayoutEffect } from 'react';
export interface SceneDraft {
  save: () => Promise<boolean>;
  discard: () => void;
}
export const SceneDraftContext = createContext<{ register: (id: string, draft: SceneDraft | null) => void } | null>(null);
/** Lets the enclosing wizard resolve field drafts before leaving an encounter editor. */
export function useSceneDraft(dirty: boolean, save: SceneDraft['save'], discard: SceneDraft['discard']) {
  const registry = useContext(SceneDraftContext);
  const id = useId();
  // Il selettore può cambiare subito dopo un campo: il registro deve essere
  // aggiornato prima del prossimo gesto, anche quando un editor viene smontato.
  useLayoutEffect(() => { registry?.register(id, dirty ? { save, discard } : null); });
  useLayoutEffect(() => () => registry?.register(id, null), [registry, id]);
}
