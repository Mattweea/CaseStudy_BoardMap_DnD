# Proposal

## Why

Il ricalco libero dei muri accumula molti punti anche per pareti dritte. Il Master inoltre non ha un riscontro visivo del buio attivato per il party. L'utente ha richiesto il selettore Libero/Segmenti al posto delle coordinate numeriche e un velo semitrasparente esclusivamente per il Master.

## What Changes

- Disegno muri con modalità Libero e Segmenti; rimuovere il form Segmento da tastiera.
- In Segmenti, clic per aggiungere vertici frazionari, anteprima verso il puntatore, Spazio/Invio o pulsante per confermare, Escape per annullare e Backspace per togliere l'ultimo vertice.
- In Libero conservare il ricalco corrente; cambiare modalità o scena scarta la bozza.
- Con buio attivo mostrare al Master un velo nero al 45% sul terreno sconosciuto. Conservare buio opaco e visibilità corrente dei token per i Player.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- `freehand-vision-walls`: selezione della modalità di disegno e conferma delle spezzate.
- `map-darkness`: anteprima semitrasparente del terreno sconosciuto nella vista Master.

## Impact

SceneWallEditor, Board e DarknessLayer; guida comandi e contratti frontend. Riutilizzo delle API versionate e del formato muri esistenti, senza migrazioni o modifiche di autorizzazione. Test geometrici e di interazione, build, docs:check e validazione OpenSpec.
