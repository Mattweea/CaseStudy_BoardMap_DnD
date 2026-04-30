import { useEffect, useState } from 'react';
import { useAnimatedPresence } from '../hooks/useAnimatedPresence';
import type { DiceRollLog } from '../types';

const RESULT_EXIT_DURATION_MS = 180;
const RESULT_REVEAL_DELAY_MS = 1200;
const RESULT_CLOSE_DELAY_MS = 6200;

interface DiceResultScene {
  flavor: string;
  log: DiceRollLog;
}

interface DiceResultModalProps {
  result: DiceResultScene | null;
  onClose: () => void;
}

export function DiceResultModal({ result, onClose }: DiceResultModalProps) {
  const { shouldRender, isVisible } = useAnimatedPresence(result !== null, RESULT_EXIT_DURATION_MS);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (!result) {
      setShowResult(false);
      return undefined;
    }

    setShowResult(false);

    const revealTimeoutId = window.setTimeout(() => {
      setShowResult(true);
    }, RESULT_REVEAL_DELAY_MS);

    const closeTimeoutId = window.setTimeout(() => {
      onClose();
    }, RESULT_CLOSE_DELAY_MS);

    return () => {
      window.clearTimeout(revealTimeoutId);
      window.clearTimeout(closeTimeoutId);
    };
  }, [onClose, result]);

  if (!result || !shouldRender) {
    return null;
  }

  return (
    <div
      className="dice-result-overlay"
      data-state={isVisible ? 'open' : 'closed'}
      role="status"
      aria-live="polite"
    >
      <div className="dice-result-card" data-state={isVisible ? 'open' : 'closed'}>
        <p className="eyebrow dice-result-card__eyebrow">Risultato</p>
        {result.log.rollerName ? <p className="dice-result-card__roller">{`${result.log.rollerName} lancia i dadi...`}</p> : null}
        <p className="dice-result-card__flavor">{result.flavor}</p>

        <div
          className={`dice-result-card__reveal ${showResult ? 'dice-result-card__reveal--visible' : ''}`}
          aria-hidden={!showResult}
        >
          <h2>{result.log.total}</h2>
          <p className="dice-result-card__formula">{result.log.formula}</p>
          <p className="dice-result-card__detail">
            Tiri: {result.log.rolls.join(', ')} | Totale: {result.log.total}
          </p>
        </div>
      </div>
    </div>
  );
}
