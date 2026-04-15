import type { DiceRollLog } from '../types';
import { Modal } from './Modal';

interface DiceLogModalProps {
  isOpen: boolean;
  logs: DiceRollLog[];
  onClose: () => void;
  onClear: () => void;
}

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
              <strong>{log.label}</strong>
              <span>{log.timestamp}</span>
            </div>
            <div className="log-card__body">
              {log.rollerName ? <span>Autore: {log.rollerName}</span> : null}
              <span>Formula: {log.formula}</span>
              <span>Tiri: {log.rolls.join(', ')}</span>
              <span>Totale: {log.total}</span>
            </div>
          </article>
        ))}
      </div>
    </Modal>
  );
}
