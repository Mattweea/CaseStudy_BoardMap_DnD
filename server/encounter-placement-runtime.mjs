import { projectEncounterEntityToken } from '../shared/encounter-token.mjs';

function preparedTokens(scene) {
  const entities = new Map((scene?.document.entityReferences ?? []).map((entity) => [entity.id, entity]));
  return new Map((scene?.document.preparedPlacements ?? []).flatMap((placement) => {
    const entity = entities.get(placement.entityReferenceId);
    return entity && ['monster', 'npc'].includes(entity.entityType)
      ? [[placement.id, projectEncounterEntityToken({ entity, placement })]] : [];
  }));
}

// Remembers only the last preparation projected during this process. Live movement,
// HP and removals never write back to preparation or get reset by unrelated scene edits.
export class EncounterPlacementRuntime {
  constructor() { this.preparations = new Map(); }
  clear() { this.preparations.clear(); }
  remember(scene) { if (scene) this.preparations.set(scene.id, preparedTokens(scene)); }
  project(scene, runtimeTokens) {
    if (!scene) return runtimeTokens;
    const previous = this.preparations.get(scene.id) ?? new Map();
    const next = preparedTokens(scene);
    const result = runtimeTokens.filter((token) => !previous.has(token.id) || next.has(token.id))
      .map((token) => {
        const before = previous.get(token.id), after = next.get(token.id);
        if (!before || !after) return token;
        const changed = Object.fromEntries(Object.entries(after).filter(([key, value]) =>
          JSON.stringify(value) !== JSON.stringify(before[key])));
        return { ...token, ...changed };
      });
    for (const [id, token] of next) {
      if (previous.has(id)) continue;
      if (result.some((existing) => existing.id === id)) throw new TypeError('Identificatore token già presente.');
      result.push(token);
    }
    return result;
  }
}
