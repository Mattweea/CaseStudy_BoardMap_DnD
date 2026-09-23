import { useState } from 'react';
import type { DiceRollRequest, DiceType, RollMode } from '../types';
import { DICE_OPTIONS } from '../utils/dice';
import { DiceGlyph, numericDiceToIconType } from './DiceIcons';
import { Modal } from './Modal';

interface DicePanelProps {
  onRoll: (request: DiceRollRequest) => Promise<{ ok: boolean; message?: string } | undefined>;
  animationEnabled: boolean;
  soundEnabled: boolean;
  onAnimationEnabledChange: (enabled: boolean) => void;
  onSoundEnabledChange: (enabled: boolean) => void;
}
const initialCounts = Object.fromEntries(DICE_OPTIONS.map((die) => [die, 0])) as Record<DiceType, number>;

export function DicePanel({
  onRoll,
  animationEnabled,
  soundEnabled,
  onAnimationEnabledChange,
  onSoundEnabledChange,
}: DicePanelProps) {
  const [selectedDie, setSelectedDie] = useState<DiceType | null>(null);
  const [counts, setCounts] = useState<Record<DiceType, number>>({ ...initialCounts });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'secret'>('public');
  const [modifierInput, setModifierInput] = useState('');
  const [mode, setMode] = useState<RollMode>('normal');
  const [command, setCommand] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const count = selectedDie ? counts[selectedDie] : 0;
  const modifier = Number(modifierInput) || 0;
  const formula = `${Math.max(1, count)}d${selectedDie ?? 20}${modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : modifier}`;
  const changeCount = (die: DiceType, delta: number) => { setSelectedDie(die); setCounts((current) => ({ ...current, [die]: Math.max(0, Math.min(20, current[die] + delta)) })); };
  const resetDice = () => { setCounts({ ...initialCounts }); setSelectedDie(null); setModifierInput(''); setMode('normal'); setVisibility('public'); };
  const submit = async () => { if (isRolling || count < 1) return; setIsRolling(true); setMessage(null); const result = await onRoll({ formula, visibility, mode }); if (!result?.ok) setMessage(result?.message ?? 'Tiro non riuscito.'); else { setIsConfigOpen(false); resetDice(); } setIsRolling(false); };
  const submitCommand = async () => {
    const match = command.trim().match(/^\/r\s+(.+)$/i);
    if (!match || isRolling) { setMessage('Usa /r seguito dalla formula, ad esempio /r 1d20+5.'); return; }
    setIsRolling(true); setMessage(null);
    const result = await onRoll({ formula: match[1], visibility: 'public', mode: 'normal' });
    if (!result?.ok) setMessage(result?.message ?? 'Tiro non riuscito.'); else { setCommand(''); resetDice(); }
    setIsRolling(false);
  };

  return <section className="dice-panel" aria-label="Controlli dadi">
    <div className="dice-panel__tray" aria-label="Scegli dadi: click sinistro aggiunge, destro rimuove">
      {DICE_OPTIONS.map((die) => <button key={die} type="button" className={`dice-chip ${selectedDie === die ? 'dice-chip--active' : ''}`} aria-pressed={selectedDie === die} onClick={() => changeCount(die, 1)} onContextMenu={(event) => { event.preventDefault(); changeCount(die, -1); }} aria-label={`d${die}, quantità ${counts[die]}. Click aggiunge, click destro rimuove.`}><DiceGlyph type={numericDiceToIconType[die]} className="dice-chip__icon" /><span className="dice-chip__shape">d{die}</span>{counts[die] ? <b className="dice-chip__count">{counts[die]}</b> : null}</button>)}
    </div>
    <div className="dice-panel__actions"><span aria-live="polite">{count ? `${count}d${selectedDie}` : 'Scegli un dado'}</span><button type="button" className="primary-button" onClick={() => setIsConfigOpen(true)} disabled={!count}>Tira</button></div>
    <fieldset className="dice-panel__preferences">
      <legend>Presentazione dadi</legend>
      <label className="dice-panel__preference">
        <input type="checkbox" checked={animationEnabled} onChange={(event) => onAnimationEnabledChange(event.target.checked)} />
        <span>Animazione 3D</span>
      </label>
      <label className="dice-panel__preference">
        <input type="checkbox" checked={soundEnabled} onChange={(event) => onSoundEnabledChange(event.target.checked)} />
        <span>Suoni</span>
      </label>
    </fieldset>
    <textarea className="dice-panel__chat-input" value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submitCommand(); } }} placeholder="Scrivi /r 1d20+5 e premi Invio" rows={2} aria-label="Comando dadi" />
    {message ? <p className="dice-panel__error" role="alert">{message}</p> : null}
    <Modal title={`Tira ${Math.max(1, count)}d${selectedDie}`} isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} className="modal-card--dice" backdropClassName="modal-backdrop--map">
      <div className="dice-roll-config">
        <fieldset className="dice-roll-config__group"><legend>Modificatore</legend><input className="dice-roll-config__modifier" type="number" min="-1000" max="1000" value={modifierInput} placeholder="0" onChange={(event) => setModifierInput(event.target.value)} /></fieldset>
        <fieldset className="dice-roll-config__group"><legend>Modalità</legend>{(['normal', 'advantage', 'disadvantage'] as RollMode[]).map((value) => <button key={value} type="button" className={mode === value ? 'dice-choice dice-choice--active' : 'dice-choice'} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'normal' ? 'Normale' : value === 'advantage' ? 'Vantaggio' : 'Svantaggio'}</button>)}</fieldset>
        <fieldset className="dice-roll-config__group"><legend>Visibilità</legend>{(['public', 'secret'] as const).map((value) => <button key={value} type="button" className={visibility === value ? 'dice-choice dice-choice--active' : 'dice-choice'} aria-pressed={visibility === value} onClick={() => setVisibility(value)}>{value === 'public' ? 'Pubblico' : 'Segreto'}</button>)}</fieldset>
        <button type="button" className="primary-button" onClick={() => void submit()} disabled={isRolling}>{isRolling ? 'Il fato decide…' : `Tira ${formula}`}</button>
      </div>
    </Modal>
  </section>;
}
