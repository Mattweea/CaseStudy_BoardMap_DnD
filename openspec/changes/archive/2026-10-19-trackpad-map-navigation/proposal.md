## Why

La mappa è oggi inutilizzabile con un trackpad. Un unico gestore `wheel` sul guscio della board legge solo il **segno** di `deltaY` e applica un passo additivo fisso (`zoomStep: 0.2`) su un intervallo di nove livelli (`minZoom: 0.6`, `maxZoom: 2.2`): uno scroll a due dita produce decine di eventi al secondo, quindi un singolo gesto porta lo zoom a fondo scala. Lo stesso gestore ignora `event.ctrlKey`, con cui il browser segnala il pinch del trackpad, e ignora del tutto `deltaX`, quindi il gesto di navigazione più naturale su un portatile non esiste: lo spostamento della visuale richiede `Ctrl`+trascinamento o il tasto centrale, che su un trackpad sono rispettivamente scomodo e assente.

Due difetti aggravano il problema anche col mouse: lo zoom non è ancorato al puntatore (la camera non viene corretta, quindi il contenuto sotto il cursore scappa) e lo spostamento della visuale è quantizzato a celle intere, quindi avanza a scatti di 48 px invece di seguire il gesto.

## What Changes

- Lo scroll a due dita del trackpad (`wheel` senza `ctrlKey`, con `deltaX` e `deltaY`) sposta la visuale sui due assi. È un gesto nuovo: oggi quell'evento ingrandisce.
- Il pinch a due dita (`wheel` con `ctrlKey`, che il browser sintetizza dal gesto del trackpad) ingrandisce in modo continuo e proporzionale all'ampiezza del gesto, invece del passo fisso attuale.
- Lo zoom diventa **moltiplicativo e ancorato al puntatore**: la cella sotto il dito resta ferma durante il gesto, e la progressione percepita è uniforme a ogni livello di ingrandimento.
- L'intervallo di zoom resta `0.6`–`2.2`: un allargamento a `0.25`–`4` è stato provato e scartato in uso, perché lo zoom-out risultante mostrava molto più tavolo di quello utile. I valori già salvati in `localStorage` restano validi: `readStoredZoom` li ridimensiona con `clampZoom`.
- La rotella del mouse **continua a ingrandire** quando `Ctrl` non è premuto, secondo la convenzione dei VTT e il comportamento odierno; **con `Ctrl` premuto la rotella sposta la visuale in verticale, con `Alt` in orizzontale**. Il client distingue rotella e trackpad dalla forma dell'evento (`deltaMode`, ampiezza e granularità di `deltaY`), indipendentemente da `ctrlKey`. Un delta piccolo in pixel è sempre trackpad, anche se intero e solo verticale, perché i touchpad Precision di Windows emettono delta interi; una rotella ad alta risoluzione a scorrimento libero può quindi spostare la visuale invece di ingrandire.
- Lo spostamento della visuale diventa continuo e frazionario su entrambi i percorsi, gesto del trackpad e trascinamento con `Ctrl` o tasto centrale, che restano invariati come gesti.
- **Nessun gesto di spostamento nuovo oltre a quelli citati.** In particolare la barra spaziatrice, che in Miro, Figma e Canva è il modificatore di pan, resta riservata: è già l'unico gesto di conferma di un movimento pianificato. Anche il trascinamento col tasto destro resta escluso, perché il destro apre il menu radiale del token e annulla un piano in corso.
- I pulsanti `+` e `−` passano al medesimo passo moltiplicativo, così che tastiera, pulsanti e gesto raggiungano gli stessi livelli.

Non è un cambio **BREAKING**: nessun contratto condiviso, nessun endpoint e nessuno snapshot cambiano, e ogni gesto esistente continua a fare quello che fa oggi.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- `session-workspace`: il requisito «Zoom e interazioni col mouse della mappa» oggi prescrive soltanto «lo spostamento della visuale con Ctrl+trascinamento o tasto centrale» e che «Wheel input controls zoom». Il delta aggiunge i gesti del trackpad, l'ancoraggio dello zoom al puntatore, la continuità dello spostamento e la riserva esplicita della barra spaziatrice.

## Impact

Il cambio è interamente client-local e non tocca né il server né lo stato condiviso: `zoom` è una preferenza locale persistita in `localStorage` (`src/hooks/useBattleMapState.ts`), e `camera` è `useState` interno a `Board`. Nessun partecipante può spostare la visuale di un altro, invariante che `token-movement-and-measurement` già impone al ping e che questo cambio non sfiora.

Codice interessato:

- `src/components/Board.tsx`: il gestore `wheel`, l'interazione `pan`, `clampCamera`, il margine di celle calcolato dal `ResizeObserver` e i pulsanti di zoom.
- `src/utils/board.ts`: `viewportPointToWorldCell` arrotonda la cella **prima** di sommare la camera, quindi con una camera frazionaria restituirebbe una cella frazionaria. È la correzione centrale del cambio, perché quella funzione converte il puntatore in cella per selezione, pianificazione del movimento, sagome, ping e piazzamento ostacoli.
- `src/constants/board.ts`: limiti e passo di zoom. `panStep: 6` risulta dichiarato e non usato da nessuno.
- `src/constants/commandModules.ts`: il catalogo dei comandi in-app elenca i gesti di mappa e va aggiornato nello stesso cambio, come impone la convenzione del router frontend.
- `Docs/ai/frontend/board_interaction_and_visibility.md`: il sistema di coordinate e la sezione sui gesti dichiarano oggi lo spostamento a celle intere.

Superficie di regressione principale: le ~20 conversioni mondo→schermo in `Board.tsx` sono lineari e indifferenti a una camera frazionaria, ma ogni funzione che converte nella direzione opposta va verificata. Sono in gioco il piazzamento dei token, l'origine delle sagome, il ping, la selezione ad area e la griglia di visibilità.
