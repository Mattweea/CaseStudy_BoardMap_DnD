export type AbilityKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';
export type SkillKey =
  | 'acrobatics' | 'animalHandling' | 'arcana' | 'athletics' | 'deception' | 'history' | 'insight'
  | 'intimidation' | 'investigation' | 'medicine' | 'nature' | 'perception' | 'performance'
  | 'persuasion' | 'religion' | 'sleightOfHand' | 'stealth' | 'survival';
export type ProficiencyLevel = 'none' | 'proficient' | 'expertise';

export const ABILITY_KEYS: readonly AbilityKey[];
export const SKILL_ABILITY: Record<SkillKey, AbilityKey>;
export const SKILL_KEYS: readonly SkillKey[];

export function isIntegerText(value: unknown): value is string;
export function parseWholeNumber(value: string): number | null;

export function abilityModifier(score: string): number | null;
export function proficiencyBonusForLevel(level: string): number | null;

export function computeSavingThrowValue(input: {
  score: string; proficient: boolean; level: string; miscBonus: string;
}): number | null;

export function computeSkillValue(input: {
  score: string; proficiency: ProficiencyLevel; level: string; miscBonus: string;
}): number | null;

export function computePassivePerception(perceptionValue: number | null): number | null;

export function computeInitiative(input: { dexScore: string; miscBonus: string }): number | null;

export function computeToolBonus(input: {
  score: string; proficiency: ProficiencyLevel; level: string; miscBonus: string;
}): number | null;

export function computeAttackBonus(input: {
  score: string; proficient: boolean; level: string; magicBonus: string; bonus: string;
}): number | null;

export function computeDamageModifier(input: { score: string; bonus: string }): number | null;

export function computeSpellSaveDc(input: { score: string; level: string; miscBonus: string }): number | null;
export function computeSpellAttackBonus(input: { score: string; level: string; miscBonus: string }): number | null;

export function formatSigned(value: number | null | undefined): string;
