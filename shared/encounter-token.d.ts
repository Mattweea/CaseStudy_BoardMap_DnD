import type { UnitToken } from '../src/types';
import type { EncounterTokenProperties, SceneEncounterEntityReference, ScenePreparedPlacement } from './scene-model';

export type { EncounterTokenProperties } from './scene-model';

export function projectEncounterEntityToken(input: {
  entity: SceneEncounterEntityReference;
  placement: Pick<ScenePreparedPlacement, 'id' | 'entityReferenceId' | 'encounterId' | 'position'>;
  tokenProperties?: EncounterTokenProperties;
}): UnitToken;
