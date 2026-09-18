import type { AbilityKey, CharacterSheetData, CharacterSheetPatchOperation, CharacterSheetSpell } from '../../types/character-sheet';
import { computeSpellAttackBonus, computeSpellSaveDc } from '../../../shared/dnd-rules';
import { ComputedWithMiscBonus, RowActions, SheetField, SheetPanel, SheetSelect } from './SheetPrimitives';

const columns = [['0', '1', '2', '3', '4'], ['5', '6', '7', '8', '9']] as const;
const abilityOptions = [
  ['', '—'], ['strength', 'Forza'], ['dexterity', 'Destrezza'], ['constitution', 'Costituzione'],
  ['intelligence', 'Intelligenza'], ['wisdom', 'Saggezza'], ['charisma', 'Carisma'],
] as const;

export function SpellsTab({ data, patch }: { data: CharacterSheetData; patch: (operation: CharacterSheetPatchOperation) => void }) {
  const set = (path: string) => (value: string) => patch({ op: 'set', path, value });
  const ability = data.spells.spellcastingAbility;
  const score = ability ? data.character.abilities[ability].score : '';
  const saveDc = computeSpellSaveDc({ score, level: data.character.level, miscBonus: data.spells.saveDcMiscBonus });
  const attackBonus = computeSpellAttackBonus({ score, level: data.character.level, miscBonus: data.spells.attackMiscBonus });
  return <div className="character-sheet-page spells-page">
    <header className="spells-header">
      <SheetField label="Classe da incantatore" value={data.spells.spellcastingClass} onChange={set('spells.spellcastingClass')} />
      <SheetSelect label="Caratteristica da incantatore" value={ability} className="sheet-field--select" options={abilityOptions} onChange={(value) => set('spells.spellcastingAbility')(value as AbilityKey | '')} />
      <ComputedWithMiscBonus label="CD tiro salvezza" value={saveDc} miscBonus={data.spells.saveDcMiscBonus} onMiscBonus={set('spells.saveDcMiscBonus')} />
      <ComputedWithMiscBonus label="Bonus attacco" value={attackBonus} miscBonus={data.spells.attackMiscBonus} onMiscBonus={set('spells.attackMiscBonus')} />
    </header>
    <div className="spell-columns">{columns.map((levels, column) => <div className="spell-column" key={column}>{levels.map((level) => { const group = data.spells.levels[level]; return <SheetPanel title={level === '0' ? 'Trucchetti' : `Livello ${level}`} className="spell-level" key={level}><div className="spell-level__head"><b>{level}</b>{level !== '0' ? <><SheetField label="Slot totali" value={group.slotsTotal} onChange={set(`spells.levels.${level}.slotsTotal`)} /><SheetField label="Slot rimasti" value={group.slotsRemaining} onChange={set(`spells.levels.${level}.slotsRemaining`)} /></> : null}</div>{group.spells.map((spell: CharacterSheetSpell) => <div className="spell-row" key={spell.id}><select value={spell.status} onChange={(event) => set(`spells.levels.${level}.spells.${spell.id}.status`)(event.target.value)} aria-label={`Stato di ${spell.name || 'incantesimo'}`}><option value="">—</option><option value="prepared">Preparato</option><option value="known">Conosciuto</option></select><input value={spell.name} onChange={(event) => set(`spells.levels.${level}.spells.${spell.id}.name`)(event.target.value)} aria-label="Nome incantesimo" /><input value={spell.notes} onChange={(event) => set(`spells.levels.${level}.spells.${spell.id}.notes`)(event.target.value)} aria-label="Note incantesimo" /><button type="button" className="sheet-remove-row" onClick={() => patch({ op: 'remove', path: `spells.levels.${level}.spells.${spell.id}` })} aria-label={`Rimuovi ${spell.name || 'incantesimo'}`} title={`Rimuovi ${spell.name || 'incantesimo'}`}>×</button></div>)}<RowActions label="Aggiungi incantesimo" onAdd={() => patch({ op: 'add', path: `spells.levels.${level}.spells`, value: { id: crypto.randomUUID(), name: '', status: '', notes: '' } })} /></SheetPanel>; })}</div>)}</div>
  </div>;
}
