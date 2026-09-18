// Regole 5e condivise fra server e client: stessa aritmetica, stesso arrotondamento,
// nessuna build richiesta per essere importato sia da Node (server/) sia da Vite (src/).

export const ABILITY_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

export const SKILL_ABILITY = {
  acrobatics: 'dexterity',
  animalHandling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleightOfHand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom',
};

export const SKILL_KEYS = Object.keys(SKILL_ABILITY);

const WHOLE_NUMBER_PATTERN = /^\s*-?\d+\s*$/;

export function isIntegerText(value) {
  return typeof value === 'string' && WHOLE_NUMBER_PATTERN.test(value);
}

// Intero richiesto: '' o testo non numerico restituiscono assenza di risultato.
export function parseWholeNumber(value) {
  return isIntegerText(value) ? Number.parseInt(value, 10) : null;
}

// Bonus vari facoltativo: vuoto vale zero, testo non numerico e la sola assenza di risultato.
function parseOptionalBonus(value) {
  if (value === '' || value === undefined || value === null) return 0;
  return parseWholeNumber(value);
}

function sum(...parts) {
  return parts.some((part) => part === null) ? null : parts.reduce((total, part) => total + part, 0);
}

export function abilityModifier(score) {
  const value = parseWholeNumber(score);
  return value === null ? null : Math.floor((value - 10) / 2);
}

export function proficiencyBonusForLevel(level) {
  const value = parseWholeNumber(level);
  return value === null ? null : 2 + Math.floor((value - 1) / 4);
}

export function computeSavingThrowValue({ score, proficient, level, miscBonus }) {
  const modifier = abilityModifier(score);
  const proficiencyBonus = proficient ? proficiencyBonusForLevel(level) : 0;
  return sum(modifier, proficiencyBonus, parseOptionalBonus(miscBonus));
}

export function computeSkillValue({ score, proficiency, level, miscBonus }) {
  const modifier = abilityModifier(score);
  let proficiencyBonus = 0;
  if (proficiency === 'proficient' || proficiency === 'expertise') {
    proficiencyBonus = proficiencyBonusForLevel(level);
    if (proficiencyBonus !== null && proficiency === 'expertise') proficiencyBonus *= 2;
  }
  return sum(modifier, proficiencyBonus, parseOptionalBonus(miscBonus));
}

export function computePassivePerception(perceptionValue) {
  return perceptionValue === null || perceptionValue === undefined ? null : 10 + perceptionValue;
}

export function computeInitiative({ dexScore, miscBonus }) {
  return sum(abilityModifier(dexScore), parseOptionalBonus(miscBonus));
}

// Il bonus di uno strumento segue la stessa formula del valore di un'abilità.
export function computeToolBonus({ score, proficiency, level, miscBonus }) {
  return computeSkillValue({ score, proficiency, level, miscBonus });
}

export function computeAttackBonus({ score, proficient, level, magicBonus, bonus }) {
  const modifier = abilityModifier(score);
  const proficiencyBonus = proficient ? proficiencyBonusForLevel(level) : 0;
  return sum(modifier, proficiencyBonus, parseOptionalBonus(magicBonus), parseOptionalBonus(bonus));
}

// Modificatore di un blocco di danno: caratteristica scelta più il bonus aggiuntivo del blocco.
export function computeDamageModifier({ score, bonus }) {
  if (score === '' || score === undefined || score === null) return null;
  return sum(abilityModifier(score), parseOptionalBonus(bonus));
}

export function computeSpellSaveDc({ score, level, miscBonus }) {
  if (score === '' || score === undefined || score === null) return null;
  return sum(8, proficiencyBonusForLevel(level), abilityModifier(score), parseOptionalBonus(miscBonus));
}

export function computeSpellAttackBonus({ score, level, miscBonus }) {
  if (score === '' || score === undefined || score === null) return null;
  return sum(proficiencyBonusForLevel(level), abilityModifier(score), parseOptionalBonus(miscBonus));
}

export function formatSigned(value) {
  if (value === null || value === undefined) return '—';
  return value >= 0 ? `+${value}` : String(value);
}
