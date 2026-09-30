const SIZES = new Set(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']);
const PROPERTY_KEYS = new Set([
  'size', 'widthCells', 'heightCells', 'color', 'initiativeModifier', 'movementCells',
  'hitPoints', 'maxHitPoints', 'isInvisible', 'excludeFromInitiative',
]);

export function normalizeEncounterTokenProperties(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !PROPERTY_KEYS.has(key))) {
    throw new TypeError('Proprietà token non supportate.');
  }
  const result = {};
  if (value.size !== undefined) {
    if (!SIZES.has(value.size)) throw new TypeError('Taglia token non supportata.');
    result.size = value.size;
  }
  for (const key of ['widthCells', 'heightCells']) {
    if (value[key] === undefined) continue;
    if (value[key] !== null && (!Number.isSafeInteger(value[key]) || value[key] < 1 || value[key] > 40)) {
      throw new TypeError('L’ingombro deve usare celle intere positive.');
    }
    result[key] = value[key];
  }
  if (value.color !== undefined) {
    if (typeof value.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.color)) {
      throw new TypeError('Colore token non valido.');
    }
    result.color = value.color;
  }
  if (value.initiativeModifier !== undefined) {
    if (!Number.isSafeInteger(value.initiativeModifier) || Math.abs(value.initiativeModifier) > 100) {
      throw new TypeError('Modificatore iniziativa non valido.');
    }
    result.initiativeModifier = value.initiativeModifier;
  }
  for (const [key, maximum] of [['movementCells', 1000], ['hitPoints', 100000], ['maxHitPoints', 100000]]) {
    if (value[key] === undefined) continue;
    if (value[key] !== null && (typeof value[key] !== 'number' || !Number.isFinite(value[key])
      || value[key] < 0 || value[key] > maximum)) {
      throw new TypeError(`${key} deve essere un numero finito valido.`);
    }
    result[key] = value[key];
  }
  for (const key of ['isInvisible', 'excludeFromInitiative']) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== 'boolean') throw new TypeError(`${key} deve essere booleano.`);
    result[key] = value[key];
  }
  return result;
}
