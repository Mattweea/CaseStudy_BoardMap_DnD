import type { AbilityKey, SkillKey } from '../../shared/dnd-rules';

export type SheetText = string;
export type { AbilityKey, SkillKey };
export type SpellStatus = '' | 'prepared' | 'known';
export type ProficiencyLevel = 'none' | 'proficient' | 'expertise';
export type FeatureSource = 'race' | 'class' | 'feat' | 'background' | 'item' | 'other';
export type CoinKey = 'cp' | 'sp' | 'gp' | 'pp';
export type HitDiceType = '' | 'd4' | 'd6' | 'd8' | 'd10' | 'd12';
export type DeathSaveCount = '0' | '1' | '2' | '3';
export type AbilityOrNone = '' | AbilityKey;
export type DamageType =
  | '' | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning' | 'necrotic'
  | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder';

export interface CharacterSheetAttack {
  id: string; name: SheetText;
  attackEnabled: boolean; attackAbility: AbilityOrNone; attackBonus: SheetText; attackProficient: boolean;
  range: SheetText; magicBonus: SheetText; critRange: SheetText;
  damageEnabled: boolean; damageDice: SheetText; damageAbility: AbilityOrNone; damageBonus: SheetText; damageType: DamageType; damageCritDice: SheetText;
  damage2Enabled: boolean; damage2Dice: SheetText; damage2Ability: AbilityOrNone; damage2Bonus: SheetText; damage2Type: DamageType; damage2CritDice: SheetText;
  saveEnabled: boolean; saveAbility: AbilityOrNone; saveDc: SheetText; saveEffect: SheetText;
  description: SheetText;
}
export interface CharacterSheetEquipmentItem { id: string; quantity: SheetText; name: SheetText; weight: SheetText }
export interface CharacterSheetTool { id: string; name: SheetText; proficiency: ProficiencyLevel; ability: AbilityOrNone; bonus: SheetText }
export interface CharacterSheetLanguage { id: string; name: SheetText }
export interface CharacterSheetFeature { id: string; name: SheetText; source: FeatureSource; description: SheetText }
export interface CharacterSheetResourceBlock { name: SheetText; total: SheetText; current: SheetText }
export interface CharacterSheetResourceSection { id: string; classResource: CharacterSheetResourceBlock; otherResource: CharacterSheetResourceBlock }
export interface CharacterSheetSpell { id: string; name: SheetText; status: SpellStatus; notes: SheetText }
export interface CharacterSheetSpellLevel { slotsTotal: SheetText; slotsRemaining: SheetText; spells: CharacterSheetSpell[] }

export type CharacterSheetRow =
  | CharacterSheetAttack
  | CharacterSheetEquipmentItem
  | CharacterSheetTool
  | CharacterSheetLanguage
  | CharacterSheetFeature
  | CharacterSheetResourceSection
  | CharacterSheetSpell;

export interface CharacterSheetData {
  schemaVersion: 1;
  character: {
    name: SheetText; className: SheetText; subclass: SheetText; level: SheetText; species: SheetText; background: SheetText; alignment: SheetText; experience: SheetText;
    inspiration: boolean; armorClass: SheetText; speed: SheetText; initiativeMiscBonus: SheetText;
    initiativeRollMode: 'normal' | 'advantage' | 'disadvantage';
    equipmentTotalWeight: SheetText; personalityTraits: SheetText; ideals: SheetText; bonds: SheetText; flaws: SheetText;
    abilities: Record<AbilityKey, { score: SheetText }>;
    savingThrows: Record<AbilityKey, { proficient: boolean; miscBonus: SheetText }>;
    skills: Record<SkillKey, { proficiency: ProficiencyLevel; miscBonus: SheetText }>;
    hitPoints: { maximum: SheetText; current: SheetText; temporary: SheetText };
    hitDice: { type: HitDiceType; total: SheetText; remaining: SheetText };
    deathSaves: { successes: DeathSaveCount; failures: DeathSaveCount };
    attacks: CharacterSheetAttack[];
    equipment: CharacterSheetEquipmentItem[];
    tools: CharacterSheetTool[];
    languages: CharacterSheetLanguage[];
    features: CharacterSheetFeature[];
    resources: CharacterSheetResourceSection[];
    currency: Record<CoinKey, SheetText>;
    sectionLocks: { attacks: boolean; tools: boolean };
  };
  story: {
    name: SheetText; age: SheetText; height: SheetText; weight: SheetText; eyes: SheetText; skin: SheetText; hair: SheetText;
    appearance: SheetText; alliesOrganizations: SheetText; factionName: SheetText; backstory: SheetText; additionalFeatures: SheetText; treasure: SheetText;
  };
  spells: {
    spellcastingClass: SheetText; spellcastingAbility: AbilityOrNone; saveDcMiscBonus: SheetText; attackMiscBonus: SheetText;
    levels: Record<'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9', CharacterSheetSpellLevel>;
  };
}

export type CharacterCollectionKey = 'attacks' | 'equipment' | 'tools' | 'languages' | 'features' | 'resources';

export type CharacterSheetPatchOperation =
  | { op: 'set'; path: string; value: string | boolean }
  | { op: 'add'; path: string; value: CharacterSheetRow }
  | { op: 'remove'; path: string };

export interface CharacterSheetRecord {
  id: string;
  ownerUserId: string;
  campaignId: string;
  version: number;
  data: CharacterSheetData;
  portraitUrl: string | null;
  portraitMediaType: string | null;
  portraitUpdatedAt: string | null;
}
