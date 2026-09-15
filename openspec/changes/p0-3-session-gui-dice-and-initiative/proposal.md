## Why

La sessione usa oggi una sidebar a sinistra con sezioni eterogenee, lasciando la mappa sulla destra. P0.3 stabilisce la GUI di gioco prima dell'arrivo delle schede: dà priorità alla mappa, rende raggiungibili dadi, turni, personaggi e comandi, e definisce tiri condivisi o segreti senza affidare il risultato al browser.

## What Changes

- Spostare il pannello di sessione a destra, richiudibile, con mappa centrale a sinistra (circa 75%/25% su desktop) e quattro tab: Chat + Dadi, Turni di iniziativa, Personaggi e Legenda dei comandi. Mantenere sulla mappa i pulsanti Zoom in/out, lo spostamento della visuale col mouse e il trascinamento dei token consentiti; nascondere dalla GUI i controlli di sessione e Master non richiesti, senza eliminarne il codice. Offrire un layout utilizzabile su schermi stretti.
- Offrire tiri liberi dai controlli a click integrati in basso nel pannello, disponibili anche cambiando tab, e dal comando `/r 1d20+5`, con validazione, calcolo sul server e log. La reference 2 ispira la scelta dei dadi; il pulsante di tiro apre una modale compatta nella sola superficie della mappa per modificatore con segno, modalità e visibilità. I tiri pubblici sono visibili a tutti; quelli segreti solo all'autore e al Master, anche tramite HTTP e SSE.
- Mostrare il tracker esistente in ordine decrescente, evidenziare il turno e avvisare il Player una volta per transizione con «Sei il prossimo!» e «Tocca a te!». Mostrare nella tab Personaggi il roster e il collegamento ai token.
- Riutilizzare la legenda esistente e documentare il comando di tiro. La chat testuale in tempo reale resta in P2.6 e occuperà lo spazio sopra i controlli dei dadi; schede e tiri dalla scheda sono P0.4/P0.5, mentre il nuovo calcolo e inserimento di iniziativa è P0.7.

## Capabilities

### New Capabilities

- `session-workspace`: composizione della GUI, quattro tab, roster, controlli esistenti e adattamento responsive.
- `session-dice-rolling`: tiro libero da click o comando, calcolo autorevole e visibilità del log.
- `initiative-presentation`: lettura dell'ordine esistente, indicazione del turno e avvisi al Player.

### Modified Capabilities

Nessuna: le specifiche esistenti su login/ruoli e base SQLite restano valide.

## Impact

Frontend React (`src/App.tsx`, componenti dadi/iniziativa, `src/styles/index.css`, hook e tipi condivisi), API Fastify e snapshot/SSE in `server/index.mjs`. I tiri richiedono un contratto di richiesta basato su formula o parametri, un log associato all'utente autenticato e proiezioni dei dati per destinatario. Nessuna scheda personaggio o chat testuale è richiesta in questo change.
