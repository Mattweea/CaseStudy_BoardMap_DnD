## Why

Durante la sessione il Master vede sempre la mappa illuminata, mentre i Player vedono buio, scurovisione e luci puntuali. Il flag condiviso che illumina tutta la mappa esiste già, ma il relativo comando è nascosto nella GUI corrente. Serve un controllo rapido sulla board per cambiare ciò che vedono i Player.

## What Changes

- La board mostra al Master un pulsante luna/sole che indica lo stato corrente della luce completa e alterna «Mostra luce» e «Mostra buio».
- Il controllo compare anche nella board fullscreen; i Player non lo vedono.
- L'azione riusa `isBoardFullyLit` come proiezione della scena attiva e la PATCH versionata della scena, senza cambiare visibilità dei token invisibili, luci puntuali o formato dello snapshot.

La modifica viene integrata nel branch `feat/p0-9-maps-and-scenes`.

## Capabilities

### Modified Capabilities

- `session-workspace` e `scene-map-presentation`: aggiungono alla board un controllo di luce completa riservato al Master.

## Impact

Frontend: `Board`, `App`, sistema di icone, CSS e contratti della scena. Contratti server e tipi di stato condiviso già esistenti. Regressioni da verificare: visibilità Player, accesso per ruolo, vista fullscreen e controlli zoom.
