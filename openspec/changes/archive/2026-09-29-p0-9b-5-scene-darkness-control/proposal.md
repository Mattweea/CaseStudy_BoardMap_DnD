# Proposal

## Why

La nuova interfaccia non rende raggiungibile il controllo legacy del buio, anche se il documento scena conserva già `board.isFullyLit`. Il Master deve poter preparare il comportamento di illuminazione di ogni scena direttamente nel dialog dedicato, prima o dopo la sua attivazione.

## What Changes

- Aggiunge in Preparazione scene un controllo Master per attivare o disattivare il buio della scena selezionata.
- Salva il valore insieme alla configurazione versionata della scena, inclusa una scena inattiva.
- Aggiorna immediatamente la proiezione condivisa quando viene salvata la scena attiva; una scena inattiva applica il proprio valore alla successiva attivazione.
- Mantiene il buio attivo come default compatibile quando il campo non è presente.
- Non introduce fog server-side, nuove sorgenti luminose o nuove regole di visibilità.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- `scene-map-presentation`: aggiunge la configurazione persistente e scene-specific del buio nel dialog di preparazione.

## Impact

- UI e bozza locale di `SceneCatalogPanel`.
- Client API e hook del catalogo scene.
- Validazione della patch scena, persistenza versionata e proiezione realtime della scena attiva.
- Test di route, proiezione, conflitto di versione e comportamento Master/Player.
- Documentazione frontend/backend relativa a configurazione e visibilità della scena.
