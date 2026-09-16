import { randomUUID } from 'node:crypto';

export const ABILITY_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
export const SKILL_KEYS = [
  'acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight',
  'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance',
  'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival',
];
export const SPELL_LEVELS = Array.from({ length: 10 }, (_, index) => String(index));
export const PROFICIENCY_LEVELS = ['proficient', 'expertise', 'none'];
export const FEATURE_SOURCES = ['race', 'class', 'feat', 'background', 'item', 'other'];
export const COIN_KEYS = ['cp', 'sp', 'gp', 'pp'];
export const RESOURCE_BLOCKS = ['classResource', 'otherResource'];
export const RESOURCE_BLOCK_KEYS = ['name', 'total', 'current'];
export const MAX_TEXT_LENGTH = 20_000;

const characterScalarKeys = [
  'name', 'className', 'subclass', 'level', 'species', 'background', 'alignment', 'experience',
  'inspiration', 'proficiencyBonus', 'passivePerception', 'armorClass', 'initiativeModifier', 'speed',
  'equipmentTotalWeight', 'personalityTraits', 'ideals', 'bonds', 'flaws',
];
const storyKeys = [
  'name', 'age', 'height', 'weight', 'eyes', 'skin', 'hair', 'appearance',
  'alliesOrganizations', 'factionName', 'backstory', 'additionalFeatures', 'treasure',
];
const hitPointKeys = ['maximum', 'current', 'temporary'];
const hitDiceKeys = ['type', 'total', 'remaining'];
const deathSaveKeys = ['successes', 'failures'];
const spellKeys = ['id', 'name', 'status', 'notes'];
const spellHeaderKeys = ['spellcastingClass', 'spellcastingAbility', 'saveDc', 'attackBonus'];

// Ogni collezione ripetibile della tab Personaggio con i campi modificabili di una riga.
// Il valore 'text' indica testo libero, una lista indica l'insieme chiuso dei valori ammessi.
export const CHARACTER_COLLECTIONS = {
  attacks: { name: 'text', bonus: 'text', damageType: 'text', notes: 'text' },
  equipment: { quantity: 'text', name: 'text', weight: 'text' },
  tools: { name: 'text', proficiency: PROFICIENCY_LEVELS, ability: ['', ...ABILITY_KEYS], modifier: 'text' },
  languages: { name: 'text' },
  features: { name: 'text', source: FEATURE_SOURCES, description: 'text' },
  resources: null,
};
export const CHARACTER_COLLECTION_KEYS = Object.keys(CHARACTER_COLLECTIONS);

function valueMap(keys, factory = () => '') {
  return Object.fromEntries(keys.map((key) => [key, factory(key)]));
}

function defaultRow(collection) {
  return Object.fromEntries(Object.entries(CHARACTER_COLLECTIONS[collection]).map(([field, rule]) => [field, rule === 'text' ? '' : rule[0]]));
}

export function createRow(collection, overrides = {}) {
  if (collection === 'resources') return createResourceSection(overrides);
  return { id: randomUUID(), ...defaultRow(collection), ...overrides };
}

export function createAttack(overrides = {}) { return createRow('attacks', overrides); }
export function createEquipmentItem(overrides = {}) { return createRow('equipment', overrides); }
export function createTool(overrides = {}) { return createRow('tools', overrides); }
export function createLanguage(overrides = {}) { return createRow('languages', overrides); }
export function createFeature(overrides = {}) { return createRow('features', overrides); }

export function createResourceSection(overrides = {}) {
  return {
    id: randomUUID(),
    classResource: valueMap(RESOURCE_BLOCK_KEYS),
    otherResource: valueMap(RESOURCE_BLOCK_KEYS),
    ...overrides,
  };
}

export function createSpell(overrides = {}) {
  return { id: randomUUID(), name: '', status: '', notes: '', ...overrides };
}

export function createInitialCharacterSheetData(profile = {}) {
  return {
    schemaVersion: 1,
    character: {
      ...valueMap(characterScalarKeys),
      name: typeof profile.displayName === 'string' ? profile.displayName : '',
      initiativeModifier: Number.isFinite(profile.initiativeModifier) ? String(profile.initiativeModifier) : '',
      speed: typeof profile.movement === 'string' ? profile.movement : '',
      abilities: valueMap(ABILITY_KEYS, () => ({ score: '', modifier: '' })),
      savingThrows: valueMap(ABILITY_KEYS, () => ({ proficient: false, value: '' })),
      skills: valueMap(SKILL_KEYS, () => ({ proficient: false, value: '' })),
      hitPoints: valueMap(hitPointKeys),
      hitDice: valueMap(hitDiceKeys),
      deathSaves: valueMap(deathSaveKeys),
      attacks: [],
      equipment: [],
      tools: [],
      languages: [],
      features: [],
      resources: [createResourceSection()],
      currency: valueMap(COIN_KEYS),
    },
    story: {
      ...valueMap(storyKeys),
      name: typeof profile.displayName === 'string' ? profile.displayName : '',
    },
    spells: {
      ...valueMap(spellHeaderKeys),
      levels: valueMap(SPELL_LEVELS, () => ({ slotsTotal: '', slotsRemaining: '', spells: [] })),
    },
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys, path, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${path} deve essere un oggetto.`);
    return false;
  }
  const allowed = new Set(keys);
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) errors.push(`Campo sconosciuto: ${path}.${key}.`);
  });
  keys.forEach((key) => {
    if (!(key in value)) errors.push(`Campo mancante: ${path}.${key}.`);
  });
  return true;
}

function text(value, path, errors) {
  if (typeof value !== 'string') errors.push(`${path} deve essere testo.`);
  else if (value.length > MAX_TEXT_LENGTH) errors.push(`${path} supera ${MAX_TEXT_LENGTH} caratteri.`);
}

function boolean(value, path, errors) {
  if (typeof value !== 'boolean') errors.push(`${path} deve essere booleano.`);
}

function validateValueObject(value, keys, path, errors, validator = text) {
  if (!exactKeys(value, keys, path, errors)) return;
  keys.forEach((key) => validator(value[key], `${path}.${key}`, errors));
}

function validateRepeatable(rows, keys, path, errors, validateRow) {
  if (!Array.isArray(rows)) {
    errors.push(`${path} deve essere una lista.`);
    return;
  }
  const ids = new Set();
  rows.forEach((row, index) => {
    const rowPath = `${path}[${index}]`;
    if (!exactKeys(row, keys, rowPath, errors)) return;
    if (typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(row.id)) {
      errors.push(`${rowPath}.id non e un identificatore stabile valido.`);
    } else if (ids.has(row.id)) {
      errors.push(`${rowPath}.id e duplicato.`);
    } else ids.add(row.id);
    validateRow(row, rowPath, errors);
  });
}

function validateCollection(rows, collection, path, errors) {
  if (collection === 'resources') {
    validateRepeatable(rows, ['id', ...RESOURCE_BLOCKS], path, errors, (row, rowPath) => {
      RESOURCE_BLOCKS.forEach((block) => validateValueObject(row[block], RESOURCE_BLOCK_KEYS, `${rowPath}.${block}`, errors));
    });
    return;
  }
  const fields = CHARACTER_COLLECTIONS[collection];
  validateRepeatable(rows, ['id', ...Object.keys(fields)], path, errors, (row, rowPath) => {
    Object.entries(fields).forEach(([field, rule]) => {
      if (rule === 'text') text(row[field], `${rowPath}.${field}`, errors);
      else if (!rule.includes(row[field])) errors.push(`${rowPath}.${field} non e valido.`);
    });
  });
}

export function validateCharacterSheetData(data) {
  const errors = [];
  if (!exactKeys(data, ['schemaVersion', 'character', 'story', 'spells'], 'scheda', errors)) return errors;
  if (data.schemaVersion !== 1) errors.push('scheda.schemaVersion deve essere 1.');

  const characterKeys = [
    ...characterScalarKeys, 'abilities', 'savingThrows', 'skills', 'hitPoints', 'hitDice',
    'deathSaves', ...CHARACTER_COLLECTION_KEYS, 'currency',
  ];
  if (exactKeys(data.character, characterKeys, 'scheda.character', errors)) {
    characterScalarKeys.forEach((key) => text(data.character[key], `scheda.character.${key}`, errors));
    if (exactKeys(data.character.abilities, ABILITY_KEYS, 'scheda.character.abilities', errors)) {
      ABILITY_KEYS.forEach((key) => validateValueObject(data.character.abilities[key], ['score', 'modifier'], `scheda.character.abilities.${key}`, errors));
    }
    if (exactKeys(data.character.savingThrows, ABILITY_KEYS, 'scheda.character.savingThrows', errors)) {
      ABILITY_KEYS.forEach((key) => {
        const item = data.character.savingThrows[key];
        if (exactKeys(item, ['proficient', 'value'], `scheda.character.savingThrows.${key}`, errors)) {
          boolean(item.proficient, `scheda.character.savingThrows.${key}.proficient`, errors);
          text(item.value, `scheda.character.savingThrows.${key}.value`, errors);
        }
      });
    }
    if (exactKeys(data.character.skills, SKILL_KEYS, 'scheda.character.skills', errors)) {
      SKILL_KEYS.forEach((key) => {
        const item = data.character.skills[key];
        if (exactKeys(item, ['proficient', 'value'], `scheda.character.skills.${key}`, errors)) {
          boolean(item.proficient, `scheda.character.skills.${key}.proficient`, errors);
          text(item.value, `scheda.character.skills.${key}.value`, errors);
        }
      });
    }
    validateValueObject(data.character.hitPoints, hitPointKeys, 'scheda.character.hitPoints', errors);
    validateValueObject(data.character.hitDice, hitDiceKeys, 'scheda.character.hitDice', errors);
    validateValueObject(data.character.deathSaves, deathSaveKeys, 'scheda.character.deathSaves', errors);
    validateValueObject(data.character.currency, COIN_KEYS, 'scheda.character.currency', errors);
    CHARACTER_COLLECTION_KEYS.forEach((collection) => {
      validateCollection(data.character[collection], collection, `scheda.character.${collection}`, errors);
    });
  }

  if (exactKeys(data.story, storyKeys, 'scheda.story', errors)) {
    storyKeys.forEach((key) => text(data.story[key], `scheda.story.${key}`, errors));
  }

  if (exactKeys(data.spells, [...spellHeaderKeys, 'levels'], 'scheda.spells', errors)) {
    spellHeaderKeys.forEach((key) => text(data.spells[key], `scheda.spells.${key}`, errors));
    if (exactKeys(data.spells.levels, SPELL_LEVELS, 'scheda.spells.levels', errors)) {
      SPELL_LEVELS.forEach((level) => {
        const levelData = data.spells.levels[level];
        const levelPath = `scheda.spells.levels.${level}`;
        if (!exactKeys(levelData, ['slotsTotal', 'slotsRemaining', 'spells'], levelPath, errors)) return;
        text(levelData.slotsTotal, `${levelPath}.slotsTotal`, errors);
        text(levelData.slotsRemaining, `${levelPath}.slotsRemaining`, errors);
        validateRepeatable(levelData.spells, spellKeys, `${levelPath}.spells`, errors, (row, path) => {
          text(row.name, `${path}.name`, errors);
          text(row.notes, `${path}.notes`, errors);
          if (!['', 'prepared', 'known'].includes(row.status)) errors.push(`${path}.status non e valido.`);
        });
      });
    }
  }
  return errors;
}

export function assertValidCharacterSheetData(data) {
  const errors = validateCharacterSheetData(data);
  if (errors.length) throw new TypeError(errors.join(' '));
  return data;
}

function copyKnownText(target, source, keys) {
  if (!isPlainObject(source)) return;
  keys.forEach((key) => {
    if (typeof source[key] === 'string') target[key] = source[key].slice(0, MAX_TEXT_LENGTH);
  });
}

function normalizeRow(collection, row) {
  const id = typeof row.id === 'string' ? row.id : randomUUID();
  if (collection === 'resources') {
    const section = createResourceSection({ id });
    RESOURCE_BLOCKS.forEach((block) => copyKnownText(section[block], row[block], RESOURCE_BLOCK_KEYS));
    return section;
  }
  const fields = CHARACTER_COLLECTIONS[collection];
  const normalized = createRow(collection, { id });
  Object.entries(fields).forEach(([field, rule]) => {
    if (rule === 'text') { if (typeof row[field] === 'string') normalized[field] = row[field].slice(0, MAX_TEXT_LENGTH); }
    else if (rule.includes(row[field])) normalized[field] = row[field];
  });
  return normalized;
}

// I documenti scritti prima della riorganizzazione della tab Personaggio tengono il testo in un
// campo unico: ogni campo legacy riconosciuto diventa una riga della collezione corrispondente.
function adoptLegacyCharacter(target, source) {
  if (!isPlainObject(source)) return;
  if (!target.className && typeof source.classLevel === 'string') target.className = source.classLevel.slice(0, MAX_TEXT_LENGTH);
  if (!target.equipment.length && typeof source.equipment === 'string' && source.equipment.trim()) {
    target.equipment = [createEquipmentItem({ quantity: '1', name: source.equipment.slice(0, MAX_TEXT_LENGTH) })];
  }
  if (!target.languages.length && typeof source.proficienciesLanguages === 'string' && source.proficienciesLanguages.trim()) {
    target.languages = [createLanguage({ name: source.proficienciesLanguages.slice(0, MAX_TEXT_LENGTH) })];
  }
  if (!target.features.length && typeof source.featuresTraits === 'string' && source.featuresTraits.trim()) {
    target.features = [createFeature({ name: 'Privilegi e tratti', source: 'other', description: source.featuresTraits.slice(0, MAX_TEXT_LENGTH) })];
  }
}

export function normalizeCharacterSheetData(value, profile = {}) {
  const initial = createInitialCharacterSheetData(profile);
  if (!isPlainObject(value)) return initial;
  copyKnownText(initial.character, value.character, characterScalarKeys);
  copyKnownText(initial.story, value.story, storyKeys);
  copyKnownText(initial.spells, value.spells, spellHeaderKeys);
  for (const [target, source, keys] of [
    [initial.character.hitPoints, value.character?.hitPoints, hitPointKeys],
    [initial.character.hitDice, value.character?.hitDice, hitDiceKeys],
    [initial.character.deathSaves, value.character?.deathSaves, deathSaveKeys],
    [initial.character.currency, value.character?.currency, COIN_KEYS],
  ]) copyKnownText(target, source, keys);
  for (const key of ABILITY_KEYS) {
    copyKnownText(initial.character.abilities[key], value.character?.abilities?.[key], ['score', 'modifier']);
    copyKnownText(initial.character.savingThrows[key], value.character?.savingThrows?.[key], ['value']);
    if (typeof value.character?.savingThrows?.[key]?.proficient === 'boolean') initial.character.savingThrows[key].proficient = value.character.savingThrows[key].proficient;
  }
  for (const key of SKILL_KEYS) {
    copyKnownText(initial.character.skills[key], value.character?.skills?.[key], ['value']);
    if (typeof value.character?.skills?.[key]?.proficient === 'boolean') initial.character.skills[key].proficient = value.character.skills[key].proficient;
  }
  CHARACTER_COLLECTION_KEYS.forEach((collection) => {
    const rows = Array.isArray(value.character?.[collection]) ? value.character[collection] : [];
    initial.character[collection] = rows.flatMap((row) => isPlainObject(row) ? [normalizeRow(collection, row)] : []);
  });
  adoptLegacyCharacter(initial.character, value.character);
  if (!initial.character.resources.length) initial.character.resources = [createResourceSection()];
  SPELL_LEVELS.forEach((level) => {
    const source = value.spells?.levels?.[level];
    copyKnownText(initial.spells.levels[level], source, ['slotsTotal', 'slotsRemaining']);
    const rows = Array.isArray(source?.spells) ? source.spells : [];
    initial.spells.levels[level].spells = rows.flatMap((row) => isPlainObject(row) ? [createSpell({
      name: typeof row.name === 'string' ? row.name : '',
      status: ['', 'prepared', 'known'].includes(row.status) ? row.status : '',
      notes: typeof row.notes === 'string' ? row.notes : '',
      id: typeof row.id === 'string' ? row.id : randomUUID(),
    })] : []);
  });
  return assertValidCharacterSheetData(initial);
}

function setValueError(rule, value) {
  if (rule === 'text') return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH ? null : 'Valore patch non valido.';
  return rule.includes(value) ? null : 'Valore patch non valido.';
}

export function validatePatchOperation(operation) {
  if (!isPlainObject(operation) || !['set', 'add', 'remove'].includes(operation.op) || typeof operation.path !== 'string') {
    return 'Operazione patch non valida.';
  }
  const parts = operation.path.split('.');
  const [root, second] = parts;
  const isCharacterCollection = root === 'character' && CHARACTER_COLLECTION_KEYS.includes(second);
  const isSpellCollection = root === 'spells' && second === 'levels' && SPELL_LEVELS.includes(parts[2]) && parts[3] === 'spells';

  if (operation.op === 'set') {
    const textPaths = new Set([
      ...characterScalarKeys.map((key) => `character.${key}`),
      ...storyKeys.map((key) => `story.${key}`),
      ...spellHeaderKeys.map((key) => `spells.${key}`),
      ...hitPointKeys.map((key) => `character.hitPoints.${key}`),
      ...hitDiceKeys.map((key) => `character.hitDice.${key}`),
      ...deathSaveKeys.map((key) => `character.deathSaves.${key}`),
      ...COIN_KEYS.map((key) => `character.currency.${key}`),
      ...ABILITY_KEYS.flatMap((key) => [`character.abilities.${key}.score`, `character.abilities.${key}.modifier`, `character.savingThrows.${key}.value`]),
      ...SKILL_KEYS.map((key) => `character.skills.${key}.value`),
      ...SPELL_LEVELS.flatMap((level) => [`spells.levels.${level}.slotsTotal`, `spells.levels.${level}.slotsRemaining`]),
    ]);
    const booleanPaths = new Set([
      ...ABILITY_KEYS.map((key) => `character.savingThrows.${key}.proficient`),
      ...SKILL_KEYS.map((key) => `character.skills.${key}.proficient`),
    ]);
    if (textPaths.has(operation.path)) return setValueError('text', operation.value);
    if (booleanPaths.has(operation.path)) return typeof operation.value === 'boolean' ? null : 'Valore patch non valido.';
    if (isCharacterCollection && second === 'resources') {
      if (parts.length !== 5 || !RESOURCE_BLOCKS.includes(parts[3]) || !RESOURCE_BLOCK_KEYS.includes(parts[4])) return 'Percorso patch non ammesso.';
      return setValueError('text', operation.value);
    }
    if (isCharacterCollection && parts.length === 4) {
      const rule = CHARACTER_COLLECTIONS[second][parts[3]];
      return rule ? setValueError(rule, operation.value) : 'Percorso patch non ammesso.';
    }
    if (isSpellCollection && parts.length === 6) {
      const field = parts[5];
      if (field === 'status') return ['', 'prepared', 'known'].includes(operation.value) ? null : 'Valore patch non valido.';
      return ['name', 'notes'].includes(field) ? setValueError('text', operation.value) : 'Percorso patch non ammesso.';
    }
    return 'Percorso patch non ammesso.';
  }

  if (operation.op === 'add') {
    if (!(isCharacterCollection && parts.length === 2) && !(isSpellCollection && parts.length === 4)) return 'Percorso patch non ammesso.';
    const candidate = createInitialCharacterSheetData();
    if (isCharacterCollection) candidate.character[second] = [operation.value];
    else candidate.spells.levels[parts[2]].spells = [operation.value];
    return validateCharacterSheetData(candidate)[0] ?? null;
  }

  const removePath = (isCharacterCollection && parts.length === 3) || (isSpellCollection && parts.length === 5);
  return removePath ? null : 'Percorso patch non ammesso.';
}
