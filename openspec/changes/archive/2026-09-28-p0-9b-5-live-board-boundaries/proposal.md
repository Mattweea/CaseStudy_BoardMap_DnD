# Proposal

## Why

Nel dialog di preparazione il Master non vede dove le dimensioni impostate taglieranno la board; la griglia della preview può inoltre deformarsi in rettangoli. Il limite fisso di righe e colonne impedisce di usare la mappa come spazio aperto quando si sceglie `0 × 0`.

## What Changes

- La preview della scena mostra in tempo reale il rettangolo della board definito dai valori in modifica, separando chiaramente l'area inclusa da quella esclusa e mantenendo le celle quadrate.
- `0 × 0` diventa una board logicamente illimitata: il viewport rende soltanto la porzione visibile della griglia e può spostarsi oltre l'immagine, senza ritagliare né estendere artificialmente l'asset.
- Una sola dimensione a zero è rifiutata; le scene esistenti con dimensioni positive conservano il comportamento attuale. I valori in bozza non mutano la scena condivisa fino al salvataggio autorizzato.
- Movimento, misurazione, snapshot, persistenza e normalizzazione riconoscono coerentemente la modalità illimitata, mantenendo i controlli di validità delle coordinate e le regole di gioco esistenti.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- `scene-map-presentation`: preview live, proporzioni della griglia e semantica di `0 × 0` per la board.
- `scene-management`: validazione, salvataggio e compatibilità della configurazione delle dimensioni nelle scene.
- `token-movement-and-measurement`: comportamento di movimento e misurazione sulla board illimitata.

## Impact

Dialog di preparazione e renderer della board React/CSS; geometria e stato condiviso; normalizzazione delle scene; endpoint di modifica e movimento, snapshot HTTP/SSE e persistenza SQLite delle scene. Nessuna nuova dipendenza o migrazione obbligatoria per scene già valide.
