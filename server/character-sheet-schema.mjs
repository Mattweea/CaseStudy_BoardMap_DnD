import { randomUUID } from 'node:crypto';
import {
  ABILITY_KEYS, SKILL_KEYS, SKILL_ABILITY, isIntegerText,
  computeSavingThrowValue, computeSkillValue, computeInitiative, computeSpellSaveDc, computeSpellAttackBonus,
} from '../shared/dnd-rules.mjs';

export { ABILITY_KEYS, SKILL_KEYS };
export const SPELL_LEVELS = Array.from({ length: 10 }, (_, index) => String(index));
export const PROFICIENCY_LEVELS = ['none', 'proficient', 'expertise'];
export const FEATURE_SOURCES = ['race', 'class', 'feat', 'background', 'item', 'other'];
export const COIN_KEYS = ['cp', 'sp', 'gp', 'pp'];
export const RESOURCE_BLOCKS = ['classResource', 'otherResource'];
export const RESOURCE_BLOCK_KEYS = ['name', 'total', 'current'];
export const HIT_DICE_TYPES = ['', 'd4', 'd6', 'd8', 'd10', 'd12'];
// Tipi di danno del regolamento 5e: elenco chiuso, coerente sui due blocchi di danno di un attacco.
export const DAMAGE_TYPES = [
  '', 'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
];
export const DEATH_SAVE_COUNTS = ['0', '1', '2', '3'];
export const SPELLCASTING_ABILITIES = ['', ...ABILITY_KEYS];
export const ABILITY_OR_NONE = ['', ...ABILITY_KEYS];
export const MAX_TEXT_LENGTH = 20_000;

// Ogni campo di caratteristica di uno strumento o di un attacco può restare non scelto ('')
// oppure puntare a una delle sei caratteristiche: stesso dominio ovunque compaia la scelta.
const characterScalarKeys = [
  'name', 'className', 'subclass', 'species', 'background', 'alignment', 'experience',
  'armorClass', 'speed', 'equipmentTotalWeight', 'personalityTraits', 'ideals', 'bonds', 'flaws',
];
const storyKeys = [
  'name', 'age', 'height', 'weight', 'eyes', 'skin', 'hair', 'appearance',
  'alliesOrganizations', 'factionName', 'backstory', 'additionalFeatures', 'treasure',
];
const hitPointKeys = ['maximum', 'current', 'temporary'];
const deathSaveKeys = ['successes', 'failures'];
const spellKeys = ['id', 'name', 'status', 'notes'];
// spellcastingAbility ha un dominio proprio (le sei caratteristiche o non scelta): validato a parte.
const spellHeaderKeys = ['spellcastingClass', 'saveDcMiscBonus', 'attackMiscBonus'];
const sectionLockKeys = ['attacks', 'tools'];

// Ogni collezione ripetibile della tab Personaggio con i campi modificabili di una riga.
// Il valore 'text' indica testo libero, 'boolean' un booleano, 'integer' un intero libero
// (nessun tetto), una lista indica l'insieme chiuso dei valori ammessi.
export const CHARACTER_COLLECTIONS = {
  attacks: {
    name: 'text',
    attackEnabled: 'boolean', attackAbility: ABILITY_OR_NONE, attackBonus: 'text', attackProficient: 'boolean',
    range: 'text', magicBonus: 'text', critRange: 'integer',
    damageEnabled: 'boolean', damageDice: 'text', damageAbility: ABILITY_OR_NONE, damageBonus: 'text', damageType: DAMAGE_TYPES, damageCritDice: 'text',
    damage2Enabled: 'boolean', damage2Dice: 'text', damage2Ability: ABILITY_OR_NONE, damage2Bonus: 'text', damage2Type: DAMAGE_TYPES, damage2CritDice: 'text',
    saveEnabled: 'boolean', saveAbility: ABILITY_OR_NONE, saveDc: 'text', saveEffect: 'text',
    description: 'text',
  },
  equipment: { quantity: 'text', name: 'text', weight: 'text' },
  tools: { name: 'text', proficiency: PROFICIENCY_LEVELS, ability: ABILITY_OR_NONE, bonus: 'text' },
  languages: { name: 'text' },
  features: { name: 'text', source: FEATURE_SOURCES, description: 'text' },
  resources: null,
};
export const CHARACTER_COLLECTION_KEYS = Object.keys(CHARACTER_COLLECTIONS);

// Scostamenti dal predefinito generico del dominio: la soglia di critico parte da 20, non da 0.
const COLLECTION_FIELD_DEFAULTS = { attacks: { critRange: '20', damageEnabled: true } };

const defaultForRule = (rule) => {
  if (rule === 'text') return '';
  if (rule === 'boolean') return false;
  if (rule === 'integer') return '0';
  return rule[0];
};

function valueMap(keys, factory = () => '') {
  return Object.fromEntries(keys.map((key) => [key, factory(key)]));
}

function defaultRow(collection) {
  const overrides = COLLECTION_FIELD_DEFAULTS[collection] ?? {};
  return Object.fromEntries(Object.entries(CHARACTER_COLLECTIONS[collection]).map(([field, rule]) => [field, overrides[field] ?? defaultForRule(rule)]));
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
      speed: typeof profile.movement === 'string' ? profile.movement : '',
      inspiration: false,
      level: '1',
      initiativeMiscBonus: '',
      abilities: valueMap(ABILITY_KEYS, () => ({ score: '10' })),
      savingThrows: valueMap(ABILITY_KEYS, () => ({ proficient: false, miscBonus: '' })),
      skills: valueMap(SKILL_KEYS, () => ({ proficiency: 'none', miscBonus: '' })),
      hitPoints: valueMap(hitPointKeys),
      hitDice: { type: '', total: '', remaining: '' },
      deathSaves: { successes: '0', failures: '0' },
      attacks: [],
      equipment: [],
      tools: [],
      languages: [],
      features: [],
      resources: [createResourceSection()],
      currency: valueMap(COIN_KEYS),
      sectionLocks: { attacks: false, tools: false },
    },
    story: {
      ...valueMap(storyKeys),
      name: typeof profile.displayName === 'string' ? profile.displayName : '',
    },
    spells: {
      ...valueMap(spellHeaderKeys),
      spellcastingAbility: '',
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

function integer(value, path, errors) {
  if (!isIntegerText(value)) errors.push(`${path} deve essere un intero.`);
}

// Vocabolario condiviso da collezioni e oggetti a chiave: 'text' | 'boolean' | 'integer' | dominio chiuso.
function validateField(rule, value, path, errors) {
  if (rule === 'text') text(value, path, errors);
  else if (rule === 'boolean') boolean(value, path, errors);
  else if (rule === 'integer') integer(value, path, errors);
  else if (!rule.includes(value)) errors.push(`${path} non e valido.`);
}

function validateValueObject(value, fields, path, errors) {
  const keys = Array.isArray(fields) ? fields : Object.keys(fields);
  if (!exactKeys(value, keys, path, errors)) return;
  keys.forEach((key) => {
    const rule = Array.isArray(fields) ? 'text' : fields[key];
    validateField(rule, value[key], `${path}.${key}`, errors);
  });
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
    Object.entries(fields).forEach(([field, rule]) => validateField(rule, row[field], `${rowPath}.${field}`, errors));
  });
}

export function validateCharacterSheetData(data) {
  const errors = [];
  if (!exactKeys(data, ['schemaVersion', 'character', 'story', 'spells'], 'scheda', errors)) return errors;
  if (data.schemaVersion !== 1) errors.push('scheda.schemaVersion deve essere 1.');

  const characterKeys = [
    ...characterScalarKeys, 'inspiration', 'level', 'initiativeMiscBonus', 'abilities', 'savingThrows', 'skills',
    'hitPoints', 'hitDice', 'deathSaves', ...CHARACTER_COLLECTION_KEYS, 'currency', 'sectionLocks',
  ];
  if (exactKeys(data.character, characterKeys, 'scheda.character', errors)) {
    characterScalarKeys.forEach((key) => text(data.character[key], `scheda.character.${key}`, errors));
    boolean(data.character.inspiration, 'scheda.character.inspiration', errors);
    integer(data.character.level, 'scheda.character.level', errors);
    text(data.character.initiativeMiscBonus, 'scheda.character.initiativeMiscBonus', errors);
    if (exactKeys(data.character.abilities, ABILITY_KEYS, 'scheda.character.abilities', errors)) {
      ABILITY_KEYS.forEach((key) => validateValueObject(data.character.abilities[key], { score: 'integer' }, `scheda.character.abilities.${key}`, errors));
    }
    if (exactKeys(data.character.savingThrows, ABILITY_KEYS, 'scheda.character.savingThrows', errors)) {
      ABILITY_KEYS.forEach((key) => validateValueObject(data.character.savingThrows[key], { proficient: 'boolean', miscBonus: 'text' }, `scheda.character.savingThrows.${key}`, errors));
    }
    if (exactKeys(data.character.skills, SKILL_KEYS, 'scheda.character.skills', errors)) {
      SKILL_KEYS.forEach((key) => validateValueObject(data.character.skills[key], { proficiency: PROFICIENCY_LEVELS, miscBonus: 'text' }, `scheda.character.skills.${key}`, errors));
    }
    validateValueObject(data.character.hitPoints, hitPointKeys, 'scheda.character.hitPoints', errors);
    validateValueObject(data.character.hitDice, { type: HIT_DICE_TYPES, total: 'text', remaining: 'text' }, 'scheda.character.hitDice', errors);
    validateValueObject(data.character.deathSaves, { successes: DEATH_SAVE_COUNTS, failures: DEATH_SAVE_COUNTS }, 'scheda.character.deathSaves', errors);
    validateValueObject(data.character.currency, COIN_KEYS, 'scheda.character.currency', errors);
    validateValueObject(data.character.sectionLocks, { attacks: 'boolean', tools: 'boolean' }, 'scheda.character.sectionLocks', errors);
    CHARACTER_COLLECTION_KEYS.forEach((collection) => {
      validateCollection(data.character[collection], collection, `scheda.character.${collection}`, errors);
    });
  }

  if (exactKeys(data.story, storyKeys, 'scheda.story', errors)) {
    storyKeys.forEach((key) => text(data.story[key], `scheda.story.${key}`, errors));
  }

  if (exactKeys(data.spells, [...spellHeaderKeys, 'spellcastingAbility', 'levels'], 'scheda.spells', errors)) {
    spellHeaderKeys.forEach((key) => text(data.spells[key], `scheda.spells.${key}`, errors));
    if (!SPELLCASTING_ABILITIES.includes(data.spells.spellcastingAbility)) errors.push('scheda.spells.spellcastingAbility non e valido.');
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

function copyKnownField(target, source, field, rule) {
  if (!isPlainObject(source) || !(field in source)) return;
  const value = source[field];
  if (rule === 'text') { if (typeof value === 'string') target[field] = value.slice(0, MAX_TEXT_LENGTH); }
  else if (rule === 'boolean') { if (typeof value === 'boolean') target[field] = value; }
  else if (rule === 'integer') { if (isIntegerText(value)) target[field] = value; }
  else if (rule.includes(value)) target[field] = value;
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
  Object.entries(fields).forEach(([field, rule]) => copyKnownField(normalized, row, field, rule));
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

const ABILITY_NAME_LOOKUP = {
  forza: 'strength', for: 'strength', str: 'strength', strength: 'strength',
  destrezza: 'dexterity', des: 'dexterity', dex: 'dexterity', dexterity: 'dexterity',
  costituzione: 'constitution', cos: 'constitution', con: 'constitution', constitution: 'constitution',
  intelligenza: 'intelligence', int: 'intelligence', intelligence: 'intelligence',
  saggezza: 'wisdom', sag: 'wisdom', wis: 'wisdom', wisdom: 'wisdom',
  carisma: 'charisma', car: 'charisma', cha: 'charisma', charisma: 'charisma',
};

// Riconosce una caratteristica da un testo libero confrontandolo con nomi e abbreviazioni
// italiani e inglesi. Nessuna corrispondenza parziale: solo un'uguaglianza esatta dopo la
// normalizzazione, per non reinterpretare un testo ambiguo.
function recognizeAbility(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return ABILITY_NAME_LOOKUP[normalized] ?? '';
}

// Bonus vari per differenza: se il vecchio valore non è un intero, il bonus resta vuoto.
function miscBonusFromDifference(oldValue, computedBase) {
  if (!isIntegerText(oldValue) || computedBase === null) return '';
  return String(Number.parseInt(oldValue, 10) - computedBase);
}

function normalizeAbilityScore(source) {
  if (isIntegerText(source?.score)) return source.score.trim();
  if (isIntegerText(source?.modifier)) return String(10 + 2 * Number.parseInt(source.modifier, 10));
  return '10';
}

function normalizeLevel(source) {
  if (isIntegerText(source?.level)) return source.level.trim();
  if (isIntegerText(source?.proficiencyBonus)) {
    const bonus = Number.parseInt(source.proficiencyBonus, 10);
    if (bonus >= 2) return String((bonus - 2) * 4 + 1);
  }
  return '1';
}

function normalizeHitDiceType(value) {
  if (HIT_DICE_TYPES.includes(value)) return value;
  if (typeof value === 'string') {
    const match = value.toLowerCase().match(/d(4|6|8|10|12)/);
    if (match) return `d${match[1]}`;
  }
  return '';
}

function normalizeDeathSaveCount(value) {
  if (DEATH_SAVE_COUNTS.includes(value)) return value;
  const parsed = isIntegerText(value) ? Number.parseInt(value, 10) : null;
  return parsed !== null && parsed >= 0 && parsed <= 3 ? String(parsed) : '0';
}

export function normalizeCharacterSheetData(value, profile = {}) {
  const initial = createInitialCharacterSheetData(profile);
  if (!isPlainObject(value)) return initial;
  copyKnownText(initial.character, value.character, characterScalarKeys);
  copyKnownText(initial.story, value.story, storyKeys);
  // Ispirazione era testo libero prima di questa change: un booleano esplicito vince, un vecchio
  // testo non vuoto diventa "posseduta" per non perdere silenziosamente l'informazione visibile.
  const legacyInspiration = value.character?.inspiration;
  initial.character.inspiration = typeof legacyInspiration === 'boolean' ? legacyInspiration : Boolean(String(legacyInspiration ?? '').trim());
  copyKnownText(initial.spells, value.spells, spellHeaderKeys);

  // 1. Punteggi delle caratteristiche, ricostruiti dal vecchio modificatore quando serve.
  for (const key of ABILITY_KEYS) {
    initial.character.abilities[key].score = normalizeAbilityScore(value.character?.abilities?.[key]);
  }
  // 2. Livello, ricostruito dal vecchio bonus di competenza quando serve.
  initial.character.level = normalizeLevel(value.character);
  const level = initial.character.level;

  // 3. Bonus vari per differenza fra il vecchio valore e il calcolo dai nuovi input.
  for (const key of ABILITY_KEYS) {
    const legacySave = value.character?.savingThrows?.[key];
    const proficient = typeof legacySave?.proficient === 'boolean' ? legacySave.proficient : false;
    initial.character.savingThrows[key].proficient = proficient;
    const computedBase = computeSavingThrowValue({ score: initial.character.abilities[key].score, proficient, level, miscBonus: '' });
    initial.character.savingThrows[key].miscBonus = miscBonusFromDifference(legacySave?.value, computedBase);
  }
  for (const key of SKILL_KEYS) {
    const legacySkill = value.character?.skills?.[key];
    // 4. Competenza booleana delle abilità verso i tre livelli.
    const proficiency = typeof legacySkill?.proficient === 'boolean' ? (legacySkill.proficient ? 'proficient' : 'none') : 'none';
    initial.character.skills[key].proficiency = proficiency;
    const abilityKey = SKILL_ABILITY[key];
    const computedBase = computeSkillValue({ score: initial.character.abilities[abilityKey].score, proficiency, level, miscBonus: '' });
    initial.character.skills[key].miscBonus = miscBonusFromDifference(legacySkill?.value, computedBase);
  }
  {
    const dexScore = initial.character.abilities.dexterity.score;
    const legacyInitiative = value.character?.initiativeModifier;
    const computedBase = computeInitiative({ dexScore, miscBonus: '' });
    initial.character.initiativeMiscBonus = miscBonusFromDifference(legacyInitiative, computedBase);
  }

  // 5. Attacchi, strumenti, dado vita e salvataggi contro morte.
  CHARACTER_COLLECTION_KEYS.forEach((collection) => {
    const rows = Array.isArray(value.character?.[collection]) ? value.character[collection] : [];
    initial.character[collection] = rows.flatMap((row) => isPlainObject(row) ? [normalizeLegacyRow(collection, row)] : []);
  });
  adoptLegacyCharacter(initial.character, value.character);
  if (!initial.character.resources.length) initial.character.resources = [createResourceSection()];

  if (isPlainObject(value.character?.sectionLocks)) {
    sectionLockKeys.forEach((key) => {
      if (typeof value.character.sectionLocks[key] === 'boolean') initial.character.sectionLocks[key] = value.character.sectionLocks[key];
    });
  }

  initial.character.hitDice.type = normalizeHitDiceType(value.character?.hitDice?.type);
  copyKnownText(initial.character.hitDice, value.character?.hitDice, ['total', 'remaining']);
  initial.character.deathSaves.successes = normalizeDeathSaveCount(value.character?.deathSaves?.successes);
  initial.character.deathSaves.failures = normalizeDeathSaveCount(value.character?.deathSaves?.failures);
  copyKnownText(initial.character.currency, value.character?.currency, COIN_KEYS);
  copyKnownText(initial.character.hitPoints, value.character?.hitPoints, hitPointKeys);

  // 6. Valori da incantatore: riconoscimento della caratteristica dal testo libero.
  const recognizedAbility = recognizeAbility(value.spells?.spellcastingAbility);
  initial.spells.spellcastingAbility = recognizedAbility;
  if (recognizedAbility) {
    const score = initial.character.abilities[recognizedAbility].score;
    initial.spells.saveDcMiscBonus = miscBonusFromDifference(value.spells?.saveDc, computeSpellSaveDc({ score, level, miscBonus: '' }));
    initial.spells.attackMiscBonus = miscBonusFromDifference(value.spells?.attackBonus, computeSpellAttackBonus({ score, level, miscBonus: '' }));
  } else {
    initial.spells.saveDcMiscBonus = '';
    initial.spells.attackMiscBonus = '';
  }

  SPELL_LEVELS.forEach((spellLevel) => {
    const source = value.spells?.levels?.[spellLevel];
    copyKnownText(initial.spells.levels[spellLevel], source, ['slotsTotal', 'slotsRemaining']);
    const rows = Array.isArray(source?.spells) ? source.spells : [];
    initial.spells.levels[spellLevel].spells = rows.flatMap((row) => isPlainObject(row) ? [createSpell({
      name: typeof row.name === 'string' ? row.name : '',
      status: ['', 'prepared', 'known'].includes(row.status) ? row.status : '',
      notes: typeof row.notes === 'string' ? row.notes : '',
      id: typeof row.id === 'string' ? row.id : randomUUID(),
    })] : []);
  });
  return assertValidCharacterSheetData(initial);
}

// Converte una riga di attacco o di strumento dal formato precedente. Le altre collezioni
// non sono cambiate e passano dal normalizeRow generico.
function normalizeLegacyRow(collection, row) {
  if (collection === 'attacks') {
    const id = typeof row.id === 'string' ? row.id : randomUUID();
    const normalized = createRow('attacks', { id });
    // Un documento del formato precedente non ha mai 'attackEnabled': il suo 'damageType'
    // era il testo combinato «danno / tipo» e va in damageDice, non nel nuovo campo type.
    const isLegacyShape = !('attackEnabled' in row);
    Object.entries(CHARACTER_COLLECTIONS.attacks).forEach(([field, rule]) => {
      if (isLegacyShape && field === 'damageType') return;
      copyKnownField(normalized, row, field, rule);
    });
    if (isLegacyShape) {
      if (typeof row.bonus === 'string' && row.bonus.trim()) {
        normalized.attackBonus = row.bonus.slice(0, MAX_TEXT_LENGTH);
        normalized.attackEnabled = true;
      }
      if (typeof row.damageType === 'string' && row.damageType.trim()) {
        normalized.damageDice = row.damageType.slice(0, MAX_TEXT_LENGTH);
        normalized.damageEnabled = true;
      }
      if (typeof row.notes === 'string') normalized.description = row.notes.slice(0, MAX_TEXT_LENGTH);
    }
    return normalized;
  }
  if (collection === 'tools') {
    const id = typeof row.id === 'string' ? row.id : randomUUID();
    const normalized = createRow('tools', { id });
    Object.entries(CHARACTER_COLLECTIONS.tools).forEach(([field, rule]) => copyKnownField(normalized, row, field, rule));
    if (!('bonus' in row) && typeof row.modifier === 'string') normalized.bonus = row.modifier.slice(0, MAX_TEXT_LENGTH);
    return normalized;
  }
  return normalizeRow(collection, row);
}

function setValueError(rule, value) {
  if (rule === 'text') return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH ? null : 'Valore patch non valido.';
  if (rule === 'boolean') return typeof value === 'boolean' ? null : 'Valore patch non valido.';
  if (rule === 'integer') return isIntegerText(value) ? null : 'Valore patch non valido.';
  return rule.includes(value) ? null : 'Valore patch non valido.';
}

function buildScalarFieldRules() {
  const rules = {};
  characterScalarKeys.forEach((key) => { rules[`character.${key}`] = 'text'; });
  rules['character.inspiration'] = 'boolean';
  rules['character.level'] = 'integer';
  rules['character.initiativeMiscBonus'] = 'text';
  storyKeys.forEach((key) => { rules[`story.${key}`] = 'text'; });
  spellHeaderKeys.forEach((key) => { rules[`spells.${key}`] = 'text'; });
  rules['spells.spellcastingAbility'] = SPELLCASTING_ABILITIES;
  hitPointKeys.forEach((key) => { rules[`character.hitPoints.${key}`] = 'text'; });
  rules['character.hitDice.type'] = HIT_DICE_TYPES;
  rules['character.hitDice.total'] = 'text';
  rules['character.hitDice.remaining'] = 'text';
  rules['character.deathSaves.successes'] = DEATH_SAVE_COUNTS;
  rules['character.deathSaves.failures'] = DEATH_SAVE_COUNTS;
  COIN_KEYS.forEach((key) => { rules[`character.currency.${key}`] = 'text'; });
  sectionLockKeys.forEach((key) => { rules[`character.sectionLocks.${key}`] = 'boolean'; });
  ABILITY_KEYS.forEach((key) => {
    rules[`character.abilities.${key}.score`] = 'integer';
    rules[`character.savingThrows.${key}.proficient`] = 'boolean';
    rules[`character.savingThrows.${key}.miscBonus`] = 'text';
  });
  SKILL_KEYS.forEach((key) => {
    rules[`character.skills.${key}.proficiency`] = PROFICIENCY_LEVELS;
    rules[`character.skills.${key}.miscBonus`] = 'text';
  });
  SPELL_LEVELS.forEach((level) => {
    rules[`spells.levels.${level}.slotsTotal`] = 'text';
    rules[`spells.levels.${level}.slotsRemaining`] = 'text';
  });
  return rules;
}

const SCALAR_FIELD_RULES = buildScalarFieldRules();

export function validatePatchOperation(operation) {
  if (!isPlainObject(operation) || !['set', 'add', 'remove'].includes(operation.op) || typeof operation.path !== 'string') {
    return 'Operazione patch non valida.';
  }
  const parts = operation.path.split('.');
  const [root, second] = parts;
  const isCharacterCollection = root === 'character' && CHARACTER_COLLECTION_KEYS.includes(second);
  const isSpellCollection = root === 'spells' && second === 'levels' && SPELL_LEVELS.includes(parts[2]) && parts[3] === 'spells';

  if (operation.op === 'set') {
    const scalarRule = SCALAR_FIELD_RULES[operation.path];
    if (scalarRule) return setValueError(scalarRule, operation.value);
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
