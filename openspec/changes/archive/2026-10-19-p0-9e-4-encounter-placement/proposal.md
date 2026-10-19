# Proposal

## Why

Il Master deve preparare sulla scena le entità di un encounter distinguendole dagli arredi e rappresentandone visibilità senza anticipare P0.10.

## What Changes

- Aggiunge placement collegati a encounter ed entity.
- Riusa Board e trasformazioni token per posizione/preparazione.
- Per istanze già collocate, riconcilia solo le proprietà iniziali cambiate dall'authoring; la definizione senza placement non crea token.
- Applica lo stato nascosto corrente ma non promette segretezza server-side completa.

## Capabilities

### New Capabilities

Nessuna.

### Modified Capabilities

- encounter-management: aggiunge collocazione e preparazione posizionale alla capability esistente.

## Impact

- Nuova collezione placement nel documento scena.
- Adapter stabile fra placement preparato e UnitToken runtime.
