# Proposal

## Why

Il party deve poter passare fra scene conservando identità e relazioni senza trasferimenti parziali o duplicazioni.

## What Changes

- Calcola server-side roster token, familiari posseduti e veicoli occupati.
- Fornisce preview deterministica da una cella ancora.
- Commette rimozione e inserimento delle entità come operazione atomica.

## Capabilities

### New Capabilities

- multi-scene-session: comportamento realtime e operativo fra scene.

### Modified Capabilities

Nessuna.

## Impact

- Service transazionale su due scene.
- Nuovo flusso Master di preview e conferma.
