import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { auraPresenceFor } from '../../shared/token-auras.mjs';
import type { AuraPresenceRow } from '../../shared/token-auras.mjs';
import type { BattleMapSharedState } from '../types';
import { SparkIcon } from './UiIcons';

interface AuraPresenceBannerProps {
  // Host attivo della mappa (normale o schermo intero), come l'overlay dei dadi (design,
  // decisione 7). `null` mentre nessun host ha ancora riportato il proprio nodo.
  host: HTMLElement | null;
  state: BattleMapSharedState;
  userId: string;
}

// Avviso persistente per chi ha un proprio token (o il proprio famiglio) dentro l'aura accesa di
// un altro personaggio. Il Master non monta questo componente (vedi il chiamante in App.tsx); le
// righe vengono comunque da `auraPresenceFor`, che a sua volta restituisce sempre un array vuoto
// per il Master, come doppia sicurezza.
export function AuraPresenceBanner({ host, state, userId }: AuraPresenceBannerProps) {
  const rows = auraPresenceFor(state, userId) as AuraPresenceRow[];
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const previousKeysRef = useRef<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    setIsOpen(false);
    setExpandedKeys(new Set());
    previousKeysRef.current = new Set();
  }, [state.activeSceneId, userId]);

  // Annuncia solo le righe nuove rispetto al render precedente, senza spostare il fuoco: un
  // ingresso in un'aura non deve interrompere quello che l'Adventurer stava facendo.
  useEffect(() => {
    const previousKeys = previousKeysRef.current;
    const enteredRows = rows.filter((row) => !previousKeys.has(row.key));
    if (enteredRows.length > 0) {
      setAnnouncement(
        enteredRows
          .map((row) => rowText(row))
          .join('. '),
      );
    }
    const currentKeys = new Set(rows.map((row) => row.key));
    previousKeysRef.current = currentKeys;
    if (rows.length === 0) {
      setIsOpen(false);
      setAnnouncement('');
    }
    setExpandedKeys((current) => {
      const next = new Set([...current].filter((key) => currentKeys.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [rows]);

  if (!host || rows.length === 0) {
    return null;
  }

  return createPortal(
    <div className={`aura-presence-banner${isOpen ? ' aura-presence-banner--open' : ''}`}
      onKeyDown={(event) => {
        // Le scorciatoie della board non devono muovere il PG mentre si consulta il pannello.
        event.stopPropagation();
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault();
          setIsOpen(false);
          toggleRef.current?.focus();
        }
      }}>
      <span className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
      <button ref={toggleRef} type="button" className="board-tool-button aura-presence-banner__toggle"
        aria-label={`Aure applicate: ${rows.length}`} aria-expanded={isOpen} aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}>
        <SparkIcon size={18} /><span>Aure</span>
        <span className="aura-presence-banner__count" aria-hidden="true">{rows.length}</span>
        <svg className="aura-presence-banner__chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m3.5 6 4.5 4 4.5-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen ? <ul id={panelId} className="aura-presence-banner__list" aria-label="Aure applicate" tabIndex={0}>
        {rows.map((row) => {
          const isExpanded = expandedKeys.has(row.key);
          return (
            <li key={row.key} className="aura-presence-banner__item">
              <button
                type="button"
                className="aura-presence-banner__row"
                aria-expanded={isExpanded}
                onClick={() =>
                  setExpandedKeys((current) => {
                    const next = new Set(current);
                    if (next.has(row.key)) {
                      next.delete(row.key);
                    } else {
                      next.add(row.key);
                    }
                    return next;
                  })
                }
              >
                <span className="aura-presence-banner__title">{rowText(row)}</span>
                <span className="aura-presence-banner__detail-cue">
                  <svg className="aura-presence-banner__chevron" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m3.5 6 4.5 4 4.5-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{isExpanded ? 'Nascondi dettagli' : 'Mostra dettagli'}</span>
                </span>
              </button>
              {isExpanded ? (
                <p className="aura-presence-banner__effect">{row.effect || 'Nessun effetto indicato'}</p>
              ) : null}
            </li>
          );
        })}
      </ul> : null}
    </div>,
    host,
  );
}

// «Sei nell'aura di X: nome» / «<famiglio> è nell'aura di X: nome» (spec, «Avviso di presenza in
// un'aura»): la forma con l'aura prima del nome evita l'articolo davanti a un nome arbitrario.
function rowText(row: AuraPresenceRow): string {
  const auraName = row.auraName || 'Aura';
  return row.isFamiliar
    ? `${row.subjectName} è nell'aura di ${row.ownerName}: ${auraName}`
    : `Sei nell'aura di ${row.ownerName}: ${auraName}`;
}
