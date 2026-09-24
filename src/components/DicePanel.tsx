import { useState } from 'react';
import type { DiceRollRequest, DiceType } from '../types';
import { DICE_OPTIONS } from '../utils/dice';
import { DiceGlyph, numericDiceToIconType } from './DiceIcons';
import { Modal } from './Modal';

interface DicePanelProps {
  onRoll: (request: DiceRollRequest) => Promise<{ ok: boolean; message?: string } | undefined>;
}
const initialCounts = Object.fromEntries(DICE_OPTIONS.map((die) => [die, 0])) as Record<DiceType, number>;

const D20_ONLY_MESSAGE = 'Il d20 si tira da solo: non può condividere il tiro con altri tipi di dado.';

export function DicePanel({ onRoll }: DicePanelProps) {
  const [counts, setCounts] = useState<Record<DiceType, number>>({ ...initialCounts });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'secret'>('public');
  const [modifierInput, setModifierInput] = useState('');
  const [command, setCommand] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  // La selezione è cumulativa: ogni tipo di dado tiene il proprio contatore, ordinato per
  // numero di facce nella formula. Il d20 resta l'unica eccezione, perché tira sempre una
  // coppia o esiti indipendenti e non può condividere una formula con altri gruppi.
  const activeDiceTypes = DICE_OPTIONS.filter((die) => counts[die] > 0).sort((a, b) => a - b);
  const totalDiceSelected = activeDiceTypes.reduce((sum, die) => sum + counts[die], 0);
  const modifier = Number(modifierInput) || 0;
  const modifierSuffix = modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : String(modifier);
  const formulaBody = activeDiceTypes.map((die) => `${counts[die]}d${die}`).join('+');
  const formula = `${formulaBody}${modifierSuffix}`;

  const changeCount = (die: DiceType, delta: number) => {
    if (delta > 0) {
      if (die === 20 && DICE_OPTIONS.some((other) => other !== 20 && counts[other] > 0)) {
        setMessage(D20_ONLY_MESSAGE);
        return;
      }
      if (die !== 20 && counts[20] > 0) {
        setMessage(D20_ONLY_MESSAGE);
        return;
      }
    }
    setMessage(null);
    setCounts((current) => ({ ...current, [die]: Math.max(0, Math.min(20, current[die] + delta)) }));
  };
  const resetDice = () => { setCounts({ ...initialCounts }); setModifierInput(''); setVisibility('public'); };
  const submit = async () => {
    if (isRolling || !formulaBody) return;
    setIsRolling(true); setMessage(null);
    const result = await onRoll({ formula, visibility });
    if (!result?.ok) setMessage(result?.message ?? 'Tiro non riuscito.'); else { setIsConfigOpen(false); resetDice(); }
    setIsRolling(false);
  };
  const submitCommand = async () => {
    const match = command.trim().match(/^\/(r|rs)\s+(.+)$/i);
    if (!match || isRolling) { setMessage('Usa /r seguito dalla formula per un tiro pubblico, ad esempio /r 1d20+5, oppure /rs per un tiro segreto, ad esempio /rs 1d8 + 3d6.'); return; }
    setIsRolling(true); setMessage(null);
    const result = await onRoll({ formula: match[2], visibility: match[1].toLowerCase() === 'rs' ? 'secret' : 'public' });
    if (!result?.ok) setMessage(result?.message ?? 'Tiro non riuscito.'); else { setCommand(''); resetDice(); }
    setIsRolling(false);
  };

  return <section className="dice-panel" aria-label="Controlli dadi">
    <div className="dice-panel__tray" aria-label="Scegli dadi: click sinistro aggiunge, destro rimuove">
      {DICE_OPTIONS.map((die) => <button key={die} type="button" className={`dice-chip ${counts[die] ? 'dice-chip--active' : ''}`} aria-pressed={counts[die] > 0} onClick={() => changeCount(die, 1)} onContextMenu={(event) => { event.preventDefault(); changeCount(die, -1); }} aria-label={`d${die}, quantità ${counts[die]}. Click aggiunge, click destro rimuove.`}><DiceGlyph type={numericDiceToIconType[die]} className="dice-chip__icon" /><span className="dice-chip__shape">d{die}</span>{counts[die] ? <b className="dice-chip__count">{counts[die]}</b> : null}</button>)}
    </div>
    <div className="dice-panel__actions"><span aria-live="polite">{formulaBody || 'Scegli un dado'}</span><button type="button" className="primary-button" onClick={() => setIsConfigOpen(true)} disabled={!totalDiceSelected}>Tira</button></div>
    <textarea className="dice-panel__chat-input" value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submitCommand(); } }} placeholder="/r 1d20+5 e Invio per un tiro pubblico, /rs per un tiro segreto" rows={2} aria-label="Comando dadi: /r per un tiro pubblico, /rs per un tiro segreto" />
    {message ? <p className="dice-panel__error" role="alert">{message}</p> : null}
    <Modal title={formulaBody ? `Tira ${formulaBody}` : 'Configura il tiro'} isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} className="modal-card--dice" backdropClassName="modal-backdrop--map">
      <div className="dice-roll-config">
        <fieldset className="dice-roll-config__group"><legend>Modificatore</legend><input className="dice-roll-config__modifier" type="number" min="-1000" max="1000" value={modifierInput} placeholder="0" onChange={(event) => setModifierInput(event.target.value)} /></fieldset>
        <fieldset className="dice-roll-config__group"><legend>Visibilità</legend>{(['public', 'secret'] as const).map((value) => <button key={value} type="button" className={visibility === value ? 'dice-choice dice-choice--active' : 'dice-choice'} aria-pressed={visibility === value} onClick={() => setVisibility(value)}>{value === 'public' ? 'Pubblico' : 'Segreto'}</button>)}</fieldset>
        <button type="button" className="primary-button" onClick={() => void submit()} disabled={isRolling}>{isRolling ? 'Il fato decide…' : `Tira ${formula}`}</button>
      </div>
    </Modal>
  </section>;
}
