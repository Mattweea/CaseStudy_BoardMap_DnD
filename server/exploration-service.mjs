import { mergeRegions, visibleRegions, clipRegions } from '../shared/explored-regions.mjs';
import { darkvisionToCells } from '../shared/vision.mjs';
import { collectVisionBlockers } from '../shared/scene-blockers.mjs';
export class ExplorationService {
  constructor(db, profiles) {
    this.db = db;
    this.profiles = profiles;
  }
  read(sceneId) {
    const row = this.db.prepare('SELECT * FROM explored_regions WHERE scene_id=?').get(sceneId);
    return row ? { regions: JSON.parse(row.regions_json), revision: row.revision } : { regions: [], revision: 0 };
  }
  remember(state, travels = []) {
    const sceneId = state.activeSceneId;
    if (!sceneId || state.isBoardFullyLit) return;
    const footprint = (t) => ({
      width: t.widthCells ?? { large: 2, huge: 3, gargantuan: 4 }[t.size] ?? 1,
      height: t.heightCells ?? { large: 2, huge: 3, gargantuan: 4 }[t.size] ?? 1,
    });
    const blockers = collectVisionBlockers(
      state.tokens,
      state.activeSceneElements ?? [],
      footprint,
      state.activeSceneWalls ?? [],
    );
    this.db.transaction(() => {
      const previous = this.read(sceneId);
      let regions = previous.regions;
      for (const token of state.tokens) {
        const profile = this.profiles.find((p) => p.id === token.ownerUserId || p.key === token.characterKey);
        if (token.type !== 'player' || token.isFamiliar || !profile || profile.role === 'master') continue;
        const radius = darkvisionToCells(profile.darkvision);
        const positions = travels.filter((t) => t.id === token.id).map((t) => t.position);
        for (const position of [...positions, token.position]) {
          regions = mergeRegions(
            regions,
            clipRegions(
              visibleRegions({ ...token, position }, radius, blockers, state.lightSources ?? []),
              state.boardDimensions,
            ),
          );
        }
      }
      if (JSON.stringify(regions) === JSON.stringify(previous.regions)) return;
      this.db
        .prepare(
          `INSERT INTO explored_regions(scene_id,revision,regions_json) VALUES(?,?,?)
    ON CONFLICT(scene_id) DO UPDATE SET revision=excluded.revision,regions_json=excluded.regions_json`,
        )
        .run(sceneId, previous.revision + 1, JSON.stringify(regions));
    })();
  }
}
