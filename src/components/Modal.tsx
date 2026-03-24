import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAnimatedPresence } from '../hooks/useAnimatedPresence';

const MODAL_EXIT_DURATION_MS = 220;

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ title, isOpen, onClose, children, className }: ModalProps) {
  const { shouldRender, isVisible } = useAnimatedPresence(isOpen, MODAL_EXIT_DURATION_MS);

  useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      data-state={isVisible ? 'open' : 'closed'}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={['modal-card', className].filter(Boolean).join(' ')}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-state={isVisible ? 'open' : 'closed'}
      >
        <div className="modal-card__header">
          <h2>{title}</h2>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>
        <div className="modal-card__body" data-state={isVisible ? 'open' : 'closed'}>
          {children}
        </div>
      </div>
    </div>
  );
}
