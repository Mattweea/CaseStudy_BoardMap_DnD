export type SheetText = string;
export type AbilityKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';
export type SkillKey = 'acrobatics' | 'animalHandling' | 'arcana' | 'athletics' | 'deception' | 'history' | 'insight' | 'intimidation' | 'investigation' | 'medicine' | 'nature' | 'perception' | 'performance' | 'persuasion' | 'religion' | 'sleightOfHand' | 'stealth' | 'survival';
export type SpellStatus = '' | 'prepared' | 'known';
export type ProficiencyLevel = 'proficient' | 'expertise' | 'none';
export type FeatureSource = 'race' | 'class' | 'feat' | 'background' | 'item' | 'other';
export type CoinKey = 'cp' | 'sp' | 'gp' | 'pp';

export interface CharacterSheetAttack { id: string; name: SheetText; bonus: SheetText; damageType: SheetText; notes: SheetText }
export interface CharacterSheetEquipmentItem { id: string; quantity: SheetText; name: SheetText; weight: SheetText }
export interface CharacterSheetTool { id: string; name: SheetText; proficiency: ProficiencyLevel; ability: '' | AbilityKey; modifier: SheetText }
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
    inspiration: SheetText; proficiencyBonus: SheetText; passivePerception: SheetText; armorClass: SheetText; initiativeModifier: SheetText; speed: SheetText;
    equipmentTotalWeight: SheetText; personalityTraits: SheetText; ideals: SheetText; bonds: SheetText; flaws: SheetText;
    abilities: Record<AbilityKey, { score: SheetText; modifier: SheetText }>;
    savingThrows: Record<AbilityKey, { proficient: boolean; value: SheetText }>;
    skills: Record<SkillKey, { proficient: boolean; value: SheetText }>;
    hitPoints: { maximum: SheetText; current: SheetText; temporary: SheetText };
    hitDice: { type: SheetText; total: SheetText; remaining: SheetText };
    deathSaves: { successes: SheetText; failures: SheetText };
    attacks: CharacterSheetAttack[];
    equipment: CharacterSheetEquipmentItem[];
    tools: CharacterSheetTool[];
    languages: CharacterSheetLanguage[];
    features: CharacterSheetFeature[];
    resources: CharacterSheetResourceSection[];
    currency: Record<CoinKey, SheetText>;
  };
  story: {
    name: SheetText; age: SheetText; height: SheetText; weight: SheetText; eyes: SheetText; skin: SheetText; hair: SheetText;
    appearance: SheetText; alliesOrganizations: SheetText; factionName: SheetText; backstory: SheetText; additionalFeatures: SheetText; treasure: SheetText;
  };
  spells: {
    spellcastingClass: SheetText; spellcastingAbility: SheetText; saveDc: SheetText; attackBonus: SheetText;
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
