# Proposal

## Why

Le griglie disegnate nelle immagini degli utenti devono poter coincidere con la griglia applicativa già presente.

## What Changes

- Aggiunge preview sulla griglia esistente.
- Permette di calibrare e persistere scala immagine, offset X e offset Y.
- Mantiene immagine e griglia nella stessa catena di pan/zoom.

## Capabilities

### New Capabilities

- scene-map-presentation: presentazione della scena sulla board esistente.

### Modified Capabilities

Nessuna.

## Impact

- Nuovi campi di calibrazione nel background scena.
- Integrazione nel rendering Board esistente, senza nuovo canvas o libreria.
