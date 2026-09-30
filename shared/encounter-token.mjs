import { SCENE_ENTITY_KINDS, SCENE_LIMITS } from './scene-model.mjs';

const SIZES = new Set(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']);
const PROPERTY_KEYS = new Set([
  'size', 'widthCells', 'heightCells', 'color', 'initiativeModifier', 'movementCells',
  'hitPoints', 'maxHitPoints', 'isInvisible', 'excludeFromInitiative',
]);

function requireId(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > SCENE_LIMITS.maxIdLength) {
    throw new TypeError(`${label} deve essere un ID valido.`);
  }
  return value.trim();
}

function optionalNumber(value, label, maximum) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    throw new TypeError(`${label} deve essere un numero finito valido.`);
  }
  return value;
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
  if (!tokenProperties || typeof tokenProperties !== 'object' || Array.isArray(tokenProperties)
    || Object.keys(tokenProperties).some((key) => !PROPERTY_KEYS.has(key))) {
    throw new TypeError('Proprietà token non supportate.');
  }
  const size = tokenProperties.size ?? 'medium';
  if (!SIZES.has(size)) throw new TypeError('Taglia token non supportata.');
  const widthCells = optionalNumber(tokenProperties.widthCells, 'Larghezza', 40);
  const heightCells = optionalNumber(tokenProperties.heightCells, 'Altezza', 40);
  if ((widthCells !== null && !Number.isSafeInteger(widthCells))
    || (heightCells !== null && !Number.isSafeInteger(heightCells))
    || widthCells === 0 || heightCells === 0) {
    throw new TypeError('L’ingombro deve usare celle intere positive.');
  }
  const initiativeModifier = tokenProperties.initiativeModifier ?? 0;
  if (!Number.isSafeInteger(initiativeModifier) || Math.abs(initiativeModifier) > 100) {
    throw new TypeError('Modificatore iniziativa non valido.');
  }
  const color = tokenProperties.color ?? (entity.entityType === 'monster' ? '#9b1f1b' : '#7f6ad6');
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new TypeError('Colore token non valido.');
  }
  for (const key of ['isInvisible', 'excludeFromInitiative']) {
    if (tokenProperties[key] !== undefined && typeof tokenProperties[key] !== 'boolean') {
      throw new TypeError(`${key} deve essere booleano.`);
    }
  }
  const movementCells = optionalNumber(tokenProperties.movementCells, 'Movimento', 1000);
  const hitPoints = optionalNumber(tokenProperties.hitPoints, 'Punti ferita', 100000);
  const maxHitPoints = optionalNumber(tokenProperties.maxHitPoints, 'Punti ferita massimi', 100000);

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
    isInvisible: tokenProperties.isInvisible ?? false,
    excludeFromInitiative: tokenProperties.excludeFromInitiative ?? false,
    conditions: [],
  };
}
