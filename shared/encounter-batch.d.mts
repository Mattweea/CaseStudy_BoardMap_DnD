import type { SceneDocument, ScenePreparedPlacement } from './scene-model';
export function planEncounterBatch(
  document: SceneDocument,
  encounterId: string,
  input: Partial<ScenePreparedPlacement> & { quantity?: number },
  makeId?: (index: number) => string,
): ScenePreparedPlacement[];
