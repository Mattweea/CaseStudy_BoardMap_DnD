import { createDefaultSceneDocument, normalizeSceneDocument } from '../shared/scene-model.mjs';
import { LOCAL_CAMPAIGN_ID } from './character-sheet-bootstrap.mjs';
import { SceneRepository } from './scene-repository.mjs';

export const INITIAL_SCENE_ID = 'initial-scene';
export const INITIAL_SCENE_NAME = 'Scena iniziale';

function legacyConfiguration(snapshot) {
  const state = snapshot?.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return createDefaultSceneDocument();
  }

  try {
    return normalizeSceneDocument({
      board: {
        diagonalRule: state.diagonalRule,
        measurementUnit: state.measurementUnit,
        isBackgroundHidden: state.isBoardBackgroundHidden,
        isFullyLit: state.isBoardFullyLit,
        lightSources: state.lightSources,
      },
    });
  } catch {
    return createDefaultSceneDocument();
  }
}

export function bootstrapScenes(
  db,
  { campaignId = LOCAL_CAMPAIGN_ID, legacySnapshot = null } = {},
) {
  const repository = new SceneRepository(db);
  const existing = repository.findByCampaign(campaignId);
  if (existing.length > 0) {
    return {
      created: false,
      scenes: existing,
      activeScene: repository.findActiveByCampaign(campaignId),
    };
  }

  const scene = repository.createAndActivate({
    id: INITIAL_SCENE_ID,
    campaignId,
    name: INITIAL_SCENE_NAME,
    document: legacyConfiguration(legacySnapshot),
  });
  return { created: true, scenes: [scene], activeScene: scene };
}
