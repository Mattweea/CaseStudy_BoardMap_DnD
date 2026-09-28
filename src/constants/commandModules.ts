// Catalogo dei moduli della tab «Moduli» (P0.12): guida ai comandi realmente disponibili nel
// codice consegnato, filtrabile per ruolo. Nessun JSX qui, così `commandModulesFor` resta
// verificabile con `node --test` senza montare componenti (design, decisione 1).
import {
  AURAS_ACCESS_KEY,
  CONDITION_ACCESS_KEYS,
  CREATURE_CONDITIONS,
  STAND_UP_ACCESS_KEY,
  VEHICLE_CONDITIONS,
  conditionLabel,
} from '../utils/tokens.ts';
import type { TokenCondition } from '../types';

export type CommandAudience = 'all' | 'master' | 'player';

export interface CommandEntry {
  keys: string[];
  text: string;
  audience: CommandAudience;
}

export interface CommandSection {
  title?: string;
  entries: CommandEntry[];
}

export type CommandModuleId =
  | 'map'
  | 'movement'
  | 'measurement'
  | 'combat'
  | 'dice'
  | 'conditions'
  | 'auras'
  | 'hitPoints'
  | 'characterSheet'
  | 'mapManagement';

export interface CommandModule {
  id: CommandModuleId;
  title: string;
  summary: string;
  sections: CommandSection[];
}

function conditionAccessEntry(condition: TokenCondition, scope: string): CommandEntry {
  return {
    keys: [CONDITION_ACCESS_KEYS[condition]],
    text: `${conditionLabel(condition)} (${scope}).`,
    audience: 'all',
  };
}

const creatureConditionEntries: CommandEntry[] = CREATURE_CONDITIONS.map((condition) =>
  conditionAccessEntry(condition, 'creature'),
);
const vehicleConditionEntries: CommandEntry[] = VEHICLE_CONDITIONS.map((condition) =>
  conditionAccessEntry(condition, 'veicoli'),
);

export const COMMAND_MODULES: readonly CommandModule[] = [
  {
    id: 'map',
    title: 'Mappa e visuale',
    summary: 'Zoom, spostamento della visuale, selezione e strumenti sempre disponibili.',
    sections: [
      {
        entries: [
          { keys: ['Rotella'], text: 'Zoom della mappa, ancorato al cursore.', audience: 'all' },
          { keys: ['Ctrl', 'Rotella'], text: 'Sposta la visuale in verticale.', audience: 'all' },
          { keys: ['Alt', 'Rotella'], text: 'Sposta la visuale in orizzontale.', audience: 'all' },
          { keys: ['Pinch trackpad'], text: 'Zoom della mappa, ancorato alle dita.', audience: 'all' },
          { keys: ['Scorrimento a due dita'], text: 'Sposta la visuale (pan) sul trackpad, in ogni direzione.', audience: 'all' },
          { keys: ['+', '−'], text: 'Pulsanti di zoom a lato della mappa.', audience: 'all' },
          { keys: ['Ctrl', 'trascina'], text: 'Sposta la visuale (pan).', audience: 'all' },
          { keys: ['Tasto centrale', 'trascina'], text: 'Sposta la visuale (pan).', audience: 'all' },
          { keys: ['Click'], text: 'Seleziona un elemento.', audience: 'all' },
          {
            keys: ['Shift', 'click'],
            text: 'Aggiunge alla selezione; trascinare su spazio vuoto apre un riquadro di selezione multipla.',
            audience: 'master',
          },
          { keys: ['Full screen'], text: 'Alterna la mappa a schermo intero.', audience: 'all' },
          { keys: ['Elementi in mappa'], text: 'Elenco filtrabile di tutti gli elementi, con localizzazione.', audience: 'all' },
          { keys: ['Averno'], text: 'Mostra l’immagine della mappa dell’Averno.', audience: 'all' },
          { keys: ['Manuale'], text: 'Apre il manuale della campagna.', audience: 'all' },
          {
            keys: ['Localizza'],
            text: 'Nella tab Personaggi, centra la mappa sul token del personaggio scelto.',
            audience: 'all',
          },
          {
            keys: ['Blocca sidebar'],
            text: 'Tiene il pannello laterale aperto invece di richiuderlo quando il puntatore esce.',
            audience: 'all',
          },
        ],
      },
    ],
  },
  {
    id: 'movement',
    title: 'Movimento',
    summary: 'Pianificazione del percorso con conferma e annullamento, spostamento da tastiera.',
    sections: [
      {
        title: 'Pianificazione del percorso',
        entries: [
          { keys: ['Click sul token'], text: 'Seleziona il token e apre il piano di movimento.', audience: 'all' },
          { keys: ['Click'], text: 'Aggiunge un punto intermedio al percorso in corso.', audience: 'all' },
          { keys: ['Spazio'], text: 'Conferma il movimento sulla casella sotto il puntatore.', audience: 'all' },
          { keys: ['Backspace'], text: 'Toglie l’ultimo punto del percorso.', audience: 'all' },
          { keys: ['Esc'], text: 'Annulla il piano senza inviare nulla.', audience: 'all' },
          { keys: ['Click destro'], text: 'Annulla il piano, come Esc.', audience: 'all' },
        ],
      },
      {
        title: 'Da tastiera e pad',
        entries: [
          {
            keys: ['←', '→', '↑', '↓', 'W', 'A', 'S', 'D'],
            text: 'Muovono il tuo personaggio di una cella.',
            audience: 'player',
          },
          { keys: ['Home', 'PgUp', 'End', 'PgDn'], text: 'Muovono il tuo personaggio in diagonale.', audience: 'player' },
          { keys: ['Pad direzionale'], text: 'Le stesse otto direzioni, da mouse o tocco.', audience: 'player' },
          { keys: ['-1', '+1'], text: 'Rimuovono o aggiungono movimento extra al round.', audience: 'player' },
          {
            keys: ['Scatto'],
            text: 'Raddoppia il movimento nel proprio turno di un round avviato; una volta per round.',
            audience: 'player',
          },
          { keys: ['Ctrl+Z'], text: 'Annulla la tua ultima azione.', audience: 'player' },
          {
            keys: ['←', '→', '↑', '↓', 'W', 'A', 'S', 'D'],
            text: 'Muovono i token selezionati, incluso un gruppo o un ostacolo collegato.',
            audience: 'master',
          },
          { keys: ['Drag'], text: 'Sposta i token selezionati, un gruppo o gli ostacoli collegati.', audience: 'master' },
          {
            keys: ['Regola delle diagonali'],
            text: 'Standard o variante 5-10-5, nella tab Movimento e misura.',
            audience: 'master',
          },
          {
            keys: ['Unità di misura'],
            text: 'Etichetta e valore per casella, nella tab Movimento e misura.',
            audience: 'master',
          },
          { keys: ['Ctrl+Z'], text: 'Annulla globale, per qualunque azione della sessione.', audience: 'master' },
        ],
      },
    ],
  },
  {
    id: 'measurement',
    title: 'Strumenti di misura',
    summary: 'Righello, sagome e ping, con le loro scorciatoie e l’uscita con Esc.',
    sections: [
      {
        entries: [
          { keys: ['R'], text: 'Righello: misura la distanza tra due punti.', audience: 'all' },
          { keys: ['P'], text: 'Ping: segnala un punto sulla mappa a tutti i partecipanti.', audience: 'all' },
          { keys: ['C'], text: 'Sagoma a cerchio.', audience: 'all' },
          { keys: ['O'], text: 'Sagoma a cono.', audience: 'all' },
          { keys: ['L'], text: 'Sagoma a linea.', audience: 'all' },
          { keys: ['Esc'], text: 'Chiude lo strumento di misura attivo.', audience: 'all' },
          {
            keys: ['R', 'P', 'C', 'O', 'L'],
            text: 'Inerti mentre il fuoco è in un campo di testo o durante un’altra interazione di mappa.',
            audience: 'all',
          },
        ],
      },
    ],
  },
  {
    id: 'combat',
    title: 'Combattimento e iniziativa',
    summary: 'Avvio e gestione dei turni, tiro d’iniziativa e fine del turno secondo il ruolo.',
    sections: [
      {
        entries: [
          { keys: ['Avvia combattimento'], text: 'Apre la fase di tiro dell’iniziativa.', audience: 'master' },
          { keys: ['Avvia round 1'], text: 'Avvia il round con le voci già tirate.', audience: 'master' },
          { keys: ['Turno precedente', 'Turno successivo'], text: 'Fanno avanzare o retrocedere il turno attivo.', audience: 'master' },
          { keys: ['Tira per tutti'], text: 'Tira l’iniziativa per le creature che non l’hanno ancora.', audience: 'master' },
          { keys: ['Gestisci voci'], text: 'Tiro, valore manuale o rimozione per una singola creatura.', audience: 'master' },
          { keys: ['↑', '↓'], text: 'Riordinano una voce nell’ordine dei turni.', audience: 'master' },
          { keys: ['Rimuovi dall’ordine'], text: 'Toglie una voce dall’ordine dei turni.', audience: 'master' },
          { keys: ['Aggiungi selezionati'], text: 'Aggiunge i token selezionati ai turni, nella card Azioni.', audience: 'master' },
          { keys: ['Termina combattimento'], text: 'Chiude il combattimento e torna in esplorazione.', audience: 'master' },
          { keys: ['Tira l’iniziativa'], text: 'Tira l’iniziativa del tuo personaggio, quando non l’hai ancora tirata.', audience: 'player' },
          {
            keys: ['Termina il mio turno'],
            text: 'Passa il turno, solo quando il Master lo consente e è il tuo turno.',
            audience: 'player',
          },
        ],
      },
    ],
  },
  {
    id: 'dice',
    title: 'Dadi',
    summary: 'Vassoio, modificatore, visibilità, comandi /r e /rs, e preferenze locali.',
    sections: [
      {
        entries: [
          {
            keys: ['Click', 'Click destro'],
            text: 'Nel vassoio, aggiungono o tolgono un dado dalla selezione cumulativa (fino a 20 per tipo).',
            audience: 'all',
          },
          { keys: ['d20'], text: 'Non si combina con altri tipi di dado nello stesso tiro.', audience: 'all' },
          { keys: ['Modificatore'], text: 'Campo numerico nella configurazione del tiro.', audience: 'all' },
          { keys: ['Pubblico', 'Segreto'], text: 'Visibilità del tiro per gli altri partecipanti.', audience: 'all' },
          { keys: ['/r', 'Invio'], text: 'Tiro pubblico da comando, per esempio /r 1d20+5.', audience: 'all' },
          { keys: ['/rs', 'Invio'], text: 'Tiro segreto da comando, per esempio /rs 1d8+3d6.', audience: 'all' },
          {
            keys: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'],
            text: 'Formule supportate, fino a 20 dadi per tiro.',
            audience: 'all',
          },
          { keys: ['Click', 'Esc'], text: 'Saltano l’animazione 3D del tiro in corso, senza annullare il risultato.', audience: 'all' },
          {
            keys: ['Preferenze dadi'],
            text: 'Animazione 3D e suoni sono preferenze locali, nella tab Impostazioni.',
            audience: 'all',
          },
        ],
      },
    ],
  },
  {
    id: 'conditions',
    title: 'Condizioni',
    summary: 'Apertura del menu radiale, tasti d’accesso, «Alzati», livelli di Indebolimento.',
    sections: [
      {
        entries: [
          {
            keys: ['Click destro'],
            text: 'Sul token che puoi modificare, apre il menu delle condizioni (nessuna interazione di mappa in corso).',
            audience: 'all',
          },
          { keys: ['S', 'Shift+F10'], text: 'Aprono lo stesso menu sul token con il fuoco da tastiera.', audience: 'all' },
          { keys: ['Frecce'], text: 'Spostano il fuoco tra le voci del menu.', audience: 'all' },
          { keys: ['Invio', 'Spazio'], text: 'Attivano la voce con il fuoco.', audience: 'all' },
        ],
      },
      {
        title: 'Tasti d’accesso',
        entries: [...creatureConditionEntries, ...vehicleConditionEntries],
      },
      {
        entries: [
          { keys: ['+'], text: 'Apre il pannello con le condizioni restanti.', audience: 'all' },
          { keys: [STAND_UP_ACCESS_KEY], text: 'Alzati: costa metà del movimento effettivo.', audience: 'all' },
          {
            keys: [CONDITION_ACCESS_KEYS.prone],
            text: 'Toglie Prono senza costo, per esempio quando un alleato aiuta a rialzarsi.',
            audience: 'all',
          },
          { keys: ['0', '1', '2', '3', '4', '5', '6'], text: 'Impostano direttamente il livello di Indebolimento.', audience: 'all' },
          { keys: ['Esc'], text: 'Chiude il menu (o torna dal pannello +) e restituisce il fuoco al token.', audience: 'all' },
        ],
      },
    ],
  },
  {
    id: 'auras',
    title: 'Aure',
    summary: 'Accensione delle aure dal menu radiale e, per il Player, il pannello delle aure altrui.',
    sections: [
      {
        entries: [
          {
            keys: [AURAS_ACCESS_KEY],
            text: 'Apre il pannello delle aure del personaggio, per il proprietario o il Master.',
            audience: 'all',
          },
          { keys: ['Frecce'], text: 'Spostano il fuoco tra le aure nel pannello.', audience: 'all' },
          { keys: ['Invio', 'Spazio'], text: 'Accendono o spengono l’aura con il fuoco.', audience: 'all' },
          { keys: ['Esc'], text: 'Torna dal pannello aure alla corona del menu.', audience: 'all' },
          {
            keys: ['Mostra dettagli', 'Nascondi dettagli'],
            text: 'Nel pannello delle aure altrui in cui ti trovi, rivela o nasconde l’effetto.',
            audience: 'player',
          },
        ],
      },
    ],
  },
  {
    id: 'hitPoints',
    title: 'Punti ferita',
    summary: 'Modifica dei punti ferita dal menu radiale e dalla scheda.',
    sections: [
      {
        entries: [
          { keys: ['Icona PF'], text: 'Nel menu delle condizioni, apre il campo dei punti ferita.', audience: 'all' },
          { keys: ['-', '+'], text: 'Aprono il campo dei punti ferita con il segno già scritto.', audience: 'all' },
          { keys: ['Invio'], text: 'Applica il valore digitato e torna al menu.', audience: 'all' },
          { keys: ['Esc'], text: 'Chiude il campo senza applicare; un secondo Esc chiude il menu.', audience: 'all' },
          { keys: ['PF nella scheda'], text: 'Aggiorna i punti ferita direttamente dalla scheda personaggio.', audience: 'all' },
        ],
      },
    ],
  },
  {
    id: 'characterSheet',
    title: 'Scheda personaggio',
    summary: 'Apertura, spostamento della finestra, visibilità dei tiri dalla scheda.',
    sections: [
      {
        entries: [
          { keys: ['Apri scheda'], text: 'Apre la scheda del personaggio, nella tab Personaggi.', audience: 'all' },
          { keys: ['Trascina la barra'], text: 'Sposta la finestra della scheda.', audience: 'all' },
          { keys: ['Alt', 'Frecce'], text: 'Spostano la finestra della scheda da tastiera.', audience: 'all' },
          {
            keys: ['Tiri: Pubblici / Segreti'],
            text: 'Alterna la visibilità dei tiri effettuati dalla scheda.',
            audience: 'all',
          },
          { keys: ['×'], text: 'Chiude la scheda.', audience: 'all' },
          { keys: ['Apri scheda'], text: 'Il Master può aprire la scheda di ogni personaggio, non solo la propria.', audience: 'master' },
        ],
      },
    ],
  },
  {
    id: 'mapManagement',
    title: 'Gestione della mappa',
    summary: 'Creazione, rimozione, visibilità degli elementi, luci e annullamento globale.',
    sections: [
      {
        entries: [
          { keys: ['Nuovo elemento'], text: 'Apre la creazione di un nuovo elemento, nella card Azioni.', audience: 'master' },
          { keys: ['Canc', 'Backspace'], text: 'Rimuovono i token selezionati.', audience: 'master' },
          { keys: ['Rimuovi selezionati'], text: 'Rimuove i token selezionati, nella card Azioni.', audience: 'master' },
          { keys: ['Rimuovi'], text: 'Rimuove un singolo elemento, nell’elenco Elementi in mappa.', audience: 'master' },
          {
            keys: ['Nascondi', 'Mostra'],
            text: 'Alterna Invisibile su un token, nell’elenco Elementi in mappa.',
            audience: 'master',
          },
          { keys: ['Mostra sfondo board', 'Nascondi sfondo board'], text: 'Alterna la visibilità dello sfondo della mappa.', audience: 'master' },
          { keys: ['Posa ostacolo libera'], text: 'Seleziona celle e conferma o annulla un nuovo ostacolo.', audience: 'master' },
          { keys: ['Illumina tutto', 'Riattiva buio'], text: 'Alterna l’illuminazione completa della mappa.', audience: 'master' },
          { keys: ['Posa luce'], text: 'Piazza una nuova luce puntuale con il raggio impostato.', audience: 'master' },
          { keys: ['Ctrl+Z'], text: 'Annulla globale, per qualunque azione della sessione.', audience: 'master' },
        ],
      },
    ],
  },
];

export function commandModulesFor(role: 'master' | 'player'): CommandModule[] {
  return COMMAND_MODULES.map((commandModule) => ({
    ...commandModule,
    sections: commandModule.sections
      .map((section) => ({
        ...section,
        entries: section.entries.filter((entry) => entry.audience === 'all' || entry.audience === role),
      }))
      .filter((section) => section.entries.length > 0),
  })).filter((commandModule) => commandModule.sections.length > 0);
}
