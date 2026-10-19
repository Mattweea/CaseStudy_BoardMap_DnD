# Proposal

## Why

Il Master deve costruire battle map semplici con arredi riutilizzabili senza convertirli in token o dipendere da librerie esterne.

## What Changes

- Aggiunge una piccola libreria locale di elementi scenici.
- Supporta add, select, move, resize, rotate e remove nel dialog Preparazione scena; la board live mostra soltanto il risultato confermato.
- Mantiene modello, layer e controlli separati dai token.

## Capabilities

### Modified Capabilities

- scene-authoring: aggiunge la preparazione degli elementi scenici alla capability esistente.

## Impact

- Nuova collezione scene elements, strumenti nel dialog e layer di sola visualizzazione sulla Board.
- Asset iniziali esclusivamente locali e approvati nel repository.
