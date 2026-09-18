import type { DiceRollLog } from '../types';
import { Modal } from './Modal';

interface DiceLogModalProps {
  isOpen: boolean;
  logs: DiceRollLog[];
  onClose: () => void;
  onClear: () => void;
}

const abilityLabels: Record<string, string> = {
  strength: 'Forza', dexterity: 'Destrezza', constitution: 'Costituzione',
  intelligence: 'Intelligenza', wisdom: 'Saggezza', charisma: 'Carisma',
};

const modeLabels: Record<string, string> = { advantage: 'Vantaggio', disadvantage: 'Svantaggio' };

export function DiceLogModal({ isOpen, logs, onClose, onClear }: DiceLogModalProps) {
  return (
    <Modal title="Log dei dadi" isOpen={isOpen} onClose={onClose}>
      <div className="panel-heading">
        <button type="button" className="secondary-button secondary-button--small" onClick={onClear}>
          Reset log
        </button>
      </div>

      <div className="log-list">
        {logs.length === 0 ? <p className="empty-state">Nessun tiro registrato.</p> : null}

        {logs.map((log) => (
          <article key={log.id} className="log-card">
            <div className="log-card__header">
              <strong>{log.actionLabel ?? log.label}</strong>
              <span>{log.timestamp}</span>
            </div>
            <div className="log-card__body">
              {log.characterName ? <span>Personaggio: {log.characterName}</span> : log.rollerName ? <span>Autore: {log.rollerName}</span> : null}
              {log.rollerName && log.characterName ? <span>Autore: {log.rollerName}</span> : null}
              {log.parts?.length ? (
                <ul className="log-card__parts">
                  {log.parts.map((part, index) => (
                    <li key={`${log.id}-part-${index}`}>
                      <strong>{part.label}</strong>: {part.formula} — Tiri: {part.rolls.join(', ')} — Totale: {part.total}
                      {part.critical ? ' — Critico!' : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <span>Formula: {log.formula}</span>
                  <span>Tiri: {log.rolls.join(', ')}</span>
                  <span>Totale: {log.total}</span>
                </>
              )}
              {modeLabels[log.mode] ? <span>Modalità: {modeLabels[log.mode]} (dadi tenuti: {log.keptRolls.join(', ')})</span> : null}
              {log.savingThrow ? (
                <span>Tiro salvezza: {log.savingThrow.ability ? abilityLabels[log.savingThrow.ability] ?? log.savingThrow.ability : '—'} CD {log.savingThrow.dc || '—'}</span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </Modal>
  );
}
