import type { CharacterSheetAttack, CharacterSheetTool } from '../../types/character-sheet';

// Valori predefiniti di una nuova riga aperta nell'editor: stessi predefiniti dichiarati in
// server/character-sheet-schema.mjs, riscritti qui perché il client non importa moduli server.
export function createAttack(overrides: Partial<CharacterSheetAttack> = {}): CharacterSheetAttack {
  return {
    id: crypto.randomUUID(), name: '',
    attackEnabled: false, attackAbility: '', attackBonus: '', attackProficient: false,
    range: '', magicBonus: '', critRange: '20',
    damageEnabled: true, damageDice: '', damageAbility: '', damageBonus: '', damageType: '', damageCritDice: '',
    damage2Enabled: false, damage2Dice: '', damage2Ability: '', damage2Bonus: '', damage2Type: '', damage2CritDice: '',
    saveEnabled: false, saveAbility: '', saveDc: '', saveEffect: '',
    description: '',
    ...overrides,
  };
}

export function createTool(overrides: Partial<CharacterSheetTool> = {}): CharacterSheetTool {
  return { id: crypto.randomUUID(), name: '', proficiency: 'none', ability: '', bonus: '', ...overrides };
}
