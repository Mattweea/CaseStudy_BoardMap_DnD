# Proposal

## Why

Gli elementi devono poter influire su movimento e visuale tramite i sistemi esistenti, senza anticipare il filtraggio server-side di P0.10.

## What Changes

- Aggiunge flag separati blocksMovement e blocksVision.
- Adatta i footprint agli helper correnti senza convertire elementi in token.
- Mantiene la visuale corrente client-side e dichiara il confine P0.10.

## Capabilities

### New Capabilities

- scene-authoring: strumenti Master di preparazione della scena.

### Modified Capabilities

Nessuna.

## Impact

- Integrazione con validazione movimento server e calcolo visuale client.
- Test di regressione su ostacoli e bypass Master esistenti.
