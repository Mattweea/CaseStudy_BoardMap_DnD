# Proposal

## Why

Il party deve poter passare fra scene conservando identità e relazioni senza trasferimenti parziali o duplicazioni.

## What Changes

- Calcola server-side roster token, familiari posseduti e veicoli occupati.
- Separa i token live per scena durante il processo: l'attivazione mostra soltanto il runtime della nuova scena e il ritorno ripristina quello lasciato nella precedente.
- Fornisce preview deterministica da una cella ancora.
- Commette rimozione e inserimento delle entità come operazione atomica.
- Permette al Master di selezionare la scena di destinazione e scegliere fra attivarla soltanto oppure attivarla trasferendo il party, con anteprima e conferma prima di ogni effetto.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- multi-scene-session: isola il runtime live per scena e trasferisce il party tra scene.

## Impact

- Runtime per scena in memoria e pubblicazione atomica del trasferimento; nessuna nuova persistenza del runtime dopo il riavvio.
- Nuovo flusso Master con destinazione selezionata, preview e conferma; l'attivazione ordinaria senza trasferimento resta disponibile.
- Il commit combinato aggiorna il riferimento SQLite alla scena attiva soltanto dopo aver preparato e validato il trasferimento; un fallimento lascia scena attiva e token invariati.
