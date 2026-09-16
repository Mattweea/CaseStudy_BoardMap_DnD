import type { ChangeEvent, ReactNode } from 'react';

export function SheetPanel({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  return <section className={`sheet-panel ${className}`}><h3>{title}</h3><div className="sheet-panel__body">{children}</div></section>;
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

export function ProficiencyRow({ label, checked, value, onChecked, onValue, rollSource }: { label: string; checked: boolean; value: string; onChecked: (value: boolean) => void; onValue: (value: string) => void; rollSource?: string }) {
  return <div className="proficiency-row" data-roll-source={rollSource}><input type="checkbox" checked={checked} onChange={(event) => onChecked(event.target.checked)} aria-label={`Competenza: ${label}`} /><input value={value} onChange={(event) => onValue(event.target.value)} aria-label={`Valore: ${label}`} /><span>{label}</span></div>;
}

export function RowActions({ onAdd, label }: { onAdd: () => void; label: string }) {
  return <button type="button" className="sheet-add-row" onClick={onAdd}>+ {label}</button>;
}

export function RemoveRowButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <button type="button" className="sheet-remove-row" onClick={onRemove} aria-label={label} title={label}>×</button>;
}
