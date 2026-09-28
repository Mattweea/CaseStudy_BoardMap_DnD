import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { commandModulesFor } from '../constants/commandModules';
import type { CommandModule, CommandModuleId } from '../constants/commandModules';
import { Modal } from './Modal';
import {
  BlockIcon,
  BookIcon,
  ChatDiceIcon,
  CrossedSwordsIcon,
  DashIcon,
  HeartIcon,
  MapIcon,
  PlusIcon,
  RulerIcon,
  SparkIcon,
} from './UiIcons';

export interface CommandModulesProps {
  role: 'master' | 'player';
}

const MODULE_ICONS: Partial<Record<CommandModuleId, ReactNode>> = {
  map: <MapIcon aria-hidden="true" />,
  movement: <DashIcon aria-hidden="true" />,
  measurement: <RulerIcon aria-hidden="true" />,
  combat: <CrossedSwordsIcon aria-hidden="true" size="1.1em" />,
  dice: <ChatDiceIcon aria-hidden="true" />,
  conditions: <BlockIcon aria-hidden="true" />,
  auras: <SparkIcon aria-hidden="true" />,
  hitPoints: <HeartIcon aria-hidden="true" />,
  characterSheet: <BookIcon aria-hidden="true" />,
  mapManagement: <PlusIcon aria-hidden="true" />,
};

// Isola i tasti dalla mappa e dalla sessione mentre la modale è aperta (design, decisione 5): la
// cattura su `window` precede i listener in bubble di `App.tsx` e `Board.tsx`, così frecce, WASD,
// scorciatoie degli strumenti, `S`, `Canc` e `Ctrl+Z` non li raggiungono. `Escape` e `Tab` passano
// perché chiudono la modale o spostano il fuoco al suo interno; nessun `preventDefault`, quindi
// l'attivazione dei pulsanti e le scorciatoie native del browser restano intatte.
function useModalKeyIsolation(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab') return;
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [active]);
}

function ModuleDetail({ commandModule }: { commandModule: CommandModule }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="command-modules__detail">
      <h3 ref={headingRef} tabIndex={-1} className="visually-hidden">
        {commandModule.title}
      </h3>
      {commandModule.sections.map((section, sectionIndex) => (
        <section key={section.title ?? sectionIndex} className="command-modules__detail-section">
          {section.title ? <h4>{section.title}</h4> : null}
          <dl>
            {section.entries.map((entry, entryIndex) => (
              <div className="command-modules__entry" key={`${entry.keys.join('+')}-${entryIndex}`}>
                <dt>
                  {entry.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </dt>
                <dd>{entry.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

// Guida ai comandi per argomento (P0.12): un elenco di moduli, filtrato per ruolo, che apre una
// modale di dettaglio invece del vecchio blocco di testo unico della «Legenda dei comandi».
export function CommandModules({ role }: CommandModulesProps) {
  const [openModuleId, setOpenModuleId] = useState<CommandModuleId | null>(null);
  const buttonRefs = useRef(new Map<CommandModuleId, HTMLButtonElement>());

  const modules = commandModulesFor(role);
  const openModule = modules.find((commandModule) => commandModule.id === openModuleId) ?? null;

  useModalKeyIsolation(openModule !== null);

  const closeModule = () => {
    const previousId = openModuleId;
    setOpenModuleId(null);
    if (previousId) {
      buttonRefs.current.get(previousId)?.focus();
    }
  };

  return (
    <section className="sidebar__section command-modules">
      <div className="panel-heading">
        <div>
          <h2>Moduli</h2>
        </div>
      </div>
      <div className="command-modules__list">
        <a
          className="command-modules__item command-modules__item--link"
          href="https://5e.tools/book.html#phb"
          target="_blank"
          rel="noreferrer"
        >
          <span className="command-modules__item-icon" aria-hidden="true">
            <BookIcon />
          </span>
          <span className="command-modules__item-text">
            <strong>Manuale del Giocatore 2014</strong>
          </span>
        </a>
        <hr className="command-modules__divider" />
        {modules.map((commandModule) => (
          <button
            key={commandModule.id}
            type="button"
            className="command-modules__item"
            ref={(node) => {
              if (node) buttonRefs.current.set(commandModule.id, node);
              else buttonRefs.current.delete(commandModule.id);
            }}
            onClick={() => setOpenModuleId(commandModule.id)}
          >
            <span className="command-modules__item-icon" aria-hidden="true">
              {MODULE_ICONS[commandModule.id]}
            </span>
            <span className="command-modules__item-text">
              <strong>{commandModule.title}</strong>
              <span className="command-modules__item-summary">{commandModule.summary}</span>
            </span>
          </button>
        ))}
      </div>

      <Modal
        title={openModule?.title ?? ''}
        isOpen={openModule !== null}
        onClose={closeModule}
        className="modal-card--command-module"
      >
        {openModule ? <ModuleDetail commandModule={openModule} /> : null}
      </Modal>
    </section>
  );
}
