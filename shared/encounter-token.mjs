import { SCENE_ENTITY_KINDS, SCENE_LIMITS } from './scene-model.mjs';
import { normalizeEncounterTokenProperties } from './encounter-token-properties.mjs';

function requireId(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > SCENE_LIMITS.maxIdLength) {
    throw new TypeError(`${label} deve essere un ID valido.`);
  }
  return value.trim();
}

export function projectEncounterEntityToken({ entity, placement, tokenProperties = {} }) {
  if (!entity || !SCENE_ENTITY_KINDS.includes(entity.entityType)
    || typeof entity.name !== 'string' || !entity.name.trim()) {
    throw new TypeError('Entità monster o npc non valida.');
  }
  const referenceId = requireId(entity.id, 'Il riferimento entità');
  if (!placement || requireId(placement.entityReferenceId, 'Il riferimento del placement') !== referenceId
    || requireId(placement.encounterId, 'L’encounter del placement')
      !== requireId(entity.encounterId, 'L’encounter dell’entità')) {
    throw new TypeError('Il placement deve riferirsi alla stessa entità e allo stesso encounter.');
  }
  const id = requireId(placement.id, 'Il placement');
  const { x, y } = placement.position ?? {};
  if (![x, y].every((value) => Number.isSafeInteger(value)
    && value >= 0 && value <= SCENE_LIMITS.maxCoordinateMagnitude)) {
    throw new TypeError('Il placement richiede coordinate valide non negative.');
  }
  const properties = normalizeEncounterTokenProperties({
    ...normalizeEncounterTokenProperties(entity.tokenProperties ?? {}),
    ...normalizeEncounterTokenProperties(tokenProperties),
  });
  const size = properties.size ?? 'medium';
  const widthCells = properties.widthCells ?? null;
  const heightCells = properties.heightCells ?? null;
  const initiativeModifier = properties.initiativeModifier ?? 0;
  const color = properties.color ?? (entity.entityType === 'monster' ? '#9b1f1b' : '#7f6ad6');
  const movementCells = properties.movementCells ?? null;
  const hitPoints = properties.hitPoints ?? null;
  const maxHitPoints = properties.maxHitPoints ?? null;

  return {
    id,
    name: entity.name.trim(),
    type: 'enemy',
    size,
    position: { x, y },
    widthCells,
    heightCells,
    color,
    initiativeModifier,
    initiativeMode: 'normal',
    movementCells,
    affiliation: entity.entityType === 'monster' ? 'enemy' : null,
    ownerUserId: null,
    characterKey: null,
    hitPoints,
    maxHitPoints,
    isInvisible: properties.isInvisible ?? false,
    excludeFromInitiative: properties.excludeFromInitiative ?? false,
    conditions: [],
  };
}
