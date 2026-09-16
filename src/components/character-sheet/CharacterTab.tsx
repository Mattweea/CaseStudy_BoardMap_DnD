import { useMemo, useState } from 'react';
import type {
  AbilityKey, CharacterSheetAttack, CharacterSheetData, CharacterSheetEquipmentItem, CharacterSheetFeature,
  CharacterSheetLanguage, CharacterSheetPatchOperation, CharacterSheetResourceSection, CharacterSheetRow, CharacterSheetTool, CoinKey, SkillKey,
} from '../../types/character-sheet';
import { FramedValue, ProficiencyRow, RemoveRowButton, RowActions, SheetField, SheetPanel, SheetSelect } from './SheetPrimitives';

const abilities: Array<[AbilityKey, string, string]> = [
  ['strength', 'Forza', 'FOR'], ['dexterity', 'Destrezza', 'DES'], ['constitution', 'Costituzione', 'COS'],
  ['intelligence', 'Intelligenza', 'INT'], ['wisdom', 'Saggezza', 'SAG'], ['charisma', 'Carisma', 'CAR'],
];
const skills: Array<[SkillKey, string]> = [['acrobatics', 'Acrobazia'], ['animalHandling', 'Addestrare animali'], ['arcana', 'Arcano'], ['athletics', 'Atletica'], ['deception', 'Inganno'], ['history', 'Storia'], ['insight', 'Intuizione'], ['intimidation', 'Intimidire'], ['investigation', 'Indagare'], ['medicine', 'Medicina'], ['nature', 'Natura'], ['perception', 'Percezione'], ['performance', 'Intrattenere'], ['persuasion', 'Persuasione'], ['religion', 'Religione'], ['sleightOfHand', 'Rapidità di mano'], ['stealth', 'Furtività'], ['survival', 'Sopravvivenza']];
const identityFields: Array<[keyof CharacterSheetData['character'], string]> = [
  ['className', 'Classe'], ['subclass', 'Sottoclasse'], ['level', 'Livello'], ['species', 'Razza'],
  ['background', 'Background'], ['alignment', 'Allineamento'], ['experience', 'Punti esperienza'],
];
const coins: Array<[CoinKey, string]> = [['cp', 'Monete di rame'], ['sp', 'Monete d’argento'], ['gp', 'Monete d’oro'], ['pp', 'Monete di platino']];
const proficiencyOptions = [['proficient', 'Competente'], ['expertise', 'Esperto'], ['none', 'Nessuna']] as const;
const abilityOptions = [['', '—'], ...abilities.map(([key, label]) => [key, label] as const)] as ReadonlyArray<readonly [string, string]>;
const featureSourceOptions = [['race', 'Razziale'], ['class', 'Classe'], ['feat', 'Talento'], ['background', 'Background'], ['item', 'Oggetto'], ['other', 'Altro']] as const;

export function CharacterTab({ data, patch }: { data: CharacterSheetData; patch: (operation: CharacterSheetPatchOperation) => void }) {
  const [featureFilter, setFeatureFilter] = useState('');
  const set = (path: string) => (value: string | boolean) => patch({ op: 'set', path, value });
  const remove = (path: string) => () => patch({ op: 'remove', path });
  const add = (collection: string, value: CharacterSheetRow) => () => patch({ op: 'add', path: `character.${collection}`, value });
  const emptyBlock = { name: '', total: '', current: '' };

  const visibleFeatures = useMemo(() => {
    const needle = featureFilter.trim().toLowerCase();
    if (!needle) return data.character.features;
    return data.character.features.filter((feature: CharacterSheetFeature) =>
      `${feature.name} ${feature.description}`.toLowerCase().includes(needle));
  }, [data.character.features, featureFilter]);

  return <div className="character-sheet-page character-page">
    <header className="sheet-identity">
      <SheetField label="Nome del personaggio" value={data.character.name} onChange={set('character.name')} className="sheet-identity__name" />
      <div className="sheet-identity__facts">
        {identityFields.map(([key, label]) => <SheetField key={key} label={label} value={data.character[key] as string} onChange={set(`character.${key}`)} />)}
      </div>
    </header>

    <div className="character-page__grid">
      <div className="character-page__column character-page__abilities">
        <div className="ability-rail">
          <div className="ability-stack">{abilities.map(([key, label, short]) => <div className="ability-block" key={key} data-roll-source={`ability:${key}`}>
            <span title={label}>{short}</span>
            <input value={data.character.abilities[key].score} onChange={(event) => set(`character.abilities.${key}.score`)(event.target.value)} aria-label={`${label}: punteggio`} />
            <input className="ability-block__modifier" value={data.character.abilities[key].modifier} onChange={(event) => set(`character.abilities.${key}.modifier`)(event.target.value)} aria-label={`${label}: modificatore`} />
          </div>)}</div>
          <div className="ability-rail__side">
            <FramedValue label="Ispirazione" value={data.character.inspiration} onChange={set('character.inspiration')} compact />
            <FramedValue label="Bonus competenza" value={data.character.proficiencyBonus} onChange={set('character.proficiencyBonus')} compact />
            <SheetPanel title="Tiri salvezza">{abilities.map(([key, label]) => <ProficiencyRow key={key} label={label} checked={data.character.savingThrows[key].proficient} value={data.character.savingThrows[key].value} onChecked={set(`character.savingThrows.${key}.proficient`)} onValue={set(`character.savingThrows.${key}.value`)} rollSource={`saving-throw:${key}`} />)}</SheetPanel>
            <SheetPanel title="Abilità" className="skills-panel">{skills.map(([key, label]) => <ProficiencyRow key={key} label={label} checked={data.character.skills[key].proficient} value={data.character.skills[key].value} onChecked={set(`character.skills.${key}.proficient`)} onValue={set(`character.skills.${key}.value`)} rollSource={`skill:${key}`} />)}</SheetPanel>
          </div>
        </div>
        <FramedValue label="Percezione passiva" value={data.character.passivePerception} onChange={set('character.passivePerception')} compact />
        <SheetPanel title="Strumenti e competenze" className="repeatable-panel">
          <div className="repeatable-head tool-row"><span>Nome</span><span>Comp.</span><span>Attr.</span><span>Mod.</span><span /></div>
          {data.character.tools.map((tool: CharacterSheetTool) => <div className="tool-row" key={tool.id} data-roll-source={`tool:${tool.id}`}>
            <input value={tool.name} onChange={(event) => set(`character.tools.${tool.id}.name`)(event.target.value)} aria-label="Nome strumento" />
            <SheetSelect label="Tipo di competenza" value={tool.proficiency} className="sheet-field--inline" options={proficiencyOptions} onChange={set(`character.tools.${tool.id}.proficiency`)} />
            <SheetSelect label="Attributo" value={tool.ability} className="sheet-field--inline" options={abilityOptions} onChange={set(`character.tools.${tool.id}.ability`)} />
            <input value={tool.modifier} onChange={(event) => set(`character.tools.${tool.id}.modifier`)(event.target.value)} aria-label="Modificatore" />
            <RemoveRowButton label={`Rimuovi ${tool.name || 'strumento'}`} onRemove={remove(`character.tools.${tool.id}`)} />
          </div>)}
          <RowActions onAdd={add('tools', { id: crypto.randomUUID(), name: '', proficiency: 'proficient', ability: '', modifier: '' })} label="Aggiungi strumento" />
        </SheetPanel>
        <SheetPanel title="Linguaggi" className="repeatable-panel">
          {data.character.languages.map((language: CharacterSheetLanguage) => <div className="language-row" key={language.id}>
            <input value={language.name} onChange={(event) => set(`character.languages.${language.id}.name`)(event.target.value)} aria-label="Linguaggio" />
            <RemoveRowButton label={`Rimuovi ${language.name || 'linguaggio'}`} onRemove={remove(`character.languages.${language.id}`)} />
          </div>)}
          <RowActions onAdd={add('languages', { id: crypto.randomUUID(), name: '' })} label="Aggiungi linguaggio" />
        </SheetPanel>
      </div>

      <div className="character-page__column character-page__combat">
        <div className="combat-vitals">
          <FramedValue label="Classe Armatura" value={data.character.armorClass} onChange={set('character.armorClass')} className="framed-value--shield" />
          <FramedValue label="Iniziativa" value={data.character.initiativeModifier} onChange={set('character.initiativeModifier')} rollSource="initiative" />
          <FramedValue label="Velocità" value={data.character.speed} onChange={set('character.speed')} />
        </div>
        <SheetPanel title="Punti ferita"><div className="hp-grid">
          <SheetField label="Massimi" value={data.character.hitPoints.maximum} onChange={set('character.hitPoints.maximum')} />
          <SheetField label="Attuali" value={data.character.hitPoints.current} onChange={set('character.hitPoints.current')} />
          <SheetField label="Temporanei" value={data.character.hitPoints.temporary} onChange={set('character.hitPoints.temporary')} />
        </div></SheetPanel>
        <div className="combat-secondary">
          <SheetPanel title="Dadi vita">
            <SheetField label="Tipo" value={data.character.hitDice.type} onChange={set('character.hitDice.type')} />
            <SheetField label="Totali" value={data.character.hitDice.total} onChange={set('character.hitDice.total')} />
            <SheetField label="Rimasti" value={data.character.hitDice.remaining} onChange={set('character.hitDice.remaining')} />
          </SheetPanel>
          <SheetPanel title="Tiri salvezza contro morte">
            <SheetField label="Successi" value={data.character.deathSaves.successes} onChange={set('character.deathSaves.successes')} />
            <SheetField label="Fallimenti" value={data.character.deathSaves.failures} onChange={set('character.deathSaves.failures')} />
          </SheetPanel>
        </div>
        <SheetPanel title="Attacchi e incantesimi" className="repeatable-panel">
          <div className="repeatable-head attack-row"><span>Nome</span><span>Bonus</span><span>Danno / tipo</span><span>Note</span><span /></div>
          {data.character.attacks.map((row: CharacterSheetAttack) => <div className="attack-row" key={row.id} data-roll-source={`attack:${row.id}`}>
            {(['name', 'bonus', 'damageType', 'notes'] as const).map((field) => <input key={field} value={row[field]} onChange={(event) => set(`character.attacks.${row.id}.${field}`)(event.target.value)} aria-label={`${field} attacco`} />)}
            <RemoveRowButton label={`Rimuovi ${row.name || 'attacco'}`} onRemove={remove(`character.attacks.${row.id}`)} />
          </div>)}
          <RowActions onAdd={add('attacks', { id: crypto.randomUUID(), name: '', bonus: '', damageType: '', notes: '' })} label="Aggiungi attacco" />
        </SheetPanel>
        <SheetPanel title="Equipaggiamento e monete" className="repeatable-panel equipment-panel">
          <div className="currency-row">{coins.map(([coin, label]) => <label className={`coin-field coin-field--${coin}`} key={coin}>
            <span className="coin-field__badge" aria-hidden="true">{coin.toUpperCase()}</span>
            <input value={data.character.currency[coin]} onChange={(event) => set(`character.currency.${coin}`)(event.target.value)} aria-label={label} />
          </label>)}</div>
          <div className="repeatable-head equipment-row"><span>Quantità</span><span>Nome</span><span>Peso</span><span /></div>
          {data.character.equipment.map((item: CharacterSheetEquipmentItem) => <div className="equipment-row" key={item.id}>
            <input value={item.quantity} onChange={(event) => set(`character.equipment.${item.id}.quantity`)(event.target.value)} aria-label="Quantità" />
            <input value={item.name} onChange={(event) => set(`character.equipment.${item.id}.name`)(event.target.value)} aria-label="Nome oggetto" />
            <input value={item.weight} onChange={(event) => set(`character.equipment.${item.id}.weight`)(event.target.value)} aria-label="Peso" />
            <RemoveRowButton label={`Rimuovi ${item.name || 'oggetto'}`} onRemove={remove(`character.equipment.${item.id}`)} />
          </div>)}
          <RowActions onAdd={add('equipment', { id: crypto.randomUUID(), quantity: '', name: '', weight: '' })} label="Aggiungi oggetto" />
          <div className="equipment-total"><SheetField label="Peso totale" value={data.character.equipmentTotalWeight} onChange={set('character.equipmentTotalWeight')} /></div>
        </SheetPanel>
      </div>

      <div className="character-page__column character-page__roleplay">
        <SheetPanel title="Caratteristiche" className="traits-panel">
          {([['personalityTraits', 'Tratti della personalità'], ['ideals', 'Ideali'], ['bonds', 'Legami'], ['flaws', 'Difetti']] as const).map(([key, label]) =>
            <SheetField key={key} label={label} value={data.character[key]} onChange={set(`character.${key}`)} multiline />)}
        </SheetPanel>
        <SheetPanel title="Risorse" className="resources-panel">
          {data.character.resources.map((section: CharacterSheetResourceSection, index: number) => <div className="resource-section" key={section.id}>
            {([['classResource', 'Risorsa di classe'], ['otherResource', 'Altra risorsa']] as const).map(([block, blockLabel]) => <div className="resource-block" key={block}>
              <SheetField label="Totale" className="resource-block__total" value={section[block].total} onChange={set(`character.resources.${section.id}.${block}.total`)} />
              <SheetField label="Attuale" className="resource-block__current" value={section[block].current} onChange={set(`character.resources.${section.id}.${block}.current`)} />
              <input className="resource-block__caption" value={section[block].name} placeholder={blockLabel} onChange={(event) => set(`character.resources.${section.id}.${block}.name`)(event.target.value)} aria-label={blockLabel} />
            </div>)}
            {index > 0 ? <RemoveRowButton label={`Rimuovi sezione risorse ${index + 1}`} onRemove={remove(`character.resources.${section.id}`)} /> : null}
          </div>)}
          <RowActions onAdd={add('resources', { id: crypto.randomUUID(), classResource: { ...emptyBlock }, otherResource: { ...emptyBlock } })} label="Aggiungi sezione risorse" />
        </SheetPanel>
        <SheetPanel title="Privilegi e tratti" className="repeatable-panel features-panel">
          <label className="feature-filter">
            <input type="search" value={featureFilter} onChange={(event) => setFeatureFilter(event.target.value)} placeholder="Filtra per nome o descrizione" aria-label="Filtra privilegi e tratti" />
          </label>
          {visibleFeatures.map((feature: CharacterSheetFeature) => <div className="feature-row" key={feature.id}>
            <div className="feature-row__head">
              <input value={feature.name} onChange={(event) => set(`character.features.${feature.id}.name`)(event.target.value)} aria-label="Nome privilegio" />
              <SheetSelect label="Fonte" value={feature.source} className="sheet-field--inline" options={featureSourceOptions} onChange={set(`character.features.${feature.id}.source`)} />
              <RemoveRowButton label={`Rimuovi ${feature.name || 'privilegio'}`} onRemove={remove(`character.features.${feature.id}`)} />
            </div>
            <textarea value={feature.description} onChange={(event) => set(`character.features.${feature.id}.description`)(event.target.value)} aria-label="Descrizione privilegio" />
          </div>)}
          {featureFilter && !visibleFeatures.length ? <p className="feature-empty">Nessun privilegio corrisponde al filtro.</p> : null}
          <RowActions onAdd={add('features', { id: crypto.randomUUID(), name: '', source: 'class', description: '' })} label="Aggiungi privilegio" />
        </SheetPanel>
      </div>
    </div>
  </div>;
}
