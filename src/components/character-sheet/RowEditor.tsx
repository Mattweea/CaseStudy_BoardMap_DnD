import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AbilityKey, CharacterSheetAttack, CharacterSheetAura, CharacterSheetTool, DamageType } from '../../types/character-sheet';
import type { MeasurementUnit } from '../../types';
import { AURA_COLORS, AURA_LIMITS, radiusCellsFromUnit } from '../../../shared/token-auras.mjs';

const abilityOptions = [
  ['', '—'], ['strength', 'Forza'], ['dexterity', 'Destrezza'], ['constitution', 'Costituzione'],
  ['intelligence', 'Intelligenza'], ['wisdom', 'Saggezza'], ['charisma', 'Carisma'],
] as const;

// Elenco chiuso dei tipi di danno 5e, stessi valori interni di server/character-sheet-schema.mjs.
const damageTypeOptions = [
  ['', 'Non scelto'], ['acid', 'Acido'], ['bludgeoning', 'Contundente'], ['cold', 'Freddo'], ['fire', 'Fuoco'],
  ['force', 'Forza'], ['lightning', 'Fulmine'], ['necrotic', 'Necrotico'], ['piercing', 'Perforante'],
  ['poison', 'Veleno'], ['psychic', 'Psichico'], ['radiant', 'Radiante'], ['slashing', 'Tagliente'], ['thunder', 'Tuono'],
] as const;

const auraColorNames = ['Azzurro', 'Verde smeraldo', 'Oro', 'Arancione', 'Rosa', 'Viola', 'Turchese', 'Rosso'] as const;

function AuraColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, AURA_COLORS.indexOf(value));

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen, selectedIndex]);

  return <div className="row-editor__field aura-color-picker" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
  }} onKeyDown={(event) => {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = optionRefs.current.findIndex((option) => option === document.activeElement);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? AURA_COLORS.length - 1
      : (currentIndex + (event.key === 'ArrowDown' ? 1 : AURA_COLORS.length - 1)) % AURA_COLORS.length;
    optionRefs.current[nextIndex]?.focus();
  }}>
    <span id="aura-color-label">Colore</span>
    <button ref={triggerRef} type="button" className="aura-color-picker__trigger" aria-labelledby="aura-color-label aura-color-selected" aria-haspopup="menu" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
      <span className="aura-color-swatch" style={{ backgroundColor: value }} aria-hidden="true" />
      <span id="aura-color-selected">{auraColorNames[selectedIndex]}</span>
      <span className="aura-color-picker__chevron" aria-hidden="true">▾</span>
    </button>
    {isOpen ? <div className="aura-color-picker__menu" role="menu" aria-label="Colori dell'aura">
      {AURA_COLORS.map((color, index) => <button key={color} ref={(node) => { optionRefs.current[index] = node; }} type="button" role="menuitemradio" aria-checked={value === color} className="aura-color-picker__option" onClick={() => { onChange(color); setIsOpen(false); triggerRef.current?.focus(); }}>
        <span className="aura-color-swatch" style={{ backgroundColor: color }} aria-hidden="true" />
        <span>{auraColorNames[index]}</span>
      </button>)}
    </div> : null}
  </div>;
}

function focusablesOf(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter((element) => !element.hasAttribute('disabled'));
}

// Bozza locale: la conferma calcola il diff verso i valori d'apertura ed emette solo i campi
// cambiati; l'annullamento scarta la bozza senza emettere nulla.
function useDialogBehaviour(onCancel: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement;
    const container = containerRef.current;
    const frame = requestAnimationFrame(() => container?.querySelector<HTMLElement>('input, select, textarea')?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); return; }
      if (event.key !== 'Tab' || !container) return;
      const focusables = focusablesOf(container);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return containerRef;
}

function EditorShell({ title, onConfirm, onCancel, onRemove, children }: {
  title: string; onConfirm: () => void; onCancel: () => void; onRemove?: () => void; children: ReactNode;
}) {
  const containerRef = useDialogBehaviour(onCancel);
  return <div className="row-editor-overlay" role="presentation">
    <div className="row-editor" role="dialog" aria-modal="true" aria-labelledby="row-editor-title" ref={containerRef}>
      <header className="row-editor__head"><h4 id="row-editor-title">{title}</h4></header>
      <div className="row-editor__body">{children}</div>
      <footer className="row-editor__actions">
        {onRemove ? <button type="button" className="row-editor__remove" onClick={onRemove}>Rimuovi</button> : null}
        <div className="row-editor__spacer" />
        <button type="button" className="row-editor__cancel" onClick={onCancel}>Annulla</button>
        <button type="button" className="row-editor__confirm" onClick={onConfirm}>Conferma</button>
      </footer>
    </div>
  </div>;
}

function Field({ label, value, onChange, type = 'text', maxLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; maxLength?: number }) {
  return <label className="row-editor__field"><span>{label}</span><input type={type} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: ReadonlyArray<readonly [string, string]> }) {
  return <label className="row-editor__field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="row-editor__toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

export function AttackEditor({ initial, onConfirm, onCancel, onRemove }: {
  initial: CharacterSheetAttack;
  onConfirm: (attack: CharacterSheetAttack) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  // Il primo blocco di danno è sempre attivo: nessun attacco esiste senza infliggere danno.
  const [draft, setDraft] = useState<CharacterSheetAttack>(() => ({ ...initial, damageEnabled: true }));
  const set = <K extends keyof CharacterSheetAttack>(key: K) => (value: CharacterSheetAttack[K]) => setDraft((current) => ({ ...current, [key]: value }));

  return <EditorShell title={initial.name ? `Modifica ${initial.name}` : 'Nuovo attacco'} onConfirm={() => onConfirm(draft)} onCancel={onCancel} onRemove={onRemove}>
    <Field label="Nome" value={draft.name} onChange={set('name')} />
    <fieldset className="row-editor__block">
      <Toggle label="Tiro di attacco" checked={draft.attackEnabled} onChange={set('attackEnabled')} />
      {draft.attackEnabled ? <div className="row-editor__grid">
        <Select label="Caratteristica" value={draft.attackAbility} onChange={(value) => set('attackAbility')(value as AbilityKey | '')} options={abilityOptions} />
        <Field label="Bonus aggiuntivo" value={draft.attackBonus} onChange={set('attackBonus')} />
        <Toggle label="Competente" checked={draft.attackProficient} onChange={set('attackProficient')} />
      </div> : null}
    </fieldset>
    <div className="row-editor__grid">
      <Field label="Gittata" value={draft.range} onChange={set('range')} />
      <Field label="Bonus magico" value={draft.magicBonus} onChange={set('magicBonus')} />
      <Field label="Soglia di critico" value={draft.critRange} onChange={set('critRange')} />
    </div>
    <fieldset className="row-editor__block">
      <span className="row-editor__block-title">Blocco di danno</span>
      <div className="row-editor__grid">
        <Field label="Formula del dado" value={draft.damageDice} onChange={set('damageDice')} />
        <Select label="Caratteristica" value={draft.damageAbility} onChange={(value) => set('damageAbility')(value as AbilityKey | '')} options={abilityOptions} />
        <Field label="Bonus" value={draft.damageBonus} onChange={set('damageBonus')} />
        <Select label="Tipo di danno" value={draft.damageType} onChange={(value) => set('damageType')(value as DamageType)} options={damageTypeOptions} />
        <Field label="Dado di critico" value={draft.damageCritDice} onChange={set('damageCritDice')} />
      </div>
    </fieldset>
    <fieldset className="row-editor__block">
      <Toggle label="Secondo blocco di danno" checked={draft.damage2Enabled} onChange={set('damage2Enabled')} />
      {draft.damage2Enabled ? <div className="row-editor__grid">
        <Field label="Formula del dado" value={draft.damage2Dice} onChange={set('damage2Dice')} />
        <Select label="Caratteristica" value={draft.damage2Ability} onChange={(value) => set('damage2Ability')(value as AbilityKey | '')} options={abilityOptions} />
        <Field label="Bonus" value={draft.damage2Bonus} onChange={set('damage2Bonus')} />
        <Select label="Tipo di danno" value={draft.damage2Type} onChange={(value) => set('damage2Type')(value as DamageType)} options={damageTypeOptions} />
        <Field label="Dado di critico" value={draft.damage2CritDice} onChange={set('damage2CritDice')} />
      </div> : null}
    </fieldset>
    <fieldset className="row-editor__block">
      <Toggle label="Tiro salvezza" checked={draft.saveEnabled} onChange={set('saveEnabled')} />
      {draft.saveEnabled ? <div className="row-editor__grid">
        <Select label="Caratteristica" value={draft.saveAbility} onChange={(value) => set('saveAbility')(value as AbilityKey | '')} options={abilityOptions} />
        <Field label="CD" value={draft.saveDc} onChange={set('saveDc')} />
        <Field label="Effetto del salvataggio" value={draft.saveEffect} onChange={set('saveEffect')} />
      </div> : null}
    </fieldset>
    <label className="row-editor__field row-editor__field--wide"><span>Descrizione</span><textarea value={draft.description} onChange={(event) => set('description')(event.target.value)} /></label>
  </EditorShell>;
}

export function ToolEditor({ initial, onConfirm, onCancel, onRemove }: {
  initial: CharacterSheetTool;
  onConfirm: (tool: CharacterSheetTool) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [draft, setDraft] = useState<CharacterSheetTool>(initial);
  const set = <K extends keyof CharacterSheetTool>(key: K) => (value: CharacterSheetTool[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const proficiencyOptions = [['none', 'Nessuna'], ['proficient', 'Competente'], ['expertise', 'Esperto']] as const;

  return <EditorShell title={initial.name ? `Modifica ${initial.name}` : 'Nuovo strumento'} onConfirm={() => onConfirm(draft)} onCancel={onCancel} onRemove={onRemove}>
    <Field label="Nome" value={draft.name} onChange={set('name')} />
    <div className="row-editor__grid">
      <Select label="Competenza" value={draft.proficiency} onChange={(value) => set('proficiency')(value as CharacterSheetTool['proficiency'])} options={proficiencyOptions} />
      <Select label="Caratteristica" value={draft.ability} onChange={(value) => set('ability')(value as AbilityKey | '')} options={abilityOptions} />
      <Field label="Bonus aggiuntivo" value={draft.bonus} onChange={set('bonus')} />
    </div>
  </EditorShell>;
}

export function AuraEditor({ initial, measurementUnit, onConfirm, onCancel, onRemove }: {
  initial: CharacterSheetAura;
  measurementUnit: MeasurementUnit;
  onConfirm: (aura: CharacterSheetAura) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [draft, setDraft] = useState<CharacterSheetAura>(initial);
  const [radiusUnit, setRadiusUnit] = useState(() => String(Number(initial.radiusCells) * measurementUnit.cellsValue));
  const [radiusError, setRadiusError] = useState('');
  const set = <K extends keyof CharacterSheetAura>(key: K) => (value: CharacterSheetAura[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const confirm = () => {
    const value = Number(radiusUnit);
    if (!radiusUnit.trim() || !Number.isFinite(value) || value <= 0) {
      setRadiusError('Inserisci un raggio maggiore di zero.');
      return;
    }
    onConfirm({ ...draft, radiusCells: String(radiusCellsFromUnit(value, measurementUnit.cellsValue)) });
  };

  return <EditorShell title={initial.name ? `Modifica ${initial.name}` : 'Nuova aura'} onConfirm={confirm} onCancel={onCancel} onRemove={onRemove}>
    <Field label="Nome" value={draft.name} maxLength={AURA_LIMITS.maxNameLength} onChange={set('name')} />
    <label className="row-editor__field row-editor__field--wide"><span>Descrizione (privata nella scheda)</span><textarea value={draft.description} onChange={(event) => set('description')(event.target.value)} /></label>
    <label className="row-editor__field row-editor__field--wide"><span>Effetto visibile sull'avviso</span><textarea value={draft.effect} maxLength={AURA_LIMITS.maxEffectLength} onChange={(event) => set('effect')(event.target.value)} /></label>
    <div className="row-editor__grid">
      <label className="row-editor__field"><span>Raggio ({measurementUnit.label})</span><input type="number" min="0.01" step="any" value={radiusUnit} aria-invalid={Boolean(radiusError)} onChange={(event) => { setRadiusUnit(event.target.value); setRadiusError(''); }} />{radiusError ? <small role="alert">{radiusError}</small> : null}<small>Da 1 a {AURA_LIMITS.maxRadiusCells} caselle; arrotondato alla casella più vicina.</small></label>
      <AuraColorPicker value={draft.color} onChange={set('color')} />
    </div>
  </EditorShell>;
}
