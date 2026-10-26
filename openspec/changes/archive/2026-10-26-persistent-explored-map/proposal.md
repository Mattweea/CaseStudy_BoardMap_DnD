## Why

In una mappa buia, il corridoio già percorso torna nascosto quando il PG si allontana. Il gruppo deve poter riconoscere il terreno già esplorato e ripercorrere la strada senza perdere la conoscenza della mappa.

## What Changes

- Conservare per scena le zone legittimamente scoperte dai PG lungo i movimenti confermati, comprese le posizioni intermedie del percorso.
- Lasciare visibile il terreno esplorato anche dopo l'allontanamento: il corridoio percorso non torna nero.
- Condividere la conoscenza della mappa fra i membri del party (default proposto), conservandola a riconnessione, cambio scena e riavvio.
- Tenere distinta la memoria del terreno dalla visione attuale: questa memoria non accende una sorgente luminosa e non rivela creature fuori visuale o token nascosti dal Master.
- Coordinare la proposta con [opaque-map-darkness](../2026-10-26-opaque-map-darkness/proposal.md): soltanto le zone non esplorate e non attualmente visibili restano nero pieno.

## Capabilities

### New Capabilities

- `explored-map-memory`: memoria persistente, condivisa e distinta per scena del terreno esplorato.

### Modified Capabilities

Nessuna modifica ai requisiti canonici della configurazione del buio: il flag per scena mantiene il proprio significato. La nuova capability estende la presentazione e introduce un confine di persistenza specifico per la memoria, senza promettere recovery completo del runtime.

## Impact

Frontend board/maschera e visione, geometria condivisa, movimento autorevole e percorsi, normalizzazione, SSE e isolamento scena, SQLite e lifecycle. Aggiornare i relativi contratti Docs/ai insieme all'implementazione. Nessun codice applicativo modificato in fase Propose.

## Stato e scelte proposte

Proposta da rivedere sul branch `feat/master-creatures-and-dice-workflow`, derivato da `test`. Default: memoria comune del party e limitata al terreno; non una cronologia separata per ogni PG. Dipendenza funzionale da `opaque-map-darkness` per la resa delle zone ancora sconosciute.
