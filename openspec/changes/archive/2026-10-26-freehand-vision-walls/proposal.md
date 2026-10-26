## Why

Il Master deve poter usare l'immagine di una mappa come sfondo e ripassarne i muri con un gesto simile alla matita. I tratti devono diventare barriere alla luce e alla visuale, non semplici disegni decorativi.

## What Changes

- Strumento Master «Disegna muri» nella preview della mappa in Preparazione scena, coerente con il flusso della matita esistente.
- Tracciati liberi precisi rispetto allo sfondo, anche diagonali o curvi, senza obbligo di aggancio a celle intere.
- Muri bidirezionali che bloccano luce e visuale/scurovisione, distinti da drawing, elementi e token.
- Cancellazione selettiva, undo/redo dedicati, salvataggio per scena e aggiornamento realtime della scena attiva.
- Integrazione con memoria esplorata e bordi sfumati senza cancellare il terreno già ricordato o far filtrare visione oltre le barriere.

## Capabilities

### New Capabilities

- `freehand-vision-walls`: tracciamento e gestione di muri come occlusori persistenti della scena.

### Modified Capabilities

Nessuna modifica dei canonici durante Propose. Il layer muri è distinto dal drawing: il contratto di undo del drawing continua ad agire solo sui suoi tratti.

## Impact

Editor della scena, modello/schema versionato e proiezione, routes e repository, geometria condivisa di visione/luci/esplorazione, SSE e test. Nessun riconoscimento automatico della foto, nessuna importazione esterna, porte o blocco del movimento richiesti da questo change.

## Stato

Proposta sul branch feat/master-creatures-and-dice-workflow derivato da test. Documentazione operativa e contratti Docs/ai saranno aggiornati insieme all'implementazione; non si cambia ora la descrizione del comportamento corrente.
