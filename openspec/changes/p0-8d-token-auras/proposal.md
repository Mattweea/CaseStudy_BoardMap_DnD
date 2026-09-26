## Why

Oggi le aure sono cerchi disegnati dal centro del token, configurabili solo dalla modale di modifica, che da `p0-8c` non si apre più: nessuno può crearne, accenderne o spegnerne una. Un giocatore non ha nemmeno un modo per sapere di trovarsi dentro l'aura di un alleato, e se ne dimentica proprio al momento del tiro. P0.8 (sezione in `FEATURES_VTT.md`) chiede aure definite nella scheda, accese dal token e segnalate a chi ci entra, senza automatizzarne gli effetti.

## What Changes

- **Definizione nella scheda:** una nuova sezione «Aure» nella tab `Personaggio e combattimento`, con più aure per personaggio. Ogni aura ha nome, descrizione, effetto, raggio, colore e stato acceso/spento. Il raggio si inserisce nell'unità di misura della partita e si conserva in caselle. Niente preset e nessun modello precompilato.
- **Proiezione sul token:** la scheda resta privata, quindi il server proietta sul token canonico del personaggio solo nome, effetto, raggio, colore e stato di ogni aura, mai la descrizione. Il campo `auras` del token diventa di sola lettura: il server lo ricalcola dalla scheda a ogni normalizzazione e ignora quello inviato da un client. **BREAKING** per le aure legacy configurate dalla modale (anche sui nemici), che vengono scartate, e per il vecchio formato `{ radiusCells, isVisible, color }`.
- **Accensione dal menu radiale:** una voce «Aure» apre l'elenco delle aure del personaggio come interruttori, per il proprietario e il Master. Un nuovo endpoint applica l'interruttore come patch della scheda. Nessuno spegnimento automatico.
- **Area secondo la griglia del PHB:** ogni casella costa 1, diagonali comprese, sempre, anche se il Master ha scelto la variante 5-10-5 per il movimento. L'area è quindi il rettangolo di caselle che si ottiene allargando l'ingombro del token del raggio su ogni lato. Un token è dentro se almeno una sua casella cade nell'area.
- **Visibilità:** le aure accese sono visibili a tutti. Il flag `isVisible` sparisce. Un'aura segue la visibilità del proprio token: chi non riceve il token nascosto dal Master non riceve né l'area né l'avviso.
- **Avviso persistente** in alto al centro per chi ha un token dentro un'aura accesa di un altro personaggio: una riga per aura, espandibile per leggere l'effetto, che nomina il famiglio quando è lui dentro. Il proprietario non riceve l'avviso della propria aura e il Master non riceve avvisi.
- **Fuori ambito:** destinatari (alleati, nemici), promemoria nei tiri o nel log, avvisi di immunità, sospensione automatica.

## Capabilities

### New Capabilities

- `token-auras`: definizione delle aure nella scheda, proiezione sul token e compatibilità con gli snapshot, interruttore autorizzato, area secondo la griglia del PHB, visibilità e sanitizzazione, avviso persistente di presenza.

### Modified Capabilities

- `token-conditions`: il menu radiale guadagna la voce «Aure» con il suo pannello e il suo tasto d'accesso, e la legenda dei comandi la elenca.

## Impact

- **Codice condiviso:** un nuovo modulo `shared/token-auras.mjs` con palette, limiti, area e verifica di presenza, usato da client e server.
- **Scheda:**
  - `server/character-sheet-schema.mjs`: nuova collezione `auras` con validazione;
  - `server/character-sheet-service.mjs`: proiezione delle operazioni sulle aure;
  - `CharacterTab.tsx`, `RowEditor.tsx`, `rowDefaults.ts`: sezione ed editor dedicato.

  Nessuna migrazione SQLite: il documento è JSON e la normalizzazione aggiunge la collezione vuota.
- **Server (`server/index.mjs`):**
  - normalizzazione di `auras` derivata dalla scheda collegata;
  - nuovo endpoint `POST /api/battle-map/token-auras`;
  - `updateOwnedToken` e il commit a stato pieno ignorano `auras`.
- **Client:**
  - `src/types/index.ts` (nuovo `TokenAura`);
  - `useBattleMapState.ts` (mutazione con aggiornamento ottimistico);
  - `Board.tsx` (area rettangolare al posto del cerchio);
  - `TokenRadialMenu.tsx` (voce e pannello «Aure»);
  - un nuovo avviso di presenza montato da `App.tsx`, anche a schermo intero;
  - `ElementModals.tsx` (tolta la sezione delle aure dalla modale nascosta);
  - legenda dei comandi.
- **Documentazione:**
  - `Docs/ai/gameplay/token_and_vehicle_rules.md`;
  - `Docs/ai/backend/shared_state_and_persistence.md`;
  - `Docs/ai/backend/character_sheet_service_and_realtime.md`;
  - `Docs/ai/frontend/board_interaction_and_visibility.md`;
  - `Docs/ai/frontend/character_sheet_client_and_window.md`;
  - la sezione P0.8 di `FEATURES_VTT.md`.
- **Fuori da questa change:**
  - aure dei mostri, aure ancorate a un punto e aure a cono (P0.9);
  - aura proiettata da un token dentro un veicolo;
  - HP (`p0-8b`).
