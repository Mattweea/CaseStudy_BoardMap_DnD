# Proposal

## Why

La scena deve fornire i dati necessari alla griglia e alla misura esistenti, non creare un secondo sistema di unità o movimento.

## What Changes

- Rende dimensioni e measurementUnit proprietà della scena attiva.
- Mantiene righello, sagome, percorso, costi e validazione sotto la capability esistente.
- Cambia scala atomicamente insieme alla scena.

## Capabilities

### New Capabilities

- scene-map-presentation: presentazione della scena sulla board esistente.

### Modified Capabilities

- token-movement-and-measurement: l'unità canonica viene letta dalla scena attiva senza duplicare la logica di misura.

## Impact

- Adattamento dei contratti condivisi e dei normalizzatori.
- Test di regressione su misura e movimento.
