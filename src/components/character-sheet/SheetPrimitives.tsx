import type { ChangeEvent, ReactNode } from 'react';
import { formatSigned } from '../../../shared/dnd-rules';
import { GearIcon, LockIcon, ProficiencyMarkIcon, UnlockIcon } from '../UiIcons';

export function SheetPanel({ title, className = '', rollSource, headerAction, children }: {
  title: string; className?: string; rollSource?: string; headerAction?: ReactNode; children: ReactNode;
}) {
  return <section className={`sheet-panel ${className}`} data-roll-source={rollSource}>
    <h3>{title}{headerAction}</h3>
    <div className="sheet-panel__body">{children}</div>
  </section>;
}

export function SheetField({ label, value, onChange, className = '', multiline = false, type = 'text' }: {
  label: string; value: string; onChange: (value: string) => void; className?: string; multiline?: boolean; type?: string;
}) {
  const props = { value, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value), 'aria-label': label };
  return <label className={`sheet-field ${className}`}>
    {multiline ? <textarea {...props} /> : <input {...props} type={type} />}
    <span>{label}</span>
  </label>;
}

export function SheetSelect({ label, value, options, onChange, className = '' }: {
  label: string; value: string; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void; className?: string;
}) {
  return <label className={`sheet-field sheet-field--select ${className}`}>
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
    </select>
    <span>{label}</span>
  </label>;
}

export function FramedValue({ label, value, onChange, compact = false, rollSource, className = '' }: { label: string; value: string; onChange: (value: string) => void; compact?: boolean; rollSource?: string; className?: string }) {
  return <label className={`framed-value ${compact ? 'framed-value--compact' : ''} ${className}`} data-roll-source={rollSource}><input value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} /><span>{label}</span></label>;
}

// Come FramedValue ma per un valore booleano (Ispirazione): una casella, non testo libero.
export function FramedCheckbox({ label, checked, onChange, compact = false, className = '' }: { label: string; checked: boolean; onChange: (checked: boolean) => void; compact?: boolean; className?: string }) {
  return <label className={`framed-value framed-value--checkbox ${compact ? 'framed-value--compact' : ''} ${className}`}>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} />
    <span>{label}</span>
  </label>;
}

// Valore calcolato dalle regole: sola lettura, mai un input, quindi fuori dalla tabulazione.
export function ReadOnlyStat({ label, value, compact = false, rollSource, className = '' }: {
  label: string; value: number | null; compact?: boolean; rollSource?: string; className?: string;
}) {
  return <div className={`framed-value framed-value--readonly ${compact ? 'framed-value--compact' : ''} ${className}`} data-roll-source={rollSource}>
    <output aria-label={label}>{formatSigned(value)}</output>
    <span>{label}</span>
  </div>;
}

// Come ReadOnlyStat ma con il proprio campo bonus vari accanto (iniziativa, valori da incantatore).
// `rollDisabledReason` lascia l'ancoraggio del bersaglio al suo posto ma lo mostra inattivo, con la
// spiegazione come testo accessibile; `badge` è un'etichetta breve accanto al valore.
export function ComputedWithMiscBonus({ label, value, miscBonus, onMiscBonus, compact = false, rollSource, className = '', rollDisabledReason, badge }: {
  label: string; value: number | null; miscBonus: string; onMiscBonus: (value: string) => void; compact?: boolean; rollSource?: string; className?: string;
  rollDisabledReason?: string; badge?: ReactNode;
}) {
  return <div
    className={`framed-value framed-value--readonly framed-value--misc ${compact ? 'framed-value--compact' : ''} ${rollDisabledReason ? 'framed-value--roll-disabled' : ''} ${className}`}
    data-roll-source={rollSource} aria-disabled={rollDisabledReason ? true : undefined} title={rollDisabledReason}
  >
    {badge}
    <output aria-label={label}>{formatSigned(value)}</output>
    <input className="framed-value__misc" value={miscBonus} onChange={(event) => onMiscBonus(event.target.value)} aria-label={`Bonus vari: ${label}`} placeholder="±" title="Bonus vari" />
    <span>{label}</span>
  </div>;
}

export type CompetenceState = { key: 'none' | 'proficient' | 'expertise'; ariaLabel: string };

// Indicatore ciclico di competenza: due stati per i tiri salvezza, tre per abilità e strumenti.
// Un <button> nativo copre da solo tastiera e stato esposto (aria-label cambia ad ogni stato).
export function CompetenceRow({ label, states, currentIndex, onCycle, value, miscBonus, onMiscBonus, rollSource }: {
  label: string; states: readonly CompetenceState[]; currentIndex: number; onCycle: () => void;
  value: number | null; miscBonus: string; onMiscBonus: (value: string) => void; rollSource?: string;
}) {
  const current = states[currentIndex];
  return <div className="proficiency-row" data-roll-source={rollSource}>
    <button type="button" className={`proficiency-indicator proficiency-indicator--${current.key}`} onClick={onCycle} aria-label={`Competenza ${label}: ${current.ariaLabel}`}>
      <ProficiencyMarkIcon level={current.key} />
    </button>
    <output className="proficiency-row__value" aria-label={`Valore: ${label}`}>{formatSigned(value)}</output>
    <input className="proficiency-row__misc" value={miscBonus} onChange={(event) => onMiscBonus(event.target.value)} aria-label={`Bonus vari: ${label}`} placeholder="±" title="Bonus vari" />
    <span>{label}</span>
  </div>;
}

export const SAVING_THROW_STATES: readonly CompetenceState[] = [
  { key: 'none', ariaLabel: 'nessuna competenza' },
  { key: 'proficient', ariaLabel: 'competente' },
];
export const SKILL_STATES: readonly CompetenceState[] = [
  { key: 'none', ariaLabel: 'nessuna competenza' },
  { key: 'proficient', ariaLabel: 'competente' },
  { key: 'expertise', ariaLabel: 'esperto' },
];

// Tre indicatori riempibili/svuotabili a mano per riga (dadi vita e salvataggi contro morte).
export function PipCounter({ label, count, max, onChange }: { label: string; count: number; max: number; onChange: (count: number) => void }) {
  return <div className="pip-counter" role="group" aria-label={label}>
    {Array.from({ length: max }, (_, index) => {
      const filled = index < count;
      return <button
        key={index}
        type="button"
        className={`pip-counter__pip ${filled ? 'pip-counter__pip--filled' : ''}`}
        aria-pressed={filled}
        aria-label={`${label} ${index + 1} di ${max}${filled ? ', pieno' : ', vuoto'}`}
        onClick={() => onChange(filled && index === count - 1 ? count - 1 : index + 1)}
      />;
    })}
  </div>;
}

export function GearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="sheet-gear-button" onClick={onClick} aria-label={label} title={label}><GearIcon size="0.95em" /></button>;
}

export function LockToggle({ locked, onToggle, label }: { locked: boolean; onToggle: () => void; label: string }) {
  return <button type="button" className={`sheet-lock-toggle ${locked ? 'sheet-lock-toggle--locked' : ''}`} onClick={onToggle} aria-pressed={locked} aria-label={locked ? `${label}: sblocca` : `${label}: blocca`} title={locked ? 'Sblocca sezione' : 'Blocca sezione'}>
    {locked ? <LockIcon size="1em" /> : <UnlockIcon size="1em" />}
  </button>;
}

export function RowActions({ onAdd, label }: { onAdd: () => void; label: string }) {
  return <button type="button" className="sheet-add-row" onClick={onAdd}>+ {label}</button>;
}

export function RemoveRowButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <button type="button" className="sheet-remove-row" onClick={onRemove} aria-label={label} title={label}>×</button>;
}
