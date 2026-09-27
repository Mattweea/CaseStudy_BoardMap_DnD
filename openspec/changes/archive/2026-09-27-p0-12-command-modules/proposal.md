## Why

La tab «Legenda dei comandi» è un unico blocco di testo: non si consulta per argomento, alcune righe (il paragrafo del menu delle condizioni) vengono tagliate alla larghezza del pannello e parte del contenuto è superato. Mancano righello `R`, ping `P`, sagome `C`/`O`/`L`, lo spostamento WASD, la pianificazione del percorso con `Spazio`/`Backspace`/click destro e i controlli dell'iniziativa; restano voci che non esistono più, come il tasto `+` che aprirebbe la card Azioni. P0.12 chiede una guida allineata alle interazioni reali e con le differenze fra Player e Master esplicite.

## What Changes

- La tab «Legenda dei comandi» diventa **«Moduli»**: un elenco di moduli tutorial per argomento, ciascuno un link con titolo e riassunto di una riga.
- Attivare un modulo apre una modale centrata con il dettaglio completo del modulo: gesti di mouse, scorciatoie di tastiera e controlli, raggruppati e leggibili senza tagli. `Esc`, il pulsante di chiusura e il click sullo sfondo chiudono la modale e riportano il fuoco al link del modulo.
- Catalogo dei moduli: Mappa e visuale, Movimento, Strumenti di misura, Combattimento e iniziativa, Dadi, Condizioni, Aure, Punti ferita, Scheda personaggio, Gestione della mappa (solo Master).
- Ogni partecipante vede soltanto i comandi comuni e quelli del proprio ruolo. Un modulo che per il ruolo corrente non ha comandi non compare nell'elenco.
- I contenuti sono riscritti a partire dai comandi effettivamente disponibili nel codice; le voci superate vengono tolte.
- Il requisito della legenda nel menu radiale (click destro, `S`, `Shift+F10`, tasti d'accesso, `0`-`6`, `-`/`+`) si sposta nel modulo Condizioni e nei moduli Aure e Punti ferita, senza perdere nessuna delle voci richieste.

Fuori perimetro: `HOWITWORKS.md`, la navigazione migliorata della mappa di P0.12 e qualsiasi modifica ai comandi stessi. La guida descrive i comandi, non li cambia.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- `session-workspace`: la quinta tab si chiama «Moduli»; il requisito «Controlli esistenti e legenda» diventa il requisito della guida a moduli con modale di dettaglio, filtro per ruolo e contenuto allineato ai comandi reali.
- `token-conditions`: il requisito «Menu accessibile da tastiera» rimanda ai moduli Condizioni, Aure e Punti ferita invece che alla «legenda dei comandi», conservando lo stesso elenco di comandi da documentare.

## Impact

- Codice frontend:
  - `src/App.tsx`: etichetta e icona della tab, rendering del `case 'legend'` sostituito dall'elenco dei moduli e dalla modale;
  - nuovo componente dei moduli e catalogo dei contenuti in un modulo dedicato, così il testo non vive dentro `App.tsx`;
  - `src/styles/index.css`: stili dell'elenco e del contenuto della modale, sostituendo `.command-legend*`.
- Riuso del `Modal` esistente; nessun cambio a stato condiviso, server, SSE, persistenza o autorizzazione. Il filtro per ruolo è solo presentazione: nessun comando cambia permessi.
- `FEATURES_VTT.md`: la voce P0.12 della legenda viene spuntata all'archiviazione.
- `Docs/ai`: valutare `frontend_architecture.md` per la regola «il catalogo dei moduli si aggiorna nella stessa change che aggiunge o cambia un comando».
