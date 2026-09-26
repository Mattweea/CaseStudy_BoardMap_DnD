# Proposal

## Why

Il Master deve correggere le operazioni di disegno senza ampliare la history globale o renderla parte dello stato persistente.

## What Changes

- Aggiunge undo/redo soltanto per add/erase drawing.
- Mantiene stack limitati e isolati per scena.
- Persiste il risultato ma non la cronologia.

## Capabilities

### New Capabilities

- scene-authoring: strumenti Master di preparazione della scena.

### Modified Capabilities

Nessuna.

## Impact

- Nuovo stato service in memoria e controlli Master.
- Nessun cambiamento a history globale, elementi o token.
