import { useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import type {
  AbilityKey, CharacterSheetAttack, CharacterSheetData, CharacterSheetEquipmentItem, CharacterSheetFeature,
  CharacterSheetLanguage, CharacterSheetPatchOperation, CharacterSheetResourceSection, CharacterSheetRow, CharacterSheetTool, CoinKey, SkillKey,
} from '../../types/character-sheet';
import type { DiceRollLog, DiceRollSourceRequest, InitiativeRollMode, SessionMode } from '../../types';
import {
  abilityModifier, computeAttackBonus, computeDamageModifier, computeInitiative, computePassivePerception,
  computeSavingThrowValue, computeSkillValue, computeToolBonus, formatSigned, proficiencyBonusForLevel, SKILL_ABILITY,
} from '../../../shared/dnd-rules';
import {
  ComputedWithMiscBonus, CompetenceRow, FramedCheckbox, FramedValue, GearButton, LockToggle, PipCounter, ReadOnlyStat,
  RemoveRowButton, RowActions, SAVING_THROW_STATES, SKILL_STATES, SheetField, SheetPanel, SheetSelect,
} from './SheetPrimitives';
import { AttackEditor, ToolEditor } from './RowEditor';
import { createAttack as createAttackDraft, createTool as createToolDraft } from './rowDefaults';
import { GearIcon, LockIcon } from '../UiIcons';

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
const featureSourceOptions = [['race', 'Razziale'], ['class', 'Classe'], ['feat', 'Talento'], ['background', 'Background'], ['item', 'Oggetto'], ['other', 'Altro']] as const;
const hitDiceOptions = [['', 'Non scelto'], ['d4', 'd4'], ['d6', 'd6'], ['d8', 'd8'], ['d10', 'd10'], ['d12', 'd12']] as const;

function readWholeNumber(value: string) {
  return /^\s*-?\d+\s*$/.test(value) ? Number.parseInt(value, 10) : null;
}

function clampCount(value: string) {
  const parsed = readWholeNumber(value);
  return parsed === null ? 0 : Math.min(3, Math.max(0, parsed));
}

// Purely visual: derived from the typed values, never written back to the sheet.
function HitPointMeter({ maximum, current, temporary }: { maximum: string; current: string; temporary: string }) {
  const max = readWholeNumber(maximum);
  const now = readWholeNumber(current);
  if (max === null || now === null || max <= 0) return null;
  const currentRatio = Math.min(1, Math.max(0, now / max));
  const tempRatio = Math.min(1 - currentRatio, Math.max(0, (readWholeNumber(temporary) ?? 0) / max));
  const tone = currentRatio > .5 ? '' : currentRatio > .25 ? 'hp-meter--warn' : 'hp-meter--danger';
  const style = { '--hp-current': currentRatio, '--hp-temp': tempRatio } as CSSProperties;
  return <div className={`hp-meter ${tone}`} style={style} aria-hidden="true">
    <span className="hp-meter__current" />
    <span className="hp-meter__temp" />
  </div>;
}

function attackBonusOf(row: CharacterSheetAttack, data: CharacterSheetData) {
  if (!row.attackEnabled) return null;
  return computeAttackBonus({
    score: row.attackAbility ? data.character.abilities[row.attackAbility].score : '',
    proficient: row.attackProficient,
    level: data.character.level,
    magicBonus: row.magicBonus,
    bonus: row.attackBonus,
  });
}

function damageDisplayOf(row: CharacterSheetAttack, data: CharacterSheetData) {
  if (!row.damageEnabled || !row.damageDice) return null;
  const modifier = row.damageAbility ? computeDamageModifier({ score: data.character.abilities[row.damageAbility].score, bonus: row.damageBonus }) : null;
  const dice = `${row.damageDice}${modifier ? formatSigned(modifier) : ''}`;
  return [dice, row.damageType].filter(Boolean).join(' ');
}

function toolBonusOf(tool: CharacterSheetTool, data: CharacterSheetData) {
  if (!tool.ability) return null;
  return computeToolBonus({ score: data.character.abilities[tool.ability].score, proficiency: tool.proficiency, level: data.character.level, miscBonus: tool.bonus });
}

// Il danno di un attacco è un bersaglio separato dal tiro di attacco (vedi resolver server): il
// client deduce da sé se applicare il critico, guardando l'ultimo tiro di attacco per questo
// stesso bersaglio nel log condiviso — niente scelta manuale, come in Roll20.
function wasLastAttackCritical(diceLogs: DiceRollLog[] | undefined, attackTarget: string) {
  return diceLogs?.find((log) => log.source?.target === attackTarget)?.critical === true;
}

const initiativeRollModes: Array<[InitiativeRollMode, string]> = [['normal', 'Normale'], ['advantage', 'Vantaggio'], ['disadvantage', 'Svantaggio']];
const INITIATIVE_DISABLED_REASON = "Il tiro d'iniziativa si abilita quando il Master avvia il combattimento.";

// Selettore della modalità del tiro d'iniziativa (P0.8a): salvata nella scheda come ogni altro
// campo, letta dal server al momento del tiro. Cambiarla non tira nulla. Sta fuori dal bersaglio
// `data-roll-source`, così un click sulle opzioni non avvia mai un tiro.
function InitiativeModePicker({ mode, onChange }: { mode: InitiativeRollMode; onChange: (mode: InitiativeRollMode) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  return <div className="initiative-mode" onKeyDown={(event) => { if (event.key === 'Escape' && isOpen) { event.stopPropagation(); setIsOpen(false); } }}>
    <button
      type="button" className="sheet-gear-button initiative-mode__toggle" aria-expanded={isOpen}
      aria-label="Modalità del tiro d'iniziativa" title="Modalità del tiro d'iniziativa" onClick={() => setIsOpen((current) => !current)}
    ><GearIcon size="0.95em" /></button>
    {isOpen ? <fieldset className="initiative-mode__options">
      <legend>Tiro d'iniziativa</legend>
      {initiativeRollModes.map(([value, label]) => <label key={value}>
        <input type="radio" name="initiative-roll-mode" value={value} checked={mode === value} onChange={() => onChange(value)} />
        <span>{label}</span>
      </label>)}
    </fieldset> : null}
  </div>;
}

// Emette una patch 'set' solo per i campi effettivamente cambiati rispetto all'apertura dell'editor.
function buildRowDiffOps<T extends { id: string }>(collection: string, before: T, after: T): CharacterSheetPatchOperation[] {
  const ops: CharacterSheetPatchOperation[] = [];
  (Object.keys(after) as Array<keyof T>).forEach((key) => {
    if (key === 'id') return;
    if (after[key] !== before[key]) ops.push({ op: 'set', path: `character.${collection}.${after.id}.${String(key)}`, value: after[key] as string | boolean });
  });
  return ops;
}

export function CharacterTab({ data, patch, sheetId, onRoll, diceLogs, rollVisibility = 'public', sessionMode }: {
  data: CharacterSheetData; patch: (operation: CharacterSheetPatchOperation) => void;
  sheetId?: string; onRoll?: (request: DiceRollSourceRequest) => void; diceLogs?: DiceRollLog[];
  rollVisibility?: 'public' | 'secret'; sessionMode?: SessionMode;
}) {
  const isInitiativeRollDisabled = sessionMode === 'exploration';
  const initiativeRollMode = data.character.initiativeRollMode ?? 'normal';
  const [featureFilter, setFeatureFilter] = useState('');
  const [editingAttackId, setEditingAttackId] = useState<string | 'new' | null>(null);
  const [editingToolId, setEditingToolId] = useState<string | 'new' | null>(null);
  const set = (path: string) => (value: string | boolean) => patch({ op: 'set', path, value });
  const remove = (path: string) => () => patch({ op: 'remove', path });
  const add = (collection: string, value: CharacterSheetRow) => () => patch({ op: 'add', path: `character.${collection}`, value });
  const emptyBlock = { name: '', total: '', current: '' };
  const level = data.character.level;
  const proficiencyBonus = proficiencyBonusForLevel(level);

  const visibleFeatures = useMemo(() => {
    const needle = featureFilter.trim().toLowerCase();
    if (!needle) return data.character.features;
    return data.character.features.filter((feature: CharacterSheetFeature) =>
      `${feature.name} ${feature.description}`.toLowerCase().includes(needle));
  }, [data.character.features, featureFilter]);

  const editingAttack = editingAttackId === 'new' ? createAttackDraft() : editingAttackId ? data.character.attacks.find((row) => row.id === editingAttackId) ?? null : null;
  const editingTool = editingToolId === 'new' ? createToolDraft() : editingToolId ? data.character.tools.find((row) => row.id === editingToolId) ?? null : null;

  const confirmAttack = (updated: CharacterSheetAttack) => {
    if (editingAttackId === 'new') add('attacks', updated)();
    else if (editingAttack) buildRowDiffOps('attacks', editingAttack, updated).forEach(patch);
    setEditingAttackId(null);
  };
  const confirmTool = (updated: CharacterSheetTool) => {
    if (editingToolId === 'new') add('tools', updated)();
    else if (editingTool) buildRowDiffOps('tools', editingTool, updated).forEach(patch);
    setEditingToolId(null);
  };

  // Interazione di tiro (P0.5 Fase B): delegata sull'intera scheda invece di un gestore per
  // ciascun nodo `data-roll-source`, così SheetPrimitives resta invariato. Un elemento
  // interattivo (input, select, button, link) dentro il bersaglio intercetta il click prima che
  // raggiunga il bersaglio: modificare un campo non avvia mai un tiro. Un solo click tira sempre
  // subito (niente modale): i bersagli 1d20 tirano due dadi indipendenti lato server, il danno di
  // un attacco applica da sé il critico dell'ultimo tiro di attacco visto per lo stesso bersaglio.
  const handleSheetClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onRoll || !sheetId) return;
    const clicked = event.target as HTMLElement;
    if (clicked.closest('button, input, select, textarea, a')) return;
    const target = clicked.closest<HTMLElement>('[data-roll-source]')?.dataset.rollSource;
    if (!target) return;
    // L'iniziativa scrive l'ordine dei turni: in Esplorazione il bersaglio è inattivo. La sua
    // visibilità la decide il server, non l'interruttore segreto della scheda.
    if (target === 'initiative') {
      if (!isInitiativeRollDisabled) onRoll({ source: { sheetId, target } });
      return;
    }
    if (target.startsWith('attack-damage:')) {
      const attackTarget = `attack:${target.slice('attack-damage:'.length)}`;
      onRoll({ source: { sheetId, target }, visibility: rollVisibility, critical: wasLastAttackCritical(diceLogs, attackTarget) });
      return;
    }
    onRoll({ source: { sheetId, target }, visibility: rollVisibility });
  };

  return <div className="character-sheet-page character-page" onClick={handleSheetClick}>
    {rollVisibility === 'secret' ? (
      // Stato persistente reso evidente dove si tira, non solo dove si è attivato: tirare in
      // pubblico credendosi in segreto rivelerebbe qualcosa di irrecuperabile.
      <p className="sheet-roll-visibility-banner" role="status"><LockIcon size="1em" /> I prossimi tiri da questa scheda sono segreti.</p>
    ) : null}
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
            <output className="ability-block__modifier" aria-label={`${label}: modificatore`}>{formatSigned(abilityModifier(data.character.abilities[key].score))}</output>
            <input className="ability-block__score" value={data.character.abilities[key].score} onChange={(event) => set(`character.abilities.${key}.score`)(event.target.value)} aria-label={`${label}: punteggio`} />
          </div>)}</div>
          <div className="ability-rail__side">
            <FramedCheckbox label="Ispirazione" checked={data.character.inspiration} onChange={set('character.inspiration')} compact />
            <ReadOnlyStat label="Bonus competenza" value={proficiencyBonus} compact />
            <SheetPanel title="Tiri salvezza">{abilities.map(([key, label]) => {
              const saving = data.character.savingThrows[key];
              return <CompetenceRow
                key={key} label={label} states={SAVING_THROW_STATES} currentIndex={saving.proficient ? 1 : 0}
                onCycle={() => set(`character.savingThrows.${key}.proficient`)(!saving.proficient)}
                value={computeSavingThrowValue({ score: data.character.abilities[key].score, proficient: saving.proficient, level, miscBonus: saving.miscBonus })}
                miscBonus={saving.miscBonus} onMiscBonus={set(`character.savingThrows.${key}.miscBonus`)}
                rollSource={`saving-throw:${key}`}
              />;
            })}</SheetPanel>
            <SheetPanel title="Abilità" className="skills-panel">{skills.map(([key, label]) => {
              const skill = data.character.skills[key];
              const stateIndex = SKILL_STATES.findIndex((state) => state.key === skill.proficiency);
              return <CompetenceRow
                key={key} label={label} states={SKILL_STATES} currentIndex={stateIndex < 0 ? 0 : stateIndex}
                onCycle={() => {
                  const nextIndex = (stateIndex < 0 ? 0 : stateIndex) + 1;
                  set(`character.skills.${key}.proficiency`)(SKILL_STATES[nextIndex % SKILL_STATES.length].key);
                }}
                value={computeSkillValue({ score: data.character.abilities[SKILL_ABILITY[key]].score, proficiency: skill.proficiency, level, miscBonus: skill.miscBonus })}
                miscBonus={skill.miscBonus} onMiscBonus={set(`character.skills.${key}.miscBonus`)}
                rollSource={`skill:${key}`}
              />;
            })}</SheetPanel>
          </div>
        </div>
        <ReadOnlyStat label="Percezione passiva" compact value={computePassivePerception(computeSkillValue({
          score: data.character.abilities[SKILL_ABILITY.perception].score,
          proficiency: data.character.skills.perception.proficiency,
          level, miscBonus: data.character.skills.perception.miscBonus,
        }))} />
        <SheetPanel
          title="Strumenti e competenze" className="repeatable-panel"
          headerAction={<LockToggle label="Strumenti e competenze" locked={data.character.sectionLocks.tools} onToggle={() => set('character.sectionLocks.tools')(!data.character.sectionLocks.tools)} />}
        >
          <div className="repeatable-head tool-row"><span>Nome</span><span>Bonus</span><span /></div>
          {data.character.tools.map((tool: CharacterSheetTool) => <div className="tool-row" key={tool.id} data-roll-source={`tool:${tool.id}`}>
            <span className="tool-row__name">{tool.name || '—'}</span>
            <output className="tool-row__bonus" aria-label={`Bonus di ${tool.name || 'strumento'}`}>{formatSigned(toolBonusOf(tool, data))}</output>
            {data.character.sectionLocks.tools ? <span /> : <GearButton label={`Modifica ${tool.name || 'strumento'}`} onClick={() => setEditingToolId(tool.id)} />}
          </div>)}
          {data.character.sectionLocks.tools ? null : <RowActions onAdd={() => setEditingToolId('new')} label="Aggiungi strumento" />}
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
          <div className="initiative-control">
            <ComputedWithMiscBonus
              label="Iniziativa" rollSource="initiative"
              value={computeInitiative({ dexScore: data.character.abilities.dexterity.score, miscBonus: data.character.initiativeMiscBonus })}
              miscBonus={data.character.initiativeMiscBonus} onMiscBonus={set('character.initiativeMiscBonus')}
              rollDisabledReason={isInitiativeRollDisabled ? INITIATIVE_DISABLED_REASON : undefined}
              badge={initiativeRollMode === 'normal' ? null : <abbr
                className={`initiative-mode__badge initiative-mode__badge--${initiativeRollMode}`}
                title={initiativeRollMode === 'advantage' ? 'Iniziativa con vantaggio' : 'Iniziativa con svantaggio'}
                aria-label={initiativeRollMode === 'advantage' ? 'Iniziativa con vantaggio' : 'Iniziativa con svantaggio'}
              >{initiativeRollMode === 'advantage' ? 'V' : 'S'}</abbr>}
            />
            <InitiativeModePicker mode={initiativeRollMode} onChange={(mode) => set('character.initiativeRollMode')(mode)} />
            {isInitiativeRollDisabled ? <p className="initiative-control__hint">{INITIATIVE_DISABLED_REASON}</p> : null}
          </div>
          <FramedValue label="Velocità" value={data.character.speed} onChange={set('character.speed')} />
        </div>
        <SheetPanel title="Punti ferita"><HitPointMeter {...data.character.hitPoints} /><div className="hp-grid">
          <SheetField label="Massimi" value={data.character.hitPoints.maximum} onChange={set('character.hitPoints.maximum')} />
          <SheetField label="Attuali" value={data.character.hitPoints.current} onChange={set('character.hitPoints.current')} />
          <SheetField label="Temporanei" value={data.character.hitPoints.temporary} onChange={set('character.hitPoints.temporary')} />
        </div></SheetPanel>
        <div className="combat-secondary">
          <SheetPanel title="Dadi vita" rollSource="hit-dice" className="hit-dice-panel">
            <div className="hit-dice-box">
              <SheetField label="Totali" className="hit-dice-box__total" value={data.character.hitDice.total} onChange={set('character.hitDice.total')} />
              <SheetField label="Rimasti" className="hit-dice-box__remaining" value={data.character.hitDice.remaining} onChange={set('character.hitDice.remaining')} />
              <SheetSelect label="Tipo di dado" value={data.character.hitDice.type} className="hit-dice-box__type" options={hitDiceOptions} onChange={set('character.hitDice.type')} />
            </div>
          </SheetPanel>
          <SheetPanel title="Tiri salvezza contro morte" rollSource="death-saves" className="death-saves-panel">
            <div className="death-save-row"><span>Successi</span><PipCounter label="Successi" count={clampCount(data.character.deathSaves.successes)} max={3} onChange={(count) => set('character.deathSaves.successes')(String(count))} /></div>
            <div className="death-save-row"><span>Fallimenti</span><PipCounter label="Fallimenti" count={clampCount(data.character.deathSaves.failures)} max={3} onChange={(count) => set('character.deathSaves.failures')(String(count))} /></div>
          </SheetPanel>
        </div>
        <SheetPanel
          title="Attacchi e incantesimi" className="repeatable-panel"
          headerAction={<LockToggle label="Attacchi" locked={data.character.sectionLocks.attacks} onToggle={() => set('character.sectionLocks.attacks')(!data.character.sectionLocks.attacks)} />}
        >
          <div className="repeatable-head attack-row"><span>Nome</span><span>Bonus</span><span>Danno / tipo</span><span /></div>
          {data.character.attacks.map((row: CharacterSheetAttack) => <div className="attack-row" key={row.id}>
            <span className="attack-row__name">{row.name || '—'}</span>
            <output className="attack-row__bonus" data-roll-source={`attack:${row.id}`} aria-label={`Tiro di attacco di ${row.name || 'attacco'}`}>{formatSigned(attackBonusOf(row, data))}</output>
            <span className="attack-row__damage" data-roll-source={`attack-damage:${row.id}`} aria-label={`Danno di ${row.name || 'attacco'}`}>{damageDisplayOf(row, data) ?? '—'}</span>
            {data.character.sectionLocks.attacks ? <span /> : <GearButton label={`Modifica ${row.name || 'attacco'}`} onClick={() => setEditingAttackId(row.id)} />}
          </div>)}
          {data.character.sectionLocks.attacks ? null : <RowActions onAdd={() => setEditingAttackId('new')} label="Aggiungi attacco" />}
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

    {editingAttack ? <AttackEditor
      initial={editingAttack} onConfirm={confirmAttack} onCancel={() => setEditingAttackId(null)}
      onRemove={editingAttackId !== 'new' ? () => { remove(`character.attacks.${editingAttack.id}`)(); setEditingAttackId(null); } : undefined}
    /> : null}
    {editingTool ? <ToolEditor
      initial={editingTool} onConfirm={confirmTool} onCancel={() => setEditingToolId(null)}
      onRemove={editingToolId !== 'new' ? () => { remove(`character.tools.${editingTool.id}`)(); setEditingToolId(null); } : undefined}
    /> : null}
  </div>;
}
