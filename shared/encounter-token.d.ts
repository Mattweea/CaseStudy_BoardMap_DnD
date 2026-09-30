import type { UnitToken } from '../src/types';
import type { SceneEncounterEntityReference, ScenePreparedPlacement } from './scene-model';

export type EncounterTokenProperties = Partial<Pick<UnitToken,
  'size' | 'widthCells' | 'heightCells' | 'color' | 'initiativeModifier' |
  'movementCells' | 'hitPoints' | 'maxHitPoints' | 'isInvisible' | 'excludeFromInitiative'>>;

export function projectEncounterEntityToken(input: {
  entity: SceneEncounterEntityReference;
  placement: Pick<ScenePreparedPlacement, 'id' | 'entityReferenceId' | 'encounterId' | 'position'>;
  tokenProperties?: EncounterTokenProperties;
}): UnitToken;
