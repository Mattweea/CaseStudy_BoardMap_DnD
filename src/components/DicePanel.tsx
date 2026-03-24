import { useEffect, useRef, useState } from 'react';
import type { DiceRollLog, DiceType, RollMode } from '../types';
import { DiceGlyph, numericDiceToIconType } from './DiceIcons';
import { DICE_OPTIONS, rollDice } from '../utils/dice';

const ROLLING_FLAVORS = [
  'I dadi rimbalzano sul tavolo del DM...',
  'Lo schermo del master trema appena...',
  'Le ossa del fato stanno ancora girando...',
];

const ROLLING_DURATION_MS = 520;

interface DicePanelProps {
  logsCount: number;
  rollerName?: string | null;
  isResultOpen: boolean;
  onAddLog: (log: DiceRollLog) => void;
  onShowResult: (payload: { log: DiceRollLog; flavor: string }) => void;
  onOpenLogs: () => void;
}

export function DicePanel({
  logsCount,
  rollerName,
  isResultOpen,
  onAddLog,
  onShowResult,
  onOpenLogs,
}: DicePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [diceType, setDiceType] = useState<DiceType>(20);
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [mode, setMode] = useState<RollMode>('normal');
  const [label, setLabel] = useState('');
  const [isRolling, setIsRolling] = useState(false);
  const rollingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rollingTimeoutRef.current !== null) {
        window.clearTimeout(rollingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isResultOpen || !isRolling) {
      return;
    }

    setMode('normal');
    setLabel('');
    setIsRolling(false);
  }, [isResultOpen, isRolling]);

  const handleRoll = () => {
    if (isRolling) {
      return;
    }

    const nextFlavor = ROLLING_FLAVORS[Math.floor(Math.random() * ROLLING_FLAVORS.length)];
    setIsRolling(true);

    rollingTimeoutRef.current = window.setTimeout(() => {
      const result = rollDice(diceType, count, modifier, mode);

      const log: DiceRollLog = {
        id: crypto.randomUUID(),
        label: label.trim() || result.label,
        formula: result.label,
        rollerName: rollerName ?? undefined,
        timestamp: new Date().toLocaleString('it-IT'),
        rolls: result.rolls,
        keptRolls: result.keptRolls,
        total: result.total,
        modifier,
        mode,
      };

      onAddLog(log);
      onShowResult({ log, flavor: nextFlavor });
      rollingTimeoutRef.current = null;
    }, ROLLING_DURATION_MS);
  };

  return (
    <section className="sidebar__section">
      <div className="panel-heading panel-heading--compact">
        <div>
          <p className="eyebrow">Dice Roller</p>
          <h2>Tira i dadi</h2>
        </div>
        <div className="dice-panel__header-actions">
          <button
            type="button"
            className="secondary-button secondary-button--tiny"
            onClick={() => setIsCollapsed((current) => !current)}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? 'Espandi' : 'Comprimi'}
          </button>
          <button type="button" className="secondary-button secondary-button--tiny" onClick={onOpenLogs}>
            Log ({logsCount})
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          <div className="dice-grid">
            <div className="dice-picker">
              <span className="dice-picker__label">Dado</span>
              <div className="dice-picker__list">
                {DICE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`dice-chip ${diceType === option ? 'dice-chip--active' : ''}`}
                    onClick={() => setDiceType(option)}
                    aria-pressed={diceType === option}
                    aria-label={`Seleziona dado d${option}`}
                  >
                    <DiceGlyph type={numericDiceToIconType[option]} className="dice-chip__icon" />
                    <span className="dice-chip__shape">d{option}</span>
                  </button>
                ))}

                <label className="dice-picker__field dice-picker__field--compact">
                  Quantita
                  <input
                    type="number"
                    min="1"
                    value={count}
                    onChange={(event) => setCount(Number(event.target.value) || 1)}
                    disabled={mode !== 'normal'}
                  />
                </label>

                <label className="dice-picker__field dice-picker__field--compact">
                  Modificatore
                  <input
                    type="number"
                    value={modifier}
                    onChange={(event) => setModifier(Number(event.target.value) || 0)}
                  />
                </label>
              </div>
            </div>

            <label>
              Modalita
              <select value={mode} onChange={(event) => setMode(event.target.value as RollMode)}>
                <option value="normal">Normale</option>
                <option value="advantage">Vantaggio</option>
                <option value="disadvantage">Svantaggio</option>
              </select>
            </label>
          </div>

          <label>
            Etichetta log
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Es. Attacco spada lunga"
            />
          </label>

          {rollerName ? <p className="dice-panel__actor">Tiro di: {rollerName}</p> : null}

          <button
            type="button"
            className={`primary-button dice-panel__roll-button ${isRolling ? 'dice-panel__roll-button--rolling' : ''}`}
            onClick={handleRoll}
            disabled={isRolling}
          >
            {isRolling ? 'Il fato decide...' : 'Tira dado'}
          </button>
        </>
      ) : null}
    </section>
  );
}
