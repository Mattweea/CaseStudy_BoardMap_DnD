## Context

La tab è il `case 'legend'` di `renderSidebarSection` in `src/App.tsx`: paragrafi JSX scritti a mano, un gruppo «Comuni» e un gruppo scelto con `canManageBattleMap`. Il testo non è collegato ai comandi che descrive, perciò è andato fuori sincronia (vedi proposal.md, Why). I comandi reali vivono in punti diversi:

- `App.tsx`: `KEYBOARD_MOVEMENTS` (frecce, WASD, `Home`/`PgUp`/`End`/`PgDn`), `Ctrl+Z`, `Canc`/`Backspace` del Master, movement pad e `-1`/`+1` del Player, pulsante Scatto;
- `Board.tsx`: `TOOL_SHORTCUTS` (`R`, `P`, `C`, `O`, `L`), `Esc`, pianificazione (`Spazio`, `Backspace`, `Esc`, click destro), selezione e pan, pulsanti Full screen, Elementi in mappa, Averno e Manuale, `S`/`Shift+F10`;
- `TokenRadialMenu.tsx` e `src/utils/tokens.ts`: `CONDITION_ACCESS_KEYS`, `STAND_UP_ACCESS_KEY` (`L`), `AURAS_ACCESS_KEY` (`U`), `0`-`6`, `-`/`+`;
- `InitiativePanel.tsx`, `DicePanel.tsx`, `CharacterSheetWindow.tsx`: controlli di turno, vassoio e `/r` `/rs`, `Alt`+frecce e visibilità dei tiri della scheda.

`Modal` esiste già: portal su `document.body`, `Esc` in ascolto su `window` in fase di bubble, click sullo sfondo, pulsante `×`. Non sposta il fuoco all'apertura e non lo restituisce alla chiusura. Le scorciatoie di mappa e sessione ascoltano `keydown` su `window` e ignorano solo i campi di testo, quindi oggi continuano ad agire dietro qualunque modale.

I test girano con `node --test` e importano direttamente moduli `.ts` senza JSX (per esempio `src/utils/dice.ts`).

## Goals / Non-Goals

**Goals:**

- Catalogo dei moduli come dati tipizzati fuori da `App.tsx`, filtrabile per ruolo e verificabile da test.
- Le parti del catalogo che dipendono da una costante esistente, come i tasti d'accesso delle condizioni, si derivano da quella costante.
- Modale di dettaglio con fuoco in entrata e in uscita e tasti isolati dalla mappa, senza modificare il `Modal` condiviso.

**Non-Goals:**

- Nessun nuovo comando e nessuna modifica ai gestori da tastiera esistenti.
- Nessuna persistenza del modulo aperto o della tab.
- Nessun contenuto multimediale (GIF, video) nei moduli: solo testo e tasti.
- Non si riusa il `Modal` per altre guide né si generalizza l'isolamento dei tasti alle altre modali.

## Decisions

### 1. Catalogo in `src/constants/commandModules.ts`

Struttura:

```ts
type CommandAudience = 'all' | 'master' | 'player';
interface CommandEntry { keys: string[]; text: string; audience: CommandAudience }
interface CommandSection { title?: string; entries: CommandEntry[] }
interface CommandModule { id: CommandModuleId; title: string; summary: string; sections: CommandSection[] }

export const COMMAND_MODULES: readonly CommandModule[];
export function commandModulesFor(role: 'master' | 'player'): CommandModule[];
```

`keys` contiene i singoli tasti o gesti, come `['Ctrl', 'trascina']` o `['Spazio']`, resi come `<kbd>`; `text` descrive l'effetto. `commandModulesFor` toglie le voci dell'altro ruolo, poi le sezioni rimaste vuote e infine i moduli rimasti vuoti. L'ordine è quello della spec.

Il modulo non importa JSX né componenti, così il test lo carica con `node --test`.

*Alternative:* lasciare il JSX in `App.tsx` diviso in dieci blocchi. È scartata perché non è testabile, fa crescere `App.tsx` e ripete il filtro per ruolo in ogni blocco. Anche un file Markdown caricato a runtime è scartato: servirebbe un parser e il filtro per ruolo richiederebbe una sintassi propria.

### 2. Tasti d'accesso derivati, non copiati

La riga delle condizioni del modulo Condizioni si costruisce da `CONDITION_ACCESS_KEYS` e dalle etichette già usate dal menu radiale, separando creature e veicoli con `conditionCatalogFor`. `STAND_UP_ACCESS_KEY` e `AURAS_ACCESS_KEY` si spostano da `TokenRadialMenu.tsx` a `src/utils/tokens.ts`, accanto a `CONDITION_ACCESS_KEYS`, e sono importati da entrambi. Aggiungere una condizione o cambiarne il tasto aggiorna così la guida senza un secondo intervento.

Le scorciatoie degli strumenti restano scritte nel catalogo: `TOOL_SHORTCUTS` vive dentro il componente `Board`. Il test fissa quelle cinque lettere, quindi un loro cambio rompe il test e obbliga ad aggiornare la guida. Estrarre `TOOL_SHORTCUTS` toccherebbe `Board.tsx` per un beneficio minore.

### 3. Componente `CommandModules`

Il componente `src/components/CommandModules.tsx` riceve `role` e rende:

- un elenco di pulsanti, uno per modulo, ciascuno con icona `aria-hidden` da `UiIcons`, titolo e riassunto. Sono `button`, non `a`, perché aprono una modale e non navigano;
- un solo `Modal` con `title` pari al titolo del modulo aperto, sezioni con intestazione e voci in una lista `dl` (`dt` con i `kbd`, `dd` con il testo).

Stato locale: `openModuleId` e un `Map` di ref ai pulsanti. `App.tsx` sostituisce il `case 'legend'` con `<CommandModules role={canManageBattleMap ? 'master' : 'player'} />`.

Icone proposte, tutte già presenti: Mappa `MapIcon`, Movimento `DashIcon`, Misura `RulerIcon`, Combattimento `CrossedSwordsIcon`, Dadi `ChatDiceIcon`, Condizioni `BlockIcon`, Aure `SparkIcon`, Punti ferita, Scheda `BookIcon`, Gestione `PlusIcon`. Per i punti ferita si usa l'icona del cuore del menu radiale se è esportata; altrimenti nessuna icona, senza aggiungere asset.

### 4. Fuoco

All'apertura il contenuto della modale porta il fuoco sul proprio primo elemento, un'intestazione nascosta visivamente con `tabIndex={-1}`, in un `useEffect` di montaggio. Lo screen reader legge così il titolo e il contenuto partendo dall'inizio. Alla chiusura, `onClose` azzera `openModuleId` e riporta il fuoco al pulsante del modulo tramite il suo ref.

*Alternativa:* aggiungere a `Modal` le prop `initialFocusRef`/`returnFocusRef`. È un contratto condiviso usato da molte modali. AGENTS.md chiede di cambiarlo solo quando la causa è condivisa, quindi l'adattamento resta locale.

### 5. Tasti isolati mentre la modale è aperta

Mentre `openModuleId` è valorizzato, `CommandModules` registra `window.addEventListener('keydown', handler, true)`. Il gestore chiama `stopImmediatePropagation()` per ogni tasto tranne `Escape` e `Tab`, senza `preventDefault`. La fase di cattura su `window` precede tutti i listener in bubble di `App.tsx`, `Board.tsx` e `Modal`: frecce, WASD, `R`/`P`/`C`/`O`/`L`, `S`, `Canc`, `Spazio` e `Ctrl+Z` non raggiungono la mappa. `Invio` e `Spazio` continuano ad attivare il pulsante di chiusura, perché l'azione predefinita non è annullata. `Escape` passa e chiude la modale tramite `Modal`. Se nello stesso momento è attivo uno strumento o un piano, `Esc` chiude anche quello, coerentemente con il suo significato di annullamento.

*Alternativa:* un blocco globale «modale aperta» controllato da ogni gestore. Toccherebbe tre file condivisi per un'esigenza locale.

### 6. Tab e identificatori

L'etichetta e il nome accessibile diventano «Moduli». L'id interno passa da `legend` a `modules` in `WorkspaceTabId` e `SidebarSectionId`, così `tab-modules` e `panel-modules` non parlano più di legenda. La tab non è persistita, quindi il cambio di id non richiede migrazione. L'icona resta `KeyboardIcon`: `BookIcon` è già usata dal pulsante Manuale.

### 7. Stili

`.command-legend*` è sostituito da `.command-modules*` in `src/styles/index.css`. L'elenco è una colonna di pulsanti a tutta larghezza con titolo e riassunto su due righe, senza troncamento. La modale usa una classe dedicata con `max-width` di circa 40rem, `max-height` di circa 80vh, corpo con `overflow-y: auto` e `overflow-wrap: anywhere` per le righe di tasti. I `kbd` usano il tema scuro esistente.

### 8. Contenuto

Il testo di ogni voce nasce dal codice elencato nel Context, non dalla vecchia legenda. Ogni voce ha un'origine verificabile: una costante, un gestore di tasti, un `aria-label` o un pulsante. Voci della vecchia legenda senza riscontro, come `+` che apre la card Azioni, sono rimosse. La tabella di verifica voce per voce è un task, non un documento a parte.

## Risks / Trade-offs

- [Deriva fra guida e comandi quando una change futura aggiunge un tasto] → Tasti delle condizioni derivati, test sulle lettere degli strumenti e regola in `Docs/ai/frontend/frontend_architecture.md`: chi cambia un comando aggiorna il catalogo nella stessa change.
- [Il listener in cattura blocca anche combinazioni del browser gestite da script] → Non chiama `preventDefault`, quindi le scorciatoie native del browser e l'attivazione dei pulsanti restano intatte; blocca solo i listener JavaScript di pagina.
- [`Escape` attraversa la modale e annulla anche un piano di movimento in corso] → Accettato: `Esc` significa «annulla» ovunque. Un piano annullato non invia richieste.
- [Nomi dei moduli troppo lunghi per il pannello a un quarto di larghezza] → Titoli brevi; il riassunto va a capo invece di essere troncato.

## Migration Plan

Solo frontend, senza dati. Il rilascio è una normale build; il rollback è il revert del commit.
