# Proposal

## Why

Il Master deve preparare sulla scena le entità di un encounter distinguendole dagli arredi e rappresentandone visibilità senza anticipare P0.10.

## What Changes

- Aggiunge placement collegati a encounter ed entity.
- Riusa Board e trasformazioni token per posizione/preparazione.
- Applica lo stato nascosto corrente ma non promette segretezza server-side completa.

## Capabilities

### New Capabilities

- encounter-management: configurazione e preparazione degli encounter associati alle scene.

### Modified Capabilities

Nessuna.

## Impact

- Nuova collezione placement nel documento scena.
- Adapter stabile fra placement preparato e UnitToken runtime.
